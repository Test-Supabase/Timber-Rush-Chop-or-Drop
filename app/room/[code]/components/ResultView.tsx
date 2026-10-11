'use client'

// ResultView: layar hasil akhir dengan tabel ranking 4 pemain.
// Sorot juara #1 dengan warna emas, sisanya silver/bronze/gray.
import { useRouter } from 'next/navigation'

interface ResultPlayer {
  id: string
  name: string
  score: number
  rank: number
  isMe: boolean
}

interface ResultViewProps {
  players: ResultPlayer[]
  myRank: number
  onRestart: () => void
}

export default function ResultView({ players, myRank, onRestart }: ResultViewProps) {
  const router = useRouter()

  // Sort by rank ascending (1 = juara).
  const sorted = [...players].sort((a, b) => a.rank - b.rank)

  // Warna medali per rank.
  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-sun' // emas
    if (rank === 2) return 'text-bark' // silver/bronze
    if (rank === 3) return 'text-bark-dark'
    return 'text-ink/60' // gray
  }

  const getRankBg = (rank: number) => {
    if (rank === 1) return 'bg-sun/20 border-sun'
    if (rank === 2) return 'bg-bark/10 border-bark'
    if (rank === 3) return 'bg-bark-dark/10 border-bark-dark'
    return 'bg-ink/5 border-ink/30'
  }

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🏆'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return '😔'
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      {/* Header hasil */}
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-bark-dark">
          {myRank === 1 ? '🎉 JUARA! 🎉' : 'Permainan Selesai'}
        </h1>
        <p className="mt-2 text-lg font-bold text-ink">
          Peringkat Anda: #{myRank}
        </p>
      </div>

      {/* Tabel ranking */}
      <div className="w-full max-w-lg space-y-3">
        {sorted.map((player) => (
          <div
            key={player.id}
            className={`flex items-center justify-between rounded-xl border-4 p-4 ${
              getRankBg(player.rank)
            } ${
              player.isMe ? 'ring-4 ring-leaf ring-offset-2' : ''
            } transition-all`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{getRankEmoji(player.rank)}</span>
              <div>
                <div className={`text-xl font-extrabold ${getRankColor(player.rank)}`}>
                  #{player.rank} {player.name}
                  {player.isMe && ' (Anda)'}
                </div>
                <div className="text-sm font-bold text-ink/70">
                  Skor: {player.score}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tombol aksi */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-xl border-4 border-ink bg-leaf px-6 py-3 text-lg font-extrabold text-white shadow-[0_4px_0_#2b1d0e] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#2b1d0e] active:translate-y-1 active:shadow-none"
        >
          Main Lagi
        </button>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="rounded-xl border-4 border-ink bg-sky px-6 py-3 text-lg font-extrabold text-ink shadow-[0_4px_0_#2b1d0e] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#2b1d0e] active:translate-y-1 active:shadow-none"
        >
          ← Kembali ke Lobby
        </button>
      </div>
    </div>
  )
}