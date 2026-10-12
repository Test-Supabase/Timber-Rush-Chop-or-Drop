'use client'

// TreePanel: render batang pohon vertikal (atas-bawah layar) dengan tekstur
// bark yang random namun konsisten per sisi. Tebasan kapak ditampilkan sebagai
// lekukan kecil dari samping batang.
//
// Tambahan: gauge lingkaran gergaji mesin di kanan-tengah area batang.
//  - Saat belum aktif: cincin biru menunjukkan progres pengisian (0..CHAINSAW_EVERY pohon).
//  - Saat aktif: cincin merah menunjukkan sisa waktu gergaji + kilat "mencolok".
import { useEffect, useRef, useState } from 'react'
import {
  SIDES,
  TREE_TRANSITION,
  SWING_COOLDOWN,
  COOLDOWN_BAR_WIDTH_PX,
  COOLDOWN_BAR_HEIGHT_PX,
  COOLDOWN_BAR_BOTTOM_PX,
  COOLDOWN_ICON_SIZE_PX,
  CONTROL_BUTTON_BOTTOM_PX,
  // Gergaji mesin
  CHAINSAW_EVERY,
  CHAINSAW_FLASH_MS,
  CHAINSAW_GAUGE_SIZE_PX,
  CHAINSAW_GAUGE_STROKE_PX,
  CHAINSAW_GAUGE_RIGHT_PX,
  CHAINSAW_GAUGE_ICON_PX,
  CHAINSAW_POPUP_MS,
} from '@/lib/constants'
import { chainsawGauge } from '@/lib/gameState'

interface TreePanelProps {
  getState: () => {
    rotation: number
    fragileSide: number
    fragileHalf: 0 | 1
    hits: number
    phase: 'playing' | 'transition' | 'over'
    transitionElapsed: number
    hitSeq?: number
    lastHit?: 'correct' | 'wrong' | 'none'
    lastGain?: number
    lastSide?: 'left' | 'right'
    swingCooldown: number
    // Gergaji mesin
    chainsawActive?: boolean
    chainsawTimeLeft?: number
    chainsawFlashSeq?: number
    treesFelled?: number
    chainsawCharge?: number
    sawText?: 'perfect' | 'good' | 'none'
    sawGain?: number
    sawSeq?: number
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
  // Bar cooldown kapak (diisi ulang setelah ayunan, tanpa re-render React).
  const cooldownFillRef = useRef<HTMLDivElement>(null)
  const cooldownWrapRef = useRef<HTMLDivElement>(null)
  // Simpan tekstur random per sisi (konsisten saat kembali ke sisi yang sama).
  const barkPatternsRef = useRef<Map<number, { knots: Array<{ x: number; y: number; r: number }> }>>(new Map())
  // Gauge lingkaran gergaji: cincin progres (strokeDashoffset diatur via rAF).
  const gaugeRef = useRef<SVGCircleElement | null>(null)
  // Status gergaji aktif untuk JSX (diubah hanya saat berubah -> hemat re-render).
  const [chainsawOn, setChainsawOn] = useState(false)
  const chainsawOnRef = useRef(false)
  // Teks tengah gauge (mis. "3/5" saat mengisi, atau sisa detik saat aktif).
  const [gaugeText, setGaugeText] = useState(`0/${CHAINSAW_EVERY}`)
  const gaugeTextRef = useRef(`0/${CHAINSAW_EVERY}`)
  // Label sisi untuk JSX (diubah hanya saat berubah).
  const [sideLabel, setSideLabel] = useState(1)
  const sideLabelRef = useRef(1)
  // Nomor urut tebasan gergaji terakhir yang sudah ditampilkan (deteksi perubahan).
  const lastSawSeqRef = useRef(0)
  // Nomor urut aktivasi gergaji terakhir (untuk animasi "mencolok").
  const lastFlashSeqRef = useRef(0)
  // Aktifkan animasi kilat "mencolok" saat gergaji baru aktif.
  const [flash, setFlash] = useState(false)
  // Popup teks "PERFECT"/"GOOD" dari gergaji.
  const [popupEvent, setPopupEvent] = useState<{
    seq: number
    text: 'perfect' | 'good'
    gain: number
  } | null>(null)

  // Panjang keliling cincin gauge (dipakai untuk dasharray/dashoffset).
  const gaugeRadius = (CHAINSAW_GAUGE_SIZE_PX - CHAINSAW_GAUGE_STROKE_PX) / 2
  const gaugeCircumference = 2 * Math.PI * gaugeRadius

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

      // Toggle status gergaji hanya saat berubah (hemat re-render).
      const csOn = s.chainsawActive ?? false
      if (csOn !== chainsawOnRef.current) {
        chainsawOnRef.current = csOn
        setChainsawOn(csOn)
      }

      // Teks tengah gauge: sisa detik saat aktif, progres pohon saat mengisi.
      const gText = csOn
        ? `${(s.chainsawTimeLeft ?? 0).toFixed(1)}s`
        : `${s.chainsawCharge ?? 0}/${CHAINSAW_EVERY}`
      if (gText !== gaugeTextRef.current) {
        gaugeTextRef.current = gText
        setGaugeText(gText)
      }

      // Label sisi: tetap rotation + 1 (sisi yang dilihat pemain sesuai rotasi).
      const label = s.rotation + 1
      if (label !== sideLabelRef.current) {
        sideLabelRef.current = label
        setSideLabel(label)
      }

      prevRotationRef.current = s.rotation

      syncSize()
      if (cssW > 0 && cssH > 0) drawTreeTrunk(ctx, cssW, cssH, s)

      // Bar cooldown: ditampilkan saat masih cooldown, terisi bertahap.
      const cd = s.swingCooldown ?? 0
      if (cooldownWrapRef.current) {
        cooldownWrapRef.current.style.visibility = cd > 0 ? 'visible' : 'hidden'
      }
      if (cooldownFillRef.current) {
        const ratio = SWING_COOLDOWN > 0 ? Math.min(1, cd / SWING_COOLDOWN) : 0
        // Terisi dari kosong (0%) ke penuh (100%) saat cooldown berjalan.
        cooldownFillRef.current.style.width = `${(1 - ratio) * 100}%`
      }

      // Cincin gauge gergaji: nilai 0..1 -> panjang dashoffset.
      if (gaugeRef.current) {
        const value = chainsawGauge(s)
        gaugeRef.current.style.strokeDashoffset = `${gaugeCircumference * (1 - value)}px`
      }

      // Deteksi tebasan gergaji baru (sawSeq naik) -> tampilkan teks PERFECT/GOOD.
      const sawSeq = s.sawSeq ?? 0
      if (sawSeq !== lastSawSeqRef.current) {
        lastSawSeqRef.current = sawSeq
        if (s.sawText && s.sawText !== 'none') {
          setPopupEvent({ seq: sawSeq, text: s.sawText, gain: s.sawGain ?? 0 })
        }
      }

      // Deteksi gergaji baru aktif (chainsawFlashSeq naik) -> animasi "mencolok".
      const flashSeq = s.chainsawFlashSeq ?? 0
      if (flashSeq !== lastFlashSeqRef.current) {
        lastFlashSeqRef.current = flashSeq
        if (flashSeq > 0) {
          setFlash(true)
          window.setTimeout(() => setFlash(false), CHAINSAW_FLASH_MS)
        }
      }

      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafRef.current)
  }, [getState, gaugeCircumference])

  // Popup teks "PERFECT"/"GOOD" dari gergaji.
  useEffect(() => {
    if (!popupEvent) return
    const t = window.setTimeout(() => setPopupEvent(null), CHAINSAW_POPUP_MS)
    return () => window.clearTimeout(t)
  }, [popupEvent])

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

    // Sisi rapuh efektif: saat gergaji aktif, retak selalu di sisi "1" (index 0).
    const effectiveFragileSide = s.chainsawActive ? 0 : s.fragileSide
    const effectiveFragileHalf = s.fragileHalf

    // Retak horizontal (bekas tebasan) di sisi rapuh, bertambah LEBAR tiap pukulan
    // benar, dengan rongga gelap. Tampil sejak hits = 0 (retak awal).
    if (s.phase === 'playing' && s.rotation === effectiveFragileSide) {
      const isLeftHalf = effectiveFragileHalf === 0
      const inward = isLeftHalf ? 1 : -1 // arah retak masuk ke dalam kayu
      const yc = (y0 + y1) / 2 // posisi vertikal retak (tengah batang)
      const idx = edgeIndex(yc, y0, y1)
      // Titik buka retak di tepi batang (sisi rapuh efektif).
      const edgeX = isLeftHalf ? x0 + edge.left[idx] : x1 - edge.right[idx]

      const hits = Math.max(0, s.hits) // jumlah pukulan benar sebenarnya
      const length = 30 + hits * 26 // lebar horizontal (bertambah tiap pukulan)
      const halfH = 11 + hits * 6 // tinggi bukaan retak
      const tipX = edgeX + inward * length

      // 1) Rongga retak GELAP (area gelap yang tersisa di bagian retak).
      ctx.fillStyle = '#140b03'
      ctx.beginPath()
      ctx.moveTo(edgeX, yc - halfH)
      ctx.quadraticCurveTo(edgeX + inward * length * 0.6, yc - halfH * 0.3, tipX, yc)
      ctx.quadraticCurveTo(edgeX + inward * length * 0.6, yc + halfH * 0.3, edgeX, yc + halfH)
      ctx.closePath()
      ctx.fill()

      // 2) Bibir kayu baru TERANG di atas & bawah retak (kontras tinggi).
      ctx.strokeStyle = '#f2e0b4'
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.moveTo(edgeX, yc - halfH)
      ctx.quadraticCurveTo(edgeX + inward * length * 0.6, yc - halfH * 0.3, tipX, yc)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(edgeX, yc + halfH)
      ctx.quadraticCurveTo(edgeX + inward * length * 0.6, yc + halfH * 0.3, tipX, yc)
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

    // Teks sisi kini dirender sebagai elemen HTML (di JSX) agar tidak dobel.
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
      {/* Animasi "mencolok": kilat merah menyala saat gergaji mesin baru aktif. */}
      {flash && (
        <div className="pointer-events-none absolute inset-0 z-40 animate-chainsaw-flash rounded-3xl bg-danger/30 ring-8 ring-inset ring-danger" />
      )}
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        className="game-area h-full w-full cursor-pointer"
        aria-label="Batang pohon. Klik kiri atau kanan untuk memukul."
      />
      {/* Tombol putar di bawah layar */}
      <div
        className="pointer-events-none absolute inset-x-0 flex items-center justify-between px-6"
        style={{ bottom: `${CONTROL_BUTTON_BOTTOM_PX}px` }}
      >
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

      {/* Gauge lingkaran gergaji mesin — selalu tampil di kanan tengah area batang. */}
      <div
        className="pointer-events-none absolute top-1/2 z-10 -translate-y-1/2"
        style={{ left: `${CHAINSAW_GAUGE_RIGHT_PX}px` }}
      >
        <div
          className={`relative flex items-center justify-center rounded-full ${chainsawOn ? 'animate-pulse ring-4 ring-danger/70' : ''
            }`}
          style={{ width: `${CHAINSAW_GAUGE_SIZE_PX}px`, height: `${CHAINSAW_GAUGE_SIZE_PX}px` }}
        >
          {/* Cincin dasar gauge. */}
          <svg
            className="absolute inset-0"
            viewBox={`0 0 ${CHAINSAW_GAUGE_SIZE_PX} ${CHAINSAW_GAUGE_SIZE_PX}`}
          >
            <circle
              cx={CHAINSAW_GAUGE_SIZE_PX / 2}
              cy={CHAINSAW_GAUGE_SIZE_PX / 2}
              r={gaugeRadius}
              fill="rgba(255,255,255,0.55)"
              stroke="#2b1d0e"
              strokeWidth={CHAINSAW_GAUGE_STROKE_PX}
            />
          </svg>
          {/* Cincin progres: biru saat mengisi, merah saat gergaji aktif. */}
          <svg
            className="absolute inset-0 -rotate-90"
            viewBox={`0 0 ${CHAINSAW_GAUGE_SIZE_PX} ${CHAINSAW_GAUGE_SIZE_PX}`}
          >
            <circle
              ref={gaugeRef}
              cx={CHAINSAW_GAUGE_SIZE_PX / 2}
              cy={CHAINSAW_GAUGE_SIZE_PX / 2}
              r={gaugeRadius}
              fill="none"
              stroke={chainsawOn ? '#e53935' : '#2196f3'}
              strokeWidth={CHAINSAW_GAUGE_STROKE_PX}
              strokeLinecap="round"
              strokeDasharray={gaugeCircumference}
              strokeDashoffset={gaugeCircumference}
            />
          </svg>
          {/* Ikon gergaji mesin + teks progres di tengah gauge. */}
          <div className="relative flex flex-col items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              style={{ width: `${CHAINSAW_GAUGE_ICON_PX}px`, height: `${CHAINSAW_GAUGE_ICON_PX}px` }}
            >
              {/* Gagang atas (oranye). */}
              <rect x="4" y="7" width="16" height="5" rx="2.5" fill="#ff9f1c" stroke="#2b1d0e" strokeWidth="1.2" />
              {/* Bilah gergaji (baja). */}
              <rect x="2" y="12" width="17" height="3.6" rx="1.2" fill="#9e9e9e" stroke="#2b1d0e" strokeWidth="1" />
              {/* Gigi gergaji. */}
              <path
                d="M2 15.6l1.5 1.6 1.5-1.6 1.5 1.6 1.5-1.6 1.5 1.6 1.5-1.6 1.5 1.6 1.5-1.6 1.5 1.6 1.5-1.6 1.5 1.6 1.5-1.6"
                fill="none"
                stroke="#2b1d0e"
                strokeWidth="1"
              />
              {/* Gagang depan. */}
              <rect x="17" y="11" width="5" height="6" rx="1.6" fill="#7a4a1c" stroke="#2b1d0e" strokeWidth="1" />
            </svg>
            <span
              className={`mt-0.5 text-[10px] font-extrabold leading-none ${chainsawOn ? 'text-danger' : 'text-ink'
                }`}
            >
              {gaugeText}
            </span>
          </div>
        </div>
      </div>

      {/* Bar cooldown ayunan kapak — terpusat, tepat di atas teks "Sisi".
          Tersembunyi saat siap; terisi (kiri->kanan) selama cooldown. */}
      <div
        ref={cooldownWrapRef}
        className="pointer-events-none absolute inset-x-0 flex justify-center"
        style={{ bottom: `${COOLDOWN_BAR_BOTTOM_PX}px`, visibility: 'hidden' }}
        aria-hidden
      >
        <div
          className="relative overflow-hidden rounded-full border-2 border-ink bg-white/70"
          style={{
            width: `${COOLDOWN_BAR_WIDTH_PX}px`,
            height: `${COOLDOWN_BAR_HEIGHT_PX}px`,
          }}
        >
          {/* Isian cooldown (lebar diatur via rAF). */}
          <div
            ref={cooldownFillRef}
            className="absolute inset-y-0 left-0 rounded-full bg-sun"
            style={{ width: '0%' }}
          />
          {/* Ikon kapak di pojok kiri bar. */}
          <div
            className="absolute left-1 top-1/2 -translate-y-1/2"
            style={{ width: `${COOLDOWN_ICON_SIZE_PX}px`, height: `${COOLDOWN_ICON_SIZE_PX}px` }}
          >
            <svg viewBox="0 0 24 24" className="h-full w-full">
              {/* Kapak: mata besi + gagang kayu. */}
              <rect x="11" y="3" width="2.4" height="18" rx="1" fill="#5c3a1a" />
              <path d="M9 3h8c1.5 0 2.5 1.6 1.8 3l-1.4 2.6H9z" fill="#9e9e9e" stroke="#2b1d0e" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* Indikator sisi di bawah layar (di bawah bar cooldown). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-sm font-bold text-ink">
        Sisi {sideLabel} / {SIDES}
      </div>

      {/* Popup gergaji: "PERFECT" (benar) atau "GOOD" (miss), di area kayu. */}
      {popupEvent && (
        <div
          key={popupEvent.seq}
          className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2 animate-saw-pop"
        >
          {popupEvent.text === 'perfect' ? (
            <div className="rounded-xl border-4 border-ink bg-gradient-to-b from-[#ffd54f] to-[#ff8f00] px-4 py-2 shadow-[0_4px_0_#2b1d0e]">
              <span className="text-2xl font-extrabold italic tracking-wide text-ink drop-shadow-[0_1px_0_#fff]">
                PERFECT! +{popupEvent.gain}
              </span>
            </div>
          ) : (
            <div className="rounded-xl border-4 border-ink bg-gradient-to-b from-[#4fc3f7] to-[#0277bd] px-4 py-2 shadow-[0_4px_0_#2b1d0e]">
              <span className="text-2xl font-extrabold italic tracking-wide text-white drop-shadow-[0_2px_0_#2b1d0e]">
                GOOD
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}