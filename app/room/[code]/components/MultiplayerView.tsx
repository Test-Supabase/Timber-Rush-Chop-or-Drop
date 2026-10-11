'use client'

import { useCallback, useState } from 'react'
import { useMultiplayer, type TreeViewState } from '@/hooks/useMultiplayer'
import TreePanel from './TreePanel'
import TimerBar from './TimerBar'
import TopBar from './TopBar'
import ResultView from './ResultView'

export default function MultiplayerView() {
  const {
    leaderboard,
    phase,
    winnerId,
    aliveCount,
    feedback,
    shake,
    getMyState,
    handleStrike,
    handleRotate,
    restart,
  } = useMultiplayer('Anda')

  const myPlayer = leaderboard.find((p) => p.isMe)

  // --- UI Feedback & Animasi ---

  // Feedback DEFLEKSI! + getar layar.
  const shakeStyle = shake ? 'animate-shake' : ''

  // Tombol "Main Lagi" muncul di hasil akhir.
  const onRestart = useCallback(() => {
    restart()
  }, [restart])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      {/* TopBar: leaderboard 3 teratas */}
      {phase === 'playing' && <TopBar players={leaderboard} myId={myPlayer?.id || ''} />}

      {/* Area utama */}
      <div className="w-full max-w-4xl flex flex-col items-center justify-center gap-4">
        {/* Info pemain yang dikontrol user */}
        {myPlayer && phase === 'playing' && (
          <div className="text-center text-sm font-bold text-ink">
            Pohon #{myPlayer.treeIndex} • Skor {myPlayer.score}
          </div>
        )}

        {/* Timer pemain yang dikontrol user */}
        {myPlayer && (
          <TimerBar timeLeft={myPlayer.timeLeft} maxTime={myPlayer.maxTime} />
        )}

        {/* TreePanel (untuk pemain yang dikontrol user) */}
        <div className={`h-[420px] w-full max-w-md ${shakeStyle}`}>
          <TreePanel
            getState={getMyState}
            onStrike={handleStrike}
            onRotate={handleRotate}
          />
        </div>

        {/* Overlay bila pemain user sudah tereliminasi tapi match masih jalan */}
        {myPlayer && !myPlayer.alive && phase === 'playing' && (
          <div className="text-center">
            <div className="text-2xl font-extrabold text-danger">TERELIMINASI!</div>
            <div className="text-sm font-bold text-ink/70">
              Menonton {aliveCount} pemain tersisa…
            </div>
          </div>
        )}

        {/* Feedback visual saat pukulan salah */}
        <div className="h-8">
          {feedback && (
            <span className="animate-pulse text-2xl font-extrabold text-danger">
              {feedback}
            </span>
          )}
        </div>

        {/* Hasil akhir */}
        {phase === 'result' && (
          <ResultView
            players={leaderboard.map((p) => ({
              id: p.id,
              name: p.name,
              score: p.score,
              rank: p.rank,
              isMe: p.isMe,
            }))}
            myRank={myPlayer?.rank || 0}
            onRestart={onRestart}
          />
        )}
      </div>
    </div>
  )
}