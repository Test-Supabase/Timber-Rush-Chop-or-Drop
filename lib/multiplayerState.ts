'use client'

// ============================================================
// LOGIKA MULTIPLAYER LOKAL (4 pemain di 1 browser).
// State independen per pemain, eliminasi berdasarkan timeLeft=0,
// juara = pemain terakhir hidup.
// ============================================================

import {
  type PlayerState,
  createPlayerState,
  update as updatePlayer,
  rotate,
  strike,
  type HitSide,
} from './gameState'
import {
  AI_REACT_MIN,
  AI_REACT_MAX,
  AI_ACCURACY,
  PLAYERS_PER_ROOM,
} from './constants'

export interface MultiplayerPlayer {
  id: string
  name: string
  isAi: boolean
  state: PlayerState
  nextAiAction: number // detik hingga aksi AI berikutnya
  eliminatedOrder: number // 0 = belum, >0 = urutan eliminasi
  rank: number // 1 = juara, 4 = pertama tereliminasi
}

export interface MultiplayerState {
  players: MultiplayerPlayer[]
  myId: string
  phase: 'playing' | 'result'
  eliminatedCount: number
  winnerId: string | null
}

const AI_NAMES = ['Budi', 'Andi', 'Siti']

function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function newAiDelay(): number {
  return randFloat(AI_REACT_MIN, AI_REACT_MAX)
}

/** Buat state multiplayer: pemain 0 = user, sisanya AI. */
export function createMultiplayerState(playerName: string): MultiplayerState {
  const players: MultiplayerPlayer[] = []
  for (let i = 0; i < PLAYERS_PER_ROOM; i++) {
    const isAi = i > 0
    players.push({
      id: `p${i}`,
      name: isAi ? AI_NAMES[i - 1] : playerName,
      isAi,
      state: createPlayerState(),
      nextAiAction: isAi ? newAiDelay() : 0,
      eliminatedOrder: 0,
      rank: 0,
    })
  }
  return {
    players,
    myId: 'p0',
    phase: 'playing',
    eliminatedCount: 0,
    winnerId: null,
  }
}

/** Update semua pemain. Deteksi eliminasi baru & juara. */
export function updateMultiplayer(state: MultiplayerState, dt: number): void {
  if (state.phase !== 'playing') return

  // Update tiap pemain
  for (const p of state.players) {
    const wasAlive = p.state.phase !== 'over'
    if (!wasAlive) continue

    if (p.isAi) runAi(state, p, dt)
    updatePlayer(p.state, dt)

    // Deteksi eliminasi baru
    const nowOut = (p.state.phase as string) === 'over'
    if (nowOut && wasAlive) {
      state.eliminatedCount += 1
      p.eliminatedOrder = state.eliminatedCount
    }
  }

  // Cek apakah match selesai
  const alive = state.players.filter((p) => p.state.phase !== 'over')
  if (alive.length <= 1) finishMatch(state, alive[0]?.id || null)
}

/** AI sederhana: jeda acak lalu putar ke sisi rapuh, pukul. */
function runAi(state: MultiplayerState, p: MultiplayerPlayer, dt: number): void {
  p.nextAiAction -= dt
  if (p.nextAiAction > 0) return
  p.nextAiAction = newAiDelay()

  const s = p.state
  if (s.phase !== 'playing') return

  // Belum menghadap sisi rapuh: putar ke sisi rapuh terdekat
  if (s.rotation !== s.fragileSide) {
    const steps = (s.fragileSide - s.rotation + PLAYERS_PER_ROOM) % PLAYERS_PER_ROOM
    rotate(s, steps <= 2 ? 'right' : 'left')
    return
  }

  // Menghadap sisi rapuh: pukul separuh yang benar (dengan akurasi AI)
  const correctSide: HitSide = s.fragileHalf === 0 ? 'left' : 'right'
  const wrongSide: HitSide = correctSide === 'left' ? 'right' : 'left'
  strike(s, Math.random() < AI_ACCURACY ? correctSide : wrongSide)
}

/** Akhiri match, beri peringkat. */
function finishMatch(state: MultiplayerState, winnerId: string | null): void {
  state.phase = 'result'
  state.winnerId = winnerId

  // Pemenang (jika ada) peringkat 1
  if (winnerId) {
    const winner = state.players.find((p) => p.id === winnerId)
    if (winner) winner.rank = 1
  }

  // Peringkat berdasarkan urutan eliminasi (baling-balik)
  const losers = state.players.filter((p) => p.id !== winnerId)
  losers.sort((a, b) => b.eliminatedOrder - a.eliminatedOrder)
  losers.forEach((p, i) => {
    p.rank = i + 2
  })
}

/** Leaderboard saat bermain: hidup dulu, skor desc, timeLeft desc. */
export function sortLeaderboard(players: MultiplayerPlayer[]): MultiplayerPlayer[] {
  return [...players].sort((a, b) => {
    const aAlive = a.state.phase !== 'over'
    const bAlive = b.state.phase !== 'over'
    if (aAlive !== bAlive) return aAlive ? -1 : 1
    if (a.state.score !== b.state.score) return b.state.score - a.state.score
    return b.state.timeLeft - a.state.timeLeft
  })
}

/** Pemain yang masih hidup. */
export function alivePlayers(players: MultiplayerPlayer[]): MultiplayerPlayer[] {
  return players.filter((p) => p.state.phase !== 'over')
}

/** Pukul pohon pemain tertentu. */
export function strikePlayer(
  state: MultiplayerState,
  playerId: string,
  side: HitSide
) {
  const p = state.players.find((x) => x.id === playerId)
  if (!p) return
  return strike(p.state, side)
}

/** Putar pohon pemain tertentu. */
export function rotatePlayer(
  state: MultiplayerState,
  playerId: string,
  dir: 'left' | 'right'
) {
  const p = state.players.find((x) => x.id === playerId)
  if (p) rotate(p.state, dir)
}