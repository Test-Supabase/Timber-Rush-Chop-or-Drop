// ============================================================
// Tipe event popup pukulan (dipakai hook & komponen HitPopup).
// ============================================================

export interface HitEvent {
  seq: number // nomor urut pukulan (berubah tiap ayunan yang diproses)
  result: 'correct' | 'wrong'
  gain: number // poin yang didapat (untuk 'correct')
  side: 'left' | 'right' // sisi yang dipukul
}
