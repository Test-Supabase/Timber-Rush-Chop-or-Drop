'use client'

// TopBar: leaderboard ringkas berupa kotak nama pemain yang naik/turun
// otomatis mengikuti poin (disusun ulang + animasi transisi posisi).
// Bila `canWatch` aktif (pemain sudah tereliminasi), nama tiap pemain lain
// bisa diklik untuk menonton (spektator) permainannya.
import { useMemo } from 'react'
import { TIMER_LOW_THRESHOLD } from '@/lib/constants'

interface Player {
  id: string
  name: string
  score: number
  timeLeft: number
  alive: boolean
  /** Opsional: true bila pemain ini bot (ditampilkan dengan ikon 🤖). */
  isBot?: boolean
}

interface TopBarProps {
  players: Player[]
  myId: string
  vertical?: boolean // dipertahankan untuk kompatibilitas
  /** Aktif saat pemain yang bersangkutan sudah tereliminasi (boleh menonton). */
  canWatch?: boolean
  /** Id pemain yang sedang ditonton (null = kembali ke tampilan sendiri). */
  watchingId?: string | null
  /** Dipanggil saat nama pemain diklik untuk ditonton. */
  onWatch?: (id: string) => void
}

// Tinggi tiap kotak pemain (px) + jarak antar kotak.
const ROW_HEIGHT = 34
const ROW_GAP = 6

export default function TopBar({
  players,
  myId,
  canWatch = false,
  watchingId = null,
  onWatch,
}: TopBarProps) {
  // Urutkan: hidup dulu, lalu skor tertinggi, lalu sisa waktu terbanyak.
  const sorted = useMemo(() => {
    return [...players].sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1
      if (a.score !== b.score) return b.score - a.score
      return b.timeLeft - a.timeLeft
    })
  }, [players])

  if (sorted.length === 0) return null

  const totalHeight = sorted.length * ROW_HEIGHT + (sorted.length - 1) * ROW_GAP

  return (
    <div className="w-full">
      <div className="mb-2 text-center text-xs font-extrabold uppercase tracking-wider text-bark-dark">
        🏆 Papan Skor
      </div>

      {/* Kontainer relatif: tiap kotak diposisikan absolut agar transisi mulus. */}
      <div className="relative w-full" style={{ height: `${totalHeight}px` }}>
        {sorted.map((player, index) => {
          const isMe = player.id === myId
          const lowTime = player.timeLeft < TIMER_LOW_THRESHOLD
          const medal =
            index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`
          // Pemain ini boleh ditonton: kita sudah tereliminasi & ini bukan diri kita.
          const watchable = canWatch && !isMe
          const isWatched = watchingId === player.id

          return (
            <div
              key={player.id}
              className="absolute inset-x-0"
              style={{
                top: `${index * (ROW_HEIGHT + ROW_GAP)}px`,
                height: `${ROW_HEIGHT}px`,
                // Animasi naik/turun saat peringkat berubah.
                transition: 'top 350ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <div
                className={`flex h-full w-full items-center gap-1.5 rounded-lg border-2 px-2 ${
                  isWatched
                    ? 'border-sun bg-sun/25'
                    : isMe
                      ? 'border-leaf bg-leaf/15'
                      : !player.alive
                        ? 'border-ink/20 bg-white/70'
                        : 'border-ink/25 bg-white'
                } ${
                  !player.alive
                    ? 'text-ink/40'
                    : lowTime
                      ? 'text-danger animate-pulse'
                      : 'text-ink'
                }`}
              >
                <span className="w-5 flex-shrink-0 text-center text-sm">{medal}</span>
                <div className="min-w-0 flex-1">
                  {watchable ? (
                    <button
                      type="button"
                      onClick={() => onWatch?.(player.id)}
                      title={isWatched ? 'Berhenti menonton' : 'Tonton pemain ini'}
                      className={`flex w-full items-center gap-1 truncate text-left text-xs ${
                        isMe ? 'font-extrabold' : 'font-bold'
                      } ${!player.alive ? 'line-through' : ''} ${
                        isWatched ? 'text-bark-dark' : ''
                      } hover:underline`}
                    >
                      {/* Ikon mata: tampil/permanen sebagai penanda bisa ditonton. */}
                      <span aria-hidden className="flex-shrink-0">
                        {isWatched ? '🔍' : '👁️'}
                      </span>
                      <span className="truncate">
                        {player.name}
                        {player.isBot && ' 🤖'}
                      </span>
                    </button>
                  ) : (
                    <div
                      className={`truncate text-xs ${
                        isMe ? 'font-extrabold' : 'font-bold'
                      } ${!player.alive ? 'line-through' : ''}`}
                    >
                      {player.name}
                      {player.isBot && ' 🤖'}
                      {isMe && ' (Anda)'}
                    </div>
                  )}
                  <div className="text-[10px] font-bold text-ink/55">
                    {player.score} poin
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}