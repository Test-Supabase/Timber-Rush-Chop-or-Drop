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
  CHAINSAW_EVERY,
  CHAINSAW_DURATION,
  CHAINSAW_COOLDOWN,
  CHAINSAW_HIT_DELAY,
  CHAINSAW_MISS_DELAY,
  CHAINSAW_TRANSITION,
} from './constants'

export type Phase = 'playing' | 'transition' | 'over'
// 'chainsaw' = ayunan gergaji (hasilnya diproses setelah delay, bukan seketika).
export type HitResult = 'correct' | 'wrong' | 'ignored' | 'chainsaw'
export type HitSide = 'left' | 'right'
export type RotateDir = 'left' | 'right'
// Teks hasil tebasan gergaji.
export type SawText = 'perfect' | 'good' | 'none'

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
  swingCooldownMax: number // durasi jeda penuh (untuk bar UI)
  phase: Phase // fase permainan
  transitionElapsed: number // waktu berjalan selama transisi (detik)
  transitionDur: number // durasi transisi pohon ini (detik)
  // Hasil pukulan terakhir (untuk popup di klien).
  hitSeq: number // nomor urut pukulan (naik tiap ayunan yang diproses)
  lastHit: 'correct' | 'wrong' | 'none' // hasil pukulan terakhir
  lastGain: number // poin yang didapat dari pukulan terakhir (0 bila salah)
  lastSide: HitSide // sisi yang dipukul pada ayunan terakhir
  // --- Gergaji mesin (power-up berkala) ---
  treesFelled: number // total pohon yang sudah ditebang (kapak + gergaji)
  chainsawCharge: number // pohon yang ditebang DENGAN KAPAK sejak gergaji terakhir (0..CHAINSAW_EVERY)
  chainsawActive: boolean // gergaji sedang aktif?
  chainsawTimeLeft: number // sisa waktu aktif (detik)
  chainsawFlashSeq: number // naik saat gergaji baru aktif (animasi "mencolok")
  strikeDelay: number // sisa delay proses tebasan gergaji (detik)
  pendingCorrect: boolean // hasil ayunan gergaji yang sedang diproses
  pendingSide: HitSide // sisi ayunan gergaji yang sedang diproses
  sawSeq: number // nomor urut tebasan gergaji (untuk popup teks)
  sawText: SawText // hasil tebasan gergaji terakhir
  sawGain: number // poin dari tebasan gergaji terakhir
  sawSide: HitSide // sisi tebasan gergaji terakhir
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
    swingCooldownMax: SWING_COOLDOWN,
    phase: 'playing',
    transitionElapsed: 0,
    transitionDur: TREE_TRANSITION,
    hitSeq: 0,
    lastHit: 'none',
    lastGain: 0,
    lastSide: 'left',
    treesFelled: 0,
    chainsawCharge: 0,
    chainsawActive: false,
    chainsawTimeLeft: 0,
    chainsawFlashSeq: 0,
    strikeDelay: 0,
    pendingCorrect: false,
    pendingSide: 'left',
    sawSeq: 0,
    sawText: 'none',
    sawGain: 0,
    sawSide: 'left',
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

// Nilai gauge gergaji 0..1: sisa waktu saat aktif, progres pengisian saat belum aktif.
// Menerima bentuk minimal agar bisa dipanggil dari snapshot wire (PlayerNet / TreeViewState).
export function chainsawGauge(state: {
  chainsawActive?: boolean
  chainsawTimeLeft?: number
  chainsawCharge?: number
}): number {
  if (state.chainsawActive) {
    return Math.min(1, Math.max(0, (state.chainsawTimeLeft ?? 0) / CHAINSAW_DURATION))
  }
  return Math.min(1, Math.max(0, (state.chainsawCharge ?? 0) / CHAINSAW_EVERY))
}

// Aktifkan gergaji mesin selama CHAINSAW_DURATION detik.
function activateChainsaw(state: PlayerState): void {
  state.chainsawActive = true
  state.chainsawTimeLeft = CHAINSAW_DURATION
  state.chainsawCharge = 0 // mulai mengisi ulang dari nol
  state.chainsawFlashSeq += 1 // memicu animasi "mencolok" di UI
  // Retak selalu di sisi "1" (index 0) selama gergaji aktif.
  state.fragileSide = 0
}

// Siapkan pohon berikutnya setelah transisi selesai.
function startNextTree(state: PlayerState): void {
  state.treeIndex += 1
  state.maxTime = maxTimeForTree(state.treeIndex)
  state.timeLeft = state.maxTime // reset penuh ke MAX saat itu
  state.rotation = 0

  if (state.chainsawActive) {
    // Saat gergaji aktif: retak selalu di sisi "1" (index 0), separuh acak.
    state.fragileSide = 0
    state.fragileHalf = randInt(2) as 0 | 1
  } else {
    state.fragileSide = randInt(SIDES) // sisi rapuh dipilih ulang acak
    state.fragileHalf = randInt(2) as 0 | 1
  }

  state.hits = 0
  state.swingCooldown = 0
  state.phase = 'playing'
  state.transitionElapsed = 0
  state.transitionDur = TREE_TRANSITION

  // Aktifkan gergaji tiap CHAINSAW_EVERY pohon yang ditebang dengan kapak.
  if (!state.chainsawActive && state.chainsawCharge >= CHAINSAW_EVERY) {
    activateChainsaw(state)
  }
}

// Apakah ayunan ini mengenai titik lemah?
function isCorrect(state: PlayerState, side: HitSide): boolean {
  const facingFragile = state.rotation === state.fragileSide
  return (
    facingFragile &&
    ((side === 'left' && state.fragileHalf === 0) ||
      (side === 'right' && state.fragileHalf === 1))
  )
}

// Proses hasil ayunan gergaji setelah delay (dipanggil dari update()).
function resolveChainsawStrike(state: PlayerState): void {
  const correct = state.pendingCorrect
  const side = state.pendingSide
  state.sawSeq += 1
  state.sawSide = side

  if (correct) {
    // Satu tebasan gergaji langsung merobohkan pohon.
    const gain = SCORE_CORRECT_HIT + SCORE_TREE_FELL
    state.score += gain
    state.hits = HITS_TO_FELL
    state.lastGain = 0 // popup kapak tidak dipakai; poin tampil di teks gergaji
    state.sawGain = gain
    state.sawText = 'perfect'
    state.phase = 'transition'
    state.transitionElapsed = 0
    state.transitionDur = CHAINSAW_TRANSITION
    state.swingCooldown = CHAINSAW_COOLDOWN
    state.treesFelled += 1 // setiap pohon roboh (kapak/gergaji) dihitung
  } else {
    state.timeLeft = Math.max(0, state.timeLeft - WRONG_HIT_PENALTY)
    state.sawGain = 0
    state.sawText = 'good'
    if (state.timeLeft <= 0) state.phase = 'over'
  }

  state.strikeDelay = 0
  state.pendingCorrect = false
}

// Lakukan pukulan. Return hasilnya untuk feedback UI.
export function strike(state: PlayerState, side: HitSide): HitResult {
  // Abaikan bila bukan fase main, masih cooldown, atau sedang memproses tebasan.
  if (state.phase !== 'playing') return 'ignored'
  if (state.strikeDelay > 0) return 'ignored'
  if (state.swingCooldown > 0) return 'ignored'

  const correct = isCorrect(state, side)

  state.hitSeq += 1
  state.lastSide = side

  // --- Mode gergaji mesin ---
  if (state.chainsawActive) {
    state.swingCooldown = CHAINSAW_COOLDOWN
    state.swingCooldownMax = CHAINSAW_COOLDOWN
    state.pendingCorrect = correct
    state.pendingSide = side
    // Delay proses penebangan: 0.5 dtk bila benar, 1 dtk bila salah.
    state.strikeDelay = correct ? CHAINSAW_HIT_DELAY : CHAINSAW_MISS_DELAY
    // Tampilkan retak penuh selama proses potong.
    if (correct) state.hits = HITS_TO_FELL
    state.lastHit = 'none' // popup kapak tidak muncul saat gergaji
    return 'chainsaw'
  }

  // --- Mode kapak biasa ---
  state.swingCooldown = SWING_COOLDOWN
  state.swingCooldownMax = SWING_COOLDOWN

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
      state.transitionDur = TREE_TRANSITION
      state.swingCooldown = SWING_COOLDOWN // cooldown di-reset penuh
      state.treesFelled += 1
      state.chainsawCharge += 1 // hanya tebasan kapak yang mengisi gergaji
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
  // Waktu gergaji mesin berjalan TERUS, termasuk saat transisi antar pohon.
  if (state.chainsawActive) {
    state.chainsawTimeLeft = Math.max(0, state.chainsawTimeLeft - dt)
    if (state.chainsawTimeLeft <= 0) {
      state.chainsawActive = false
    }
  }

  // Kurangi cooldown ayunan.
  if (state.swingCooldown > 0) {
    state.swingCooldown = Math.max(0, state.swingCooldown - dt)
  }

  // Delay proses tebasan gergaji: hasilnya baru diterapkan setelah delay.
  if (state.strikeDelay > 0) {
    state.strikeDelay = Math.max(0, state.strikeDelay - dt)
    if (state.strikeDelay <= 0) resolveChainsawStrike(state)
  }

  // Fase transisi: timer BEKU, hanya menghitung durasi transisi.
  if (state.phase === 'transition') {
    state.transitionElapsed += dt
    if (state.transitionElapsed >= state.transitionDur) {
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