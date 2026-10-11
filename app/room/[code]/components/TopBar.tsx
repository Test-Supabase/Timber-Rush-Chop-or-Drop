'use client'

// TopBar: leaderboard real-time 3 pemain teratas saat bermain.
// Format: nama | skor | timer (warna merah bila < 3 detik).
import { TIMER_LOW_THRESHOLD } from '@/lib/constants'

interface Player {
  id: string
  name: string
  score: number
  timeLeft: number
  alive: boolean
}

interface TopBarProps {
  players: Player[]
  myId: string
  vertical?: boolean // layout baru: sidebar kanan (vertical list)
}

export default function TopBar({ players, myId, vertical }: TopBarProps) {
  // Sort by alive first, score desc, timeLeft desc. Ambil 3 teratas.
  const top3 = [...players]
    .sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1
      if (a.score !== b.score) return b.score - a.score
      return b.timeLeft - a.timeLeft
    })
    .slice(0, 3)

  if (top3.length === 0) return null

  // Icon mahkota untuk pemain #1.
  const leader = top3[0]

  // Layout horizontal (default): header + 3 pemain teratas (desktop)
  if (!vertical) {
    return (
      <div className="w-full mb-4 rounded-xl border-4 border-ink bg-white/95 p-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-extrabold text-bark-dark">
            <span className="text-2xl">👑</span>
            <span>{leader.name}</span>
          </div>
          <div className="flex gap-6">
            {top3.map((player, index) => {
              const isMe = player.id === myId
              const lowTime = player.timeLeft < TIMER_LOW_THRESHOLD
              return (
                <div
                  key={player.id}
                  className={`flex flex-col items-center gap-1 ${
                    isMe ? 'font-extrabold' : 'font-bold'
                  } ${
                    !player.alive
                      ? 'text-ink/40 line-through'
                      : lowTime
                        ? 'text-danger animate-pulse'
                        : 'text-ink'
                  }`}
                >
                  <span className="text-sm">
                    {index + 1}. {player.name}{isMe ? ' (Anda)' : ''}
                  </span>
                  <span className="text-xs">
                    {player.score} • {player.timeLeft.toFixed(1)}s
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Layout vertical (sidebar): semua pemain dengan urutan rank (mobile/desktop)
  const sortedPlayers = [...players]
    .sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1
      if (a.score !== b.score) return b.score - a.score
      return b.timeLeft - a.timeLeft
    })

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="text-center text-lg font-extrabold text-bark-dark mb-3">
        <span className="text-2xl">🏆</span> Leaderboard
      </div>
      {sortedPlayers.map((player, index) => {
        const isMe = player.id === myId
        const lowTime = player.timeLeft < TIMER_LOW_THRESHOLD
        const leaderIcon = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`
        return (
          <div
            key={player.id}
            className={`flex items-center gap-3 rounded-xl p-3 border-2 ${
              isMe
                ? 'border-ink bg-leaf/10 font-extrabold'
                : 'border-ink/30 bg-white'
            } ${
              !player.alive
                ? 'text-ink/40 line-through'
                : lowTime
                  ? 'text-danger animate-pulse'
                  : 'text-ink'
            }`}
          >
            <div className="flex-shrink-0 text-xl font-bold w-8 text-center">
              {leaderIcon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">
                {player.name}{isMe ? ' (Anda)' : ''}
                {!player.alive && <span className="text-ink/60 ml-2">Eliminasi</span>}
              </div>
              <div className="text-xs text-ink/60">
                Skor: {player.score} • {player.timeLeft.toFixed(1)}s
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}