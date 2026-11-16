# SETUP — Panduan Konfigurasi Penerimaan & Setoran (FINOPS_SHARED_V1)

Dokumen ini memisahkan panduan non-teknis untuk **Pemilik Usaha / Penanggung Jawab Operasional** dan panduan teknis untuk **Engineer / Administrator Sistem**.

---

## Bagian A — Panduan Sederhana untuk Pemilik Usaha

1. **Siapkan Satu Akun Database Bersama (Supabase)**:
   - Aplikasi 1 (*Penerimaan & Setoran*), Aplikasi 2 (*Penjualan & Rekonsiliasi*), dan Aplikasi 3 (*Akuntansi & Laporan*) menggunakan **satu database dan satu akun pengguna yang sama** agar tidak perlu salin-tempel data.
   - Minta tim teknis Anda membuat **1 proyek Supabase** untuk seluruh perusahaan.
2. **Daftar Data Awal Perusahaan yang Perlu Disiapkan**:
   - Nama perusahaan & daftar cabang (untuk tahap awal cukup 1 badan usaha, 1 cabang, mata uang IDR).
   - Daftar rekening bank perusahaan dan nama kas kantor.
   - Daftar petugas penagih (sales dan sopir) yang menerima uang tunai di lapangan.
   - Daftar pelanggan beserta kode pelanggan (`CUST ID`) apa adanya termasuk angka nol di depan (misal `00104`).
   - Daftar pengguna beserta perannya (siapa pencatat/maker, siapa pemeriksa/checker, siapa admin penjualan, siapa akuntan).
3. **Aturan Operasional Penting**:
   - Petugas yang mencatat penerimaan/setoran **tidak boleh** menyetujui dokumennya sendiri (pemeriksaan wajib dilakukan orang berbeda).
   - Foto bukti transfer dari pelanggan **belum berarti uang sudah masuk**. Pemeriksa tetap wajib mencocokkan mutasi bank atau mencatat pemeriksaan manual.
   - Jangan memberikan kunci rahasia database (`service_role` key atau password database) melalui chat atau menyimpannya di browser.

---

## Bagian B — Panduan Teknis untuk Engineer / System Admin

### 1. Prasyarat
- Node.js 20+ dan npm
- Proyek Supabase (PostgreSQL 15+, Supabase Auth, Private Storage, Realtime)

### 2. Jalankan Migrasi Database (Secara Berurutan, Sekali Saja)
Jalankan file berikut pada SQL Editor Supabase atau Supabase CLI (`supabase db push`) sesuai urutan nomor:
1. `supabase/migrations/0001_finops_shared_v1_foundation.sql`
2. `supabase/migrations/0002_finops_shared_v1_rls_security.sql`
3. `supabase/migrations/0003_finops_app1_rpcs.sql`
4. `supabase/migrations/0004_finops_app2_views_and_realtime.sql`

> **Catatan Pengujian**: Untuk lingkungan staging/UAT saja (bukan produksi), Anda dapat menjalankan `supabase/seed_synthetic_uat.sql` agar tersedia data pelanggan, petugas, dan rekening sintetis.

### 3. Konfigurasi Variabel Environment
Salin `.env.example` menjadi `.env` pada masing-masing App 1, App 2, dan App 3, lalu isi:
```env
VITE_SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY"
```
- Browser hanya menerima URL proyek dan Publishable/Anon key.
- Semua kebijakan keamanan berjalan melalui RLS + RPC `SECURITY DEFINER`.

### 4. Pengaturan Supabase Auth & Storage
1. Pada **Supabase Auth → Providers**, aktifkan Email/Password (undangan user melalui Admin API / Dashboard Supabase, jangan buka registrasi publik bebas tanpa membership).
2. Pastikan setiap user yang diundang memiliki baris pada `public.profiles` dan `public.memberships` sesuai `company_id`, `branch_id`, dan `role_code`.
3. Pastikan bucket private `finops-evidence` sudah terbentuk dari migrasi `0002` (akses publik `false`).

### 5. Menjalankan Aplikasi & Verifikasi Build
```bash
npm install
npm run lint
npm run build
npm run dev
```

### 6. Menghubungkan App 2 & App 3
Masuk sebagai `system_admin`, buka menu **Pengaturan → URL Aplikasi Terhubung**, lalu isi URL App 2 (*Penjualan & Rekonsiliasi*) dan App 3 (*Akuntansi & Laporan*) agar tombol *Buka di Penjualan* dan *Lihat Jurnal* dapat mengarahkan petugas ke dokumen yang sama tanpa mengirim token melalui URL.
