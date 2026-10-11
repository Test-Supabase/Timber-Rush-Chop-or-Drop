import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Timber Rush: Chop or Drop',
  description: 'Game arcade multiplayer kompetitif: tebang pohon sebelum waktumu habis!',
}

// Meta viewport agar tampilan pas di HP.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

// Root layout: membungkus semua halaman.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
