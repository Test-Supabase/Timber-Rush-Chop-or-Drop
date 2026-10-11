'use client'

// HitPopup: efek pukulan di area batang.
//  - Benar  -> "+N poin" berbentuk bintang tajam (surprise) warna kuning.
//  - Salah  -> "MISS" berbentuk kotak merah.
// Popup muncul di sekitar kayu (sisi kiri/kanan sesuai pukulan), lalu
// memudar & naik. Dipicu oleh perubahan nomor urut pukulan (hitSeq).
import { useEffect, useState } from 'react'
import {
  HIT_POPUP_MS,
  HIT_STAR_POINTS,
  HIT_STAR_INNER,
  HIT_POPUP_LEFT_PCT,
  HIT_POPUP_RIGHT_PCT,
  HIT_POPUP_TOP_MIN_PCT,
  HIT_POPUP_TOP_RANGE_PCT,
} from '@/lib/constants'
import type { HitEvent } from '@/lib/hitEffects'

export type { HitEvent }

interface HitPopupProps {
  event: HitEvent | null
}

// Titik-titik bintang tajam (surprise): selang-seling jari-jari luar & dalam.
function starPoints(cx: number, cy: number, outer: number): string {
  const pts: string[] = []
  const total = HIT_STAR_POINTS * 2
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? outer : outer * HIT_STAR_INNER
    const a = (Math.PI * i) / HIT_STAR_POINTS - Math.PI / 2
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

export default function HitPopup({ event }: HitPopupProps) {
  const [active, setActive] = useState<HitEvent | null>(null)

  // Setiap pukulan baru (seq berubah) memunculkan popup yang dihidupkan ulang.
  // Sengaja bergantung pada seq saja, bukan identitas objek event.
  const seq = event?.seq ?? 0
  useEffect(() => {
    if (!event) return
    setActive(event)
    const t = window.setTimeout(() => setActive(null), HIT_POPUP_MS)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq])

  if (!active) return null

  // Posisi: kiri/kanan batang, vertikal sedikit acak per pukulan agar tidak menumpuk.
  const leftPct = active.side === 'left' ? HIT_POPUP_LEFT_PCT : HIT_POPUP_RIGHT_PCT
  const topPct = HIT_POPUP_TOP_MIN_PCT + ((active.seq * 17) % HIT_POPUP_TOP_RANGE_PCT)

  const isCorrect = active.result === 'correct'

  return (
    <div
      key={active.seq}
      className="pointer-events-none absolute z-30 animate-hit-pop"
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
    >
      {isCorrect ? (
        <div className="relative flex h-16 w-24 items-center justify-center">
          <svg viewBox="-50 -50 100 100" className="absolute inset-0 h-full w-full drop-shadow-[0_3px_0_#2b1d0e]">
            <polygon
              points={starPoints(0, 0, 48)}
              fill="#ffd54f"
              stroke="#2b1d0e"
              strokeWidth={4}
              strokeLinejoin="miter"
            />
          </svg>
          <span className="relative text-base font-extrabold text-ink">+{active.gain} poin</span>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-md border-4 border-ink bg-danger px-3 py-1 shadow-[0_3px_0_#2b1d0e]">
          <span className="text-base font-extrabold tracking-wider text-white">MISS</span>
        </div>
      )}
    </div>
  )
}
