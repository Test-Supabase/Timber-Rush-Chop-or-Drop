import { supabase } from './supabase'
import { ROOM_TTL_HOURS, ROOM_CODE_LENGTH } from './constants'

// ============================================================
// Helper room (tabel `rooms` di Supabase).
// - Room PUBLIK muncul di daftar & bisa digabung siapa pun.
// - Room PRIVAT hanya bisa digabung oleh yang tahu kodenya.
// - Semua room kedaluwarsa setelah ROOM_TTL_HOURS jam (TTL) agar
//   daftar tidak menumpuk; Aplikasi tidak memakai auth, jadi TTL
//   dipakai sebagai pembersih alami tanpa policy DELETE terbuka.
// ============================================================

export interface PublicRoom {
  code: string
  creator_name: string | null
  created_at: string
}

// Ambang waktu TTL (ISO string).
function ttlThreshold(): string {
  return new Date(Date.now() - ROOM_TTL_HOURS * 60 * 60 * 1000).toISOString()
}

// Huruf tanpa karakter ambigu (tanpa I/O/0/1).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length))
  }
  return code
}

/** Daftar room publik yang masih aktif (dalam TTL), terbaru dulu. */
export async function listPublicRooms(): Promise<PublicRoom[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('code, creator_name, created_at')
    .eq('is_private', false)
    .gte('created_at', ttlThreshold())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PublicRoom[]
}

/** Cek apakah room dengan kode tsb ada DAN masih aktif. */
export async function roomExists(code: string): Promise<boolean> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return false
  const { data, error } = await supabase
    .from('rooms')
    .select('code')
    .eq('code', normalized)
    .gte('created_at', ttlThreshold())
    .maybeSingle()
  if (error) return false
  return !!data
}

/**
 * Buat room baru dengan kode unik. Mengembalikan kode room.
 * `isPrivate` = true -> tidak muncul di daftar publik.
 */
export async function createRoom(
  isPrivate: boolean,
  creatorName: string
): Promise<string> {
  // Coba beberapa kali bila kode bentrok (sangat jarang).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode()
    const { error } = await supabase.from('rooms').insert({
      code,
      is_private: isPrivate,
      creator_name: creatorName,
    })
    if (!error) return code
    // Kode duplikat -> coba lagi. Error lain -> lempar.
    if (error.code !== '23505') throw error
  }
  throw new Error('Gagal membuat kode room unik. Coba lagi.')
}