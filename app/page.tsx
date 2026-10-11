'use client'

import { useState } from 'react'

// Landing page: input nama + tombol Buat Room / Gabung Room.
// Tahap Dev 1: hanya state lokal & navigasi placeholder (belum koneksi DB).

export default function LandingPage() {
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')

  // Placeholder: kode 6 karakter dibuat lokal. Koneksi DB dikerjakan di Dev 4.
  const handleCreateRoom = () => {
    alert(`TODO Dev 4: buat room sebagai "${name || 'Pemain'}"`)
  }

  const handleJoinRoom = () => {
    alert(`TODO Dev 4: gabung room "${roomCode.toUpperCase()}" sebagai "${name || 'Pemain'}"`)
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
          className="w-full rounded-xl border-4 border-ink bg-sun px-4 py-3 text-lg font-extrabold text-ink shadow-[0_4px_0_#2b1d0e] active:translate-y-1 active:shadow-none"
        >
          Gabung Room
        </button>
      </div>
    </main>
  )
}
