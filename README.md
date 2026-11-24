# RuangSurvei (Next.js + Tailwind + Supabase)

## Jalankan lokal

1. Install Node.js 20.9 atau lebih baru.
2. Salin `.env.example` menjadi `.env.local`, lalu isi URL dan anon/publishable key dari proyek Supabase.
3. Jalankan `npm install` kemudian `npm run dev`.
4. Buka http://localhost:3000.

Login dan pendaftaran email/kata sandi terhubung ke Supabase Auth setelah variabel lingkungan diisi. Supabase mungkin meminta pengguna mengonfirmasi email sebelum masuk. Data survei, profil, dan respons masih berupa demo; siapkan tabel PostgreSQL dan aktifkan Row Level Security (RLS) sebelum menyimpan data sungguhan. Jangan pernah menaruh `service_role` key di variabel `NEXT_PUBLIC_*` atau di browser.

