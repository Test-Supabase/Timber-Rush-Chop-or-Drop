'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createRoom, listPublicRooms, roomExists, type PublicRoom } from '@/lib/rooms'
import { ROOM_CODE_LENGTH, PLAYERS_PER_ROOM, PUBLIC_ROOMS_REFRESH_MS } from '@/lib/constants'

type Visibility = 'public' | 'private'

export default function LandingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([])
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Nama dari localStorage.
  useEffect(() => {
    const stored = localStorage.getItem('timber-rush-player-name')
    if (stored) setName(stored)
  }, [])

  useEffect(() => {
    if (name.trim()) localStorage.setItem('timber-rush-player-name', name.trim())
  }, [name])

  // Muat daftar room publik.
  const refreshRooms = useCallback(async () => {
    setLoadingRooms(true)
    try {
      setPublicRooms(await listPublicRooms())
    } catch {
      setMessage('Gagal memuat daftar room. Periksa koneksi.')
    } finally {
      setLoadingRooms(false)
    }
  }, [])

  useEffect(() => {
    refreshRooms()
    // Segarkan daftar berkala agar room baru muncul otomatis.
    const id = setInterval(refreshRooms, PUBLIC_ROOMS_REFRESH_MS)
    return () => clearInterval(id)
  }, [refreshRooms])

  const persistName = () => {
    const finalName = name.trim() || 'Pemain'
    localStorage.setItem('timber-rush-player-name', finalName)
    return finalName
  }

  const goToRoom = (code: string, finalName: string) => {
    router.push(`/room/${code}?name=${encodeURIComponent(finalName)}`)
  }

  // Buat room baru sesuai pilihan Public/Private.
  const handleCreateRoom = async () => {
    if (busy) return
    setBusy(true)
    setMessage(null)
    const finalName = persistName()
    try {
      const code = await createRoom(visibility === 'private', finalName)
      goToRoom(code, finalName)
    } catch {
      setMessage('Gagal membuat room. Coba lagi.')
      setBusy(false)
    }
  }

  // Gabung room: kode WAJIB ada di database.
  const handleJoinRoom = async () => {
    if (busy) return
    const code = roomCode.trim().toUpperCase()
    if (code.length !== ROOM_CODE_LENGTH) {
      setMessage(`Kode room harus ${ROOM_CODE_LENGTH} karakter.`)
      return
    }
    setBusy(true)
    setMessage(null)
    const finalName = persistName()
    try {
      const exists = await roomExists(code)
      if (!exists) {
        setMessage('Room tidak ditemukan. Pastikan kode benar dan room masih aktif.')
        setBusy(false)
        return
      }
      goToRoom(code, finalName)
    } catch {
      setMessage('Gagal memeriksa room. Coba lagi.')
      setBusy(false)
    }
  }

  const handleJoinPublic = (code: string) => {
    const finalName = persistName()
    goToRoom(code, finalName)
  }

  return (
    <main className="flex min-h-screen items-start justify-center p-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-3xl border-4 border-ink bg-white/90 p-6 shadow-xl">
          <div className="mb-6 flex flex-col items-center gap-2">
            <div className="axe-icon" aria-hidden="true" />
            <h1 className="text-center text-3xl font-extrabold text-bark-dark">
              Timber Rush
            </h1>
            <p className="text-center text-lg font-bold text-leaf-dark">Chop or Drop</p>
          </div>

          <label className="mb-1 block text-sm font-bold" htmlFor="name">
            Nama Penebang
          </label>
          <input
            id="name"
            type="text"
            maxLength={12}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Budi"
            className="mb-4 w-full rounded-xl border-4 border-ink px-4 py-3 text-lg outline-none focus:border-leaf"
          />

          {/* Pilihan visibilitas room */}
          <div className="mb-4">
            <span className="mb-2 block text-sm font-bold">Tipe Room</span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`rounded-xl border-4 px-3 py-3 text-left transition-colors ${
                  visibility === 'public'
                    ? 'border-leaf bg-leaf/15'
                    : 'border-ink/30 bg-white'
                }`}
              >
                <div className="text-lg font-extrabold text-ink">🌍 Publik</div>
                <div className="text-xs font-bold text-ink/60">
                  Muncul di daftar room
                </div>
              </button>
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`rounded-xl border-4 px-3 py-3 text-left transition-colors ${
                  visibility === 'private'
                    ? 'border-leaf bg-leaf/15'
                    : 'border-ink/30 bg-white'
                }`}
              >
                <div className="text-lg font-extrabold text-ink">🔒 Privat</div>
                <div className="text-xs font-bold text-ink/60">
                  Hanya via kode
                </div>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateRoom}
            disabled={busy}
            className="mb-4 w-full rounded-xl border-4 border-ink bg-leaf px-4 py-3 text-lg font-extrabold text-white shadow-[0_4px_0_#2b1d0e] disabled:opacity-50 active:translate-y-1 active:shadow-none"
          >
            {busy ? 'Memproses…' : `Buat Room ${visibility === 'public' ? 'Publik' : 'Privat'}`}
          </button>

          <div className="mb-3 flex items-center gap-2">
            <hr className="flex-1 border-ink/40" />
            <span className="text-sm font-bold text-ink/60">atau</span>
            <hr className="flex-1 border-ink/40" />
          </div>

          <input
            type="text"
            maxLength={ROOM_CODE_LENGTH}
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder={`KODE ROOM (${ROOM_CODE_LENGTH} karakter)`}
            className="mb-3 w-full rounded-xl border-4 border-ink px-4 py-3 text-center text-lg font-bold uppercase tracking-widest outline-none focus:border-leaf"
          />

          <button
            type="button"
            onClick={handleJoinRoom}
            disabled={busy || roomCode.trim().length !== ROOM_CODE_LENGTH}
            className="w-full rounded-xl border-4 border-ink bg-sun px-4 py-3 text-lg font-extrabold text-ink shadow-[0_4px_0_#2b1d0e] disabled:opacity-50 active:translate-y-1 active:shadow-none"
          >
            Gabung dengan Kode
          </button>

          {message && (
            <p className="mt-3 rounded-xl border-2 border-danger/40 bg-danger/10 px-3 py-2 text-center text-sm font-bold text-danger">
              {message}
            </p>
          )}
        </div>

        {/* Daftar room publik */}
        <div className="rounded-3xl border-4 border-ink bg-white/90 p-5 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-bark-dark">
              🌍 Room Publik
            </h2>
            <button
              type="button"
              onClick={refreshRooms}
              className="text-sm font-bold text-leaf-dark underline"
            >
              Muat ulang
            </button>
          </div>

          {loadingRooms ? (
            <p className="py-4 text-center text-sm font-bold text-ink/60">
              Memuat…
            </p>
          ) : publicRooms.length === 0 ? (
            <p className="py-4 text-center text-sm font-bold text-ink/60">
              Belum ada room publik. Buat salah satu!
            </p>
          ) : (
            <ul className="space-y-2">
              {publicRooms.map((room) => (
                <li
                  key={room.code}
                  className="flex items-center justify-between rounded-xl border-2 border-ink/20 bg-white px-3 py-2"
                >
                  <div>
                    <div className="font-extrabold tracking-widest text-ink">
                      {room.code}
                    </div>
                    <div className="text-xs font-bold text-ink/60">
                      oleh {room.creator_name || 'Pemain'} • maks {PLAYERS_PER_ROOM} pemain
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJoinPublic(room.code)}
                    className="rounded-lg border-2 border-ink bg-leaf px-3 py-1.5 text-sm font-extrabold text-white active:translate-y-0.5"
                  >
                    Gabung
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}