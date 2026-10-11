'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createRoom, listPublicRooms, roomExists, getRoomInfo, type PublicRoom } from '@/lib/rooms'
import { ROOM_CODE_LENGTH, PLAYERS_PER_ROOM, PUBLIC_ROOMS_REFRESH_MS, BOT_JOIN_WARNING_MS } from '@/lib/constants'

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
  const [botWarning, setBotWarning] = useState<{ code: string; secondsLeft: number } | null>(null)

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
  // Bila room berisi bot, tampilkan peringatan hitung mundur dulu.
  const proceedJoin = (code: string, finalName: string) => {
    setBotWarning(null)
    goToRoom(code, finalName)
  }

  const requestJoin = async (code: string) => {
    if (busy) return
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
      const info = await getRoomInfo(code)
      if (info?.has_bot) {
        // Peringatan: bot akan menyingkir (room penuh) atau tetap ada bila kursi cukup.
        setBotWarning({ code, secondsLeft: BOT_JOIN_WARNING_MS / 1000 })
        setBusy(false)
        return
      }
      proceedJoin(code, finalName)
    } catch {
      setMessage('Gagal memeriksa room. Coba lagi.')
      setBusy(false)
    }
  }

  const handleJoinRoom = async () => {
    const code = roomCode.trim().toUpperCase()
    if (code.length !== ROOM_CODE_LENGTH) {
      setMessage(`Kode room harus ${ROOM_CODE_LENGTH} karakter.`)
      return
    }
    await requestJoin(code)
  }

  const handleJoinPublic = async (code: string) => {
    await requestJoin(code)
  }

  // Hitung mundur peringatan bot; saat habis, lanjut gabung otomatis.
  useEffect(() => {
    if (!botWarning) return
    if (botWarning.secondsLeft <= 0) {
      const code = botWarning.code
      setBotWarning(null)
      proceedJoin(code, persistName())
      return
    }
    const id = setTimeout(
      () => setBotWarning((w) => (w ? { ...w, secondsLeft: w.secondsLeft - 1 } : w)),
      1000
    )
    return () => clearTimeout(id)
  }, [botWarning])

  return (
    <main className="flex min-h-screen items-start justify-center p-4 py-10">
      {/* Peringatan join ke room berisi bot */}
      {botWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl border-4 border-ink bg-white p-6 text-center shadow-2xl">
            <div className="text-5xl">🤖</div>
            <h2 className="mt-2 text-xl font-extrabold text-danger">
              Room Ini Berisi BOT!
            </h2>
            <p className="mt-2 text-sm font-bold text-ink/70">
              Kamu akan bergabung ke room <span className="font-extrabold">{botWarning.code}</span> yang
              memiliki pemain BOT. Lanjut dalam{' '}
              <span className="text-lg font-extrabold text-danger">{botWarning.secondsLeft}</span> detik...
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setBotWarning(null)}
                className="flex-1 rounded-xl border-4 border-ink bg-white px-4 py-3 text-base font-extrabold text-ink active:translate-y-1"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const code = botWarning.code
                  setBotWarning(null)
                  proceedJoin(code, persistName())
                }}
                className="flex-1 rounded-xl border-4 border-ink bg-leaf px-4 py-3 text-base font-extrabold text-white active:translate-y-1"
              >
                Lanjut
              </button>
            </div>
          </div>
        </div>
      )}

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
                    <div className="flex items-center gap-2 font-extrabold tracking-widest text-ink">
                      {room.code}
                      {room.has_bot && (
                        <span className="rounded-full border-2 border-danger bg-danger/10 px-2 py-0.5 text-xs font-extrabold tracking-normal text-danger">
                          🤖 BOT
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-ink/60">
                      oleh {room.creator_name || 'Pemain'} • {room.human_count}/{PLAYERS_PER_ROOM} pemain asli
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