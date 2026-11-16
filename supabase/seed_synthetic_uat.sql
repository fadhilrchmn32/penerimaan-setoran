-- ==============================================================================
-- DATA SINTETIS TERPISAH UNTUK UAT LINTAS APP (JANGAN JALANKAN DI PRODUKSI)
-- Seluruh nama pelanggan, rekening, dan petugas di bawah ini adalah fiktif/sintetis
-- untuk keperluan uji integrasi UAT.md dan 06_CONTOH_DATA_DAN_HASIL.md.
-- ==============================================================================

-- Catatan: Ganti UUID profile di bawah sesuai user Auth test yang Anda buat di Supabase Auth.
INSERT INTO public.companies (id, code, name, legal_name, base_currency, timezone)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'DIST-UAT',
  'PT Distribusi Nusantara (Contoh UAT)',
  'PT Distribusi Nusantara Raya Tbk (Sintetis)',
  'IDR',
  'Asia/Jakarta'
) ON CONFLICT (code) DO NOTHING;

INSERT INTO public.branches (id, company_id, code, name, is_headquarters)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'CBG-JKT',
  'Cabang Pusat Jakarta',
  true
) ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO public.app_settings (company_id, reconciliation_label, rounding_mode, rounding_scale)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'REKONSILIASI (ALMIRA)',
  'half_up',
  0
) ON CONFLICT (company_id) DO NOTHING;

-- Pelanggan sintetis dengan CUST ID teks menjaga nol awal (leading zero)
INSERT INTO public.customers (id, company_id, branch_id, cust_id, name) VALUES
  ('33333333-3333-4333-8333-333333333001', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '00104', 'Toko Sumber Makmur (UAT)'),
  ('33333333-3333-4333-8333-333333333002', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '00218', 'CV Sentosa Jaya (UAT)'),
  ('33333333-3333-4333-8333-333333333003', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '00309', 'UD Berkah Mandiri (UAT)')
ON CONFLICT (company_id, cust_id) DO NOTHING;

-- Petugas sintetis (sales & sopir)
INSERT INTO public.staff (id, company_id, branch_id, staff_code, full_name, staff_role) VALUES
  ('44444444-4444-4444-8444-444444444001', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'SLS-01', 'Budi Santoso (Sales UAT)', 'sales'),
  ('44444444-4444-4444-8444-444444444002', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'DRV-01', 'Agus Supriyadi (Sopir UAT)', 'driver')
ON CONFLICT (company_id, staff_code) DO NOTHING;

-- Rekening bank & kas kantor sintetis
INSERT INTO public.fund_accounts (id, company_id, branch_id, code, name, account_type, bank_name, account_number, coa_account_code) VALUES
  ('55555555-5555-4555-8555-555555555001', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'BANK-BCA-01', 'Bank Operasional Utama (UAT)', 'bank', 'Bank Contoh', '1230009988', '1103'),
  ('55555555-5555-4555-8555-555555555002', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'KAS-JKT-01', 'Kas Kantor Cabang Pusat (UAT)', 'office_cash', NULL, NULL, '1101')
ON CONFLICT (company_id, code) DO NOTHING;
