# 07_SUMBER_DAN_ASUMSI — Referensi Teknis & Asumsi Proses Keuangan

Dokumen ini adalah bagian dari paket kontrak `FINOPS_SHARED_V1` (v1.0.0 · 16 November 2026).

---

## 1. Status Kepatuhan & Tujuan Dokumen
Aplikasi ini dirancang sebagai sistem pencatatan operasional internal distributor (Penerimaan & Setoran, Penjualan & Rekonsiliasi, serta Akuntansi & Laporan). Dokumen ini menjelaskan keputusan rancangan teknis dan akuntansi agar konsisten di seluruh tim, dan **bukan** pernyataan sertifikasi audit atau kepatuhan pajak resmi.

## 2. Asumsi Operasional Distributor
1. **Lingkup Awal**: Satu badan usaha (`company_id`), satu cabang aktif (`branch_id`), mata uang tunggal `IDR`, zona waktu `Asia/Jakarta`.
2. **Pemisahan Tiga App dengan Satu Sumber Kebenaran**:
   - App 1 mencatat seluruh kas/transfer masuk, memverifikasi dana, mengelola custody penagih (`Kas di Penagih`), dan memproses setoran ke Kas Kantor / Bank.
   - App 2 mengalokasikan dana terverifikasi (`v_app2_allocatable_receipts`) ke `sales_documents`.
   - App 3 mengonsumsi `accounting_events` untuk membentuk draft jurnal dan posting ke buku besar.
3. **Jalur Titipan Pelanggan (`2102`) & Penerimaan Belum Teridentifikasi (`2103`)**:
   - Semua penerimaan terverifikasi yang identitas pelanggannya diketahui dikreditkan ke `2102 Titipan Pelanggan` terlebih dahulu, baru kemudian dipindahkan ke `1104 Piutang Usaha` saat dialokasikan ke nota di App 2.
   - Hal ini menjaga agar pembayaran di muka (sebelum nota terbit) dan kelebihan bayar tidak mengacaukan saldo piutang ataupun menggandakan pendapatan penjualan.
   - Dana yang pengirimnya belum dikenali dikreditkan ke `2103 Penerimaan Belum Teridentifikasi` sampai identitas disahkan melalui `approve_receipt_identity`.
4. **Pemisahan Tanggal**:
   - `customer_paid_at`: tanggal pelanggan melakukan pembayaran/penyerahan uang.
   - `bank_value_date`: tanggal efektif dana masuk menurut rekening koran bank.
   - `deposit_date`: tanggal penagih menyerahkan uang tunai atau setor langsung ke bank.
   - `verified_at`: timestamp saat checker mengesahkan penerimaan.
   - `accounting_date`: tanggal pembukuan periode terbuka yang ditentukan oleh kebijakan akuntansi.
5. **Presisi Angka**:
   - Menggunakan tipe `NUMERIC(20,2)` di PostgreSQL dan `decimal.js` di TypeScript untuk mencegah kesalahan pembulatan *floating-point* biner (`0.1 + 0.2`).

## 3. Sumber Referensi Teknis
- Dokumentasi resmi PostgreSQL 15+ (`NUMERIC`, `FOR UPDATE`, Row-Level Security, `SECURITY DEFINER` with empty `search_path`).
- Dokumentasi resmi Supabase (`@supabase/supabase-js`, Auth, Private Storage Signed URLs, Postgres Changes Realtime).
- Prinsip pengendalian internal *Maker-Checker* (Pemisahan fungsi pencatatan, verifikasi, dan otorisasi).
