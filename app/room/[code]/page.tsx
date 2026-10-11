import GameView from './components/GameView'

// Orkestrator room: LOBBY -> COUNTDOWN -> PLAYING -> RESULT
// Dev 2: langsung menampilkan GameView (single-player) untuk pengujian.
// TODO Dev 3: state machine alur permainan (lobby, countdown, result).
// TODO Dev 4: sambungkan ke Supabase Realtime.

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  return (
    <main className="min-h-screen">
      {/* Penanda kode room; nanti dipakai untuk channel `room:<code>` (Dev 4). */}
      <div className="pt-4 text-center text-sm font-bold text-ink/60">
        ROOM {code.toUpperCase()}
      </div>
      <GameView />
    </main>
  )
}
