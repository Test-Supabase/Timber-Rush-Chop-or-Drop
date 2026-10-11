import { createClient } from '@supabase/supabase-js'

// Instance Supabase client tunggal (singleton) untuk seluruh aplikasi.
// Membaca URL & kunci publishable dari environment (.env.local).
// Catatan: proyek ini memakai NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sesuai
// konvensi Supabase terbaru). Kunci ini aman untuk browser.
// JANGAN pernah memakai service_role / secret key di sini.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Variabel Supabase belum diisi. Lengkapi NEXT_PUBLIC_SUPABASE_URL dan ' +
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY di .env.local.'
  )
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
