// ============================================================
// SATU-SATUNYA SUMBER ANGKA TUNING (lihat Bagian 5 dokumen)
// Dilarang menulis angka ajaib (magic number) di tempat lain.
// ============================================================

// --- Batang ---
export const SIDES = 4; // jumlah sisi batang
export const ROTATION_STEP = 90; // derajat per putaran (snap)
export const HITS_TO_FELL = 3; // pukulan benar untuk merobohkan
export const FRAGILE_SIDES = 1; // jumlah sisi rapuh

// --- Ayunan ---
export const SWING_COOLDOWN = 1.0; // detik jeda antar ayunan

// --- Waktu (survival) ---
export const START_MAX_TIME = 30; // detik MAX awal
export const MAXTIME_STEP = 2; // pengurangan MAX tiap pohon baru
export const MAXTIME_FLOOR = 6; // lantai MAX (berhenti turun)
export const TREE_TRANSITION = 2.0; // detik transisi antar pohon (timer beku)
export const WRONG_HIT_PENALTY = 1; // detik yang hilang saat pukul salah
export const CORRECT_HIT_RECOVERY = 0; // tambahan waktu saat pukul benar (0 = tidak ada)

// --- Skor ---
export const SCORE_CORRECT_HIT = 10; // poin per pukulan benar
export const SCORE_TREE_FELL = 50; // bonus pohon roboh

// --- Room ---
export const PLAYERS_PER_ROOM = 4; // pemain maks per room
export const MIN_PLAYERS_TO_START = 2; // pemain minimum & semua harus "Siap" sebelum host bisa mulai
export const ROOM_CODE_LENGTH = 6; // panjang kode room
export const ROOM_TTL_HOURS = 6; // jam: umur maksimum room sebelum kedaluwarsa
export const PUBLIC_ROOMS_REFRESH_MS = 10000; // ms: interval segarkan daftar room publik

// --- Sinkronisasi room (heartbeat) ---
export const HEARTBEAT_MS = 4000; // ms: interval host melaporkan aktivitas room
export const ROOM_STALE_SECONDS = 15; // detik tanpa heartbeat -> room dianggap mati (tanpa pemain asli)

// --- Bot (pemain AI di dalam room online) ---
export const BOT_NAMES = ['Budi', 'Andi', 'Siti']; // nama bot (maks 3)
export const BOT_JOIN_WARNING_MS = 5000; // ms: durasi peringatan saat join ke room berisi bot

// --- AI lokal (Dev 3: 3 pemain dummy) ---
export const AI_REACT_MIN = 0.8; // detik: jeda minimum antar keputusan AI
export const AI_REACT_MAX = 1.6; // detik: jeda maksimum antar keputusan AI
export const AI_ACCURACY = 0.75; // peluang AI memukul separuh yang benar (0..1)

// --- UI ---
export const TIMER_LOW_THRESHOLD = 3; // detik: timer/bar menyala merah bila di bawah ini

// --- Efek pukulan (popup "+poin" dan "MISS" di area batang) ---
export const HIT_POPUP_MS = 900; // ms: durasi animasi popup
export const HIT_STAR_POINTS = 12; // jumlah ujung bintang "surprise" (tajam)
export const HIT_STAR_INNER = 0.7; // rasio jari-jari dalam bintang (0..1), makin kecil makin tajam
export const HIT_POPUP_LEFT_PCT = 28; // % lebar: posisi popup untuk pukulan sisi kiri
export const HIT_POPUP_RIGHT_PCT = 72; // % lebar: posisi popup untuk pukulan sisi kanan
export const HIT_POPUP_TOP_MIN_PCT = 30; // % tinggi: batas atas area popup
export const HIT_POPUP_TOP_RANGE_PCT = 40; // % tinggi: rentang vertikal area popup

// --- Jaringan / Realtime (Supabase) ---
export const NET_TICK_HZ = 30; // laju simulasi host (langkah/detik)
export const NET_BROADCAST_MS = 100; // interval siar snapshot host (ms)
export const NET_COUNTDOWN_MS = 3000; // durasi hitung mundur sebelum mulai (ms)
