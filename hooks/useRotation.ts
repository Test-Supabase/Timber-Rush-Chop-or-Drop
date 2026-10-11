// Hook rotasi: menyimpan indeks sisi yang sedang menghadap pemain.
// Nilai disimpan di useRef agar tidak memicu re-render (aturan besi Dev 2).
// Rotasi snap 1 sisi; SIDES diambil dari konstanta.
import { useRef, useCallback } from 'react'
import { SIDES } from '../lib/constants'

export function useRotation(initial = 0) {
  const rotationRef = useRef(initial % SIDES)

  // Putar ke kiri (sisi sebelumnya) — mod SIDES agar tetap 0..SIDES-1.
  const rotateLeft = useCallback(() => {
    rotationRef.current = (rotationRef.current - 1 + SIDES) % SIDES
  }, [])

  // Putar ke kanan (sisi berikutnya).
  const rotateRight = useCallback(() => {
    rotationRef.current = (rotationRef.current + 1) % SIDES
  }, [])

  const getRotation = useCallback(() => rotationRef.current, [])

  const setRotation = useCallback((value: number) => {
    rotationRef.current = ((value % SIDES) + SIDES) % SIDES
  }, [])

  return { getRotation, setRotation, rotateLeft, rotateRight }
}