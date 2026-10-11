import { supabase } from './supabase'
import { ROOM_CODE_LENGTH, ROOM_STALE_SECONDS } from './constants'

// ============================================================
// Helper room (tabel `rooms` di Supabase).
// - Room PUBLIK muncul di daftar & bisa digabung siapa pun.
// - Room PRIVAT hanya bisa digabung oleh yang tahu kodenya.
// - Room dianggap HIDUP hanya bila masih di-heartbeat oleh pemain asli.
//   Bila tidak ada pemain asli aktif, heartbeat berhenti dan room
//   dibersihkan otomatis (lihat fungsi room_heartbeat di DB).
// ============================================================

export interface PublicRoom {
  code: string
  creator_name: string | null
  created_at: string
  human_count: number
  has_bot: boolean
}

// Ambang "masih hidup": last_seen harus lebih baru dari ini.
function activeThreshold(): string {
  return new Date(Date.now() - ROOM_STALE_SECONDS * 1000).toISOString()
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

/** Daftar room publik yang masih aktif (ada pemain asli), terbaru dulu. */
export async function listPublicRooms(): Promise<PublicRoom[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('code, creator_name, created_at, human_count, has_bot')
    .eq('is_private', false)
    .gte('last_seen', activeThreshold())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PublicRoom[]
}

/** Cek apakah room dengan kode tsb ada DAN masih aktif (ada pemain asli). */
export async function roomExists(code: string): Promise<boolean> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return false
  const { data, error } = await supabase
    .from('rooms')
    .select('code, has_bot')
    .eq('code', normalized)
    .gte('last_seen', activeThreshold())
    .maybeSingle()
  if (error) return false
  return !!data
}

/** Info room (untuk peringatan bot saat join). Null bila tidak ada/kadaluarsa. */
export async function getRoomInfo(
  code: string
): Promise<{ code: string; has_bot: boolean; human_count: number } | null> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null
  const { data, error } = await supabase
    .from('rooms')
    .select('code, has_bot, human_count')
    .eq('code', normalized)
    .gte('last_seen', activeThreshold())
    .maybeSingle()
  if (error || !data) return null
  return data as { code: string; has_bot: boolean; human_count: number }
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
      human_count: 1,
      has_bot: false,
    })
    if (!error) return code
    // Kode duplikat -> coba lagi. Error lain -> lempar.
    if (error.code !== '23505') throw error
  }
  throw new Error('Gagal membuat kode room unik. Coba lagi.')
}

/**
 * Heartbeat room: perbarui jumlah pemain asli & status bot, sekaligus
 * membersihkan room yang sudah tidak aktif (tanpa pemain asli).
 * Dipanggil berkala oleh setiap klien selama berada di room.
 */
export async function roomHeartbeat(
  code: string,
  humans: number,
  hasBot: boolean,
  staleSeconds: number = ROOM_STALE_SECONDS
): Promise<void> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return
  await supabase.rpc('room_heartbeat', {
    p_code: normalized,
    p_humans: humans,
    p_has_bot: hasBot,
    p_stale_seconds: staleSeconds,
  })
}