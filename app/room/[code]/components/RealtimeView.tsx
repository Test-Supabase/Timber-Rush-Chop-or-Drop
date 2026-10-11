'use client'

// RealtimeView: tampilan permainan multiplayer realtime (Supabase).
// - Menampilkan countdown sebelum pertandingan dimulai.
// - TopBar = leaderboard pemain nyata (dari presence/broadcast host).
// - TreePanel membaca state pemain SAYA dari snapshot host (getMyState).
// - Input pemain dikirim ke host lewat sendInput/sendRotate.
// - ResultView muncul saat host menyatakan pertandingan selesai.

import { useCallback, useState } from 'react'
import { useRealtimeRoom } from '@/hooks/useRealtimeRoom'
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
    isHost,
    connState,
    error,
    sendInput,
    sendRotate,
    getMyState,
  } = useRealtimeRoom(roomCode, playerName)

  const [feedback, setFeedback] = useState<string | null>(null)

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
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <TopBar players={rows} myId={myId} />

      <div className="flex w-full max-w-4xl flex-col items-center justify-center gap-4">
        {me && (
          <div className="text-center text-sm font-bold text-ink">
            Pohon #{me.treeIndex} • Skor {me.score}
          </div>
        )}

        <TimerBar timeLeft={me?.timeLeft ?? 0} maxTime={me?.maxTime ?? 30} />

        <div className="relative">
          <TreePanel getState={treeState} onStrike={handleStrike} onRotate={handleRotate} />
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
    </div>
  )
}