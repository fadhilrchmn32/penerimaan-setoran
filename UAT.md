# UAT — Matriks Pengujian & Verifikasi (App 1: Penerimaan & Setoran)

Dokumen ini mencatat seluruh skenario verifikasi wajib App 1 serta kesiapan lintas-app untuk `06_CONTOH_DATA_DAN_HASIL.md`.  
**Kejujuran Status Lingkungan**: Pada environment AI Studio saat ini, kredensial proyek Supabase produksi belum dihubungkan sehingga uji E2E langsung terhadap PostgreSQL/Supabase live **belum dijalankan**. Seluruh kontrak logika domain, state machine, maker-checker, lock/concurrency, idempotency, kalkulasi desimal presisi, dan parser mutasi bank telah diuji melalui test suite terotomatisasi pada mesin transaksi deterministik serta diverifikasi kompilasi TypeScript/Vite.

---

## Ringkasan Skenario Wajib (Section F)

| ID Uji | Skenario | Expected Result | Status & Hasil Aktual |
| :--- | :--- | :--- | :--- |
| **UAT-01** | Transfer dilaporkan Rp1.000.000 belum diverifikasi | `status = 'waiting_verification'`, `verified_amount = 0`. App 2 melihat di antrian menunggu namun `available_to_allocate = 0` (tidak bisa melunasi nota). | **LULUS (Unit/Domain Test)** — `v_app2_allocatable_receipts` & mesin domain menahan `verified_amount = 0`. Uji Supabase live menunggu koneksi DB. |
| **UAT-02** | Checker berbeda memverifikasi kredit bank | Maker sama ditolak (`42501`). Checker berbeda menyetujui → `status = 'verified'`, `bank_matches` terbuat, event `receipt_transfer_verified` tercatat, tersedia untuk alokasi 1x. | **LULUS (Unit/Domain Test)** — Maker-checker & event outbox diverifikasi. |
| **UAT-03** | Tunai terverifikasi Rp300.000 pada penagih | `cash_custody_accounts.verified_balance` naik Rp300.000; Kas Kantor masih Rp0; event `receipt_cash_verified` terbentuk. | **LULUS (Unit/Domain Test)** — Saldo custody penagih & `custody_movement_sources` bertambah Rp300.000. |
| **UAT-04** | Setor parsial direncanakan Rp250.000 dari Rp300.000 | Kas Kantor naik Rp250.000, saldo penagih tersisa Rp50.000, total kas perusahaan tetap Rp300.000, **tidak** membuka kasus selisih. | **LULUS (Unit/Domain Test)** — Status `partially_accepted`, sisa Rp50.000 tetap di custody. |
| **UAT-05** | Pengajuan Rp300.000 diterima fisik Rp250.000 (kurang setor) | Perpindahan ke Kas Kantor Rp250.000, `discrepancy_cases` (`deposit_shortage`) terbuka Rp50.000, piutang pelanggan **tidak** bertambah. | **LULUS (Unit/Domain Test)** — Kasus selisih Rp50.000 dibuat tanpa mutasi piutang. |
| **UAT-06** | Dua checker bersamaan menerima setoran atas sumber sama | Concurrency lock (`FOR UPDATE` + `expected_version`) memastikan hanya satu yang sah; percobaan kedua ditolak (`40001`), saldo custody tidak pernah negatif. | **LULUS (Unit/Domain Test)** — Simulasi race condition menolak transaksi kedua dan menjaga saldo ≥ 0. |
| **UAT-07** | Setoran langsung penagih ke bank | Memilih mutasi bank yang tepat, membuat `bank_matches` ke `cash_deposit`, menurunkan custody penagih 1x, dan **tidak** membuat receipt pelanggan baru. | **LULUS (Unit/Domain Test)** — `target_type = 'cash_deposit'` pada `bank_matches`, jumlah receipt tetap. |
| **UAT-08** | Reversal receipt yang sudah dialokasikan | `approve_receipt_reversal` menolak jika terdapat `payment_allocations` aktif (`proposed`/`approved`). | **LULUS (Unit/Domain Test)** — Penolakan reversal terverifikasi saat alokasi aktif ada. |
| **UAT-09** | Keamanan: user tanpa izin, cabang lain, anonymous, & URL bukti tebakan | Anonymous & role tanpa hak ditolak (`42501`); bucket `finops-evidence` private menolak URL publik tanpa signed URL berizin. | **Diverifikasi via Kode RLS/RPC (`0002`, `0003`)** — Uji penetrasi live menunggu proyek Supabase aktif. |
| **UAT-10** | Sinkronisasi multi-browser & refresh | Perubahan ter-commit persisten di DB & invalidasi Realtime memicu refetch. | **Menunggu Koneksi Supabase Live** (mode demo tersimpan di memory sesi; DB produksi memerlukan Supabase URL & key). |
| **UAT-11** | Database belum terhubung | Menampilkan halaman Setup/Status Layanan jujur tanpa diam-diam beralih ke mock transaksi. | **LULUS** — Secara default saat env kosong, aplikasi menampilkan halaman Setup & Status Layanan. Sandbox Demo hanya aktif jika user memilih masuk secara eksplisit dengan banner `MODE DEMO`. |
| **UAT-12** | Kesiapan UAT lintas app (`06_CONTOH_DATA_DAN_HASIL.md`) | Skema `sales_documents`, `payment_allocations`, `accounting_events`, `journal_entries` dan view `v_app2_allocatable_receipts` siap dipakai App 2 & App 3. | **LULUS (Kontrak & Migrasi)** — `0001`–`0004` dan `seed_synthetic_uat.sql` siap dijalankan. |
