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

// --- Gergaji mesin (power-up berkala) ---
export const CHAINSAW_EVERY = 5; // pohon roboh (dengan kapak) untuk mengaktifkan gergaji
export const CHAINSAW_DURATION = 10; // detik: lama gergaji mesin aktif
export const CHAINSAW_COOLDOWN = 0.5; // detik: cooldown ayunan gergaji mesin
export const CHAINSAW_HIT_DELAY = 0.5; // detik: delay proses penebangan bila BENAR
export const CHAINSAW_MISS_DELAY = 1.0; // detik: delay proses penebangan bila SALAH
export const CHAINSAW_TRANSITION = 0.5; // detik: transisi antar pohon saat gergaji aktif

// --- Gauge lingkaran gergaji (kanan tengah area pohon) ---
export const CHAINSAW_GAUGE_SIZE_PX = 88; // px: diameter gauge lingkaran
export const CHAINSAW_GAUGE_STROKE_PX = 9; // px: tebal cincin gauge
export const CHAINSAW_GAUGE_RIGHT_PX = -256; // px: jarak gauge dari tepi kanan area pohon
export const CHAINSAW_GAUGE_ICON_PX = 36; // px: ukuran ikon gergaji di tengah gauge
export const CHAINSAW_POPUP_MS = 1100; // ms: durasi teks "PERFECT"/"GOOD"
export const CHAINSAW_FLASH_MS = 900; // ms: durasi animasi "mencolok" saat gergaji aktif

// --- Animasi kapak menebang (digambar di canvas) ---
// Pivot = tangan pemain (di luar batang, bawah). Mata kapak di ujung gagang.
// Sudut impak dihitung otomatis dari pivot ke tepi batang, jadi tidak perlu
// konstanta sudut impak. Gagang kapak juga dihitung agar mata tepat di tepi.
export const AXE_ANIM_MS = 460; // ms: total durasi animasi ayunan kapak
export const AXE_IMPACT_P = 0.42; // fraksi durasi saat mata kapak menyentuh kayu
export const AXE_START_ANGLE_DEG = -88; // derajat: sudut awal (kapak terangkat ke atas)
export const AXE_FOLLOW_ANGLE_DEG = 13; // derajat: lanjutan masuk kayu saat BENAR (menancap)
export const AXE_RECOIL_ANGLE_DEG = -72; // derajat: sudut pantulan saat SALAH (terpental ke atas-belakang)
export const AXE_RETURN_P = 0.4; // fraksi fase lanjutan saat kapak selesai menancap (BENAR)
export const AXE_HANDLE_W_PX = 9; // px: lebar gagang kapak
export const AXE_HEAD_LEN_PX = 28; // px: panjang mata kapak (ke arah batang)
export const AXE_HEAD_H_PX = 24; // px: tinggi mata kapak
export const AXE_PIVOT_OFFSET_PX = 66; // px: jarak titik putar (tangan) dari tepi batang
export const AXE_PIVOT_DROP_PX = 40; // px: pergeseran pivot ke bawah dari titik impak
export const AXE_BITE_PX = 8; // px: dalamnya mata kapak masuk ke kayu saat impak
export const AXE_RECOIL_SHIFT_PX = 18; // px: geser menjauh saat kapak terpental (SALAH)
export const AXE_FADE_P = 0.28; // fraksi akhir animasi untuk fade-out kapak

// --- Bar cooldown kapak (bawah area batang) ---
export const COOLDOWN_BAR_WIDTH_PX = 208; // px: lebar bar cooldown
export const COOLDOWN_BAR_HEIGHT_PX = 16; // px: tinggi bar cooldown
export const COOLDOWN_BAR_BOTTOM_PX = 40; // px: jarak bar dari bawah (di atas teks "Sisi")
export const COOLDOWN_ICON_SIZE_PX = 18; // px: ukuran ikon kapak di pojok kiri bar
export const CONTROL_BUTTON_BOTTOM_PX = 72; // px: jarak tombol putar dari bawah

// --- Jaringan / Realtime (Supabase) ---
export const NET_TICK_HZ = 30; // laju simulasi host (langkah/detik)
export const NET_BROADCAST_MS = 100; // interval siar snapshot host (ms)
export const NET_COUNTDOWN_MS = 3000; // durasi hitung mundur sebelum mulai (ms)
