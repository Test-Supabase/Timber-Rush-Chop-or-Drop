'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Landing page: input nama + tombol Buat Room / Gabung Room.
// Dev 4: nama disimpan ke localStorage, navigasi ke /room/[code] berfungsi.

function generateRoomCode(): string {
  // 6 karakter alfanumerik uppercase.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // tanpa I/O/0/1 agar tidak ambigu
  let code = ''
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length))
  return code
}

export default function LandingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')

  // Baca nama dari localStorage saat pertama kali mount.
  useEffect(() => {
    const stored = localStorage.getItem('timber-rush-player-name')
    if (stored) setName(stored)
  }, [])

  // Simpan nama ke localStorage setiap kali berubah.
  useEffect(() => {
    if (name.trim()) localStorage.setItem('timber-rush-player-name', name.trim())
  }, [name])

  const handleCreateRoom = () => {
    const finalName = name.trim() || 'Pemain'
    localStorage.setItem('timber-rush-player-name', finalName)
    const code = generateRoomCode()
    router.push(`/room/${code}?name=${encodeURIComponent(finalName)}`)
  }

  const handleJoinRoom = () => {
    const finalName = name.trim() || 'Pemain'
    localStorage.setItem('timber-rush-player-name', finalName)
    const code = roomCode.trim().toUpperCase()
    if (code.length !== 6) {
      alert('Kode room harus 6 karakter.')
      return
    }
    router.push(`/room/${code}?name=${encodeURIComponent(finalName)}`)
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border-4 border-ink bg-white/90 p-6 shadow-xl">
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

        <button
          type="button"
          onClick={handleCreateRoom}
          className="mb-4 w-full rounded-xl border-4 border-ink bg-leaf px-4 py-3 text-lg font-extrabold text-white shadow-[0_4px_0_#2b1d0e] active:translate-y-1 active:shadow-none"
        >
          Buat Room
        </button>

        <div className="mb-2 flex items-center gap-2">
          <hr className="flex-1 border-ink/40" />
          <span className="text-sm font-bold text-ink/60">atau</span>
          <hr className="flex-1 border-ink/40" />
        </div>

        <input
          type="text"
          maxLength={6}
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="KODE ROOM (6 karakter)"
          className="mb-3 w-full rounded-xl border-4 border-ink px-4 py-3 text-center text-lg font-bold tracking-widest uppercase outline-none focus:border-leaf"
        />

        <button
          type="button"
          onClick={handleJoinRoom}
          disabled={roomCode.trim().length !== 6}
          className="w-full rounded-xl border-4 border-ink bg-sun px-4 py-3 text-lg font-extrabold text-ink shadow-[0_4px_0_#2b1d0e] disabled:opacity-50 active:translate-y-1 active:shadow-none"
        >
          Gabung Room
        </button>
      </div>
    </main>
  )
}