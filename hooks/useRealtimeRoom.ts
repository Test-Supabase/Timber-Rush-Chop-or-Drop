'use client'

// ============================================================
// useRealtimeRoom — multiplayer REALTIME via Supabase.
//
// Arsitektur: HOST-AUTHORITATIVE (satu klien jadi "host/simulator").
//  - Host menjalankan simulasi game (update timestep tetap) untuk SEMUA
//    pemain, lalu menyiarkan snapshot state ke klien lain.
//  - Klien non-host hanya mengirim INPUT (pukul/putar) dan menampilkan
//    snapshot terbaru yang diterima. Tidak ada simulasi di klien non-host
//    agar tidak terjadi desync.
//  - Host dipilih deterministik = userId terkecil (lexicographic) di antara
//    presence yang aktif. Bila host keluar, host baru terpilih otomatis.
//  - Match berjalan otomatis saat >= 2 pemain hadir; timer mulai dari
//    COUNTDOWN_MS. Pemain yang join belakangan ikut masuk (join in progress).
//
// Catatan penting:
//  - Kanal Supabase TIDAK boleh dipakai lintas hook. Kita buat SATU kanal
//    dan panggil semua .on() sebelum .subscribe().
//  - Semua callback disimpan di ref (lihat callbackRef) agar tidak menangkap
//    closure basi; kanal hanya dibuat sekali per kode room.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  createPlayerState,
  update as updatePlayer,
  rotate,
  strike,
  type PlayerState,
  type HitSide,
} from '@/lib/gameState'
import {
  PLAYERS_PER_ROOM,
  MIN_PLAYERS_TO_START,
  NET_TICK_HZ,
  NET_BROADCAST_MS,
  NET_COUNTDOWN_MS,
} from '@/lib/constants'

// ---------- Tipe data wire (dikirim lewat broadcast) ----------

/** Snapshot lengkap satu pemain (dikirim host -> klien). */
export interface PlayerNet {
  id: string
  name: string
  ready: boolean
  rotation: number
  fragileSide: number
  fragileHalf: 0 | 1
  hits: number
  treeIndex: number
  maxTime: number
  timeLeft: number
  score: number
  swingCooldown: number
  phase: 'playing' | 'transition' | 'over'
  transitionElapsed: number
}

/** Snapshot ruangan (dikirim host -> klien). */
interface RoomNet {
  hostId: string
  phase: 'lobby' | 'countdown' | 'playing' | 'result'
  countdown: number // sisa detik countdown
  winnerId: string | null
  players: PlayerNet[]
}

/** Payload presence tiap klien. */
interface PresenceMeta {
  userId: string
  name: string
}

/** Baris ringan untuk leaderboard UI. */
export interface RealtimeRow {
  id: string
  name: string
  score: number
  timeLeft: number
  maxTime: number
  treeIndex: number
  alive: boolean
  isMe: boolean
  rank: number
}

type QueueItem =
  | { kind: 'strike'; playerId: string; side: HitSide }
  | { kind: 'rotate'; playerId: string; dir: 'left' | 'right' }
  | { kind: 'ready'; playerId: string; ready: boolean }

// ID klien acak (tanpa auth). Cukup unik per browser/tab.
function randomId(): string {
  return Math.random().toString(36).slice(2, 11)
}

// Ubah PlayerState (internal) -> PlayerNet (wire).
function toNet(p: PlayerState, id: string, name: string, ready: boolean): PlayerNet {
  return {
    id,
    name,
    ready,
    rotation: p.rotation,
    fragileSide: p.fragileSide,
    fragileHalf: p.fragileHalf,
    hits: p.hits,
    treeIndex: p.treeIndex,
    maxTime: p.maxTime,
    timeLeft: p.timeLeft,
    score: p.score,
    swingCooldown: p.swingCooldown,
    phase: p.phase,
    transitionElapsed: p.transitionElapsed,
  }
}

// Ubah PlayerNet (wire) -> PlayerState (internal) — hanya untuk TreePanel.
function toPlayerState(n: PlayerNet): PlayerState {
  return {
    rotation: n.rotation,
    fragileSide: n.fragileSide,
    fragileHalf: n.fragileHalf,
    hits: n.hits,
    treeIndex: n.treeIndex,
    maxTime: n.maxTime,
    timeLeft: n.timeLeft,
    score: n.score,
    swingCooldown: n.swingCooldown,
    phase: n.phase,
    transitionElapsed: n.transitionElapsed,
  }
}

export function useRealtimeRoom(roomCode: string, playerName: string) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const myIdRef = useRef<string>(randomId())

  const [room, setRoom] = useState<RoomNet>({
    hostId: '',
    phase: 'lobby',
    countdown: NET_COUNTDOWN_MS / 1000,
    winnerId: null,
    players: [],
  })
  const [isHost, setIsHost] = useState(false)
  const [connState, setConnState] = useState<'connecting' | 'connected' | 'error'>(
    'connecting'
  )
  const [error, setError] = useState<string | null>(null)

  // ---- Ref simulasi (hanya dipakai host) ----
  const hostStateRef = useRef<Map<string, PlayerState>>(new Map())
  const hostNameRef = useRef<Map<string, string>>(new Map())
  const readyRef = useRef<Map<string, boolean>>(new Map()) // status "Siap" per pemain
  const orderRef = useRef<string[]>([]) // urutan pemain = urutan leaderboard stabil
  const queueRef = useRef<QueueItem[]>([])
  const phaseRef = useRef<'lobby' | 'countdown' | 'playing' | 'result'>('lobby')
  const countdownRef = useRef(NET_COUNTDOWN_MS / 1000)
  const winnerRef = useRef<string | null>(null)
  const hostIdRef = useRef<string>('')

  // ---- Ref klien (snapshot terakhir dari host) ----
  const latestRef = useRef<RoomNet | null>(null)

  // Semua handler diletakkan di ref agar tidak "stale" di dalam kanal.
  const handlersRef = useRef({
    onPresenceSync: () => {},
  })
  const getIsHost = useCallback(() => hostIdRef.current === myIdRef.current, [])

  const publishRoom = useCallback((r: RoomNet) => {
    latestRef.current = r
    setRoom(r)
  }, [])

  // ---- Snapshot host saat ini ----
  const buildHostRoom = useCallback((): RoomNet => {
    const players: PlayerNet[] = []
    for (const id of orderRef.current) {
      const st = hostStateRef.current.get(id)
      if (!st) continue
      players.push(
        toNet(st, id, hostNameRef.current.get(id) ?? 'Pemain', readyRef.current.get(id) ?? false)
      )
    }
    return {
      hostId: hostIdRef.current,
      phase: phaseRef.current,
      countdown: countdownRef.current,
      winnerId: winnerRef.current,
      players,
    }
  }, [])

  const broadcastRoom = useCallback(() => {
    const snapshot = buildHostRoom()
    // Host juga harus memperbarui tampilannya sendiri: kanal memakai
    // self:false sehingga host tidak menerima siarannya sendiri.
    publishRoom(snapshot)
    const ch = channelRef.current
    if (!ch) return
    ch.send({ type: 'broadcast', event: 'room', payload: snapshot }).catch(() => {})
  }, [buildHostRoom, publishRoom])

  // ---- Terapkan input ke state host ----
  const applyQueue = useCallback(() => {
    const q = queueRef.current
    queueRef.current = []
    for (const item of q) {
      if (item.kind === 'ready') {
        readyRef.current.set(item.playerId, item.ready)
        continue
      }
      const st = hostStateRef.current.get(item.playerId)
      if (!st) continue
      if (item.kind === 'strike') strike(st, item.side)
      else rotate(st, item.dir)
    }
  }, [])

  // ---- Langkah simulasi host ----
  const hostStep = useCallback((dt: number) => {
    // Fase lobby: tidak ada simulasi; hanya proses input "siap" lalu tunggu host memulai.
    if (phaseRef.current === 'lobby') {
      applyQueue()
      return
    }
    // Fase countdown: tunggu lalu mulai.
    if (phaseRef.current === 'countdown') {
      countdownRef.current = Math.max(0, countdownRef.current - dt)
      if (countdownRef.current <= 0) {
        phaseRef.current = 'playing'
      }
      return
    }
    if (phaseRef.current !== 'playing') return

    applyQueue()

    const alive: string[] = []
    for (const id of orderRef.current) {
      const st = hostStateRef.current.get(id)
      if (!st) continue
      if (st.phase !== 'over') {
        updatePlayer(st, dt)
        // Baca ulang fase setelah update (TS tidak melacak mutasi).
        if ((st.phase as string) !== 'over') alive.push(id)
      }
    }

    // Match berakhir bila tinggal <= 1 pemain hidup.
    if (alive.length <= 1) {
      winnerRef.current = alive.length === 1 ? alive[0] : null
      phaseRef.current = 'result'
    }
  }, [applyQueue])

  // ---- Presence: sinkron daftar pemain & tentukan host ----
  const onPresenceSync = useCallback(() => {
    const ch = channelRef.current
    if (!ch) return
    const state = ch.presenceState() as Record<string, Array<PresenceMeta & { presence_ref: string }>>
    const metas: PresenceMeta[] = []
    for (const key of Object.keys(state)) {
      const arr = state[key]
      if (arr && arr.length > 0) {
        metas.push({ userId: arr[0].userId, name: arr[0].name })
      }
    }
    // Dedup by userId (ambil kemunculan pertama).
    const byId = new Map<string, PresenceMeta>()
    for (const m of metas) if (!byId.has(m.userId)) byId.set(m.userId, m)

    const liveIds = [...byId.keys()].sort() // deterministik

    // Kapasitas room.
    if (liveIds.length > PLAYERS_PER_ROOM) {
      setError('Room penuh (maksimum ' + PLAYERS_PER_ROOM + ' pemain).')
    }

    // Pilih host = userId terkecil. Selalu sinkron (host lama pun setuju).
    const newHostId = liveIds[0] ?? ''
    hostIdRef.current = newHostId
    const iAmHost = newHostId === myIdRef.current
    setIsHost(iAmHost)

    if (iAmHost) {
      // Tambah pemain baru; hapus yang sudah pergi.
      for (const id of liveIds) {
        if (!hostStateRef.current.has(id)) {
          hostStateRef.current.set(id, createPlayerState())
          hostNameRef.current.set(id, byId.get(id)?.name ?? 'Pemain')
          readyRef.current.set(id, false) // default belum siap
          orderRef.current.push(id)
        } else {
          hostNameRef.current.set(id, byId.get(id)?.name ?? 'Pemain')
        }
      }
      for (const id of [...orderRef.current]) {
        if (!byId.has(id)) {
          orderRef.current = orderRef.current.filter((x) => x !== id)
          hostStateRef.current.delete(id)
          hostNameRef.current.delete(id)
          readyRef.current.delete(id)
        }
      }
      broadcastRoom()
    }
  }, [broadcastRoom])

  handlersRef.current.onPresenceSync = onPresenceSync

  // ---- Buat kanal Realtime (sekali per roomCode) ----
  useEffect(() => {
    const ch = supabase.channel(`room:${roomCode}`, {
      config: {
        broadcast: { self: false },
        presence: { key: myIdRef.current },
      },
    })

    ch.on('presence', { event: 'sync' }, () => handlersRef.current.onPresenceSync())

    // Terima input dari klien lain (hanya host yang memproses).
    ch.on('broadcast', { event: 'input' }, ({ payload }: { payload: any }) => {
      if (!getIsHost()) return
      if (!payload?.playerId) return
      if (payload.kind === 'ready' && typeof payload.ready === 'boolean') {
        queueRef.current.push({ kind: 'ready', playerId: payload.playerId, ready: payload.ready })
      } else if (payload.kind === 'strike' && payload.side) {
        queueRef.current.push({ kind: 'strike', playerId: payload.playerId, side: payload.side })
      } else if (payload.kind === 'rotate' && payload.dir) {
        queueRef.current.push({ kind: 'rotate', playerId: payload.playerId, dir: payload.dir })
      }
    })

    // Terima snapshot dari host (diabaikan bila kita host sendiri).
    ch.on('broadcast', { event: 'room' }, ({ payload }: { payload: any }) => {
      if (getIsHost()) return
      if (!payload) return
      publishRoom(payload as RoomNet)
    })

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setConnState('connected')
        await ch.track({ userId: myIdRef.current, name: playerName })
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnState('error')
        setError('Koneksi realtime gagal. Periksa jaringan/konfigurasi Supabase.')
      }
    })

    channelRef.current = ch

    return () => {
      channelRef.current = null
      supabase.removeChannel(ch)
    }
  }, [roomCode, playerName, getIsHost, publishRoom])

  // ---- Loop simulasi host + penyiaran berkala ----
  useEffect(() => {
    let raf = 0
    let last = 0
    let accumulator = 0
    let lastBroadcast = 0
    const fixedDt = 1 / NET_TICK_HZ

    const frame = (now: number) => {
      if (!last) last = now
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.25) dt = 0.25 // hindari lompatan setelah tab tidak aktif

      if (getIsHost()) {
        accumulator += dt
        let guard = 0
        while (accumulator >= fixedDt && guard < 60) {
          hostStep(fixedDt)
          accumulator -= fixedDt
          guard++
        }
        if (now - lastBroadcast >= NET_BROADCAST_MS) {
          lastBroadcast = now
          broadcastRoom()
        }
      } else {
        accumulator = 0
      }

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [getIsHost, hostStep, broadcastRoom])

  // ---- Aksi lokal (dikirim sebagai input) ----
  // Bila kita host, kanal memakai self:false sehingga input kita TIDAK
  // kembali ke diri sendiri — jadi kita antrikan langsung ke queueRef.
  const sendInput = useCallback((side: HitSide) => {
    const payload = { kind: 'strike', playerId: myIdRef.current, side }
    if (getIsHost()) {
      queueRef.current.push({ kind: 'strike', playerId: myIdRef.current, side })
      return
    }
    const ch = channelRef.current
    if (!ch) return
    ch.send({ type: 'broadcast', event: 'input', payload }).catch(() => {})
  }, [getIsHost])

  const sendRotate = useCallback((dir: 'left' | 'right') => {
    const payload = { kind: 'rotate', playerId: myIdRef.current, dir }
    if (getIsHost()) {
      queueRef.current.push({ kind: 'rotate', playerId: myIdRef.current, dir })
      return
    }
    const ch = channelRef.current
    if (!ch) return
    ch.send({ type: 'broadcast', event: 'input', payload }).catch(() => {})
  }, [getIsHost])

  // ---- Aksi lobby: siap / mulai ----
  // Siap: setiap pemain (termasuk host) menekan "Siap" sendiri.
  const sendReady = useCallback((ready: boolean) => {
    if (getIsHost()) {
      queueRef.current.push({ kind: 'ready', playerId: myIdRef.current, ready })
      return
    }
    const ch = channelRef.current
    if (!ch) return
    ch.send({
      type: 'broadcast',
      event: 'input',
      payload: { kind: 'ready', playerId: myIdRef.current, ready },
    }).catch(() => {})
  }, [getIsHost])

  // Mulai: hanya host, hanya bila >= MIN_PLAYERS_TO_START dan semua sudah siap.
  const startMatch = useCallback(() => {
    if (!getIsHost()) return
    if (phaseRef.current !== 'lobby') return
    applyQueue() // pastikan input "siap" terbaru sudah diterapkan
    const ids = orderRef.current
    if (ids.length < MIN_PLAYERS_TO_START) return
    if (!ids.every((id) => readyRef.current.get(id))) return
    phaseRef.current = 'countdown'
    countdownRef.current = NET_COUNTDOWN_MS / 1000
    broadcastRoom()
  }, [getIsHost, applyQueue, broadcastRoom])

  // ---- Snapshot state pemain SAYA (untuk TreePanel), dari ref tanpa re-render ----
  const getMyState = useCallback((): PlayerNet | null => {
    const r = latestRef.current
    if (!r) return null
    return r.players.find((p) => p.id === myIdRef.current) ?? null
  }, [])

  // ---- Baris leaderboard (diturunkan dari snapshot) ----
  const rows: RealtimeRow[] = room.players
    .map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      timeLeft: p.timeLeft,
      maxTime: p.maxTime,
      treeIndex: p.treeIndex,
      alive: p.phase !== 'over',
      isMe: p.id === myIdRef.current,
      rank: 0,
    }))
    .sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1
      if (a.score !== b.score) return b.score - a.score
      return b.timeLeft - a.timeLeft
    })
    .map((r, i) => ({ ...r, rank: i + 1 }))

  return {
    rows,
    myId: myIdRef.current,
    players: room.players,
    phase: room.phase,
    countdown: room.countdown,
    winnerId: room.winnerId,
    hostId: room.hostId,
    isHost,
    connState,
    error,
    sendInput,
    sendRotate,
    sendReady,
    startMatch,
    getMyState,
  }
}