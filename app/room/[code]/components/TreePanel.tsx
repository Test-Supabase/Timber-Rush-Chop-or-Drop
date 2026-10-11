'use client'

// TreePanel: render batang 4 sisi (tekstur bark), rotasi snap 90°,
// animasi slide ~200ms saat berpindah sisi, indikator "Sisi x / N",
// dan "tell" berupa retakan pada sisi rapuh (hanya bila sedang menghadap).
// Klik area kiri/kanan kanvas = pukul kiri/kanan (zona tersembunyi).
import { useEffect, useRef } from 'react'
import {
  SIDES,
  TREE_TRANSITION,
} from '@/lib/constants'

interface TreePanelProps {
  // getState dibaca langsung dari ref game (loop tidak re-render).
  getState: () => {
    rotation: number
    fragileSide: number
    fragileHalf: 0 | 1
    hits: number
    phase: 'playing' | 'transition' | 'over'
    transitionElapsed: number
  }
  // onStrike dipanggil saat pemain mengklik area kiri/kanan.
  onStrike: (side: 'left' | 'right') => void
  // onRotate dipanggil saat tombol ◀/▶ ditekan.
  onRotate: (dir: 'left' | 'right') => void
}

export default function TreePanel({ getState, onStrike, onRotate }: TreePanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  // Animasi slide horizontal saat berpindah sisi (0 = diam, 1 = baru selesai).
  const slideRef = useRef({ from: 0, t: 1 })
  const prevRotationRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Batasi devicePixelRatio maks 2 (aturan besi: hindari render berat).
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2)
    const cssW = canvas.clientWidth
    const cssH = canvas.clientHeight
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx.scale(dpr, dpr)

    let last = performance.now()

    const render = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05) // batasi dt frame besar
      last = now
      const s = getState()

      // Deteksi perubahan sisi untuk animasi slide.
      if (prevRotationRef.current === null) prevRotationRef.current = s.rotation
      if (prevRotationRef.current !== s.rotation) {
        slideRef.current = { from: prevRotationRef.current, t: 0 }
        prevRotationRef.current = s.rotation
      }
      if (slideRef.current.t < 1) {
        slideRef.current.t = Math.min(1, slideRef.current.t + dt / 0.2) // ~200ms
      }

      drawBarkSide(ctx, cssW, cssH, s)

      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafRef.current)
  }, [getState])

  // Gambar satu sisi batang (yang sedang menghadap pemain).
  function drawBarkSide(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    s: ReturnType<TreePanelProps['getState']>
  ) {
    ctx.clearRect(0, 0, w, h)

    // Offset slide halus saat berpindah sisi (dari kiri/kanan layar).
    const easing = 1 - Math.pow(1 - slideRef.current.t, 3)
    const dirSign = prevRotationRef.current === null ? 0 : 1
    const slideOffset = (1 - easing) * 40 * dirSign

    const padX = 24
    const x0 = padX + slideOffset
    const x1 = w - padX + slideOffset
    const panelW = x1 - x0
    const y0 = 20
    const y1 = h - 20

    // Fase transisi: fade-out pohon lama (opacity turun).
    let alpha = 1
    if (s.phase === 'transition') {
      alpha = Math.max(0, 1 - s.transitionElapsed / (TREE_TRANSITION * 0.5))
    }
    ctx.globalAlpha = alpha

    // Badan batang dengan tekstur bark.
    const grad = ctx.createLinearGradient(x0, 0, x1, 0)
    grad.addColorStop(0, '#5c3a1a')
    grad.addColorStop(0.5, '#8b5a2b')
    grad.addColorStop(1, '#5c3a1a')
    ctx.fillStyle = grad
    roundRect(ctx, x0, y0, panelW, y1 - y0, 18)
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = '#2b1d0e'
    ctx.stroke()

    // Serat kayu vertikal.
    ctx.strokeStyle = 'rgba(0,0,0,0.10)'
    ctx.lineWidth = 2
    for (let x = x0 + 10; x < x1; x += 14) {
      ctx.beginPath()
      ctx.moveTo(x, y0 + 6)
      ctx.lineTo(x, y1 - 6)
      ctx.stroke()
    }

    // Garis tengah tak terlihat (zona pukul) — hanya penanda halus.
    ctx.strokeStyle = 'rgba(43,29,14,0.18)'
    ctx.setLineDash([6, 8])
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo((x0 + x1) / 2, y0)
    ctx.lineTo((x0 + x1) / 2, y1)
    ctx.stroke()
    ctx.setLineDash([])

    // "Tell": retakan pada sisi rapuh bila sedang menghadap.
    if (s.rotation === s.fragileSide && s.phase === 'playing') {
      const halfX =
        s.fragileHalf === 0 ? x0 + panelW * 0.25 : x0 + panelW * 0.75
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(halfX, y0 + 30)
      ctx.lineTo(halfX, y1 - 30)
      ctx.stroke()
    }

    // Retak tumbuh sesuai jumlah pukulan benar (semakin dalam/lebar).
    for (let i = 0; i < s.hits; i++) {
      const cx = x0 + panelW / 2
      const depth = 22 + i * 14
      ctx.strokeStyle = '#2b1d0e'
      ctx.lineWidth = 3 + i
      ctx.beginPath()
      ctx.moveTo(cx - depth, y0 + 60 + i * 40)
      ctx.lineTo(cx, y0 + 60 + i * 40)
      ctx.lineTo(cx + depth, y0 + 80 + i * 40)
      ctx.stroke()
    }

    ctx.globalAlpha = 1

    // Indikator "Sisi x / N".
    ctx.fillStyle = '#2b1d0e'
    ctx.font = 'bold 16px "Trebuchet MS", Verdana, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`Sisi ${s.rotation + 1} / ${SIDES}`, w / 2, h - 6)
  }

  // Utilitas menggambar persegi dengan sudut membulat.
  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  // Klik area kiri/kanan kanvas = pukul kiri/kanan.
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    onStrike(x < rect.width / 2 ? 'left' : 'right')
  }

  return (
    <div className="w-full max-w-md">
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          className="game-area h-[420px] w-full cursor-pointer rounded-2xl"
          aria-label="Area batang pohon. Klik kiri atau kanan untuk memukul."
        />
        {/* Tombol putar di lapisan atas (z-index tinggi) + stopPropagation
            agar tidak dianggap pukulan. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-between px-3">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation()
              onRotate('left')
            }}
            className="pointer-events-auto z-20 flex h-14 w-14 items-center justify-center rounded-full border-4 border-ink bg-sun text-2xl font-extrabold text-ink shadow-[0_4px_0_#2b1d0e] active:translate-y-1 active:shadow-none"
            aria-label="Putar ke kiri"
          >
            ◀
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation()
              onRotate('right')
            }}
            className="pointer-events-auto z-20 flex h-14 w-14 items-center justify-center rounded-full border-4 border-ink bg-sun text-2xl font-extrabold text-ink shadow-[0_4px_0_#2b1d0e] active:translate-y-1 active:shadow-none"
            aria-label="Putar ke kanan"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  )
}