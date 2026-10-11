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

  return (
    <div className="w-full max-w-md">
      <div className="mb-1 flex justify-between text-sm font-bold text-ink">
        <span>Nyawa: {timeLeft.toFixed(1)}s</span>
        <span>MAX: {maxTime.toFixed(0)}s</span>
      </div>
      <div className="h-7 w-full overflow-hidden rounded-full border-2 border-ink bg-ink/20">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ${
            low ? 'bg-danger' : 'bg-leaf'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}