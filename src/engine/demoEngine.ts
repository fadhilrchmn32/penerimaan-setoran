import Decimal from 'decimal.js';
import type {
  AccountingEventRow,
  AppRoleCode,
  AppSettingsRow,
  AuditEventRow,
  BankFeeBearer,
  BankMatchRow,
  BankStatementBatchRow,
  BankStatementLineRow,
  BranchRow,
  CashCustodyAccountRow,
  CashDepositLineRow,
  CashDepositRow,
  CashTransferRow,
  CollectionDashboardResponse,
  CollectorCustodyDetailResponse,
  CompanyRow,
  CustodyMovementRow,
  CustodyMovementSourceRow,
  CustomerRow,
  DiscrepancyCaseRow,
  FundAccountRow,
  PaymentAllocationRow,
  ProfileRow,
  ReceiptChannel,
  ReceiptEvidenceRow,
  ReceiptRow,
  StaffRow,
  VerificationMethod,
} from '../../database.types';
import { toDecimal, toMoneyString } from '../lib/money';

export interface DemoActor {
  id: string;
  email: string;
  full_name: string;
  role_code: AppRoleCode;
  branch_id: string | null;
  all_branches: boolean;
  staff_id?: string;
}

export interface DemoState {
  company: CompanyRow;
  branches: BranchRow[];
  appSettings: AppSettingsRow;
  profiles: ProfileRow[];
  actors: DemoActor[];
  customers: CustomerRow[];
  staff: StaffRow[];
  fundAccounts: FundAccountRow[];
  receipts: ReceiptRow[];
  receiptEvidence: ReceiptEvidenceRow[];
  bankBatches: BankStatementBatchRow[];
  bankLines: BankStatementLineRow[];
  bankMatches: BankMatchRow[];
  custodyAccounts: CashCustodyAccountRow[];
  custodyMovements: CustodyMovementRow[];
  custodySources: CustodyMovementSourceRow[];
  deposits: CashDepositRow[];
  depositLines: CashDepositLineRow[];
  cashTransfers: CashTransferRow[];
  paymentAllocations: PaymentAllocationRow[];
  discrepancies: DiscrepancyCaseRow[];
  accountingEvents: AccountingEventRow[];
  auditEvents: AuditEventRow[];
  idempotencyCache: Record<string, unknown>;
  sequences: Record<string, number>;
}

const DEMO_COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const DEMO_BRANCH_JKT = '22222222-2222-4222-8222-222222222222';
const DEMO_BRANCH_BDG = '22222222-2222-4222-8222-222222222223';

export const DEMO_ACTORS: DemoActor[] = [
  {
    id: 'aaaa1111-0000-4000-8000-000000000001',
    email: 'maker.keuangan@demo.local',
    full_name: 'Siti Rahma (Finance Maker)',
    role_code: 'finance_maker',
    branch_id: DEMO_BRANCH_JKT,
    all_branches: true,
  },
  {
    id: 'aaaa1111-0000-4000-8000-000000000002',
    email: 'checker.keuangan@demo.local',
    full_name: 'Hendra Wijaya (Finance Checker)',
    role_code: 'finance_checker',
    branch_id: DEMO_BRANCH_JKT,
    all_branches: true,
  },
  {
    id: 'aaaa1111-0000-4000-8000-000000000003',
    email: 'budi.sales@demo.local',
    full_name: 'Budi Santoso (Penagih / Sales)',
    role_code: 'collector_optional',
    branch_id: DEMO_BRANCH_JKT,
    all_branches: false,
    staff_id: '44444444-4444-4444-8444-444444444001',
  },
  {
    id: 'aaaa1111-0000-4000-8000-000000000004',
    email: 'almira.rekon@demo.local',
    full_name: 'Almira Putri (Reviewer Rekonsiliasi)',
    role_code: 'reconciliation_reviewer',
    branch_id: DEMO_BRANCH_JKT,
    all_branches: true,
  },
  {
    id: 'aaaa1111-0000-4000-8000-000000000005',
    email: 'admin.sistem@demo.local',
    full_name: 'Rizky Pratama (System Admin)',
    role_code: 'system_admin',
    branch_id: DEMO_BRANCH_JKT,
    all_branches: true,
  },
  {
    id: 'aaaa1111-0000-4000-8000-000000000006',
    email: 'owner.viewer@demo.local',
    full_name: 'Direktur Utama (Owner Viewer)',
    role_code: 'owner_viewer',
    branch_id: DEMO_BRANCH_JKT,
    all_branches: true,
  },
];

function makeUuid(prefix: string, idx: number): string {
  const hex = idx.toString(16).padStart(12, '0');
  return `${prefix}-0000-4000-8000-${hex}`;
}

export function createInitialDemoState(): DemoState {
  const now = '2026-11-16T08:30:00.000Z';
  const company: CompanyRow = {
    id: DEMO_COMPANY_ID,
    code: 'DIST-DEMO',
    name: 'PT Distribusi Nusantara (Sandbox Demo)',
    legal_name: 'PT Distribusi Nusantara Raya (Data Sintetis)',
    tax_id: '01.234.567.8-001.000',
    base_currency: 'IDR',
    timezone: 'Asia/Jakarta',
    is_active: true,
    version: 1,
    created_at: now,
    updated_at: now,
  };

  const branches: BranchRow[] = [
    {
      id: DEMO_BRANCH_JKT,
      company_id: DEMO_COMPANY_ID,
      code: 'CBG-JKT',
      name: 'Cabang Pusat Jakarta',
      address: 'Jl. Industri Raya No. 12, Jakarta',
      is_headquarters: true,
      is_active: true,
      version: 1,
    },
    {
      id: DEMO_BRANCH_BDG,
      company_id: DEMO_COMPANY_ID,
      code: 'CBG-BDG',
      name: 'Cabang Bandung',
      address: 'Jl. Soekarno Hatta No. 88, Bandung',
      is_headquarters: false,
      is_active: true,
      version: 1,
    },
  ];

  const appSettings: AppSettingsRow = {
    id: '99999999-0000-4000-8000-000000000001',
    company_id: DEMO_COMPANY_ID,
    app1_url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    app2_url: '',
    app3_url: '',
    reconciliation_label: 'REKONSILIASI (ALMIRA)',
    rounding_mode: 'half_up',
    rounding_scale: 0,
    auto_post_enabled: false,
    require_evidence_for_transfer: true,
    require_evidence_for_cash: true,
    version: 1,
  };

  const customers: CustomerRow[] = [
    {
      id: '33333333-3333-4333-8333-333333333001',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      cust_id: '00104',
      name: 'Toko Sumber Makmur',
      default_sales_id: '44444444-4444-4444-8444-444444444001',
      phone: '0812-1000-0104',
      address: 'Pasar Induk Kramat Jati Blok B2',
      is_active: true,
      version: 1,
    },
    {
      id: '33333333-3333-4333-8333-333333333002',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      cust_id: '00218',
      name: 'CV Sentosa Jaya',
      default_sales_id: '44444444-4444-4444-8444-444444444001',
      phone: '0813-2200-0218',
      address: 'Ruko Mangga Dua Blok C7',
      is_active: true,
      version: 1,
    },
    {
      id: '33333333-3333-4333-8333-333333333003',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      cust_id: '00309',
      name: 'UD Berkah Mandiri',
      default_sales_id: '44444444-4444-4444-8444-444444444003',
      phone: '0815-3000-0309',
      address: 'Jl. Bekasi Timur KM 18',
      is_active: true,
      version: 1,
    },
    {
      id: '33333333-3333-4333-8333-333333333004',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_BDG,
      cust_id: '00412',
      name: 'Minimarket Cahaya Baru',
      default_sales_id: '44444444-4444-4444-8444-444444444001',
      phone: '0821-4000-0412',
      address: 'Jl. Buah Batu No. 45, Bandung',
      is_active: true,
      version: 1,
    },
  ];

  const staff: StaffRow[] = [
    {
      id: '44444444-4444-4444-8444-444444444001',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      profile_id: 'aaaa1111-0000-4000-8000-000000000003',
      staff_code: 'SLS-01',
      full_name: 'Budi Santoso',
      staff_role: 'sales',
      phone: '0811-900-101',
      is_active: true,
      version: 1,
    },
    {
      id: '44444444-4444-4444-8444-444444444002',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      profile_id: null,
      staff_code: 'DRV-01',
      full_name: 'Agus Supriyadi',
      staff_role: 'driver',
      phone: '0811-900-102',
      is_active: true,
      version: 1,
    },
    {
      id: '44444444-4444-4444-8444-444444444003',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      profile_id: null,
      staff_code: 'SLS-02',
      full_name: 'Dewi Anggraini',
      staff_role: 'sales',
      phone: '0811-900-103',
      is_active: true,
      version: 1,
    },
  ];

  const fundAccounts: FundAccountRow[] = [
    {
      id: '55555555-5555-4555-8555-555555555001',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      code: 'BANK-BCA-01',
      name: 'Bank BCA Operasional',
      account_type: 'bank',
      bank_name: 'BCA',
      account_number: '1230009988',
      account_holder: 'PT Distribusi Nusantara',
      currency: 'IDR',
      coa_account_code: '1103',
      is_active: true,
      version: 1,
    },
    {
      id: '55555555-5555-4555-8555-555555555002',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      code: 'BANK-MDR-01',
      name: 'Bank Mandiri Giro',
      account_type: 'bank',
      bank_name: 'Mandiri',
      account_number: '140008812345',
      account_holder: 'PT Distribusi Nusantara',
      currency: 'IDR',
      coa_account_code: '1103',
      is_active: true,
      version: 1,
    },
    {
      id: '55555555-5555-4555-8555-555555555003',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      code: 'KAS-JKT-01',
      name: 'Kas Kantor Pusat Jakarta',
      account_type: 'office_cash',
      bank_name: null,
      account_number: null,
      account_holder: null,
      currency: 'IDR',
      coa_account_code: '1101',
      is_active: true,
      version: 1,
    },
  ];

  const bankBatches: BankStatementBatchRow[] = [
    {
      id: '66666666-0000-4000-8000-000000000001',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      fund_account_id: '55555555-5555-4555-8555-555555555001',
      batch_number: 'MUT-202611-0001',
      file_name: 'mutasi_bca_nov2026_minggu2.csv',
      file_hash: 'demo-hash-batch-001',
      period_start: '2026-11-10',
      period_end: '2026-11-16',
      date_format: 'dd/MM/yyyy',
      decimal_format: 'id',
      opening_balance: '14500000.00',
      closing_balance: '17993500.00',
      total_rows: 4,
      imported_rows: 4,
      duplicate_rows: 0,
      status: 'committed',
      created_by: DEMO_ACTORS[0].id,
      committed_by: DEMO_ACTORS[0].id,
      committed_at: now,
      version: 1,
      created_at: now,
    },
  ];

  const bankLines: BankStatementLineRow[] = [
    {
      id: '77777777-0000-4000-8000-000000000001',
      company_id: DEMO_COMPANY_ID,
      batch_id: '66666666-0000-4000-8000-000000000001',
      fund_account_id: '55555555-5555-4555-8555-555555555001',
      row_number: 1,
      raw_row: { tanggal: '15/11/2026', kredit: '1.000.000,00', ket: 'TRSF E-BANKING CR TOKO SUMBER MAKMUR' },
      external_txn_id: 'BCA-20261115-88101',
      fingerprint_hash: 'fp-demo-001',
      posting_date: '2026-11-15',
      value_date: '2026-11-15',
      direction: 'credit',
      amount: '1000000.00',
      signed_amount: '1000000.00',
      running_balance: '15500000.00',
      bank_reference: 'REF-BCA-88101',
      description: 'TRSF E-BANKING CR TOKO SUMBER MAKMUR INV-1104',
      suggested_classification: 'customer_receipt',
      is_duplicate_suspect: false,
      duplicate_note: null,
      match_status: 'unmatched',
      matched_amount: '0.00',
      version: 1,
      created_at: now,
    },
    {
      id: '77777777-0000-4000-8000-000000000002',
      company_id: DEMO_COMPANY_ID,
      batch_id: '66666666-0000-4000-8000-000000000001',
      fund_account_id: '55555555-5555-4555-8555-555555555001',
      row_number: 2,
      raw_row: { tanggal: '15/11/2026', kredit: '1.493.500,00', ket: 'BI-FAST CR CV SENTOSA JAYA NET FEE 6500' },
      external_txn_id: 'BCA-20261115-88102',
      fingerprint_hash: 'fp-demo-002',
      posting_date: '2026-11-15',
      value_date: '2026-11-15',
      direction: 'credit',
      amount: '1493500.00',
      signed_amount: '1493500.00',
      running_balance: '16993500.00',
      bank_reference: 'REF-BIFAST-88102',
      description: 'BI-FAST CR CV SENTOSA JAYA (POTONG BIAYA BANK 6.500)',
      suggested_classification: 'customer_receipt',
      is_duplicate_suspect: false,
      duplicate_note: null,
      match_status: 'matched',
      matched_amount: '1493500.00',
      version: 2,
      created_at: now,
    },
    {
      id: '77777777-0000-4000-8000-000000000003',
      company_id: DEMO_COMPANY_ID,
      batch_id: '66666666-0000-4000-8000-000000000001',
      fund_account_id: '55555555-5555-4555-8555-555555555001',
      row_number: 3,
      raw_row: { tanggal: '16/11/2026', kredit: '450.000,00', ket: 'SETOR TUNAI ATM AGUS SUPRIYADI' },
      external_txn_id: 'BCA-20261116-88103',
      fingerprint_hash: 'fp-demo-003',
      posting_date: '2026-11-16',
      value_date: '2026-11-16',
      direction: 'credit',
      amount: '450000.00',
      signed_amount: '450000.00',
      running_balance: '17443500.00',
      bank_reference: 'ATM-SETOR-88103',
      description: 'SETOR TUNAI CRM CABANG JAKARTA - AGUS',
      suggested_classification: 'collector_direct_deposit',
      is_duplicate_suspect: false,
      duplicate_note: null,
      match_status: 'unmatched',
      matched_amount: '0.00',
      version: 1,
      created_at: now,
    },
    {
      id: '77777777-0000-4000-8000-000000000004',
      company_id: DEMO_COMPANY_ID,
      batch_id: '66666666-0000-4000-8000-000000000001',
      fund_account_id: '55555555-5555-4555-8555-555555555001',
      row_number: 4,
      raw_row: { tanggal: '16/11/2026', kredit: '550.000,00', ket: 'TRSF E-BANKING CR HENDRIYANTO' },
      external_txn_id: 'BCA-20261116-88104',
      fingerprint_hash: 'fp-demo-004',
      posting_date: '2026-11-16',
      value_date: '2026-11-16',
      direction: 'credit',
      amount: '550000.00',
      signed_amount: '550000.00',
      running_balance: '17993500.00',
      bank_reference: 'REF-BCA-88104',
      description: 'TRSF CR HENDRIYANTO (PENGIRIM BELUM TERPETAKAN)',
      suggested_classification: 'unclassified',
      is_duplicate_suspect: false,
      duplicate_note: null,
      match_status: 'unmatched',
      matched_amount: '0.00',
      version: 1,
      created_at: now,
    },
  ];

  // Seed initial realistic receipts covering waiting_verification, verified+fee, unknown_sender, cash verified
  const receipts: ReceiptRow[] = [
    {
      id: '88888888-0000-4000-8000-000000000001',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      receipt_number: 'RCV-TRF-202611-0001',
      receipt_channel: 'bank_transfer',
      currency: 'IDR',
      customer_gross_amount: '1000000.00',
      bank_net_amount: '1000000.00',
      bank_fee_amount: '0.00',
      bank_fee_bearer: 'none',
      verified_amount: '0.00',
      customer_paid_at: '2026-11-15',
      bank_value_date: null,
      verified_at: null,
      accounting_date: null,
      is_unknown_identity: false,
      customer_id: '33333333-3333-4333-8333-333333333001',
      sender_name_raw: 'TOKO SUMBER MAKMUR / HERMAN',
      fund_account_id: '55555555-5555-4555-8555-555555555001',
      bank_reference: 'REF-BCA-88101',
      optional_invoice_ref: 'INV-2026-1104',
      receipt_book_no: null,
      actual_collector_id: null,
      sales_owner_id: '44444444-4444-4444-8444-444444444001',
      location_note: null,
      notes: 'Pelanggan mengirim bukti transfer WA, menunggu checker cocokkan mutasi BCA.',
      verification_method: null,
      verification_ref: null,
      verification_note: null,
      evidence_hash: 'sha256-demo-ev-001',
      duplicate_flag: false,
      duplicate_reason: null,
      status: 'waiting_verification',
      deposit_status: 'not_applicable',
      reconciliation_status: 'unreviewed',
      accounting_status: 'not_ready',
      created_by: DEMO_ACTORS[0].id,
      updated_by: DEMO_ACTORS[0].id,
      submitted_by: DEMO_ACTORS[0].id,
      submitted_at: '2026-11-15T09:10:00.000Z',
      verified_by: null,
      approved_by: null,
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
      reason: null,
      version: 2,
      source_app: 'app1_collections_deposits',
      correlation_id: 'cccc0000-0000-4000-8000-000000000001',
      created_at: '2026-11-15T09:05:00.000Z',
      updated_at: '2026-11-15T09:10:00.000Z',
    },
    {
      id: '88888888-0000-4000-8000-000000000002',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      receipt_number: 'RCV-TRF-202611-0002',
      receipt_channel: 'bank_transfer',
      currency: 'IDR',
      customer_gross_amount: '1500000.00',
      bank_net_amount: '1493500.00',
      bank_fee_amount: '6500.00',
      bank_fee_bearer: 'company',
      verified_amount: '1500000.00',
      customer_paid_at: '2026-11-15',
      bank_value_date: '2026-11-15',
      verified_at: '2026-11-15T14:20:00.000Z',
      accounting_date: '2026-11-15',
      is_unknown_identity: false,
      customer_id: '33333333-3333-4333-8333-333333333002',
      sender_name_raw: 'CV SENTOSA JAYA',
      fund_account_id: '55555555-5555-4555-8555-555555555001',
      bank_reference: 'REF-BIFAST-88102',
      optional_invoice_ref: 'INV-2026-1108',
      receipt_book_no: null,
      actual_collector_id: null,
      sales_owner_id: '44444444-4444-4444-8444-444444444001',
      location_note: null,
      notes: 'Potongan biaya kliring Rp6.500 disahkan ditanggung perusahaan.',
      verification_method: 'bank_statement_match',
      verification_ref: 'REF-BIFAST-88102',
      verification_note: 'Cocok mutasi BCA baris #2 + biaya bank disetujui.',
      evidence_hash: 'sha256-demo-ev-002',
      duplicate_flag: false,
      duplicate_reason: null,
      status: 'verified',
      deposit_status: 'not_applicable',
      reconciliation_status: 'matched',
      accounting_status: 'queued',
      created_by: DEMO_ACTORS[0].id,
      updated_by: DEMO_ACTORS[1].id,
      submitted_by: DEMO_ACTORS[0].id,
      submitted_at: '2026-11-15T11:00:00.000Z',
      verified_by: DEMO_ACTORS[1].id,
      approved_by: DEMO_ACTORS[1].id,
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
      reason: null,
      version: 3,
      source_app: 'app1_collections_deposits',
      correlation_id: 'cccc0000-0000-4000-8000-000000000002',
      created_at: '2026-11-15T10:55:00.000Z',
      updated_at: '2026-11-15T14:20:00.000Z',
    },
    {
      id: '88888888-0000-4000-8000-000000000003',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      receipt_number: 'RCV-TUN-202611-0001',
      receipt_channel: 'cash',
      currency: 'IDR',
      customer_gross_amount: '300000.00',
      bank_net_amount: '300000.00',
      bank_fee_amount: '0.00',
      bank_fee_bearer: 'none',
      verified_amount: '300000.00',
      customer_paid_at: '2026-11-15',
      bank_value_date: '2026-11-15',
      verified_at: '2026-11-15T16:00:00.000Z',
      accounting_date: '2026-11-15',
      is_unknown_identity: false,
      customer_id: '33333333-3333-4333-8333-333333333003',
      sender_name_raw: 'UD BERKAH MANDIRI',
      fund_account_id: null,
      bank_reference: null,
      optional_invoice_ref: 'INV-2026-1099',
      receipt_book_no: 'KWT-00412',
      actual_collector_id: '44444444-4444-4444-8444-444444444001',
      sales_owner_id: '44444444-4444-4444-8444-444444444003',
      location_note: 'Tagihan rute Bekasi Timur',
      notes: 'Uang tunai diterima langsung oleh Budi Santoso saat kunjungan toko.',
      verification_method: 'cash_evidence_check',
      verification_ref: 'KWT-00412',
      verification_note: 'Foto kuitansi & konfirmasi WA penagih sah.',
      evidence_hash: 'sha256-demo-ev-003',
      duplicate_flag: false,
      duplicate_reason: null,
      status: 'verified',
      deposit_status: 'not_deposited',
      reconciliation_status: 'unreviewed',
      accounting_status: 'queued',
      created_by: DEMO_ACTORS[0].id,
      updated_by: DEMO_ACTORS[1].id,
      submitted_by: DEMO_ACTORS[0].id,
      submitted_at: '2026-11-15T15:30:00.000Z',
      verified_by: DEMO_ACTORS[1].id,
      approved_by: DEMO_ACTORS[1].id,
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
      reason: null,
      version: 3,
      source_app: 'app1_collections_deposits',
      correlation_id: 'cccc0000-0000-4000-8000-000000000003',
      created_at: '2026-11-15T15:25:00.000Z',
      updated_at: '2026-11-15T16:00:00.000Z',
    },
    {
      id: '88888888-0000-4000-8000-000000000004',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      receipt_number: 'RCV-TUN-202611-0002',
      receipt_channel: 'cash',
      currency: 'IDR',
      customer_gross_amount: '450000.00',
      bank_net_amount: '450000.00',
      bank_fee_amount: '0.00',
      bank_fee_bearer: 'none',
      verified_amount: '450000.00',
      customer_paid_at: '2026-11-16',
      bank_value_date: '2026-11-16',
      verified_at: '2026-11-16T07:45:00.000Z',
      accounting_date: '2026-11-16',
      is_unknown_identity: false,
      customer_id: '33333333-3333-4333-8333-333333333001',
      sender_name_raw: 'TOKO SUMBER MAKMUR',
      fund_account_id: null,
      bank_reference: null,
      optional_invoice_ref: 'INV-2026-1112',
      receipt_book_no: 'KWT-00415',
      actual_collector_id: '44444444-4444-4444-8444-444444444002',
      sales_owner_id: '44444444-4444-4444-8444-444444444001',
      location_note: 'COD pengiriman pagi',
      notes: 'Sopir Agus menerima tunai COD, berencana setor langsung lewat CRM BCA.',
      verification_method: 'cash_evidence_check',
      verification_ref: 'KWT-00415',
      verification_note: 'Surat jalan bertanda tangan lunas tunai.',
      evidence_hash: 'sha256-demo-ev-004',
      duplicate_flag: false,
      duplicate_reason: null,
      status: 'verified',
      deposit_status: 'not_deposited',
      reconciliation_status: 'unreviewed',
      accounting_status: 'queued',
      created_by: DEMO_ACTORS[0].id,
      updated_by: DEMO_ACTORS[1].id,
      submitted_by: DEMO_ACTORS[0].id,
      submitted_at: '2026-11-16T07:30:00.000Z',
      verified_by: DEMO_ACTORS[1].id,
      approved_by: DEMO_ACTORS[1].id,
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
      reason: null,
      version: 3,
      source_app: 'app1_collections_deposits',
      correlation_id: 'cccc0000-0000-4000-8000-000000000004',
      created_at: '2026-11-16T07:20:00.000Z',
      updated_at: '2026-11-16T07:45:00.000Z',
    },
    {
      id: '88888888-0000-4000-8000-000000000005',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      receipt_number: 'RCV-TRF-202611-0003',
      receipt_channel: 'bank_transfer',
      currency: 'IDR',
      customer_gross_amount: '550000.00',
      bank_net_amount: '550000.00',
      bank_fee_amount: '0.00',
      bank_fee_bearer: 'none',
      verified_amount: '550000.00',
      customer_paid_at: '2026-11-16',
      bank_value_date: '2026-11-16',
      verified_at: '2026-11-16T08:15:00.000Z',
      accounting_date: '2026-11-16',
      is_unknown_identity: true,
      customer_id: null,
      sender_name_raw: 'HENDRIYANTO (REKENING PRIBADI)',
      fund_account_id: '55555555-5555-4555-8555-555555555001',
      bank_reference: 'REF-BCA-88104',
      optional_invoice_ref: null,
      receipt_book_no: null,
      actual_collector_id: null,
      sales_owner_id: null,
      location_note: null,
      notes: 'Dana sudah masuk BCA Rp550.000, pengirim atas nama pribadi belum dikonfirmasi milik toko mana.',
      verification_method: 'manual_bank_check',
      verification_ref: 'REF-BCA-88104',
      verification_note: 'Masuk ke akun 2103 Penerimaan Belum Teridentifikasi sampai dikonfirmasi.',
      evidence_hash: null,
      duplicate_flag: false,
      duplicate_reason: null,
      status: 'verified',
      deposit_status: 'not_applicable',
      reconciliation_status: 'needs_review',
      accounting_status: 'queued',
      created_by: DEMO_ACTORS[0].id,
      updated_by: DEMO_ACTORS[1].id,
      submitted_by: DEMO_ACTORS[0].id,
      submitted_at: '2026-11-16T08:05:00.000Z',
      verified_by: DEMO_ACTORS[1].id,
      approved_by: DEMO_ACTORS[1].id,
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
      reason: null,
      version: 3,
      source_app: 'app1_collections_deposits',
      correlation_id: 'cccc0000-0000-4000-8000-000000000005',
      created_at: '2026-11-16T08:00:00.000Z',
      updated_at: '2026-11-16T08:15:00.000Z',
    },
  ];

  const custodyAccounts: CashCustodyAccountRow[] = [
    {
      id: 'c0c0c0c0-0000-4000-8000-000000000001',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      collector_staff_id: '44444444-4444-4444-8444-444444444001',
      currency: 'IDR',
      verified_balance: '300000.00',
      unverified_reported_balance: '0.00',
      version: 1,
      updated_at: now,
    },
    {
      id: 'c0c0c0c0-0000-4000-8000-000000000002',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      collector_staff_id: '44444444-4444-4444-8444-444444444002',
      currency: 'IDR',
      verified_balance: '450000.00',
      unverified_reported_balance: '0.00',
      version: 1,
      updated_at: now,
    },
  ];

  const custodySources: CustodyMovementSourceRow[] = [
    {
      id: 'c1c1c1c1-0000-4000-8000-000000000001',
      company_id: DEMO_COMPANY_ID,
      custody_account_id: 'c0c0c0c0-0000-4000-8000-000000000001',
      receipt_id: '88888888-0000-4000-8000-000000000003',
      verified_amount: '300000.00',
      deposited_amount: '0.00',
      remaining_amount: '300000.00',
      version: 1,
    },
    {
      id: 'c1c1c1c1-0000-4000-8000-000000000002',
      company_id: DEMO_COMPANY_ID,
      custody_account_id: 'c0c0c0c0-0000-4000-8000-000000000002',
      receipt_id: '88888888-0000-4000-8000-000000000004',
      verified_amount: '450000.00',
      deposited_amount: '0.00',
      remaining_amount: '450000.00',
      version: 1,
    },
  ];

  const custodyMovements: CustodyMovementRow[] = [
    {
      id: 'c2c2c2c2-0000-4000-8000-000000000001',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      custody_account_id: 'c0c0c0c0-0000-4000-8000-000000000001',
      collector_staff_id: '44444444-4444-4444-8444-444444444001',
      movement_type: 'cash_receipt_verified',
      direction: 'in',
      amount: '300000.00',
      balance_after: '300000.00',
      source_type: 'receipt',
      source_id: '88888888-0000-4000-8000-000000000003',
      effective_date: '2026-11-15',
      actor_id: DEMO_ACTORS[1].id,
      created_at: '2026-11-15T16:00:00.000Z',
    },
    {
      id: 'c2c2c2c2-0000-4000-8000-000000000002',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      custody_account_id: 'c0c0c0c0-0000-4000-8000-000000000002',
      collector_staff_id: '44444444-4444-4444-8444-444444444002',
      movement_type: 'cash_receipt_verified',
      direction: 'in',
      amount: '450000.00',
      balance_after: '450000.00',
      source_type: 'receipt',
      source_id: '88888888-0000-4000-8000-000000000004',
      effective_date: '2026-11-16',
      actor_id: DEMO_ACTORS[1].id,
      created_at: '2026-11-16T07:45:00.000Z',
    },
  ];

  const bankMatches: BankMatchRow[] = [
    {
      id: 'b1b1b1b1-0000-4000-8000-000000000001',
      company_id: DEMO_COMPANY_ID,
      match_group_id: 'b2b2b2b2-0000-4000-8000-000000000001',
      bank_statement_line_id: '77777777-0000-4000-8000-000000000002',
      target_type: 'receipt',
      target_id: '88888888-0000-4000-8000-000000000002',
      matched_amount: '1493500.00',
      status: 'approved',
      notes: 'Pencocokan otomatis saat verifikasi checker.',
      proposed_by: DEMO_ACTORS[0].id,
      approved_by: DEMO_ACTORS[1].id,
      approved_at: '2026-11-15T14:20:00.000Z',
      version: 1,
      created_at: '2026-11-15T14:20:00.000Z',
    },
  ];

  const discrepancies: DiscrepancyCaseRow[] = [
    {
      id: 'd1d1d1d1-0000-4000-8000-000000000001',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      case_number: 'CASE-202611-0001',
      case_type: 'unknown_sender',
      source_type: 'receipt',
      source_id: '88888888-0000-4000-8000-000000000005',
      expected_amount: '550000.00',
      actual_amount: '550000.00',
      discrepancy_amount: '0.00',
      status: 'open',
      proposed_resolution: null,
      resolution_note: 'Menunggu konfirmasi sales/admin pelanggan mana yang mengirim melalui rekening HENDRIYANTO.',
      created_by: DEMO_ACTORS[1].id,
      proposed_by: null,
      resolved_by: null,
      resolved_at: null,
      version: 1,
      created_at: '2026-11-16T08:15:00.000Z',
    },
  ];

  const accountingEvents: AccountingEventRow[] = [
    {
      id: 'e1e1e1e1-0000-4000-8000-000000000001',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      event_type: 'receipt_transfer_verified',
      source_type: 'receipt',
      source_id: '88888888-0000-4000-8000-000000000002',
      source_version: 3,
      effective_date: '2026-11-15',
      payload_snapshot: {
        receipt_number: 'RCV-TRF-202611-0002',
        customer_gross_amount: '1500000.00',
        bank_net_amount: '1493500.00',
        bank_fee_amount: '6500.00',
        bank_fee_bearer: 'company',
      },
      mapping_version: 'v1',
      dependency_ids: [],
      processing_status: 'waiting_accounting_module',
      error_message: null,
      retry_count: 0,
      correlation_id: 'cccc0000-0000-4000-8000-000000000002',
      created_at: '2026-11-15T14:20:00.000Z',
    },
    {
      id: 'e1e1e1e1-0000-4000-8000-000000000002',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      event_type: 'receipt_cash_verified',
      source_type: 'receipt',
      source_id: '88888888-0000-4000-8000-000000000003',
      source_version: 3,
      effective_date: '2026-11-15',
      payload_snapshot: {
        receipt_number: 'RCV-TUN-202611-0001',
        verified_amount: '300000.00',
        actual_collector_id: '44444444-4444-4444-8444-444444444001',
      },
      mapping_version: 'v1',
      dependency_ids: [],
      processing_status: 'waiting_accounting_module',
      error_message: null,
      retry_count: 0,
      correlation_id: 'cccc0000-0000-4000-8000-000000000003',
      created_at: '2026-11-15T16:00:00.000Z',
    },
    {
      id: 'e1e1e1e1-0000-4000-8000-000000000003',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      event_type: 'receipt_cash_verified',
      source_type: 'receipt',
      source_id: '88888888-0000-4000-8000-000000000004',
      source_version: 3,
      effective_date: '2026-11-16',
      payload_snapshot: {
        receipt_number: 'RCV-TUN-202611-0002',
        verified_amount: '450000.00',
        actual_collector_id: '44444444-4444-4444-8444-444444444002',
      },
      mapping_version: 'v1',
      dependency_ids: [],
      processing_status: 'waiting_accounting_module',
      error_message: null,
      retry_count: 0,
      correlation_id: 'cccc0000-0000-4000-8000-000000000004',
      created_at: '2026-11-16T07:45:00.000Z',
    },
    {
      id: 'e1e1e1e1-0000-4000-8000-000000000004',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      event_type: 'receipt_unidentified_verified',
      source_type: 'receipt',
      source_id: '88888888-0000-4000-8000-000000000005',
      source_version: 3,
      effective_date: '2026-11-16',
      payload_snapshot: {
        receipt_number: 'RCV-TRF-202611-0003',
        verified_amount: '550000.00',
        is_unknown_identity: true,
      },
      mapping_version: 'v1',
      dependency_ids: [],
      processing_status: 'waiting_accounting_module',
      error_message: null,
      retry_count: 0,
      correlation_id: 'cccc0000-0000-4000-8000-000000000005',
      created_at: '2026-11-16T08:15:00.000Z',
    },
  ];

  const auditEvents: AuditEventRow[] = [
    {
      id: 'f1f1f1f1-0000-4000-8000-000000000001',
      company_id: DEMO_COMPANY_ID,
      branch_id: DEMO_BRANCH_JKT,
      actor_id: DEMO_ACTORS[1].id,
      event_action: 'receipt.verify',
      entity_type: 'receipt',
      entity_id: '88888888-0000-4000-8000-000000000002',
      before_state: { status: 'waiting_verification' },
      after_state: { status: 'verified', verified_amount: '1500000.00' },
      reason: 'Cocok mutasi BCA baris #2 + biaya bank disetujui.',
      source_app: 'app1_collections_deposits',
      correlation_id: 'cccc0000-0000-4000-8000-000000000002',
      created_at: '2026-11-15T14:20:00.000Z',
    },
  ];

  const profiles: ProfileRow[] = DEMO_ACTORS.map((a) => ({
    id: a.id,
    email: a.email,
    full_name: a.full_name,
    phone: null,
    is_active: true,
  }));

  return {
    company,
    branches,
    appSettings,
    profiles,
    actors: DEMO_ACTORS,
    customers,
    staff,
    fundAccounts,
    receipts,
    receiptEvidence: [],
    bankBatches,
    bankLines,
    bankMatches,
    custodyAccounts,
    custodyMovements,
    custodySources,
    deposits: [],
    depositLines: [],
    cashTransfers: [],
    paymentAllocations: [],
    discrepancies,
    accountingEvents,
    auditEvents,
    idempotencyCache: {},
    sequences: {
      receipt_transfer: 3,
      receipt_cash: 2,
      cash_deposit: 0,
      cash_transfer: 0,
      bank_statement_batch: 1,
      discrepancy_case: 1,
      audit: 1,
      event: 4,
      uuid: 100,
    },
  };
}

export class DemoEngineError extends Error {
  code: string;
  constructor(message: string, code = '22023') {
    super(message);
    this.code = code;
  }
}

export class DemoFinOpsEngine {
  state: DemoState;

  constructor(initialState?: DemoState) {
    this.state = initialState ?? createInitialDemoState();
  }

  private nextId(prefix = 'aaaaaaaa'): string {
    this.state.sequences.uuid = (this.state.sequences.uuid ?? 100) + 1;
    return makeUuid(prefix, this.state.sequences.uuid);
  }

  private nextDocNo(docType: string, prefix: string, dateStr: string): string {
    const ym = (dateStr || '2026-11-16').slice(0, 7).replace('-', '');
    this.state.sequences[docType] = (this.state.sequences[docType] ?? 0) + 1;
    return `${prefix}-${ym}-${String(this.state.sequences[docType]).padStart(4, '0')}`;
  }

  private requireActor(actor: DemoActor | null): DemoActor {
    if (!actor) throw new DemoEngineError('Autentikasi diperlukan (anonymous ditolak).', '42501');
    return actor;
  }

  private requireBranchAccess(actor: DemoActor, branchId: string) {
    if (!actor.all_branches && actor.branch_id !== branchId) {
      throw new DemoEngineError('Akses cabang tidak diizinkan untuk akun ini.', '42501');
    }
  }

  private requireRoles(actor: DemoActor, allowed: AppRoleCode[]) {
    if (!allowed.includes(actor.role_code)) {
      throw new DemoEngineError(`Peran ${actor.role_code} tidak memiliki izin untuk aksi ini.`, '42501');
    }
  }

  private assertMakerChecker(makerId: string | null | undefined, actorId: string, context: string) {
    if (makerId && makerId === actorId) {
      throw new DemoEngineError(
        `Pelanggaran pemisahan tugas (maker-checker): pembuat dokumen tidak boleh menyetujui/memverifikasi ${context} buatannya sendiri.`,
        '42501'
      );
    }
  }

  private checkIdempotency<T>(actorId: string, rpc: string, key: string): T | null {
    if (!key || !key.trim()) throw new DemoEngineError('idempotency_key wajib diisi.', '22023');
    const cacheKey = `${actorId}::${rpc}::${key}`;
    return (this.state.idempotencyCache[cacheKey] as T) ?? null;
  }

  private saveIdempotency(actorId: string, rpc: string, key: string, response: unknown) {
    const cacheKey = `${actorId}::${rpc}::${key}`;
    this.state.idempotencyCache[cacheKey] = response;
  }

  private writeAudit(
    actorId: string,
    branchId: string | null,
    action: string,
    entityType: string,
    entityId: string,
    beforeState: Record<string, unknown> | null,
    afterState: Record<string, unknown> | null,
    reason: string | null
  ) {
    this.state.auditEvents.unshift({
      id: this.nextId('f1f1f1f1'),
      company_id: this.state.company.id,
      branch_id: branchId,
      actor_id: actorId,
      event_action: action,
      entity_type: entityType,
      entity_id: entityId,
      before_state: beforeState,
      after_state: afterState,
      reason,
      source_app: 'app1_collections_deposits',
      correlation_id: this.nextId('cccccccc'),
      created_at: new Date().toISOString(),
    });
  }

  private emitAccountingEvent(
    actorId: string,
    branchId: string,
    eventType: string,
    sourceType: string,
    sourceId: string,
    sourceVersion: number,
    effectiveDate: string,
    payload: Record<string, unknown>,
    correlationId: string
  ) {
    const exists = this.state.accountingEvents.find(
      (e) =>
        e.company_id === this.state.company.id &&
        e.event_type === eventType &&
        e.source_id === sourceId &&
        e.source_version === sourceVersion
    );
    if (exists) return;
    this.state.accountingEvents.unshift({
      id: this.nextId('e1e1e1e1'),
      company_id: this.state.company.id,
      branch_id: branchId,
      event_type: eventType,
      source_type: sourceType,
      source_id: sourceId,
      source_version: sourceVersion,
      effective_date: effectiveDate,
      payload_snapshot: payload,
      mapping_version: 'v1',
      dependency_ids: [],
      processing_status: 'waiting_accounting_module',
      error_message: null,
      retry_count: 0,
      correlation_id: correlationId,
      created_at: new Date().toISOString(),
    });
  }

  // ---------------------------------------------------------------------------
  // READS (Scope-checked)
  // ---------------------------------------------------------------------------
  getVisibleReceipts(actor: DemoActor | null): ReceiptRow[] {
    const a = this.requireActor(actor);
    return this.state.receipts.filter((r) => {
      if (!a.all_branches && r.branch_id !== a.branch_id) return false;
      if (a.role_code === 'collector_optional') {
        return r.created_by === a.id || (a.staff_id && r.actual_collector_id === a.staff_id);
      }
      return true;
    });
  }

  listCollectionDashboard(
    actor: DemoActor | null,
    params: { branch_id?: string | null; date_from?: string | null; date_to?: string | null }
  ): CollectionDashboardResponse {
    const a = this.requireActor(actor);
    const inPeriod = (d: string) =>
      (!params.date_from || d >= params.date_from) && (!params.date_to || d <= params.date_to);
    const inBranch = (b: string) =>
      (a.all_branches || b === a.branch_id) && (!params.branch_id || b === params.branch_id);

    const visibleReceipts = this.getVisibleReceipts(a).filter((r) => inBranch(r.branch_id));

    const transferPending = visibleReceipts.filter(
      (r) =>
        r.receipt_channel === 'bank_transfer' &&
        (r.status === 'submitted' || r.status === 'waiting_verification') &&
        inPeriod(r.customer_paid_at)
    );
    const cashReported = visibleReceipts.filter(
      (r) =>
        r.receipt_channel === 'cash' &&
        (r.status === 'submitted' || r.status === 'waiting_verification') &&
        inPeriod(r.customer_paid_at)
    );
    const custodies = this.state.custodyAccounts.filter((c) => {
      if (!inBranch(c.branch_id)) return false;
      if (a.role_code === 'collector_optional') return c.collector_staff_id === a.staff_id;
      return toDecimal(c.verified_balance).gt(0);
    });
    const depositsSubmitted = this.state.deposits.filter((d) => {
      if (!inBranch(d.branch_id) || !inPeriod(d.deposit_date)) return false;
      if (a.role_code === 'collector_optional' && d.collector_staff_id !== a.staff_id) return false;
      return d.status === 'submitted';
    });
    const depositsAccepted = this.state.deposits.filter((d) => {
      if (!inBranch(d.branch_id) || !inPeriod(d.deposit_date)) return false;
      if (a.role_code === 'collector_optional' && d.collector_staff_id !== a.staff_id) return false;
      return ['partially_accepted', 'accepted', 'accepted_with_discrepancy'].includes(d.status);
    });
    const openDisc = this.state.discrepancies.filter(
      (dc) =>
        inBranch(dc.branch_id) &&
        ['open', 'investigating', 'pending_approval'].includes(dc.status) &&
        a.role_code !== 'collector_optional'
    );

    const sumField = <T,>(arr: T[], fn: (x: T) => string) =>
      arr.reduce((acc, item) => acc.plus(toDecimal(fn(item))), new Decimal(0)).toFixed(2);

    const unallocatedReceipts = visibleReceipts
      .filter((r) => r.status === 'verified')
      .map((r) => {
        const allocated = this.state.paymentAllocations
          .filter((pa) => pa.receipt_id === r.id && pa.status === 'approved')
          .reduce((acc, pa) => acc.plus(toDecimal(pa.allocated_amount)), new Decimal(0));
        const avail = toDecimal(r.verified_amount).minus(allocated);
        return { r, avail };
      })
      .filter((x) => x.avail.gt(0));

    return {
      transfer_waiting_verification: {
        count: transferPending.length,
        amount: sumField(transferPending, (x) => x.customer_gross_amount),
      },
      cash_reported: {
        count: cashReported.length,
        amount: sumField(cashReported, (x) => x.customer_gross_amount),
      },
      collector_verified_cash: {
        count: custodies.filter((c) => toDecimal(c.verified_balance).gt(0)).length,
        amount: sumField(custodies, (x) => x.verified_balance),
      },
      deposit_submitted: {
        count: depositsSubmitted.length,
        amount: sumField(depositsSubmitted, (x) => x.declared_amount),
      },
      deposit_accepted: {
        count: depositsAccepted.length,
        amount: sumField(depositsAccepted, (x) => x.received_amount),
      },
      open_discrepancies: {
        count: openDisc.length,
        amount: sumField(openDisc, (x) => x.discrepancy_amount),
      },
      unallocated_funds: {
        count: unallocatedReceipts.length,
        amount: unallocatedReceipts.reduce((acc, x) => acc.plus(x.avail), new Decimal(0)).toFixed(2),
      },
    };
  }

  getCollectorCustodyDetail(actor: DemoActor | null, collectorStaffId: string): CollectorCustodyDetailResponse {
    const a = this.requireActor(actor);
    if (a.role_code === 'collector_optional' && a.staff_id !== collectorStaffId) {
      throw new DemoEngineError('Penagih hanya dapat melihat saldo custody miliknya sendiri.', '42501');
    }
    const custody = this.state.custodyAccounts.find((c) => c.collector_staff_id === collectorStaffId) ?? null;
    if (!custody) return { custody: null, sources: [], movements: [] };
    this.requireBranchAccess(a, custody.branch_id);

    const sources = this.state.custodySources
      .filter((s) => s.custody_account_id === custody.id && toDecimal(s.remaining_amount).gt(0))
      .map((s) => {
        const r = this.state.receipts.find((x) => x.id === s.receipt_id)!;
        return {
          receipt_id: s.receipt_id,
          receipt_number: r.receipt_number,
          customer_id: r.customer_id,
          customer_paid_at: r.customer_paid_at,
          verified_amount: s.verified_amount,
          deposited_amount: s.deposited_amount,
          remaining_amount: s.remaining_amount,
        };
      });

    const movements = this.state.custodyMovements.filter((m) => m.custody_account_id === custody.id);
    return { custody, sources, movements };
  }

  // ---------------------------------------------------------------------------
  // RPC MUTATIONS
  // ---------------------------------------------------------------------------
  createReceiptDraft(
    actor: DemoActor | null,
    params: {
      idempotency_key: string;
      branch_id: string;
      receipt_channel: ReceiptChannel;
      customer_paid_at: string;
      bank_value_date?: string | null;
      fund_account_id?: string | null;
      customer_id?: string | null;
      is_unknown_identity: boolean;
      sender_name_raw?: string | null;
      customer_gross_amount: string;
      bank_net_amount?: string;
      bank_fee_amount?: string;
      bank_fee_bearer?: BankFeeBearer;
      bank_reference?: string | null;
      optional_invoice_ref?: string | null;
      receipt_book_no?: string | null;
      actual_collector_id?: string | null;
      sales_owner_id?: string | null;
      location_note?: string | null;
      notes?: string | null;
      evidence_hash?: string | null;
      evidence_file?: { file_name: string; mime_type: string; file_size_bytes: number } | null;
    }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{
      receipt_id: string;
      receipt_number: string;
      duplicate_flag: boolean;
      duplicate_reason: string | null;
      version: number;
    }>(
      a.id,
      'create_receipt_draft',
      params.idempotency_key
    );
    if (cached) return cached;

    this.requireBranchAccess(a, params.branch_id);
    this.requireRoles(a, ['finance_maker', 'finance_checker', 'collector_optional']);

    if (a.role_code === 'collector_optional') {
      if (params.receipt_channel !== 'cash') {
        throw new DemoEngineError('Akun penagih hanya dapat melaporkan penerimaan tunai.', '42501');
      }
      if (params.actual_collector_id !== a.staff_id) {
        throw new DemoEngineError('Akun penagih hanya boleh mencatat atas nama dirinya sendiri.', '42501');
      }
    }

    const gross = toDecimal(params.customer_gross_amount);
    if (gross.lte(0)) throw new DemoEngineError('Nominal penerimaan harus lebih dari 0.');
    const fee = toDecimal(params.bank_fee_amount ?? '0');
    const net = params.bank_net_amount ? toDecimal(params.bank_net_amount) : gross.minus(fee);
    if (net.lt(0) || net.plus(fee).gt(gross)) {
      throw new DemoEngineError('Kredit bank bersih + biaya bank melebihi nominal pelanggan.');
    }

    if (params.is_unknown_identity && params.customer_id) {
      throw new DemoEngineError('Pilihan identitas belum diketahui tidak boleh memilih pelanggan.');
    }
    if (!params.is_unknown_identity && !params.customer_id) {
      throw new DemoEngineError('Pilih pelanggan atau centang "Identitas Pengirim Belum Diketahui".');
    }
    if (params.receipt_channel === 'cash' && !params.actual_collector_id) {
      throw new DemoEngineError('Penerimaan tunai wajib mencantumkan penagih yang menerima uang.');
    }

    // Cek indikasi duplikat tanpa menghapus otomatis
    const dupMatches = this.state.receipts.filter(
      (r) =>
        r.status !== 'rejected' &&
        r.status !== 'reversed' &&
        r.customer_paid_at === params.customer_paid_at &&
        toDecimal(r.customer_gross_amount).eq(gross) &&
        ((params.bank_reference && r.bank_reference === params.bank_reference) ||
          (params.evidence_hash && r.evidence_hash === params.evidence_hash) ||
          (params.fund_account_id && r.fund_account_id === params.fund_account_id))
    );
    const dupFlag = dupMatches.length > 0;
    const dupReason = dupFlag
      ? `Terdeteksi ${dupMatches.length} transaksi identik pada tanggal/nominal/referensi atau hash bukti yang sama (${dupMatches.map((m) => m.receipt_number).join(', ')}). Tidak dihapus otomatis; perlu tinjauan checker.`
      : null;

    const docType = params.receipt_channel === 'bank_transfer' ? 'receipt_transfer' : 'receipt_cash';
    const prefix = params.receipt_channel === 'bank_transfer' ? 'RCV-TRF' : 'RCV-TUN';
    const receiptNumber = this.nextDocNo(docType, prefix, params.customer_paid_at);
    const id = this.nextId('88888888');
    const now = new Date().toISOString();

    const row: ReceiptRow = {
      id,
      company_id: this.state.company.id,
      branch_id: params.branch_id,
      receipt_number: receiptNumber,
      receipt_channel: params.receipt_channel,
      currency: 'IDR',
      customer_gross_amount: toMoneyString(gross),
      bank_net_amount: toMoneyString(net),
      bank_fee_amount: toMoneyString(fee),
      bank_fee_bearer: params.bank_fee_bearer ?? 'none',
      verified_amount: '0.00',
      customer_paid_at: params.customer_paid_at,
      bank_value_date: params.bank_value_date ?? null,
      verified_at: null,
      accounting_date: null,
      is_unknown_identity: params.is_unknown_identity,
      customer_id: params.is_unknown_identity ? null : params.customer_id ?? null,
      sender_name_raw: params.sender_name_raw ?? null,
      fund_account_id: params.fund_account_id ?? null,
      bank_reference: params.bank_reference ?? null,
      optional_invoice_ref: params.optional_invoice_ref ?? null,
      receipt_book_no: params.receipt_book_no ?? null,
      actual_collector_id: params.actual_collector_id ?? null,
      sales_owner_id: params.sales_owner_id ?? null,
      location_note: params.location_note ?? null,
      notes: params.notes ?? null,
      verification_method: null,
      verification_ref: null,
      verification_note: null,
      evidence_hash: params.evidence_hash ?? null,
      duplicate_flag: dupFlag,
      duplicate_reason: dupReason,
      status: 'draft',
      deposit_status: params.receipt_channel === 'cash' ? 'not_deposited' : 'not_applicable',
      reconciliation_status: 'unreviewed',
      accounting_status: 'not_ready',
      created_by: a.id,
      updated_by: a.id,
      submitted_by: null,
      submitted_at: null,
      verified_by: null,
      approved_by: null,
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
      reason: null,
      version: 1,
      source_app: 'app1_collections_deposits',
      correlation_id: this.nextId('cccccccc'),
      created_at: now,
      updated_at: now,
    };

    this.state.receipts.unshift(row);

    if (params.evidence_file && params.evidence_hash) {
      this.state.receiptEvidence.push({
        id: this.nextId('90909090'),
        company_id: this.state.company.id,
        receipt_id: id,
        storage_bucket: 'finops-evidence',
        storage_path: `${this.state.company.id}/receipt/${id}/${params.evidence_file.file_name}`,
        file_name: params.evidence_file.file_name,
        mime_type: params.evidence_file.mime_type,
        file_size_bytes: params.evidence_file.file_size_bytes,
        sha256_hash: params.evidence_hash,
        uploaded_by: a.id,
        created_at: now,
      });
    }

    this.writeAudit(
      a.id,
      params.branch_id,
      'receipt.create_draft',
      'receipt',
      id,
      null,
      { receipt_number: receiptNumber, gross: row.customer_gross_amount, channel: row.receipt_channel },
      'Draft penerimaan dibuat'
    );

    const res = {
      receipt_id: id,
      receipt_number: receiptNumber,
      duplicate_flag: dupFlag,
      duplicate_reason: dupReason,
      version: 1,
    };
    this.saveIdempotency(a.id, 'create_receipt_draft', params.idempotency_key, res);
    return res;
  }

  submitReceipt(
    actor: DemoActor | null,
    params: { idempotency_key: string; receipt_id: string; expected_version: number }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{ receipt_id: string; status: ReceiptRow['status']; version: number }>(
      a.id,
      'submit_receipt',
      params.idempotency_key
    );
    if (cached) return cached;

    const r = this.state.receipts.find((x) => x.id === params.receipt_id);
    if (!r) throw new DemoEngineError('Penerimaan tidak ditemukan.', 'P0002');
    this.requireBranchAccess(a, r.branch_id);
    this.requireRoles(a, ['finance_maker', 'finance_checker', 'collector_optional']);
    if (r.version !== params.expected_version) {
      throw new DemoEngineError('Konflik versi dokumen. Muat ulang data.', '40001');
    }
    if (r.status !== 'draft') {
      throw new DemoEngineError(`Hanya draft yang dapat diajukan verifikasi (status saat ini: ${r.status}).`);
    }

    r.status = 'waiting_verification';
    r.submitted_by = a.id;
    r.submitted_at = new Date().toISOString();
    r.updated_by = a.id;
    r.version += 1;
    r.updated_at = new Date().toISOString();

    if (r.receipt_channel === 'cash' && r.actual_collector_id) {
      let custody = this.state.custodyAccounts.find((c) => c.collector_staff_id === r.actual_collector_id);
      if (!custody) {
        custody = {
          id: this.nextId('c0c0c0c0'),
          company_id: this.state.company.id,
          branch_id: r.branch_id,
          collector_staff_id: r.actual_collector_id,
          currency: 'IDR',
          verified_balance: '0.00',
          unverified_reported_balance: '0.00',
          version: 1,
          updated_at: new Date().toISOString(),
        };
        this.state.custodyAccounts.push(custody);
      }
      custody.unverified_reported_balance = toMoneyString(
        toDecimal(custody.unverified_reported_balance).plus(toDecimal(r.customer_gross_amount))
      );
      custody.version += 1;
    }

    if (r.duplicate_flag) {
      this.state.discrepancies.unshift({
        id: this.nextId('d1d1d1d1'),
        company_id: this.state.company.id,
        branch_id: r.branch_id,
        case_number: this.nextDocNo('discrepancy_case', 'CASE', r.customer_paid_at),
        case_type: 'duplicate_review',
        source_type: 'receipt',
        source_id: r.id,
        expected_amount: r.customer_gross_amount,
        actual_amount: r.customer_gross_amount,
        discrepancy_amount: '0.00',
        status: 'open',
        proposed_resolution: null,
        resolution_note: r.duplicate_reason,
        created_by: a.id,
        proposed_by: null,
        resolved_by: null,
        resolved_at: null,
        version: 1,
        created_at: new Date().toISOString(),
      });
    }

    this.writeAudit(
      a.id,
      r.branch_id,
      'receipt.submit',
      'receipt',
      r.id,
      { status: 'draft' },
      { status: 'waiting_verification' },
      'Diajukan untuk verifikasi checker'
    );

    const res = { receipt_id: r.id, status: r.status, version: r.version };
    this.saveIdempotency(a.id, 'submit_receipt', params.idempotency_key, res);
    return res;
  }

  verifyReceipt(
    actor: DemoActor | null,
    params: {
      idempotency_key: string;
      receipt_id: string;
      expected_version: number;
      verification_method: VerificationMethod;
      bank_statement_line_id?: string | null;
      verification_ref?: string | null;
      verification_note?: string | null;
      bank_value_date?: string | null;
      bank_fee_amount?: string | null;
      bank_fee_bearer?: BankFeeBearer | null;
    }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{
      receipt_id: string;
      status: ReceiptRow['status'];
      verified_amount: string;
      version: number;
    }>(a.id, 'verify_receipt', params.idempotency_key);
    if (cached) return cached;

    const r = this.state.receipts.find((x) => x.id === params.receipt_id);
    if (!r) throw new DemoEngineError('Penerimaan tidak ditemukan.', 'P0002');
    this.requireBranchAccess(a, r.branch_id);
    this.requireRoles(a, ['finance_checker']);
    this.assertMakerChecker(r.created_by, a.id, 'penerimaan');
    this.assertMakerChecker(r.submitted_by, a.id, 'pengajuan penerimaan');

    if (r.version !== params.expected_version) {
      throw new DemoEngineError('Konflik versi dokumen. Muat ulang data.', '40001');
    }
    if (!['submitted', 'waiting_verification'].includes(r.status)) {
      throw new DemoEngineError('Penerimaan tidak berada pada antrian verifikasi.');
    }

    const fee = toDecimal(params.bank_fee_amount ?? r.bank_fee_amount ?? '0');
    const bearer = params.bank_fee_bearer ?? r.bank_fee_bearer ?? 'none';
    let bankNet = toDecimal(r.customer_gross_amount).minus(fee);
    let verifiedAmt = bankNet;
    let valueDate = params.bank_value_date ?? r.bank_value_date ?? r.customer_paid_at;

    if (r.receipt_channel === 'bank_transfer') {
      if (params.verification_method === 'bank_statement_match') {
        if (!params.bank_statement_line_id) {
          throw new DemoEngineError('Pilih baris mutasi bank untuk metode pencocokan mutasi.');
        }
        const bl = this.state.bankLines.find((x) => x.id === params.bank_statement_line_id);
        if (!bl) throw new DemoEngineError('Baris mutasi bank tidak ditemukan.', 'P0002');
        if (bl.direction !== 'credit') throw new DemoEngineError('Mutasi bank penerimaan harus berupa kredit.');
        const avail = toDecimal(bl.amount).minus(toDecimal(bl.matched_amount));
        if (avail.lte(0)) throw new DemoEngineError('Baris mutasi bank ini sudah habis dicocokkan.');

        const take = Decimal.min(avail, toDecimal(r.customer_gross_amount).minus(fee));
        if (take.lte(0)) throw new DemoEngineError('Nominal kredit bank tidak mencukupi.');
        bankNet = take;
        valueDate = bl.value_date;

        this.state.bankMatches.push({
          id: this.nextId('b1b1b1b1'),
          company_id: this.state.company.id,
          match_group_id: this.nextId('b2b2b2b2'),
          bank_statement_line_id: bl.id,
          target_type: 'receipt',
          target_id: r.id,
          matched_amount: toMoneyString(take),
          status: 'approved',
          notes: params.verification_note ?? 'Matched saat verifikasi transfer',
          proposed_by: r.created_by,
          approved_by: a.id,
          approved_at: new Date().toISOString(),
          version: 1,
          created_at: new Date().toISOString(),
        });

        bl.matched_amount = toMoneyString(toDecimal(bl.matched_amount).plus(take));
        bl.match_status = toDecimal(bl.matched_amount).gte(toDecimal(bl.amount)) ? 'matched' : 'proposed';
        bl.suggested_classification = 'customer_receipt';
        bl.version += 1;
      } else {
        if (!params.verification_ref || !params.verification_ref.trim()) {
          throw new DemoEngineError('Verifikasi manual wajib mencantumkan referensi/alasan pemeriksaan.');
        }
      }

      if (fee.gt(0) && bearer === 'company') {
        verifiedAmt = toDecimal(r.customer_gross_amount);
      } else {
        verifiedAmt = bankNet;
        if (fee.gt(0) && bearer === 'pending_review') {
          this.state.discrepancies.unshift({
            id: this.nextId('d1d1d1d1'),
            company_id: this.state.company.id,
            branch_id: r.branch_id,
            case_number: this.nextDocNo('discrepancy_case', 'CASE', valueDate),
            case_type: 'bank_fee_review',
            source_type: 'receipt',
            source_id: r.id,
            expected_amount: r.customer_gross_amount,
            actual_amount: toMoneyString(bankNet),
            discrepancy_amount: toMoneyString(fee),
            status: 'open',
            proposed_resolution: null,
            resolution_note: 'Potongan biaya bank belum mendapat persetujuan penanggung.',
            created_by: a.id,
            proposed_by: null,
            resolved_by: null,
            resolved_at: null,
            version: 1,
            created_at: new Date().toISOString(),
          });
        }
      }
    } else {
      // Cash verified -> naikkan kas di penagih
      verifiedAmt = toDecimal(r.customer_gross_amount);
      bankNet = verifiedAmt;
      let custody = this.state.custodyAccounts.find((c) => c.collector_staff_id === r.actual_collector_id);
      if (!custody) {
        custody = {
          id: this.nextId('c0c0c0c0'),
          company_id: this.state.company.id,
          branch_id: r.branch_id,
          collector_staff_id: r.actual_collector_id!,
          currency: 'IDR',
          verified_balance: '0.00',
          unverified_reported_balance: '0.00',
          version: 1,
          updated_at: new Date().toISOString(),
        };
        this.state.custodyAccounts.push(custody);
      }
      const nextBal = toDecimal(custody.verified_balance).plus(verifiedAmt);
      custody.verified_balance = toMoneyString(nextBal);
      custody.unverified_reported_balance = toMoneyString(
        Decimal.max(0, toDecimal(custody.unverified_reported_balance).minus(toDecimal(r.customer_gross_amount)))
      );
      custody.version += 1;
      custody.updated_at = new Date().toISOString();

      this.state.custodyMovements.unshift({
        id: this.nextId('c2c2c2c2'),
        company_id: this.state.company.id,
        branch_id: r.branch_id,
        custody_account_id: custody.id,
        collector_staff_id: r.actual_collector_id!,
        movement_type: 'cash_receipt_verified',
        direction: 'in',
        amount: toMoneyString(verifiedAmt),
        balance_after: custody.verified_balance,
        source_type: 'receipt',
        source_id: r.id,
        effective_date: r.customer_paid_at,
        actor_id: a.id,
        created_at: new Date().toISOString(),
      });

      this.state.custodySources.push({
        id: this.nextId('c1c1c1c1'),
        company_id: this.state.company.id,
        custody_account_id: custody.id,
        receipt_id: r.id,
        verified_amount: toMoneyString(verifiedAmt),
        deposited_amount: '0.00',
        remaining_amount: toMoneyString(verifiedAmt),
        version: 1,
      });
    }

    if (r.is_unknown_identity) {
      this.state.discrepancies.unshift({
        id: this.nextId('d1d1d1d1'),
        company_id: this.state.company.id,
        branch_id: r.branch_id,
        case_number: this.nextDocNo('discrepancy_case', 'CASE', valueDate),
        case_type: 'unknown_sender',
        source_type: 'receipt',
        source_id: r.id,
        expected_amount: toMoneyString(verifiedAmt),
        actual_amount: toMoneyString(verifiedAmt),
        discrepancy_amount: '0.00',
        status: 'open',
        proposed_resolution: null,
        resolution_note: 'Dana terverifikasi tanpa identitas pelanggan.',
        created_by: a.id,
        proposed_by: null,
        resolved_by: null,
        resolved_at: null,
        version: 1,
        created_at: new Date().toISOString(),
      });
    }

    r.status = 'verified';
    r.bank_net_amount = toMoneyString(bankNet);
    r.bank_fee_amount = toMoneyString(fee);
    r.bank_fee_bearer = bearer;
    r.verified_amount = toMoneyString(verifiedAmt);
    r.bank_value_date = valueDate;
    r.accounting_date = valueDate;
    r.verification_method = params.verification_method;
    r.verification_ref = params.verification_ref ?? r.bank_reference;
    r.verification_note = params.verification_note ?? null;
    r.verified_by = a.id;
    r.approved_by = a.id;
    r.verified_at = new Date().toISOString();
    r.updated_by = a.id;
    r.accounting_status = 'queued';
    r.version += 1;
    r.updated_at = new Date().toISOString();

    const eventType = r.is_unknown_identity
      ? 'receipt_unidentified_verified'
      : r.receipt_channel === 'bank_transfer'
      ? 'receipt_transfer_verified'
      : 'receipt_cash_verified';

    this.emitAccountingEvent(
      a.id,
      r.branch_id,
      eventType,
      'receipt',
      r.id,
      r.version,
      valueDate,
      {
        receipt_number: r.receipt_number,
        channel: r.receipt_channel,
        customer_gross_amount: r.customer_gross_amount,
        bank_net_amount: r.bank_net_amount,
        bank_fee_amount: r.bank_fee_amount,
        bank_fee_bearer: r.bank_fee_bearer,
        verified_amount: r.verified_amount,
        is_unknown_identity: r.is_unknown_identity,
      },
      r.correlation_id
    );

    this.writeAudit(
      a.id,
      r.branch_id,
      'receipt.verify',
      'receipt',
      r.id,
      { status: 'waiting_verification' },
      { status: 'verified', verified_amount: r.verified_amount },
      params.verification_note ?? 'Diverifikasi oleh checker'
    );

    const res = { receipt_id: r.id, status: r.status, verified_amount: r.verified_amount, version: r.version };
    this.saveIdempotency(a.id, 'verify_receipt', params.idempotency_key, res);
    return res;
  }

  rejectReceipt(
    actor: DemoActor | null,
    params: { idempotency_key: string; receipt_id: string; expected_version: number; reason: string }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{ receipt_id: string; status: ReceiptRow['status']; version: number }>(
      a.id,
      'reject_receipt',
      params.idempotency_key
    );
    if (cached) return cached;

    if (!params.reason || params.reason.trim().length < 3) {
      throw new DemoEngineError('Alasan penolakan wajib diisi.');
    }

    const r = this.state.receipts.find((x) => x.id === params.receipt_id);
    if (!r) throw new DemoEngineError('Penerimaan tidak ditemukan.', 'P0002');
    this.requireBranchAccess(a, r.branch_id);
    this.requireRoles(a, ['finance_checker']);
    this.assertMakerChecker(r.created_by, a.id, 'penerimaan');
    if (r.version !== params.expected_version) throw new DemoEngineError('Konflik versi.', '40001');
    if (!['submitted', 'waiting_verification'].includes(r.status)) {
      throw new DemoEngineError('Hanya penerimaan menunggu verifikasi yang dapat ditolak.');
    }

    if (r.receipt_channel === 'cash' && r.actual_collector_id) {
      const custody = this.state.custodyAccounts.find((c) => c.collector_staff_id === r.actual_collector_id);
      if (custody) {
        custody.unverified_reported_balance = toMoneyString(
          Decimal.max(0, toDecimal(custody.unverified_reported_balance).minus(toDecimal(r.customer_gross_amount)))
        );
        custody.version += 1;
      }
    }

    r.status = 'rejected';
    r.rejected_by = a.id;
    r.rejected_at = new Date().toISOString();
    r.rejection_reason = params.reason;
    r.updated_by = a.id;
    r.version += 1;
    r.updated_at = new Date().toISOString();

    this.writeAudit(a.id, r.branch_id, 'receipt.reject', 'receipt', r.id, { status: 'waiting_verification' }, { status: 'rejected' }, params.reason);

    const res = { receipt_id: r.id, status: r.status, version: r.version };
    this.saveIdempotency(a.id, 'reject_receipt', params.idempotency_key, res);
    return res;
  }

  proposeReceiptIdentity(
    actor: DemoActor | null,
    params: { idempotency_key: string; receipt_id: string; expected_version: number; proposed_customer_id: string; reason: string }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{ receipt_id: string; status: string; proposed_customer_id: string }>(
      a.id,
      'propose_receipt_identity',
      params.idempotency_key
    );
    if (cached) return cached;

    const r = this.state.receipts.find((x) => x.id === params.receipt_id);
    if (!r) throw new DemoEngineError('Penerimaan tidak ditemukan.', 'P0002');
    this.requireBranchAccess(a, r.branch_id);
    this.requireRoles(a, ['finance_maker', 'finance_checker', 'sales_admin']);
    if (!r.is_unknown_identity) throw new DemoEngineError('Identitas pelanggan sudah terisi.');
    if (r.version !== params.expected_version) throw new DemoEngineError('Konflik versi.', '40001');

    const dc = this.state.discrepancies.find(
      (d) => d.source_type === 'receipt' && d.source_id === r.id && d.case_type === 'unknown_sender'
    );
    if (dc) {
      dc.status = 'pending_approval';
      dc.proposed_resolution = params.proposed_customer_id;
      dc.resolution_note = params.reason;
      dc.proposed_by = a.id;
      dc.version += 1;
    }

    this.writeAudit(
      a.id,
      r.branch_id,
      'receipt.propose_identity',
      'receipt',
      r.id,
      null,
      { proposed_customer_id: params.proposed_customer_id },
      params.reason
    );

    const res = { receipt_id: r.id, status: 'pending_approval', proposed_customer_id: params.proposed_customer_id };
    this.saveIdempotency(a.id, 'propose_receipt_identity', params.idempotency_key, res);
    return res;
  }

  approveReceiptIdentity(
    actor: DemoActor | null,
    params: { idempotency_key: string; receipt_id: string; expected_version: number; customer_id: string; reason: string }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{ receipt_id: string; customer_id: string; version: number }>(
      a.id,
      'approve_receipt_identity',
      params.idempotency_key
    );
    if (cached) return cached;

    const r = this.state.receipts.find((x) => x.id === params.receipt_id);
    if (!r) throw new DemoEngineError('Penerimaan tidak ditemukan.', 'P0002');
    this.requireBranchAccess(a, r.branch_id);
    this.requireRoles(a, ['finance_checker', 'reconciliation_reviewer']);
    if (r.version !== params.expected_version) throw new DemoEngineError('Konflik versi.', '40001');

    const dc = this.state.discrepancies.find(
      (d) => d.source_type === 'receipt' && d.source_id === r.id && d.case_type === 'unknown_sender'
    );
    if (dc?.proposed_by) {
      this.assertMakerChecker(dc.proposed_by, a.id, 'usulan identitas pengirim');
    }

    r.is_unknown_identity = false;
    r.customer_id = params.customer_id;
    r.reconciliation_status = 'reviewed';
    r.updated_by = a.id;
    r.version += 1;
    r.updated_at = new Date().toISOString();

    if (dc) {
      dc.status = 'resolved';
      dc.resolved_by = a.id;
      dc.resolved_at = new Date().toISOString();
      dc.resolution_note = params.reason;
      dc.version += 1;
    }

    if (r.status === 'verified') {
      this.emitAccountingEvent(
        a.id,
        r.branch_id,
        'receipt_identity_resolved',
        'receipt',
        r.id,
        r.version,
        r.accounting_date ?? r.customer_paid_at,
        { receipt_number: r.receipt_number, customer_id: params.customer_id, amount: r.verified_amount },
        r.correlation_id
      );
    }

    this.writeAudit(
      a.id,
      r.branch_id,
      'receipt.approve_identity',
      'receipt',
      r.id,
      { is_unknown_identity: true },
      { is_unknown_identity: false, customer_id: params.customer_id },
      params.reason
    );

    const res = { receipt_id: r.id, customer_id: params.customer_id, version: r.version };
    this.saveIdempotency(a.id, 'approve_receipt_identity', params.idempotency_key, res);
    return res;
  }

  createCashDeposit(
    actor: DemoActor | null,
    params: {
      idempotency_key: string;
      branch_id: string;
      collector_staff_id: string;
      target_type: 'office_cash' | 'bank_direct';
      target_fund_account_id: string;
      deposit_date: string;
      lines: Array<{ receipt_id: string; declared_amount: string }>;
      is_planned_partial: boolean;
      notes?: string | null;
    }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{ deposit_id: string; deposit_number: string; declared_amount: string; version: number }>(
      a.id,
      'create_cash_deposit',
      params.idempotency_key
    );
    if (cached) return cached;

    this.requireBranchAccess(a, params.branch_id);
    this.requireRoles(a, ['finance_maker', 'finance_checker', 'collector_optional']);

    if (a.role_code === 'collector_optional' && params.collector_staff_id !== a.staff_id) {
      throw new DemoEngineError('Penagih hanya dapat mengajukan setoran atas saldo miliknya sendiri.', '42501');
    }

    const custody = this.state.custodyAccounts.find((c) => c.collector_staff_id === params.collector_staff_id);
    if (!custody || toDecimal(custody.verified_balance).lte(0)) {
      throw new DemoEngineError('Penagih tidak memiliki saldo kas terverifikasi. Verifikasi sumber tunai terlebih dahulu.');
    }

    if (!params.lines.length) throw new DemoEngineError('Pilih minimal satu sumber penerimaan terverifikasi.');

    let totalDeclared = new Decimal(0);
    const depositId = this.nextId('d0d0d0d0');
    const newLines: CashDepositLineRow[] = [];

    for (const line of params.lines) {
      const src = this.state.custodySources.find(
        (s) => s.custody_account_id === custody.id && s.receipt_id === line.receipt_id
      );
      if (!src) {
        throw new DemoEngineError('Sumber penerimaan tunai belum terverifikasi atau bukan milik penagih ini.');
      }
      const amt = toDecimal(line.declared_amount);
      if (amt.lte(0) || amt.gt(toDecimal(src.remaining_amount))) {
        throw new DemoEngineError('Nominal setoran melebihi sisa saldo sumber penerimaan yang dapat ditelusuri.');
      }
      totalDeclared = totalDeclared.plus(amt);
      newLines.push({
        id: this.nextId('d2d2d2d2'),
        company_id: this.state.company.id,
        cash_deposit_id: depositId,
        source_receipt_id: src.receipt_id,
        declared_amount: toMoneyString(amt),
        accepted_amount: '0.00',
      });
    }

    const depositNo = this.nextDocNo('cash_deposit', 'DEP', params.deposit_date);
    const now = new Date().toISOString();

    const deposit: CashDepositRow = {
      id: depositId,
      company_id: this.state.company.id,
      branch_id: params.branch_id,
      deposit_number: depositNo,
      collector_staff_id: params.collector_staff_id,
      custody_account_id: custody.id,
      target_type: params.target_type,
      target_fund_account_id: params.target_fund_account_id,
      bank_statement_line_id: null,
      deposit_date: params.deposit_date,
      declared_amount: toMoneyString(totalDeclared),
      received_amount: '0.00',
      shortage_amount: '0.00',
      excess_amount: '0.00',
      is_planned_partial: params.is_planned_partial,
      status: 'draft',
      accounting_status: 'not_ready',
      evidence_path: null,
      notes: params.notes ?? null,
      created_by: a.id,
      submitted_by: null,
      submitted_at: null,
      received_by: null,
      approved_by: null,
      approved_at: null,
      reason: null,
      version: 1,
      correlation_id: this.nextId('cccccccc'),
      created_at: now,
      updated_at: now,
    };

    this.state.deposits.unshift(deposit);
    this.state.depositLines.push(...newLines);

    this.writeAudit(
      a.id,
      params.branch_id,
      'deposit.create',
      'cash_deposit',
      depositId,
      null,
      { deposit_number: depositNo, declared_amount: deposit.declared_amount },
      'Draft setoran penagih dibuat'
    );

    const res = {
      deposit_id: depositId,
      deposit_number: depositNo,
      declared_amount: deposit.declared_amount,
      version: 1,
    };
    this.saveIdempotency(a.id, 'create_cash_deposit', params.idempotency_key, res);
    return res;
  }

  submitCashDeposit(
    actor: DemoActor | null,
    params: { idempotency_key: string; deposit_id: string; expected_version: number }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{ deposit_id: string; status: CashDepositRow['status']; version: number }>(
      a.id,
      'submit_cash_deposit',
      params.idempotency_key
    );
    if (cached) return cached;

    const d = this.state.deposits.find((x) => x.id === params.deposit_id);
    if (!d) throw new DemoEngineError('Dokumen setoran tidak ditemukan.', 'P0002');
    this.requireBranchAccess(a, d.branch_id);
    this.requireRoles(a, ['finance_maker', 'finance_checker', 'collector_optional']);
    if (d.version !== params.expected_version) throw new DemoEngineError('Konflik versi setoran.', '40001');
    if (d.status !== 'draft') throw new DemoEngineError('Hanya draft setoran yang dapat diajukan.');

    d.status = 'submitted';
    d.submitted_by = a.id;
    d.submitted_at = new Date().toISOString();
    d.version += 1;
    d.updated_at = new Date().toISOString();

    const res = { deposit_id: d.id, status: d.status, version: d.version };
    this.saveIdempotency(a.id, 'submit_cash_deposit', params.idempotency_key, res);
    return res;
  }

  acceptCashDeposit(
    actor: DemoActor | null,
    params: {
      idempotency_key: string;
      deposit_id: string;
      expected_version: number;
      received_amount: string;
      bank_statement_line_id?: string | null;
      notes?: string | null;
    }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{
      deposit_id: string;
      status: CashDepositRow['status'];
      received_amount: string;
      shortage_amount: string;
      custody_balance_after: string;
      version: number;
    }>(a.id, 'accept_cash_deposit', params.idempotency_key);
    if (cached) return cached;

    const d = this.state.deposits.find((x) => x.id === params.deposit_id);
    if (!d) throw new DemoEngineError('Dokumen setoran tidak ditemukan.', 'P0002');
    this.requireBranchAccess(a, d.branch_id);
    this.requireRoles(a, ['finance_checker']);
    this.assertMakerChecker(d.created_by, a.id, 'setoran penagih');
    this.assertMakerChecker(d.submitted_by, a.id, 'pengajuan setoran');

    if (d.version !== params.expected_version) {
      throw new DemoEngineError('Konflik versi setoran (kemungkinan sudah diproses checker lain).', '40001');
    }
    if (d.status !== 'submitted') {
      throw new DemoEngineError(`Setoran ini sudah diproses atau belum diajukan (status: ${d.status}).`);
    }

    const received = toDecimal(params.received_amount);
    if (received.lte(0)) throw new DemoEngineError('Nominal diterima harus lebih dari 0.');

    const custody = this.state.custodyAccounts.find((c) => c.id === d.custody_account_id);
    if (!custody) throw new DemoEngineError('Akun custody tidak ditemukan.');

    if (received.gt(toDecimal(custody.verified_balance))) {
      throw new DemoEngineError(
        `Nominal diterima (${toMoneyString(received)}) melebihi saldo kas terverifikasi di penagih (${custody.verified_balance}). Untuk uang lebih tanpa sumber, buat kasus uang belum teridentifikasi.`
      );
    }

    // Setoran langsung ke bank wajib memilih mutasi bank yang sesuai
    if (d.target_type === 'bank_direct') {
      if (!params.bank_statement_line_id) {
        throw new DemoEngineError('Setoran langsung ke bank wajib memilih baris mutasi bank perusahaan yang cocok.');
      }
      const bl = this.state.bankLines.find((x) => x.id === params.bank_statement_line_id);
      if (!bl || bl.fund_account_id !== d.target_fund_account_id) {
        throw new DemoEngineError('Baris mutasi bank tidak sesuai rekening tujuan setoran.');
      }
      const avail = toDecimal(bl.amount).minus(toDecimal(bl.matched_amount));
      if (avail.lt(received)) {
        throw new DemoEngineError('Sisa mutasi bank tidak mencukupi untuk nominal setoran ini.');
      }
      this.state.bankMatches.push({
        id: this.nextId('b1b1b1b1'),
        company_id: this.state.company.id,
        match_group_id: this.nextId('b2b2b2b2'),
        bank_statement_line_id: bl.id,
        target_type: 'cash_deposit',
        target_id: d.id,
        matched_amount: toMoneyString(received),
        status: 'approved',
        notes: 'Setoran langsung penagih ke bank',
        proposed_by: d.created_by,
        approved_by: a.id,
        approved_at: new Date().toISOString(),
        version: 1,
        created_at: new Date().toISOString(),
      });
      bl.matched_amount = toMoneyString(toDecimal(bl.matched_amount).plus(received));
      bl.match_status = toDecimal(bl.matched_amount).gte(toDecimal(bl.amount)) ? 'matched' : 'proposed';
      bl.suggested_classification = 'collector_direct_deposit';
      bl.version += 1;
      d.bank_statement_line_id = bl.id;
    }

    // Cek dan kurangi sumber custody (tidak boleh melebihi sisa sumber)
    const lines = this.state.depositLines.filter((l) => l.cash_deposit_id === d.id);
    let remainingToAllocate = Decimal.min(received, toDecimal(d.declared_amount));

    // Pre-check sumber agar atomik
    for (const dl of lines) {
      if (remainingToAllocate.lte(0)) break;
      const src = this.state.custodySources.find(
        (s) => s.custody_account_id === custody.id && s.receipt_id === dl.source_receipt_id
      );
      if (!src) throw new DemoEngineError('Sumber custody tidak ditemukan.');
      const needed = Decimal.min(toDecimal(dl.declared_amount), remainingToAllocate);
      if (toDecimal(src.remaining_amount).lt(needed)) {
        throw new DemoEngineError('Saldo sumber penerimaan tidak mencukupi (kemungkinan sudah disetor di transaksi lain).', '40001');
      }
      remainingToAllocate = remainingToAllocate.minus(needed);
    }

    // Mutate sumber secara atomik
    remainingToAllocate = Decimal.min(received, toDecimal(d.declared_amount));
    for (const dl of lines) {
      if (remainingToAllocate.lte(0)) break;
      const src = this.state.custodySources.find(
        (s) => s.custody_account_id === custody.id && s.receipt_id === dl.source_receipt_id
      )!;
      const take = Decimal.min(toDecimal(dl.declared_amount), remainingToAllocate, toDecimal(src.remaining_amount));
      src.deposited_amount = toMoneyString(toDecimal(src.deposited_amount).plus(take));
      src.remaining_amount = toMoneyString(toDecimal(src.remaining_amount).minus(take));
      src.version += 1;
      dl.accepted_amount = toMoneyString(take);

      const rec = this.state.receipts.find((r) => r.id === dl.source_receipt_id);
      if (rec) {
        rec.deposit_status = toDecimal(src.remaining_amount).eq(0) ? 'deposited' : 'partially_deposited';
      }
      remainingToAllocate = remainingToAllocate.minus(take);
    }

    const newBalance = toDecimal(custody.verified_balance).minus(received);
    custody.verified_balance = toMoneyString(newBalance);
    custody.version += 1;
    custody.updated_at = new Date().toISOString();

    this.state.custodyMovements.unshift({
      id: this.nextId('c2c2c2c2'),
      company_id: this.state.company.id,
      branch_id: d.branch_id,
      custody_account_id: custody.id,
      collector_staff_id: d.collector_staff_id,
      movement_type: d.target_type === 'bank_direct' ? 'deposit_direct_to_bank' : 'deposit_to_office_cash',
      direction: 'out',
      amount: toMoneyString(received),
      balance_after: custody.verified_balance,
      source_type: 'cash_deposit',
      source_id: d.id,
      effective_date: d.deposit_date,
      actor_id: a.id,
      created_at: new Date().toISOString(),
    });

    let shortage = new Decimal(0);
    let newStatus: CashDepositRow['status'] = 'accepted';
    const declared = toDecimal(d.declared_amount);

    if (received.lt(declared)) {
      shortage = declared.minus(received);
      newStatus = 'accepted_with_discrepancy';
      this.state.discrepancies.unshift({
        id: this.nextId('d1d1d1d1'),
        company_id: this.state.company.id,
        branch_id: d.branch_id,
        case_number: this.nextDocNo('discrepancy_case', 'CASE', d.deposit_date),
        case_type: 'deposit_shortage',
        source_type: 'cash_deposit',
        source_id: d.id,
        expected_amount: d.declared_amount,
        actual_amount: toMoneyString(received),
        discrepancy_amount: toMoneyString(shortage),
        status: 'open',
        proposed_resolution: null,
        resolution_note: `Kurang setor pada ${d.deposit_number}. Piutang pelanggan tidak bertambah.`,
        created_by: a.id,
        proposed_by: null,
        resolved_by: null,
        resolved_at: null,
        version: 1,
        created_at: new Date().toISOString(),
      });
    } else if (d.is_planned_partial) {
      newStatus = 'partially_accepted';
    }

    d.received_amount = toMoneyString(received);
    d.shortage_amount = toMoneyString(shortage);
    d.status = newStatus;
    d.accounting_status = 'queued';
    d.received_by = a.id;
    d.approved_by = a.id;
    d.approved_at = new Date().toISOString();
    if (params.notes) d.notes = params.notes;
    d.version += 1;
    d.updated_at = new Date().toISOString();

    this.emitAccountingEvent(
      a.id,
      d.branch_id,
      d.target_type === 'bank_direct' ? 'cash_deposit_direct_bank_accepted' : 'cash_deposit_office_accepted',
      'cash_deposit',
      d.id,
      d.version,
      d.deposit_date,
      {
        deposit_number: d.deposit_number,
        collector_staff_id: d.collector_staff_id,
        target_type: d.target_type,
        target_fund_account_id: d.target_fund_account_id,
        declared_amount: d.declared_amount,
        received_amount: d.received_amount,
        shortage_amount: d.shortage_amount,
      },
      d.correlation_id
    );

    this.writeAudit(
      a.id,
      d.branch_id,
      'deposit.accept',
      'cash_deposit',
      d.id,
      { status: 'submitted' },
      { status: newStatus, received_amount: d.received_amount, shortage_amount: d.shortage_amount, custody_after: custody.verified_balance },
      params.notes ?? 'Setoran diterima oleh checker'
    );

    const res = {
      deposit_id: d.id,
      status: newStatus,
      received_amount: d.received_amount,
      shortage_amount: d.shortage_amount,
      custody_balance_after: custody.verified_balance,
      version: d.version,
    };
    this.saveIdempotency(a.id, 'accept_cash_deposit', params.idempotency_key, res);
    return res;
  }

  createInternalFundTransfer(
    actor: DemoActor | null,
    params: {
      idempotency_key: string;
      branch_id: string;
      transfer_date: string;
      from_fund_account_id: string;
      to_fund_account_id: string;
      amount: string;
      reference_no?: string | null;
      notes?: string | null;
    }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{
      transfer_id: string;
      transfer_number: string;
      status: CashTransferRow['status'];
      version: number;
    }>(a.id, 'create_internal_fund_transfer', params.idempotency_key);
    if (cached) return cached;

    this.requireBranchAccess(a, params.branch_id);
    this.requireRoles(a, ['finance_maker', 'finance_checker']);
    if (params.from_fund_account_id === params.to_fund_account_id) {
      throw new DemoEngineError('Rekening asal dan tujuan harus berbeda.');
    }
    const amt = toDecimal(params.amount);
    if (amt.lte(0)) throw new DemoEngineError('Nominal transfer internal harus lebih dari 0.');

    const id = this.nextId('t1t1t1t1');
    const no = this.nextDocNo('cash_transfer', 'TRF-INT', params.transfer_date);
    this.state.cashTransfers.unshift({
      id,
      company_id: this.state.company.id,
      branch_id: params.branch_id,
      transfer_number: no,
      transfer_date: params.transfer_date,
      from_fund_account_id: params.from_fund_account_id,
      to_fund_account_id: params.to_fund_account_id,
      amount: toMoneyString(amt),
      bank_statement_line_id: null,
      reference_no: params.reference_no ?? null,
      notes: params.notes ?? null,
      status: 'submitted',
      accounting_status: 'not_ready',
      created_by: a.id,
      approved_by: null,
      approved_at: null,
      version: 1,
      created_at: new Date().toISOString(),
    });

    const res = { transfer_id: id, transfer_number: no, status: 'submitted', version: 1 };
    this.saveIdempotency(a.id, 'create_internal_fund_transfer', params.idempotency_key, res);
    return res;
  }

  approveInternalFundTransfer(
    actor: DemoActor | null,
    params: { idempotency_key: string; transfer_id: string; expected_version: number; bank_statement_line_id?: string | null }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{
      transfer_id: string;
      status: CashTransferRow['status'];
      version: number;
    }>(a.id, 'approve_internal_fund_transfer', params.idempotency_key);
    if (cached) return cached;

    const t = this.state.cashTransfers.find((x) => x.id === params.transfer_id);
    if (!t) throw new DemoEngineError('Transfer internal tidak ditemukan.', 'P0002');
    this.requireBranchAccess(a, t.branch_id);
    this.requireRoles(a, ['finance_checker']);
    this.assertMakerChecker(t.created_by, a.id, 'transfer kas internal');
    if (t.version !== params.expected_version) throw new DemoEngineError('Konflik versi.', '40001');

    t.status = 'approved';
    t.accounting_status = 'queued';
    t.bank_statement_line_id = params.bank_statement_line_id ?? null;
    t.approved_by = a.id;
    t.approved_at = new Date().toISOString();
    t.version += 1;

    this.emitAccountingEvent(
      a.id,
      t.branch_id,
      'internal_fund_transfer_approved',
      'cash_transfer',
      t.id,
      t.version,
      t.transfer_date,
      {
        transfer_number: t.transfer_number,
        from_fund_account_id: t.from_fund_account_id,
        to_fund_account_id: t.to_fund_account_id,
        amount: t.amount,
      },
      this.nextId('cccccccc')
    );

    const res = { transfer_id: t.id, status: 'approved', version: t.version };
    this.saveIdempotency(a.id, 'approve_internal_fund_transfer', params.idempotency_key, res);
    return res;
  }

  importBankStatementPreview(
    actor: DemoActor | null,
    params: {
      idempotency_key: string;
      fund_account_id: string;
      file_name: string;
      file_hash: string;
      period_start: string;
      period_end: string;
      date_format: string;
      decimal_format: string;
      opening_balance: string | null;
      closing_balance: string | null;
      rows: Array<{
        row_number: number;
        raw_row: Record<string, unknown>;
        external_txn_id: string | null;
        posting_date: string;
        value_date: string;
        direction: 'credit' | 'debit';
        amount: string;
        running_balance: string | null;
        bank_reference: string | null;
        description: string;
        fingerprint: string;
      }>;
    }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{
      batch_id: string;
      batch_number: string;
      total_rows: number;
      imported_rows: number;
      duplicate_rows: number;
      version: number;
    }>(
      a.id,
      'import_bank_statement_preview',
      params.idempotency_key
    );
    if (cached) return cached;

    this.requireRoles(a, ['finance_maker', 'finance_checker', 'accountant']);
    const batchId = this.nextId('66666666');
    const batchNo = this.nextDocNo('bank_statement_batch', 'MUT', params.period_end);
    let dupCount = 0;

    const newLines: BankStatementLineRow[] = [];
    for (const row of params.rows) {
      const existingById = row.external_txn_id
        ? this.state.bankLines.find(
            (l) => l.fund_account_id === params.fund_account_id && l.external_txn_id === row.external_txn_id
          )
        : undefined;
      const existingByFp = this.state.bankLines.find(
        (l) => l.fund_account_id === params.fund_account_id && l.fingerprint_hash === row.fingerprint
      );
      const isDup = Boolean(existingById || existingByFp);
      if (isDup) dupCount += 1;

      if (existingById) {
        // Idempotent skip for exact external_txn_id replay
        continue;
      }

      const amt = toDecimal(row.amount);
      newLines.push({
        id: this.nextId('77777777'),
        company_id: this.state.company.id,
        batch_id: batchId,
        fund_account_id: params.fund_account_id,
        row_number: row.row_number,
        raw_row: row.raw_row,
        external_txn_id: row.external_txn_id,
        fingerprint_hash: row.fingerprint,
        posting_date: row.posting_date,
        value_date: row.value_date,
        direction: row.direction,
        amount: toMoneyString(amt),
        signed_amount: row.direction === 'debit' ? toMoneyString(amt.neg()) : toMoneyString(amt),
        running_balance: row.running_balance,
        bank_reference: row.bank_reference,
        description: row.description,
        suggested_classification: 'unclassified',
        is_duplicate_suspect: isDup,
        duplicate_note: isDup ? 'Terdeteksi fingerprint baris identik dengan mutasi sebelumnya (perlu review).' : null,
        match_status: 'unmatched',
        matched_amount: '0.00',
        version: 1,
        created_at: new Date().toISOString(),
      });
    }

    this.state.bankBatches.unshift({
      id: batchId,
      company_id: this.state.company.id,
      branch_id: a.branch_id,
      fund_account_id: params.fund_account_id,
      batch_number: batchNo,
      file_name: params.file_name,
      file_hash: params.file_hash,
      period_start: params.period_start,
      period_end: params.period_end,
      date_format: params.date_format,
      decimal_format: params.decimal_format,
      opening_balance: params.opening_balance,
      closing_balance: params.closing_balance,
      total_rows: params.rows.length,
      imported_rows: newLines.length,
      duplicate_rows: dupCount,
      status: 'preview',
      created_by: a.id,
      committed_by: null,
      committed_at: null,
      version: 1,
      created_at: new Date().toISOString(),
    });
    this.state.bankLines.push(...newLines);

    const res = {
      batch_id: batchId,
      batch_number: batchNo,
      total_rows: params.rows.length,
      imported_rows: newLines.length,
      duplicate_rows: dupCount,
      version: 1,
    };
    this.saveIdempotency(a.id, 'import_bank_statement_preview', params.idempotency_key, res);
    return res;
  }

  commitBankStatementImport(
    actor: DemoActor | null,
    params: { idempotency_key: string; batch_id: string; expected_version: number }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{
      batch_id: string;
      status: BankStatementBatchRow['status'];
      imported_rows: number;
      version: number;
    }>(a.id, 'commit_bank_statement_import', params.idempotency_key);
    if (cached) return cached;

    this.requireRoles(a, ['finance_maker', 'finance_checker', 'accountant']);
    const b = this.state.bankBatches.find((x) => x.id === params.batch_id);
    if (!b) throw new DemoEngineError('Batch mutasi tidak ditemukan.', 'P0002');
    if (b.version !== params.expected_version) throw new DemoEngineError('Konflik versi.', '40001');
    if (b.status !== 'preview') throw new DemoEngineError('Batch sudah di-commit.');

    b.status = 'committed';
    b.committed_by = a.id;
    b.committed_at = new Date().toISOString();
    b.version += 1;

    this.writeAudit(
      a.id,
      b.branch_id,
      'bank.commit_import',
      'bank_statement_batch',
      b.id,
      { status: 'preview' },
      { status: 'committed', imported_rows: b.imported_rows },
      'Commit impor mutasi bank'
    );

    const res = { batch_id: b.id, status: 'committed', imported_rows: b.imported_rows, version: b.version };
    this.saveIdempotency(a.id, 'commit_bank_statement_import', params.idempotency_key, res);
    return res;
  }

  proposeBankMatch(
    actor: DemoActor | null,
    params: {
      idempotency_key: string;
      items: Array<{
        bank_statement_line_id: string;
        target_type: BankMatchRow['target_type'];
        target_id: string;
        matched_amount: string;
      }>;
      notes?: string | null;
    }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{ match_group_id: string; status: BankMatchRow['status'] }>(
      a.id,
      'propose_bank_match',
      params.idempotency_key
    );
    if (cached) return cached;

    this.requireRoles(a, ['finance_maker', 'finance_checker', 'reconciliation_reviewer']);
    const groupId = this.nextId('b2b2b2b2');

    for (const item of params.items) {
      const bl = this.state.bankLines.find((x) => x.id === item.bank_statement_line_id);
      if (!bl) throw new DemoEngineError('Baris mutasi tidak ditemukan.', 'P0002');
      const amt = toDecimal(item.matched_amount);
      if (amt.lte(0)) throw new DemoEngineError('Nominal match harus lebih dari 0.');
      const avail = toDecimal(bl.amount).minus(toDecimal(bl.matched_amount));
      if (avail.lt(amt)) {
        throw new DemoEngineError('Nominal match melebihi sisa mutasi yang belum terpakai.');
      }

      this.state.bankMatches.push({
        id: this.nextId('b1b1b1b1'),
        company_id: this.state.company.id,
        match_group_id: groupId,
        bank_statement_line_id: bl.id,
        target_type: item.target_type,
        target_id: item.target_id,
        matched_amount: toMoneyString(amt),
        status: 'proposed',
        notes: params.notes ?? null,
        proposed_by: a.id,
        approved_by: null,
        approved_at: null,
        version: 1,
        created_at: new Date().toISOString(),
      });
      if (bl.match_status === 'unmatched') bl.match_status = 'proposed';
    }

    const res = { match_group_id: groupId, status: 'proposed' };
    this.saveIdempotency(a.id, 'propose_bank_match', params.idempotency_key, res);
    return res;
  }

  approveBankMatch(
    actor: DemoActor | null,
    params: { idempotency_key: string; match_group_id: string; notes?: string | null }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{ match_group_id: string; status: BankMatchRow['status'] }>(
      a.id,
      'approve_bank_match',
      params.idempotency_key
    );
    if (cached) return cached;

    this.requireRoles(a, ['finance_checker', 'reconciliation_reviewer']);
    const items = this.state.bankMatches.filter(
      (m) => m.match_group_id === params.match_group_id && m.status === 'proposed'
    );
    if (!items.length) throw new DemoEngineError('Grup match tidak ditemukan atau sudah disetujui.');

    for (const m of items) {
      this.assertMakerChecker(m.proposed_by, a.id, 'usulan pencocokan mutasi');
      const bl = this.state.bankLines.find((x) => x.id === m.bank_statement_line_id)!;
      const avail = toDecimal(bl.amount).minus(toDecimal(bl.matched_amount));
      if (avail.lt(toDecimal(m.matched_amount))) {
        throw new DemoEngineError(`Baris mutasi ${bl.bank_reference ?? bl.id} sudah dipakai melebihi saldonya.`, '40001');
      }
      bl.matched_amount = toMoneyString(toDecimal(bl.matched_amount).plus(toDecimal(m.matched_amount)));
      bl.match_status = toDecimal(bl.matched_amount).gte(toDecimal(bl.amount)) ? 'matched' : 'proposed';
      bl.version += 1;

      m.status = 'approved';
      m.approved_by = a.id;
      m.approved_at = new Date().toISOString();
      if (params.notes) m.notes = params.notes;
      m.version += 1;
    }

    const res = { match_group_id: params.match_group_id, status: 'approved' };
    this.saveIdempotency(a.id, 'approve_bank_match', params.idempotency_key, res);
    return res;
  }

  requestReceiptReversal(
    actor: DemoActor | null,
    params: { idempotency_key: string; receipt_id: string; expected_version: number; reason: string }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{ receipt_id: string; status: ReceiptRow['status']; version: number }>(
      a.id,
      'request_receipt_reversal',
      params.idempotency_key
    );
    if (cached) return cached;

    if (!params.reason || params.reason.trim().length < 5) {
      throw new DemoEngineError('Alasan permintaan reversal wajib diisi.');
    }

    const r = this.state.receipts.find((x) => x.id === params.receipt_id);
    if (!r) throw new DemoEngineError('Penerimaan tidak ditemukan.', 'P0002');
    this.requireBranchAccess(a, r.branch_id);
    this.requireRoles(a, ['finance_maker', 'finance_checker']);
    if (r.version !== params.expected_version) throw new DemoEngineError('Konflik versi.', '40001');
    if (r.status !== 'verified') throw new DemoEngineError('Hanya penerimaan terverifikasi yang dapat diajukan reversal.');

    r.status = 'reversal_requested';
    r.reason = params.reason;
    r.updated_by = a.id;
    r.version += 1;
    r.updated_at = new Date().toISOString();

    this.writeAudit(a.id, r.branch_id, 'receipt.request_reversal', 'receipt', r.id, { status: 'verified' }, { status: 'reversal_requested' }, params.reason);

    const res = { receipt_id: r.id, status: r.status, version: r.version };
    this.saveIdempotency(a.id, 'request_receipt_reversal', params.idempotency_key, res);
    return res;
  }

  approveReceiptReversal(
    actor: DemoActor | null,
    params: { idempotency_key: string; receipt_id: string; expected_version: number; reason: string }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{ receipt_id: string; status: ReceiptRow['status']; version: number }>(
      a.id,
      'approve_receipt_reversal',
      params.idempotency_key
    );
    if (cached) return cached;

    const r = this.state.receipts.find((x) => x.id === params.receipt_id);
    if (!r) throw new DemoEngineError('Penerimaan tidak ditemukan.', 'P0002');
    this.requireBranchAccess(a, r.branch_id);
    this.requireRoles(a, ['finance_checker', 'accounting_approver']);
    this.assertMakerChecker(r.updated_by, a.id, 'permintaan reversal');
    if (r.version !== params.expected_version) throw new DemoEngineError('Konflik versi.', '40001');
    if (r.status !== 'reversal_requested') throw new DemoEngineError('Dokumen belum dalam status permintaan reversal.');

    // Cek dependensi alokasi App 2
    const activeAllocs = this.state.paymentAllocations.filter(
      (pa) => pa.receipt_id === r.id && ['proposed', 'approved'].includes(pa.status)
    );
    if (activeAllocs.length > 0) {
      throw new DemoEngineError(
        `Penerimaan yang sudah dialokasikan ke nota (${activeAllocs.length} alokasi aktif) tidak dapat dibalik sebelum alokasi dilepas secara sah.`,
        '23503'
      );
    }

    if (r.receipt_channel === 'cash') {
      const src = this.state.custodySources.find((s) => s.receipt_id === r.id);
      if (src && toDecimal(src.deposited_amount).gt(0)) {
        throw new DemoEngineError('Penerimaan tunai yang sudah disetorkan tidak dapat dibalik sebelum koreksi setoran disahkan.', '23503');
      }
      if (src) {
        const custody = this.state.custodyAccounts.find((c) => c.id === src.custody_account_id)!;
        custody.verified_balance = toMoneyString(toDecimal(custody.verified_balance).minus(toDecimal(r.verified_amount)));
        custody.version += 1;
        src.remaining_amount = '0.00';
      }
    }

    r.status = 'reversed';
    r.accounting_status = 'reversed';
    r.reason = params.reason;
    r.approved_by = a.id;
    r.updated_by = a.id;
    r.version += 1;
    r.updated_at = new Date().toISOString();

    this.emitAccountingEvent(
      a.id,
      r.branch_id,
      'receipt_reversed',
      'receipt',
      r.id,
      r.version,
      r.accounting_date ?? r.customer_paid_at,
      { receipt_number: r.receipt_number, reversed_amount: r.verified_amount, reason: params.reason },
      r.correlation_id
    );

    this.writeAudit(a.id, r.branch_id, 'receipt.approve_reversal', 'receipt', r.id, { status: 'reversal_requested' }, { status: 'reversed' }, params.reason);

    const res = { receipt_id: r.id, status: r.status, version: r.version };
    this.saveIdempotency(a.id, 'approve_receipt_reversal', params.idempotency_key, res);
    return res;
  }

  resolveDiscrepancyCase(
    actor: DemoActor | null,
    params: { idempotency_key: string; case_id: string; resolution_note: string }
  ) {
    const a = this.requireActor(actor);
    const cached = this.checkIdempotency<{ case_id: string; status: DiscrepancyCaseRow['status'] }>(
      a.id,
      'resolve_discrepancy_case',
      params.idempotency_key
    );
    if (cached) return cached;

    this.requireRoles(a, ['finance_checker', 'reconciliation_reviewer', 'accounting_approver']);
    const dc = this.state.discrepancies.find((x) => x.id === params.case_id);
    if (!dc) throw new DemoEngineError('Kasus selisih tidak ditemukan.');
    this.requireBranchAccess(a, dc.branch_id);

    dc.status = 'resolved';
    dc.resolution_note = params.resolution_note;
    dc.resolved_by = a.id;
    dc.resolved_at = new Date().toISOString();
    dc.version += 1;

    this.writeAudit(a.id, dc.branch_id, 'discrepancy.resolve', 'discrepancy_case', dc.id, { status: 'open' }, { status: 'resolved' }, params.resolution_note);
    const res = { case_id: dc.id, status: 'resolved' };
    this.saveIdempotency(a.id, 'resolve_discrepancy_case', params.idempotency_key, res);
    return res;
  }

  updateAppSettings(
    actor: DemoActor | null,
    params: Partial<Pick<AppSettingsRow, 'app1_url' | 'app2_url' | 'app3_url' | 'reconciliation_label'>>
  ) {
    const a = this.requireActor(actor);
    this.requireRoles(a, ['system_admin', 'accountant']);
    Object.assign(this.state.appSettings, params);
    this.state.appSettings.version += 1;
    this.writeAudit(a.id, null, 'settings.update', 'app_settings', this.state.appSettings.id, null, params, 'Pengaturan URL & label diperbarui');
    return this.state.appSettings;
  }

  addMasterCustomer(
    actor: DemoActor | null,
    params: { branch_id: string; cust_id: string; name: string; phone?: string; address?: string }
  ) {
    const a = this.requireActor(actor);
    this.requireRoles(a, ['system_admin', 'accountant', 'finance_maker']);
    if (this.state.customers.some((c) => c.cust_id === params.cust_id.trim())) {
      throw new DemoEngineError(`CUST ID "${params.cust_id}" sudah terdaftar.`);
    }
    const row: CustomerRow = {
      id: this.nextId('33333333'),
      company_id: this.state.company.id,
      branch_id: params.branch_id,
      cust_id: params.cust_id.trim(), // text preserving leading zeros
      name: params.name.trim(),
      default_sales_id: null,
      phone: params.phone ?? null,
      address: params.address ?? null,
      is_active: true,
      version: 1,
    };
    this.state.customers.push(row);
    return row;
  }

  addMasterFundAccount(
    actor: DemoActor | null,
    params: { branch_id: string; code: string; name: string; account_type: FundAccountRow['account_type']; bank_name?: string; account_number?: string }
  ) {
    const a = this.requireActor(actor);
    this.requireRoles(a, ['system_admin', 'accountant']);
    const row: FundAccountRow = {
      id: this.nextId('55555555'),
      company_id: this.state.company.id,
      branch_id: params.branch_id,
      code: params.code.trim().toUpperCase(),
      name: params.name.trim(),
      account_type: params.account_type,
      bank_name: params.bank_name ?? null,
      account_number: params.account_number ?? null,
      account_holder: this.state.company.name,
      currency: 'IDR',
      coa_account_code: params.account_type === 'bank' ? '1103' : '1101',
      is_active: true,
      version: 1,
    };
    this.state.fundAccounts.push(row);
    return row;
  }

  addMasterStaff(
    actor: DemoActor | null,
    params: { branch_id: string; staff_code: string; full_name: string; staff_role: StaffRow['staff_role']; phone?: string }
  ) {
    const a = this.requireActor(actor);
    this.requireRoles(a, ['system_admin', 'accountant']);
    const row: StaffRow = {
      id: this.nextId('44444444'),
      company_id: this.state.company.id,
      branch_id: params.branch_id,
      profile_id: null,
      staff_code: params.staff_code.trim().toUpperCase(),
      full_name: params.full_name.trim(),
      staff_role: params.staff_role,
      phone: params.phone ?? null,
      is_active: true,
      version: 1,
    };
    this.state.staff.push(row);
    return row;
  }
}
