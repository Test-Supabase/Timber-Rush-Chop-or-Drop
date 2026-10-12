'use client'

// TimerBar: menampilkan sisa survival timer pemain.
// Props di-update dari loop game via "commit view" (bukan tiap render loop).
import { TIMER_LOW_THRESHOLD } from '@/lib/constants'

interface TimerBarProps {
  timeLeft: number
  maxTime: number
}

export default function TimerBar({ timeLeft, maxTime }: TimerBarProps) {
  const pct = maxTime > 0 ? Math.max(0, Math.min(100, (timeLeft / maxTime) * 100)) : 0
  const low = timeLeft < TIMER_LOW_THRESHOLD
  // Persentase sisa waktu (lebih intuitif).
  const percentText = Math.round(pct) + '%'

  return (
    <div className="w-full max-w-2xl mb-6">
      <div className="mb-2 flex justify-between text-base font-bold text-ink">
        <span>Hp</span>
        <span className="text-xl font-extrabold">{percentText}</span>
      </div>
      <div className="h-8 w-full overflow-hidden rounded-xl border-4 border-ink bg-ink/20">
        <div
          className={`h-full rounded-xl transition-[width] duration-100 ${low ? 'bg-danger' : 'bg-leaf'
            }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}