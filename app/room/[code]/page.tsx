// Orkestrator room: LOBBY -> COUNTDOWN -> PLAYING -> RESULT
// Dev 4: menggunakan RealtimeView (multiplayer realtime via Supabase).

import RealtimeView from './components/RealtimeView'

interface SearchParams {
  name?: string
}

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<SearchParams>
}) {
  const { code } = await params
  const search = await searchParams
  const playerName = search.name?.trim() || 'Pemain'

  return (
    <main className="min-h-screen">
      {/* Penanda kode room; digunakan untuk channel `room:<code>` */}
      <div className="pt-4 text-center text-sm font-bold text-ink/60">
        ROOM {code.toUpperCase()}
      </div>
      <RealtimeView roomCode={code} playerName={playerName} />
    </main>
  )
}