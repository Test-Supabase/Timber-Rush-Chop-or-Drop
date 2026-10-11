// ============================================================
// LOGIKA GAME MURNI (tanpa React) untuk Timber Rush.
// Semua angka diambil dari lib/constants.ts (tidak ada magic number).
// State di sini MUTABLE dan disimpan di useRef oleh GameView,
// agar loop requestAnimationFrame tidak memicu re-render React.
// ============================================================

import {
  SIDES,
  HITS_TO_FELL,
  SWING_COOLDOWN,
  START_MAX_TIME,
  MAXTIME_STEP,
  MAXTIME_FLOOR,
  TREE_TRANSITION,
  WRONG_HIT_PENALTY,
  CORRECT_HIT_RECOVERY,
  SCORE_CORRECT_HIT,
  SCORE_TREE_FELL,
} from './constants'

export type Phase = 'playing' | 'transition' | 'over'
export type HitResult = 'correct' | 'wrong' | 'ignored'
export type HitSide = 'left' | 'right'
export type RotateDir = 'left' | 'right'

export interface PlayerState {
  rotation: number // sisi yang menghadap pemain (0..SIDES-1)
  fragileSide: number // sisi rapuh (0..SIDES-1)
  fragileHalf: 0 | 1 // 0 = separuh kiri, 1 = separuh kanan
  hits: number // jumlah pukulan benar pada pohon ini (0..HITS_TO_FELL)
  treeIndex: number // pohon ke-berapa (mulai 1)
  maxTime: number // MAX survival untuk pohon ini
  timeLeft: number // sisa waktu survival (detik)
  score: number // skor total
  swingCooldown: number // sisa jeda ayunan (detik)
  phase: Phase // fase permainan
  transitionElapsed: number // waktu berjalan selama transisi (detik)
  // Hasil pukulan terakhir (untuk popup di klien).
  hitSeq: number // nomor urut pukulan (naik tiap ayunan yang diproses)
  lastHit: 'correct' | 'wrong' | 'none' // hasil pukulan terakhir
  lastGain: number // poin yang didapat dari pukulan terakhir (0 bila salah)
  lastSide: HitSide // sisi yang dipukul pada ayunan terakhir
}

// Kurva MAX time: menyusut MAXTIME_STEP detik per pohon, lantai MAXTIME_FLOOR.
export function maxTimeForTree(treeIndex: number): number {
  return Math.max(MAXTIME_FLOOR, START_MAX_TIME - MAXTIME_STEP * (treeIndex - 1))
}

// Angka bulat acak 0..max-1.
function randInt(max: number): number {
  return Math.floor(Math.random() * max)
}

// State awal permainan.
export function createPlayerState(): PlayerState {
  const treeIndex = 1
  const maxTime = maxTimeForTree(treeIndex)
  return {
    rotation: 0,
    fragileSide: randInt(SIDES),
    fragileHalf: randInt(2) as 0 | 1,
    hits: 0,
    treeIndex,
    maxTime,
    timeLeft: maxTime,
    score: 0,
    swingCooldown: 0,
    phase: 'playing',
    transitionElapsed: 0,
    hitSeq: 0,
    lastHit: 'none',
    lastGain: 0,
    lastSide: 'left',
  }
}

// Putar tampilan batang (snap 1 sisi). Kiri = sisi sebelumnya, kanan = sisi berikutnya.
export function rotate(state: PlayerState, dir: RotateDir): void {
  if (state.phase !== 'playing') return
  state.rotation =
    dir === 'left'
      ? (state.rotation - 1 + SIDES) % SIDES
      : (state.rotation + 1) % SIDES
}

// Siapkan pohon berikutnya setelah transisi selesai.
function startNextTree(state: PlayerState): void {
  state.treeIndex += 1
  state.maxTime = maxTimeForTree(state.treeIndex)
  state.timeLeft = state.maxTime // reset penuh ke MAX saat itu
  state.rotation = 0
  state.fragileSide = randInt(SIDES) // sisi rapuh dipilih ulang acak
  state.fragileHalf = randInt(2) as 0 | 1
  state.hits = 0
  state.swingCooldown = 0
  state.phase = 'playing'
  state.transitionElapsed = 0
}

// Lakukan pukulan. Return hasilnya untuk feedback UI.
export function strike(state: PlayerState, side: HitSide): HitResult {
  // Abaikan bila bukan fase main atau masih cooldown.
  if (state.phase !== 'playing') return 'ignored'
  if (state.swingCooldown > 0) return 'ignored'

  // Benar bila sisi rapuh sedang menghadap DAN separuh yang dipukul tepat.
  const facingFragile = state.rotation === state.fragileSide
  const correct =
    facingFragile &&
    ((side === 'left' && state.fragileHalf === 0) ||
      (side === 'right' && state.fragileHalf === 1))

  // Setiap ayunan memicu cooldown.
  state.swingCooldown = SWING_COOLDOWN
  // Catat hasil ayunan ini untuk popup di klien.
  state.hitSeq += 1
  state.lastSide = side

  if (correct) {
    state.hits += 1
    state.score += SCORE_CORRECT_HIT
    let gain = SCORE_CORRECT_HIT
    // Tambahan waktu saat pukul benar (0 sesuai spesifikasi => tidak berubah).
    state.timeLeft = Math.min(state.maxTime, state.timeLeft + CORRECT_HIT_RECOVERY)

    if (state.hits >= HITS_TO_FELL) {
      // Pohon roboh: bonus + mulai transisi.
      state.score += SCORE_TREE_FELL
      gain += SCORE_TREE_FELL
      state.phase = 'transition'
      state.transitionElapsed = 0
      state.swingCooldown = SWING_COOLDOWN // cooldown di-reset penuh
    }
    state.lastHit = 'correct'
    state.lastGain = gain
    return 'correct'
  }

  // Pukul salah: timer berkurang & feedback defleksi (di UI).
  state.timeLeft = Math.max(0, state.timeLeft - WRONG_HIT_PENALTY)
  if (state.timeLeft <= 0) {
    state.phase = 'over'
  }
  state.lastHit = 'wrong'
  state.lastGain = 0
  return 'wrong'
}

// Update per frame. Return treeChanged=true saat pohon baru mulai (sinkron UI).
export function update(state: PlayerState, dt: number): { treeChanged: boolean } {
  // Kurangi cooldown ayunan.
  if (state.swingCooldown > 0) {
    state.swingCooldown = Math.max(0, state.swingCooldown - dt)
  }

  // Fase transisi: timer BEKU, hanya menghitung durasi transisi.
  if (state.phase === 'transition') {
    state.transitionElapsed += dt
    if (state.transitionElapsed >= TREE_TRANSITION) {
      startNextTree(state)
      return { treeChanged: true }
    }
    return { treeChanged: false }
  }

  // Fase main: survival timer menyusut real-time.
  if (state.phase === 'playing') {
    state.timeLeft = Math.max(0, state.timeLeft - dt)
    if (state.timeLeft <= 0) {
      state.phase = 'over'
    }
  }

  return { treeChanged: false }
}