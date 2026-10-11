'use client'

// ============================================================
// Hook multiplayer lokal: 4 pemain (1 user + 3 AI).
// State mutable disimpan di useRef; loop=requestAnimationFrame.
// React hanya re-render pada "commit view" ringan (~10x/detik).
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createMultiplayerState,
  updateMultiplayer,
  rotatePlayer,
  strikePlayer,
  sortLeaderboard,
  alivePlayers,
  type MultiplayerState,
} from '@/lib/multiplayerState'
import type { HitSide, HitResult, RotateDir } from '@/lib/gameState'
import type { HitEvent } from '@/lib/hitEffects'

/** Cuplikan ringan untuk re-render React (bukan state penuh per frame). */
interface LeaderRow {
  id: string
  name: string
  score: number
  timeLeft: number
  alive: boolean
  isMe: boolean
  rank: number
  treeIndex: number
  maxTime: number
}

/** Bentuk state yang dibaca TreePanel tiap frame. */
export interface TreeViewState {
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
}

const VIEW_COMMIT_INTERVAL = 100 // ms

export function useMultiplayer(playerName: string) {
  const stateRef = useRef<MultiplayerState>(createMultiplayerState(playerName))

  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([])
  const [phase, setPhase] = useState<'playing' | 'result'>('playing')
  const [winnerId, setWinnerId] = useState<string | null>(null)

  // Feedback pukulan salah.
  const [feedback, setFeedback] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  // Popup pukulan (bintang "+poin" / kotak "MISS") untuk pemain kita.
  const [hitEvent, setHitEvent] = useState<HitEvent | null>(null)

  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const lastCommitRef = useRef(0)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Loop game.
  useEffect(() => {
    const loop = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now
      // Batasi dt agar frame panjang tidak menyebabkan lompatan timer.
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = now

      updateMultiplayer(stateRef.current, dt)

      // Commit ringan ke React.
      if (now - lastCommitRef.current >= VIEW_COMMIT_INTERVAL) {
        lastCommitRef.current = now
        const s = stateRef.current
        setLeaderboard(
          sortLeaderboard(s.players).map((p) => ({
            id: p.id,
            name: p.name,
            score: p.state.score,
            timeLeft: p.state.timeLeft,
            alive: p.state.phase !== 'over',
            isMe: p.id === s.myId,
            rank: p.rank,
            treeIndex: p.state.treeIndex,
            maxTime: p.state.maxTime,
          }))
        )
        setPhase(s.phase)
        setWinnerId(s.winnerId)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    }
  }, [])

  // TreePanel membaca state pemain user langsung dari ref (tanpa re-render).
  const getMyState = useCallback((): TreeViewState => {
    const s = stateRef.current.players.find((p) => p.id === stateRef.current.myId)
    if (!s) {
      return {
        rotation: 0,
        fragileSide: 0,
        fragileHalf: 0,
        hits: 0,
        phase: 'over',
        transitionElapsed: 0,
        swingCooldown: 0,
      }
    }
    return {
      rotation: s.state.rotation,
      fragileSide: s.state.fragileSide,
      fragileHalf: s.state.fragileHalf,
      hits: s.state.hits,
      phase: s.state.phase,
      transitionElapsed: s.state.transitionElapsed,
      hitSeq: s.state.hitSeq,
      lastHit: s.state.lastHit,
      lastGain: s.state.lastGain,
      lastSide: s.state.lastSide,
      swingCooldown: s.state.swingCooldown,
    }
  }, [])

  // Aksi pukul.
  const handleStrike = useCallback((side: HitSide) => {
    const result: HitResult = strikePlayer(stateRef.current, stateRef.current.myId, side) ?? 'ignored'
    if (result === 'ignored') return

    // Popup di area batang untuk pemain kita.
    const me = stateRef.current.players.find((p) => p.id === stateRef.current.myId)
    if (me) {
      setHitEvent({
        seq: me.state.hitSeq,
        result: result === 'wrong' ? 'wrong' : 'correct',
        gain: me.state.lastGain,
        side,
      })
    }

    if (result === 'wrong') {
      setFeedback('DEFLEKSI!')
      setShake(true)
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
      feedbackTimer.current = setTimeout(() => {
        setFeedback(null)
        setShake(false)
      }, 500)
    }
    // Paksa commit segera agar bar & skor terasa responsif.
    lastCommitRef.current = 0
  }, [])

  // Aksi putar.
  const handleRotate = useCallback((dir: RotateDir) => {
    rotatePlayer(stateRef.current, stateRef.current.myId, dir)
  }, [])

  // Restart match (untuk tombol "Main Lagi").
  const restart = useCallback(() => {
    stateRef.current = createMultiplayerState(playerName)
    lastTimeRef.current = 0
    lastCommitRef.current = 0
    setFeedback(null)
    setShake(false)
    setHitEvent(null)
  }, [playerName])

  return {
    leaderboard,
    phase,
    winnerId,
    aliveCount: alivePlayers(stateRef.current.players).length,
    feedback,
    shake,
    hitEvent,
    getMyState,
    handleStrike,
    handleRotate,
    restart,
  }
}