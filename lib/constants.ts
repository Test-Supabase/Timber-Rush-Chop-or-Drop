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

// --- AI lokal (Dev 3: 3 pemain dummy) ---
export const AI_REACT_MIN = 0.8; // detik: jeda minimum antar keputusan AI
export const AI_REACT_MAX = 1.6; // detik: jeda maksimum antar keputusan AI
export const AI_ACCURACY = 0.75; // peluang AI memukul separuh yang benar (0..1)

// --- UI ---
export const TIMER_LOW_THRESHOLD = 3; // detik: timer/bar menyala merah bila di bawah ini

// --- Jaringan / Realtime (Supabase) ---
export const NET_TICK_HZ = 30; // laju simulasi host (langkah/detik)
export const NET_BROADCAST_MS = 100; // interval siar snapshot host (ms)
export const NET_COUNTDOWN_MS = 3000; // durasi hitung mundur sebelum mulai (ms)
