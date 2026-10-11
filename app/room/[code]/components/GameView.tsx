'use client'

// GameView: layout game Dev 2 (single-player).
// State game disimpan di useRef (BUKAN useState) dan diperbarui lewat
// requestAnimationFrame. Re-render React hanya dipicu lewat "commit view"
// ringan (timer/skor/fase) agar tidak 60x/detik.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createPlayerState,
  rotate,
  strike,
  update,
  type HitResult,
  type HitSide,
  type PlayerState,
} from '@/lib/gameState'
import TreePanel from './TreePanel'
import TimerBar from './TimerBar'
import HitPopup, { type HitEvent } from './HitPopup'

export default function GameView() {
  // State permainan (mutable) di ref — tidak memicu re-render.
  const stateRef = useRef<PlayerState>(createPlayerState())

  // Arah pukul terakhir (untuk keyboard Space). Default kiri.
  const lastAimRef = useRef<HitSide>('left')

  // Snapshot ringan untuk React (diupdate ~10x/detik saja).
  const [view, setView] = useState(() => ({
    timeLeft: stateRef.current.timeLeft,
    maxTime: stateRef.current.maxTime,
    score: stateRef.current.score,
    treeIndex: stateRef.current.treeIndex,
    phase: stateRef.current.phase,
  }))

  // Feedback "DEFLEKSI!" + getar layar.
  const [feedback, setFeedback] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  // Popup pukulan (bintang "+poin" / kotak "MISS").
  const [hitEvent, setHitEvent] = useState<HitEvent | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const rafRef = useRef<number>(0)
  const lastCommitRef = useRef<number>(0)
  const lastRef = useRef<number>(0)

  // Loop game.
  useEffect(() => {
    const loop = (now: number) => {
      if (!lastRef.current) lastRef.current = now
      const dt = Math.min((now - lastRef.current) / 1000, 0.05)
      lastRef.current = now

      update(stateRef.current, dt)

      // Commit view ringan setiap ~100ms (bukan tiap frame).
      if (now - lastCommitRef.current >= 100) {
        lastCommitRef.current = now
        const s = stateRef.current
        setView({
          timeLeft: s.timeLeft,
          maxTime: s.maxTime,
          score: s.score,
          treeIndex: s.treeIndex,
          phase: s.phase,
        })
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    }
  }, [])

  // Aksi pukul.
  const handleStrike = useCallback((side: HitSide) => {
    lastAimRef.current = side
    const result: HitResult = strike(stateRef.current, side)
    if (result === 'ignored') return
    const s = stateRef.current
    // Popup di area batang: bintang "+poin" bila benar, kotak "MISS" bila salah.
    setHitEvent({
      seq: s.hitSeq,
      result: result === 'wrong' ? 'wrong' : 'correct',
      gain: s.lastGain,
      side,
    })
    if (result === 'wrong') {
      setFeedback('DEFLEKSI!')
      setShake(true)
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
      feedbackTimer.current = setTimeout(() => {
        setFeedback(null)
        setShake(false)
      }, 500)
    }
    // Paksa commit cepat agar bar & skor langsung terasa responsif.
    lastCommitRef.current = 0
  }, [])

  const handleRotate = useCallback((dir: 'left' | 'right') => {
    rotate(stateRef.current, dir)
  }, [])

  // Input keyboard: A/D atau panah = putar, Space = pukul.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      switch (e.key) {
        case 'a':
        case 'A':
        case 'ArrowLeft':
          handleRotate('left')
          break
        case 'd':
        case 'D':
        case 'ArrowRight':
          handleRotate('right')
          break
        case ' ':
          e.preventDefault()
          // Space = pukul ke arah bidikan terakhir (klik terakhir). Default kiri.
          handleStrike(lastAimRef.current)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleRotate, handleStrike])

  // getState dibaca oleh TreePanel tiap frame.
  const getState = useCallback(() => {
    const s = stateRef.current
    return {
      rotation: s.rotation,
      fragileSide: s.fragileSide,
      fragileHalf: s.fragileHalf,
      hits: s.hits,
      phase: s.phase,
      transitionElapsed: s.transitionElapsed,
      hitSeq: s.hitSeq,
      lastHit: s.lastHit,
      lastGain: s.lastGain,
      lastSide: s.lastSide,
      swingCooldown: s.swingCooldown,
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <div className="w-full max-w-md text-center text-sm font-bold text-ink">
        Pohon #{view.treeIndex} • Skor {view.score}
      </div>

      <TimerBar timeLeft={view.timeLeft} maxTime={view.maxTime} />

      <div className={`relative h-[420px] w-full max-w-md ${shake ? 'animate-shake' : ''}`}>
        <TreePanel getState={getState} onStrike={handleStrike} onRotate={handleRotate} />
        <HitPopup event={hitEvent} />
      </div>

      <div className="h-8">
        {feedback && (
          <span className="animate-pulse text-2xl font-extrabold text-danger">
            {feedback}
          </span>
        )}
      </div>

      {view.phase === 'over' && (
        <div className="mt-2 flex flex-col items-center gap-2">
          <div className="text-2xl font-extrabold text-danger">
            TERELIMINASI!
          </div>
          <div className="text-lg font-bold text-ink">Skor akhir: {view.score}</div>
          <button
            type="button"
            onClick={() => {
              stateRef.current = createPlayerState()
              lastRef.current = 0
              lastCommitRef.current = 0
            }}
            className="rounded-xl border-4 border-ink bg-leaf px-6 py-3 text-lg font-extrabold text-white shadow-[0_4px_0_#2b1d0e] active:translate-y-1 active:shadow-none"
          >
            Coba Lagi
          </button>
        </div>
      )}
    </div>
  )
}