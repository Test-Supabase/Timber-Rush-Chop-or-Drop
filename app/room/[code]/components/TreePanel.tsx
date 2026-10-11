'use client'

// TreePanel: render batang pohon vertikal (atas-bawah layar) dengan tekstur
// bark yang random namun konsisten per sisi. Tebasan kapak ditampilkan sebagai
// lekukan kecil dari samping batang.
import { useEffect, useRef } from 'react'
import {
  SIDES,
  TREE_TRANSITION,
} from '@/lib/constants'

interface TreePanelProps {
  getState: () => {
    rotation: number
    fragileSide: number
    fragileHalf: 0 | 1
    hits: number
    phase: 'playing' | 'transition' | 'over'
    transitionElapsed: number
  }
  onStrike: (side: 'left' | 'right') => void
  onRotate: (dir: 'left' | 'right') => void
}

// Generator tekstur acak per sisi (seeded random agar konsisten per sisi).
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Jumlah titik sampel tepi batang (vertikal) per sisi.
const EDGE_SAMPLES = 24
// Lebar bergelombang tepi (px) — disingkat agar batang terlihat lebih tegak/center.
const EDGE_WAVE_PX = 4
const EDGE_NOTCH_PX = 3

interface TrunkEdge {
  left: number[] // jarak tepi kiri dari sisi kiri batang (px), per sampel
  right: number[] // jarak tepi kanan dari sisi kanan batang (px), per sampel
}

const edgeCache = new Map<number, TrunkEdge>()

// Bentuk tepi batang: acak tetapi deterministik per sisi (seed = indeks sisi),
// sehingga setiap sisi punya siluet berbeda namun konsisten saat diputar.
function getTrunkEdge(side: number, trunkW: number): TrunkEdge {
  const cached = edgeCache.get(side)
  if (cached) return cached
  const left: number[] = []
  const right: number[] = []
  const phase = seededRandom(side * 17 + 3) * Math.PI * 2
  for (let i = 0; i < EDGE_SAMPLES; i++) {
    const t = i / (EDGE_SAMPLES - 1)
    const wave = Math.sin(t * Math.PI * 3 + phase) * EDGE_WAVE_PX * 0.5
    const noiseL = seededRandom(side * 100 + i * 3) * EDGE_NOTCH_PX
    const noiseR = seededRandom(side * 100 + i * 3 + 1) * EDGE_NOTCH_PX
    left.push(Math.max(0, EDGE_WAVE_PX + wave + noiseL))
    right.push(Math.max(0, EDGE_WAVE_PX - wave + noiseR))
  }
  const edge = { left, right }
  edgeCache.set(side, edge)
  return edge
}

// Indeks sampel tepi terdekat untuk posisi Y tertentu.
function edgeIndex(y: number, y0: number, y1: number): number {
  const raw = ((y - y0) / (y1 - y0)) * (EDGE_SAMPLES - 1)
  return Math.max(0, Math.min(EDGE_SAMPLES - 1, Math.round(raw)))
}

export default function TreePanel({ getState, onStrike, onRotate }: TreePanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const prevRotationRef = useRef<number | null>(null)
  // Simpan tekstur random per sisi (konsisten saat kembali ke sisi yang sama).
  const barkPatternsRef = useRef<Map<number, { knots: Array<{ x: number; y: number; r: number }> }>>(new Map())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2)

    // Inisialisasi pola bark per sisi bila belum ada.
    for (let side = 0; side < SIDES; side++) {
      if (!barkPatternsRef.current.has(side)) {
        const knots: Array<{ x: number; y: number; r: number }> = []
        // Buat 4-6 mata kayu (knot) acak per sisi, posisi konsisten.
        const count = 4 + Math.floor(seededRandom(side * 100) * 3)
        for (let i = 0; i < count; i++) {
          knots.push({
            x: seededRandom(side * 100 + i * 10) * 0.8 + 0.1, // 10%-90%
            y: seededRandom(side * 100 + i * 10 + 1) * 0.9 + 0.05, // 5%-95%
            r: 8 + seededRandom(side * 100 + i * 10 + 2) * 12, // 8-20px
          })
        }
        barkPatternsRef.current.set(side, { knots })
      }
    }

    // Ukuran kanvas mengikuti elemen (responsif). Diperbarui tiap frame
    // agar mendukung layout fleksibel (tinggi penuh layar).
    let cssW = 0
    let cssH = 0
    const syncSize = () => {
      const cw = canvas.clientWidth
      const ch = canvas.clientHeight
      if (cw !== cssW || ch !== cssH) {
        cssW = cw
        cssH = ch
        canvas.width = Math.max(1, Math.round(cw * dpr))
        canvas.height = Math.max(1, Math.round(ch * dpr))
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    }

    let last = performance.now()

    const render = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const s = getState()

      if (prevRotationRef.current === null) prevRotationRef.current = s.rotation
      if (prevRotationRef.current !== s.rotation) {
        prevRotationRef.current = s.rotation
      }

      syncSize()
      if (cssW > 0 && cssH > 0) drawTreeTrunk(ctx, cssW, cssH, s)

      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafRef.current)
  }, [getState])

  function drawTreeTrunk(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    s: ReturnType<TreePanelProps['getState']>
  ) {
    ctx.clearRect(0, 0, w, h)

    // Fase transisi: fade-out pohon lama.
    let alpha = 1
    if (s.phase === 'transition') {
      alpha = Math.max(0, 1 - s.transitionElapsed / (TREE_TRANSITION * 0.5))
    }
    ctx.globalAlpha = alpha

    // Batang pohon vertikal (lebar 60% layar, tinggi penuh).
    const trunkW = w * 0.6
    const x0 = (w - trunkW) / 2
    const x1 = x0 + trunkW
    const y0 = 0
    const y1 = h

    // Bentuk tepi batang: acak tetapi konsisten per sisi (seed = indeks sisi).
    const edge = getTrunkEdge(s.rotation, trunkW)

    // Gradien horizontal untuk kedalaman 3D (warna tetap sama di semua sisi).
    const grad = ctx.createLinearGradient(x0, 0, x1, 0)
    grad.addColorStop(0, '#4a3018')
    grad.addColorStop(0.3, '#6b4423')
    grad.addColorStop(0.5, '#8b5a2b')
    grad.addColorStop(0.7, '#6b4423')
    grad.addColorStop(1, '#4a3018')

    const drawTrunkPath = () => {
      ctx.beginPath()
      ctx.moveTo(x0 + edge.left[0], y0)
      for (let i = 1; i < edge.left.length; i++) {
        ctx.lineTo(x0 + edge.left[i], y0 + ((y1 - y0) * i) / (edge.left.length - 1))
      }
      for (let i = edge.right.length - 1; i >= 0; i--) {
        ctx.lineTo(x1 - edge.right[i], y0 + ((y1 - y0) * i) / (edge.right.length - 1))
      }
      ctx.closePath()
    }

    drawTrunkPath()
    ctx.fillStyle = grad
    ctx.fill()

    // Outline batang.
    drawTrunkPath()
    ctx.strokeStyle = '#2b1d0e'
    ctx.lineWidth = 4
    ctx.stroke()

    // Serat kayu vertikal (beberapa garis tipis).
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'
    ctx.lineWidth = 1
    for (let i = 0; i < 8; i++) {
      const xLine = x0 + (i + 1) * (trunkW / 9)
      ctx.beginPath()
      ctx.moveTo(xLine, y0)
      ctx.lineTo(xLine, y1)
      ctx.stroke()
    }

    // Pola bark: mata kayu (knots) sesuai sisi rotasi saat ini.
    const pattern = barkPatternsRef.current.get(s.rotation)
    if (pattern) {
      pattern.knots.forEach((knot) => {
        const kx = x0 + knot.x * trunkW
        const ky = y0 + knot.y * (y1 - y0)
        const kr = knot.r
        // Mata kayu: lingkaran gelap.
        const knotGrad = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr)
        knotGrad.addColorStop(0, 'rgba(43,29,14,0.6)')
        knotGrad.addColorStop(1, 'rgba(43,29,14,0.1)')
        ctx.fillStyle = knotGrad
        ctx.beginPath()
        ctx.arc(kx, ky, kr, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    // Garis tengah vertikal (zona pukul kiri/kanan) — halus.
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.setLineDash([8, 12])
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(w / 2, y0)
    ctx.lineTo(w / 2, y1)
    ctx.stroke()
    ctx.setLineDash([])

    // Retak horizontal (bekas tebasan kapak) di sisi rapuh.
    // Satu retak yang bertambah LEBAR tiap pukulan benar, dengan rongga gelap.
    if (s.rotation === s.fragileSide && s.phase === 'playing' && s.hits > 0) {
      const isLeftHalf = s.fragileHalf === 0
      const inward = isLeftHalf ? 1 : -1 // arah retak masuk ke dalam kayu
      const yc = (y0 + y1) / 2 // posisi vertikal retak (tengah batang)
      const idx = edgeIndex(yc, y0, y1)
      // Titik buka retak di tepi batang (sisi rapuh).
      const edgeX = isLeftHalf ? x0 + edge.left[idx] : x1 - edge.right[idx]

      const hits = s.hits // jumlah pukulan benar sebenarnya
      const length = 30 + hits * 26 // lebar horizontal (bertambah tiap pukulan)
      const halfH = 11 + hits * 6 // tinggi bukaan retak
      const tipX = edgeX + inward * length

      // 1) Rongga retak GELAP (area gelap yang tersisa di bagian retak).
      ctx.fillStyle = '#140b03'
      ctx.beginPath()
      ctx.moveTo(edgeX, yc - halfH)
      ctx.quadraticCurveTo(
        edgeX + inward * length * 0.6,
        yc - halfH * 0.3,
        tipX,
        yc
      )
      ctx.quadraticCurveTo(
        edgeX + inward * length * 0.6,
        yc + halfH * 0.3,
        edgeX,
        yc + halfH
      )
      ctx.closePath()
      ctx.fill()

      // 2) Bibir kayu baru TERANG di atas & bawah retak (kontras tinggi).
      ctx.strokeStyle = '#f2e0b4'
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.moveTo(edgeX, yc - halfH)
      ctx.quadraticCurveTo(
        edgeX + inward * length * 0.6,
        yc - halfH * 0.3,
        tipX,
        yc
      )
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(edgeX, yc + halfH)
      ctx.quadraticCurveTo(
        edgeX + inward * length * 0.6,
        yc + halfH * 0.3,
        tipX,
        yc
      )
      ctx.stroke()

      // 3) Retakan rambut menjalar dari ujung (kayu mulai pecah).
      ctx.strokeStyle = 'rgba(20,12,4,0.85)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(tipX, yc)
      ctx.lineTo(tipX + inward * 24, yc - halfH * 0.9)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(tipX, yc)
      ctx.lineTo(tipX + inward * 18, yc + halfH * 1.1)
      ctx.stroke()
    }

    ctx.globalAlpha = 1

    // Indikator sisi di bawah layar.
    ctx.fillStyle = '#2b1d0e'
    ctx.font = 'bold 14px "Trebuchet MS", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`Sisi ${s.rotation + 1} / ${SIDES}`, w / 2, h - 10)
  }

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    onStrike(x < rect.width / 2 ? 'left' : 'right')
  }

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        className="game-area h-full w-full cursor-pointer"
        aria-label="Batang pohon. Klik kiri atau kanan untuk memukul."
      />
      {/* Tombol putar di bawah layar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-between px-6">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation()
            onRotate('left')
          }}
          className="pointer-events-auto z-20 flex h-12 w-12 items-center justify-center rounded-full border-4 border-ink bg-sun text-xl font-extrabold text-ink shadow-[0_3px_0_#2b1d0e] active:translate-y-1 active:shadow-none"
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
          className="pointer-events-auto z-20 flex h-12 w-12 items-center justify-center rounded-full border-4 border-ink bg-sun text-xl font-extrabold text-ink shadow-[0_3px_0_#2b1d0e] active:translate-y-1 active:shadow-none"
          aria-label="Putar ke kanan"
        >
          ▶
        </button>
      </div>
    </div>
  )
}
