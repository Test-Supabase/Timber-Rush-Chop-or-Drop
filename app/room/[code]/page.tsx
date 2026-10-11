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
    <main className="h-screen overflow-hidden">
      <RealtimeView roomCode={code} playerName={playerName} />
    </main>
  )
}