'use client'

// RealtimeView: tampilan permainan multiplayer realtime (Supabase).
// - Menampilkan countdown sebelum pertandingan dimulai.
// - TopBar = leaderboard pemain nyata (dari presence/broadcast host).
// - TreePanel membaca state pemain SAYA dari snapshot host (getMyState).
// - Input pemain dikirim ke host lewat sendInput/sendRotate.
// - ResultView muncul saat host menyatakan pertandingan selesai.

import { useCallback, useEffect, useState } from 'react'
import { useRealtimeRoom } from '@/hooks/useRealtimeRoom'
import { MIN_PLAYERS_TO_START, PLAYERS_PER_ROOM } from '@/lib/constants'
import TreePanel from './TreePanel'
import TimerBar from './TimerBar'
import TopBar from './TopBar'
import ResultView from './ResultView'

interface RealtimeViewProps {
  roomCode: string
  playerName: string
}

export default function RealtimeView({ roomCode, playerName }: RealtimeViewProps) {
  const {
    rows,
    myId,
    phase,
    countdown,
    winnerId,
    players,
    hostId,
    isHost,
    connState,
    error,
    humanCount,
    botCount,
    hasBotInRoom,
    myBotVote,
    botVoteYes,
    botKickIn,
    sendInput,
    sendRotate,
    sendReady,
    sendBotVote,
    sendRemoveBot,
    startMatch,
    getMyState,
  } = useRealtimeRoom(roomCode, playerName)

  const [feedback, setFeedback] = useState<string | null>(null)

  // Pesan status tombol Mulai.
  function getStartHint(count: number, allReady: boolean): string {
    if (count < MIN_PLAYERS_TO_START)
      return `Butuh ${MIN_PLAYERS_TO_START - count} pemain lagi untuk mulai`
    if (!allReady) return 'Semua pemain harus siap'
    return 'Mulai!'
  }

  const me = rows.find((r) => r.isMe)
  const amIAlive = me?.alive ?? true

  const handleStrike = useCallback(
    (side: 'left' | 'right') => {
      sendInput(side)
    },
    [sendInput]
  )

  const handleRotate = useCallback(
    (dir: 'left' | 'right') => {
      sendRotate(dir)
    },
    [sendRotate]
  )

  // getState untuk TreePanel: ubah PlayerNet -> bentuk yang dibutuhkan.
  const treeState = useCallback(() => {
    const s = getMyState()
    return {
      rotation: s?.rotation ?? 0,
      fragileSide: s?.fragileSide ?? 0,
      fragileHalf: (s?.fragileHalf ?? 0) as 0 | 1,
      hits: s?.hits ?? 0,
      phase: s?.phase ?? 'over',
      transitionElapsed: s?.transitionElapsed ?? 0,
    }
  }, [getMyState])

  // ---- Input keyboard khusus Windows ----
  // A = geser kiri, D = geser kanan, J = pukul kiri, L = pukul kanan.
  // Hanya aktif saat layar bermain agar tidak mengganggu lobby/result.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return // abaikan auto-repeat saat tombol ditahan
      if (phase !== 'playing') return
      // Jangan tangkap saat pengguna sedang mengetik di input.
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return
      }
      switch (e.key) {
        case 'a':
        case 'A':
          e.preventDefault()
          sendRotate('left')
          break
        case 'd':
        case 'D':
          e.preventDefault()
          sendRotate('right')
          break
        case 'j':
        case 'J':
          e.preventDefault()
          sendInput('left')
          break
        case 'l':
        case 'L':
          e.preventDefault()
          sendInput('right')
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, sendInput, sendRotate])

  // ---- Layar koneksi ----
  if (connState === 'connecting') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4">
        <div className="text-2xl font-extrabold text-bark-dark">
          Menghubungkan ke room…
        </div>
        <div className="text-sm font-bold text-ink/70">Room {roomCode.toUpperCase()}</div>
      </div>
    )
  }

  if (connState === 'error' || error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4">
        <div className="text-2xl font-extrabold text-danger">Koneksi Gagal</div>
        <div className="text-sm font-bold text-ink/70">{error ?? 'Terjadi kesalahan.'}</div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 rounded-xl border-4 border-ink bg-leaf px-6 py-3 text-lg font-extrabold text-white shadow-[0_4px_0_#2b1d0e] active:translate-y-1 active:shadow-none"
        >
          Coba Lagi
        </button>
      </div>
    )
  }

  // ---- Layar lobby (antrian): siap per pemain + tombol Mulai (host) ----
  if (phase === 'lobby') {
    const amIReady = players.find((p) => p.id === myId)?.ready ?? false
    const allReady = players.length > 0 && players.every((p) => p.ready)
    const enoughPlayers = players.length >= MIN_PLAYERS_TO_START
    const canStart = enoughPlayers && allReady

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <div className="text-center">
          <div className="text-3xl font-extrabold text-bark-dark">Ruang Tunggu</div>
          <div className="text-sm font-bold text-ink/60">
            Room {roomCode.toUpperCase()} • {players.length}/{PLAYERS_PER_ROOM} pemain
          </div>
        </div>

        {/* Daftar pemain + status siap */}
        <div className="w-full max-w-md rounded-3xl border-4 border-ink bg-white/90 p-5 shadow-xl">
          <h2 className="mb-3 text-center text-lg font-extrabold text-bark-dark">
            Pemain ({players.length})
          </h2>
          <ul className="space-y-2">
            {players.map((p) => {
              const isMe = p.id === myId
              const isHostPlayer = p.id === hostId
              return (
                <li
                  key={p.id}
                  className={`flex items-center justify-between rounded-xl border-2 px-3 py-2 ${
                    isMe ? 'border-leaf bg-leaf/10' : 'border-ink/20 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {isMe ? '👤 ' : ''}
                      <span className="font-extrabold text-ink">
                        {p.name}
                        {isMe ? ' (Anda)' : ''}
                      </span>
                    </span>
                    {isHostPlayer && (
                      <span className="rounded-full bg-sun px-2 py-0.5 text-xs font-extrabold text-ink">
                        Host
                      </span>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
                      p.ready ? 'bg-leaf text-white' : 'bg-ink/10 text-ink/60'
                    }`}
                  >
                    {p.ready ? 'Siap ✓' : 'Menunggu…'}
                  </span>
                </li>
              )
            })}
          </ul>

          {/* Peringatan join saat room ada bot */}
          {botKickIn !== null && botKickIn > 0 && (
            <div className="mt-3 rounded-xl border-2 border-danger/40 bg-danger/10 px-3 py-2 text-center text-xs font-bold text-danger">
              Room ini memiliki BOT! Dalam {Math.ceil(botKickIn)} detik bot akan dikeluarkan
              karena ruang tidak cukup.
            </div>
          )}

          {/* Vote tambah bot (selama masih ada kursi kosong) */}
          {phase === 'lobby' && players.length < PLAYERS_PER_ROOM && (
            <div className="mt-4 rounded-xl border-2 border-ink/20 bg-white px-3 py-3">
              <div className="mb-2 text-center text-sm font-extrabold text-ink">
                Tambah Bot untuk mengisi room?
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => sendBotVote(true)}
                  className={`rounded-lg border-2 border-ink px-3 py-1.5 text-sm font-extrabold ${
                    myBotVote ? 'bg-leaf text-white' : 'bg-white'
                  }`}
                >
                  Setuju {botVoteYes > 0 ? `(${botVoteYes}/${humanCount})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => sendBotVote(false)}
                  className="rounded-lg border-2 border-ink bg-white px-3 py-1.5 text-sm font-extrabold"
                >
                  Batal
                </button>
              </div>
              <div className="mt-2 text-center text-xs font-bold text-ink/60">
                {myBotVote ? 'Anda setuju menambah bot' : 'Semua pemain asli harus setuju'}
              </div>
            </div>
          )}

          {/* Kelola bot (host bisa menghapus, pemain bisa minta hapus) */}
          {hasBotInRoom && phase === 'lobby' && (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => sendRemoveBot()}
                className="rounded-lg border-2 border-ink bg-white px-3 py-1.5 text-sm font-extrabold"
              >
                Keluarkan Bot Terakhir
              </button>
            </div>
          )}

          {/* Tombol Siap (semua pemain) */}
          <button
            type="button"
            onClick={() => sendReady(!amIReady)}
            className={`mt-4 w-full rounded-xl border-4 border-ink px-4 py-3 text-lg font-extrabold shadow-[0_4px_0_#2b1d0e] active:translate-y-1 active:shadow-none ${
              amIReady ? 'bg-sun text-ink' : 'bg-leaf text-white'
            }`}
          >
            {amIReady ? 'Batal Siap' : 'Saya Siap'}
          </button>

          {/* Tombol Mulai (host saja) */}
          {isHost && (
            <button
              type="button"
              onClick={startMatch}
              disabled={!canStart}
              className="mt-3 w-full rounded-xl border-4 border-ink bg-leaf px-4 py-3 text-lg font-extrabold text-white shadow-[0_4px_0_#2b1d0e] disabled:opacity-50 active:translate-y-1 active:shadow-none"
            >
              {canStart ? 'Mulai!' : getStartHint(players.length, allReady)}
            </button>
          )}

          {!isHost && (
            <div className="mt-3 text-center text-sm font-bold text-ink/60">
              {canStart
                ? 'Menunggu host memulai…'
                : getStartHint(players.length, allReady)}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---- Layar countdown ----
  if (phase === 'countdown') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <TopBar players={rows} myId={myId} />
        <div className="text-6xl font-extrabold text-bark-dark">
          {Math.ceil(countdown)}
        </div>
        <div className="text-lg font-bold text-ink">Bersiap…</div>
        <div className="text-sm font-bold text-ink/60">
          {rows.length}/{4} pemain • {isHost ? 'Host' : 'Klien'}
        </div>
      </div>
    )
  }

  // ---- Layar hasil ----
  if (phase === 'result') {
    return (
      <ResultView
        players={rows.map((p) => ({
          id: p.id,
          name: p.name,
          score: p.score,
          rank: p.rank,
          isMe: p.isMe,
        }))}
        myRank={me?.rank ?? 0}
        onRestart={() => window.location.reload()}
      />
    )
  }

  // ---- Layar bermain ----
  // Layout: Kiri = batang pohon vertikal (tinggi penuh), Kanan = sidebar (leaderboard).
  return (
    <div className="flex min-h-screen p-4">
      {/* BATANG POHON (KIRI) — tinggi layar penuh */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 min-w-0">
        {me && (
          <div className="text-center text-sm font-bold text-ink">
            Pohon #{me.treeIndex} • Skor {me.score}
          </div>
        )}

        <TimerBar timeLeft={me?.timeLeft ?? 0} maxTime={me?.maxTime ?? 30} />

        <div className="relative min-h-[420px] w-full flex-1">
          <TreePanel getState={treeState} onStrike={handleStrike} onRotate={handleRotate} />
        </div>

        {/* Petunjuk kontrol keyboard (khusus Windows) */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-bold text-ink/60">
          <span>
            <kbd className="rounded border-2 border-ink/40 bg-white px-1.5 py-0.5 text-ink">A</kbd>{' '}
            <kbd className="rounded border-2 border-ink/40 bg-white px-1.5 py-0.5 text-ink">D</kbd>{' '}
            Geser
          </span>
          <span>
            <kbd className="rounded border-2 border-ink/40 bg-white px-1.5 py-0.5 text-ink">J</kbd>{' '}
            <kbd className="rounded border-2 border-ink/40 bg-white px-1.5 py-0.5 text-ink">L</kbd>{' '}
            Pukul
          </span>
        </div>

        <div className="h-8">
          {feedback && (
            <span className="animate-pulse text-2xl font-extrabold text-danger">
              {feedback}
            </span>
          )}
        </div>

        {!amIAlive && (
          <div className="mt-2 text-center">
            <div className="text-2xl font-extrabold text-danger">TERELIMINASI!</div>
            <div className="text-sm font-bold text-ink/70">
              Menonton {rows.filter((r) => r.alive).length} pemain tersisa…
            </div>
          </div>
        )}
      </div>

      {/* SIDEBAR LEADERBOARD (KANAN) */}
      <div className="ml-4 w-64 flex-shrink-0 border-l-4 border-ink/20 pl-4">
        <TopBar players={rows} myId={myId} vertical />
      </div>
    </div>
  )
}