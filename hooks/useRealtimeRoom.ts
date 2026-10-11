'use client'

// ============================================================
// useRealtimeRoom — multiplayer REALTIME via Supabase.
//
// Arsitektur: HOST-AUTHORITATIVE (satu klien jadi "host/simulator").
//  - Host menjalankan simulasi game (update timestep tetap) untuk SEMUA
//    pemain, lalu menyiarkan snapshot state ke klien lain.
//  - Klien non-host hanya mengirim INPUT (pukul/putar/siap/vote) dan
//    menampilkan snapshot terbaru yang diterima.
//  - Host dipilih deterministik = userId terkecil (lexicographic) di antara
//    presence yang aktif. Bila host keluar, host baru terpilih otomatis.
//  - Lobby: semua pemain harus menekan "Siap"; host menekan "Mulai".
//  - BOT: pemain asli bisa vote "Tambah Bot"; bila SEMUA pemain asli setuju,
//    host menambahkan bot ke room (mengisi kursi kosong).
//
// Catatan penting:
//  - Kanal Supabase HANYA SATU per kode room; semua .on() dipanggil sebelum
//    .subscribe().
//  - Semua callback disimpan di ref agar tidak menangkap closure basi.
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
  SIDES,
  NET_TICK_HZ,
  NET_BROADCAST_MS,
  NET_COUNTDOWN_MS,
  HEARTBEAT_MS,
  ROOM_STALE_SECONDS,
  BOT_NAMES,
  BOT_JOIN_WARNING_MS,
  AI_REACT_MIN,
  AI_REACT_MAX,
  AI_ACCURACY,
} from '@/lib/constants'
import { roomHeartbeat } from '@/lib/rooms'

// ---------- Tipe data wire (dikirim lewat broadcast) ----------

/** Snapshot lengkap satu pemain (dikirim host -> klien). */
export interface PlayerNet {
  id: string
  name: string
  ready: boolean
  isBot: boolean
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
  // Suara "Tambah Bot" per pemain asli (playerId -> setuju?).
  botVotes: Record<string, boolean>
  // Peringatan bot menyingkir (detik tersisa), null bila tidak ada.
  botKickIn: number | null
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
  isBot: boolean
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
  | { kind: 'voteBot'; playerId: string; add: boolean }
  | { kind: 'removeBot' }

// ID klien acak (tanpa auth). Cukup unik per browser/tab.
function randomId(): string {
  return Math.random().toString(36).slice(2, 11)
}

let botSeq = 0
function newBotId(): string {
  botSeq += 1
  return `bot-${botSeq}-${randomId()}`
}

function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

// Ubah PlayerState (internal) -> PlayerNet (wire).
function toNet(p: PlayerState, id: string, name: string, ready: boolean, isBot: boolean): PlayerNet {
  return {
    id,
    name,
    ready,
    isBot,
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

export function useRealtimeRoom(roomCode: string, playerName: string) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const myIdRef = useRef<string>(randomId())

  const [room, setRoom] = useState<RoomNet>({
    hostId: '',
    phase: 'lobby',
    countdown: NET_COUNTDOWN_MS / 1000,
    winnerId: null,
    players: [],
    botVotes: {},
    botKickIn: null,
  })
  const [isHost, setIsHost] = useState(false)
  const [connState, setConnState] = useState<'connecting' | 'connected' | 'error'>(
    'connecting'
  )
  const [error, setError] = useState<string | null>(null)

  // ---- Ref simulasi (hanya dipakai host) ----
  const hostStateRef = useRef<Map<string, PlayerState>>(new Map())
  const hostNameRef = useRef<Map<string, string>>(new Map())
  const hostIsBotRef = useRef<Map<string, boolean>>(new Map()) // status bot per pemain
  const readyRef = useRef<Map<string, boolean>>(new Map()) // status "Siap" per pemain
  const aiTimerRef = useRef<Map<string, number>>(new Map()) // jeda aksi bot berikutnya
  const orderRef = useRef<string[]>([]) // urutan pemain = urutan leaderboard stabil
  const queueRef = useRef<QueueItem[]>([])
  const phaseRef = useRef<'lobby' | 'countdown' | 'playing' | 'result'>('lobby')
  const countdownRef = useRef(NET_COUNTDOWN_MS / 1000)
  const winnerRef = useRef<string | null>(null)
  const hostIdRef = useRef<string>('')

  // Vote tambah bot per pemain asli (true = setuju).
  const botVotesRef = useRef<Map<string, boolean>>(new Map())
  // Sisa detik peringatan sebelum bot menyingkir untuk pemain baru (null = tidak ada).
  const botKickRef = useRef<number | null>(null)

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
        toNet(
          st,
          id,
          hostNameRef.current.get(id) ?? 'Pemain',
          readyRef.current.get(id) ?? false,
          hostIsBotRef.current.get(id) ?? false
        )
      )
    }
    return {
      hostId: hostIdRef.current,
      phase: phaseRef.current,
      countdown: countdownRef.current,
      winnerId: winnerRef.current,
      players,
      botVotes: Object.fromEntries(botVotesRef.current),
      botKickIn: botKickRef.current,
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

  // ---- Bot: tambah satu bot bila kursi masih ada ----
  const addBot = useCallback(() => {
    if (orderRef.current.length >= PLAYERS_PER_ROOM) return
    const usedNames = new Set(hostNameRef.current.values())
    const name = BOT_NAMES.find((n) => !usedNames.has(n)) ?? `Bot ${botSeq + 1}`
    const id = newBotId()
    hostStateRef.current.set(id, createPlayerState())
    hostNameRef.current.set(id, name)
    hostIsBotRef.current.set(id, true)
    readyRef.current.set(id, true) // bot selalu siap
    aiTimerRef.current.set(id, randFloat(AI_REACT_MIN, AI_REACT_MAX))
    orderRef.current.push(id)
  }, [])

  // ---- Bot: hapus bot terakhir (selalu sisakan minimal 1 bot saat ada vote) ----
  const removeOneBot = useCallback(() => {
    for (let i = orderRef.current.length - 1; i >= 0; i--) {
      const id = orderRef.current[i]
      if (hostIsBotRef.current.get(id)) {
        orderRef.current = orderRef.current.filter((x) => x !== id)
        hostStateRef.current.delete(id)
        hostNameRef.current.delete(id)
        hostIsBotRef.current.delete(id)
        readyRef.current.delete(id)
        aiTimerRef.current.delete(id)
        return
      }
    }
  }, [])

  // ---- Vote bot: bila SEMUA pemain asli setuju dan ada kursi kosong,
  //      tambahkan satu bot lalu reset suara (perlu vote lagi untuk bot berikutnya).
  const tallyBotVotes = useCallback(() => {
    if (phaseRef.current !== 'lobby') return
    const humanIds = orderRef.current.filter((id) => !hostIsBotRef.current.get(id))
    if (humanIds.length === 0) return
    const allAgree = humanIds.every((id) => botVotesRef.current.get(id) === true)
    if (allAgree && orderRef.current.length < PLAYERS_PER_ROOM) {
      addBot()
      botVotesRef.current.clear()
    }
  }, [addBot])

  // ---- Peringatan bot menyingkir: saat timer habis, bot dilepas bila room penuh ----
  const tickBotKick = useCallback(
    (dt: number) => {
      if (botKickRef.current === null) return
      botKickRef.current -= dt
      if (botKickRef.current > 0) return
      botKickRef.current = null
      while (orderRef.current.length > PLAYERS_PER_ROOM && removeOneBot()) {
        // terus lepas bot sampai muat
      }
    },
    [removeOneBot]
  )

  // ---- Terapkan input ke state host ----
  const applyQueue = useCallback(() => {
    const q = queueRef.current
    queueRef.current = []
    for (const item of q) {
      if (item.kind === 'ready') {
        readyRef.current.set(item.playerId, item.ready)
        continue
      }
      if (item.kind === 'voteBot') {
        if (hostIsBotRef.current.get(item.playerId)) continue // bot tidak vote
        botVotesRef.current.set(item.playerId, item.add)
        tallyBotVotes()
        continue
      }
      if (item.kind === 'removeBot') {
        removeOneBot()
        continue
      }
      const st = hostStateRef.current.get(item.playerId)
      if (!st) continue
      if (item.kind === 'strike') strike(st, item.side)
      else if (item.kind === 'rotate') rotate(st, item.dir)
    }
  }, [tallyBotVotes, removeOneBot])

  // ---- AI bot: putar ke sisi rapuh lalu pukul (dengan akurasi) ----
  const runBotAi = useCallback((id: string, st: PlayerState, dt: number) => {
    let t = aiTimerRef.current.get(id) ?? 0
    t -= dt
    if (t > 0) {
      aiTimerRef.current.set(id, t)
      return
    }
    aiTimerRef.current.set(id, randFloat(AI_REACT_MIN, AI_REACT_MAX))

    if (st.phase !== 'playing') return
    if (st.rotation !== st.fragileSide) {
      const steps = (st.fragileSide - st.rotation + SIDES) % SIDES
      rotate(st, steps <= SIDES / 2 ? 'right' : 'left')
      return
    }
    const correctSide: HitSide = st.fragileHalf === 0 ? 'left' : 'right'
    const wrongSide: HitSide = correctSide === 'left' ? 'right' : 'left'
    strike(st, Math.random() < AI_ACCURACY ? correctSide : wrongSide)
  }, [])

  // ---- Langkah simulasi host ----
  const hostStep = useCallback((dt: number) => {
    tickBotKick(dt)

    // Fase lobby: tidak ada simulasi; proses input (siap/vote) lalu tunggu mulai.
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
        if (hostIsBotRef.current.get(id)) runBotAi(id, st, dt)
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
  }, [applyQueue, runBotAi, tickBotKick])

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

    // Kapasitas room (hanya pemain asli yang dihitung dari presence).
    if (liveIds.length > PLAYERS_PER_ROOM) {
      setError('Room penuh (maksimum ' + PLAYERS_PER_ROOM + ' pemain).')
    }

    // Pilih host = userId terkecil. Selalu sinkron (host lama pun setuju).
    const newHostId = liveIds[0] ?? ''
    hostIdRef.current = newHostId
    const iAmHost = newHostId === myIdRef.current
    setIsHost(iAmHost)

    if (iAmHost) {
      // Pemain asli baru masuk ke room yang berisi bot -> beri peringatan 5 dtk.
      const newHuman = liveIds.some((id) => !hostStateRef.current.has(id))
      const hasBotNow = orderRef.current.some((id) => hostIsBotRef.current.get(id))
      if (newHuman && hasBotNow) botKickRef.current = BOT_JOIN_WARNING_MS / 1000

      // Tambah pemain asli baru; hapus yang sudah pergi (bot TIDAK dihapus di sini).
      for (const id of liveIds) {
        if (!hostStateRef.current.has(id)) {
          hostStateRef.current.set(id, createPlayerState())
          hostNameRef.current.set(id, byId.get(id)?.name ?? 'Pemain')
          hostIsBotRef.current.set(id, false)
          readyRef.current.set(id, false) // default belum siap
          orderRef.current.push(id)
        } else {
          hostNameRef.current.set(id, byId.get(id)?.name ?? 'Pemain')
        }
      }
      for (const id of [...orderRef.current]) {
        if (hostIsBotRef.current.get(id)) continue // biarkan bot
        if (!byId.has(id)) {
          orderRef.current = orderRef.current.filter((x) => x !== id)
          hostStateRef.current.delete(id)
          hostNameRef.current.delete(id)
          readyRef.current.delete(id)
          botVotesRef.current.delete(id)
        }
      }
      // Sinkron ulang vote bot setelah keanggotaan berubah.
      tallyBotVotes()
      broadcastRoom()
    }
  }, [broadcastRoom, tallyBotVotes])

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
      } else if (payload.kind === 'voteBot' && typeof payload.add === 'boolean') {
        queueRef.current.push({ kind: 'voteBot', playerId: payload.playerId, add: payload.add })
      } else if (payload.kind === 'removeBot') {
        queueRef.current.push({ kind: 'removeBot' })
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

  // ---- Heartbeat: pastikan room tercatat "hidup" bila ada klien aktif ----
  //  - Menulis status pemain asli & bot ke DB.
  //  - Membersihkan room yang tak lagi di-heartbeat (tanpa pemain asli).
  useEffect(() => {
    let stop = false
    const beat = async () => {
      try {
        const r = latestRef.current
        // Jumlah pemain asli menurut snapshot; bila belum ada, minimal 1
        // (klien ini sendiri sedang aktif).
        const humans = r
          ? Math.max(1, r.players.filter((p) => !p.isBot).length)
          : 1
        const hasBot = r ? r.players.some((p) => p.isBot) : false
        await roomHeartbeat(roomCode, humans, hasBot, ROOM_STALE_SECONDS)
      } catch {
        // Abaikan; heartbeat dicoba lagi di interval berikutnya.
      }
      if (!stop) window.setTimeout(beat, HEARTBEAT_MS)
    }
    void beat()
    return () => {
      stop = true
    }
  }, [roomCode])

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
    if (getIsHost()) {
      queueRef.current.push({ kind: 'strike', playerId: myIdRef.current, side })
      return
    }
    const ch = channelRef.current
    if (!ch) return
    ch.send({
      type: 'broadcast',
      event: 'input',
      payload: { kind: 'strike', playerId: myIdRef.current, side },
    }).catch(() => {})
  }, [getIsHost])

  const sendRotate = useCallback((dir: 'left' | 'right') => {
    if (getIsHost()) {
      queueRef.current.push({ kind: 'rotate', playerId: myIdRef.current, dir })
      return
    }
    const ch = channelRef.current
    if (!ch) return
    ch.send({
      type: 'broadcast',
      event: 'input',
      payload: { kind: 'rotate', playerId: myIdRef.current, dir },
    }).catch(() => {})
  }, [getIsHost])

  // ---- Aksi lobby: siap / mulai / vote bot ----
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

  // Vote tambah bot (setuju = true, batal = false). Berlaku di lobby.
  const sendBotVote = useCallback((add: boolean) => {
    if (getIsHost()) {
      queueRef.current.push({ kind: 'voteBot', playerId: myIdRef.current, add })
      return
    }
    const ch = channelRef.current
    if (!ch) return
    ch.send({
      type: 'broadcast',
      event: 'input',
      payload: { kind: 'voteBot', playerId: myIdRef.current, add },
    }).catch(() => {})
  }, [getIsHost])

  // Lepas bot terakhir secara langsung (tanpa vote), hanya di lobby.
  const sendRemoveBot = useCallback(() => {
    if (getIsHost()) {
      queueRef.current.push({ kind: 'removeBot' })
      return
    }
    const ch = channelRef.current
    if (!ch) return
    ch.send({ type: 'broadcast', event: 'input', payload: { kind: 'removeBot' } }).catch(() => {})
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

  // ---- Snapshot state pemain lain (untuk mode tonton / spectator) ----
  const getPlayerState = useCallback((id: string): PlayerNet | null => {
    const r = latestRef.current
    if (!r) return null
    return r.players.find((p) => p.id === id) ?? null
  }, [])

  // ---- Baris leaderboard (diturunkan dari snapshot) ----
  const rows: RealtimeRow[] = room.players
    .map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
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

  // Jumlah pemain asli & bot (untuk UI lobby & panel vote).
  const humanCount = room.players.filter((p) => !p.isBot).length
  const botCount = room.players.filter((p) => p.isBot).length
  const hasBotInRoom = botCount > 0
  // Suara "Tambah Bot" (dari snapshot agar semua klien melihat progres).
  const myBotVote = room.botVotes[myIdRef.current] === true
  // Berapa pemain asli yang sudah setuju.
  const botVoteYes = room.players.filter((p) => !p.isBot && room.botVotes[p.id] === true).length

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
    humanCount,
    botCount,
    hasBotInRoom,
    myBotVote,
    botVoteYes,
    botKickIn: room.botKickIn,
    sendInput,
    sendRotate,
    sendReady,
    sendBotVote,
    sendRemoveBot,
    startMatch,
    getMyState,
    getPlayerState,
  }
}