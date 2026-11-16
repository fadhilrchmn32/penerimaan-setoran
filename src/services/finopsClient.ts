import type {
  AccountingEventRow,
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
  CustomerRow,
  DiscrepancyCaseRow,
  FundAccountRow,
  MembershipRow,
  ProfileRow,
  ReceiptChannel,
  ReceiptEvidenceRow,
  ReceiptRow,
  StaffRow,
  VerificationMethod,
} from '../../database.types';
import { supabase } from '../lib/supabase';
import type { DemoActor, DemoFinOpsEngine } from '../engine/demoEngine';

export type WorkspaceMode = 'production_unconfigured' | 'production_live' | 'demo_sandbox';

export interface WorkspaceDataset {
  company: CompanyRow;
  branches: BranchRow[];
  appSettings: AppSettingsRow;
  customers: CustomerRow[];
  staff: StaffRow[];
  fundAccounts: FundAccountRow[];
  receipts: ReceiptRow[];
  receiptEvidence: ReceiptEvidenceRow[];
  bankBatches: BankStatementBatchRow[];
  bankLines: BankStatementLineRow[];
  bankMatches: BankMatchRow[];
  custodyAccounts: CashCustodyAccountRow[];
  deposits: CashDepositRow[];
  depositLines: CashDepositLineRow[];
  cashTransfers: CashTransferRow[];
  discrepancies: DiscrepancyCaseRow[];
  accountingEvents: AccountingEventRow[];
  auditEvents: AuditEventRow[];
  profiles: ProfileRow[];
}

export async function fetchProductionDataset(companyId: string): Promise<WorkspaceDataset> {
  if (!supabase) throw new Error('Koneksi Supabase belum dikonfigurasi.');

  const [
    companyRes,
    branchesRes,
    settingsRes,
    customersRes,
    staffRes,
    accountsRes,
    receiptsRes,
    evidenceRes,
    batchesRes,
    linesRes,
    matchesRes,
    custodyRes,
    depositsRes,
    depositLinesRes,
    transfersRes,
    discRes,
    eventsRes,
    auditRes,
    profilesRes,
  ] = await Promise.all([
    supabase.from('companies').select('*').eq('id', companyId).single(),
    supabase.from('branches').select('*').eq('company_id', companyId).order('code'),
    supabase.from('app_settings').select('*').eq('company_id', companyId).maybeSingle(),
    supabase.from('customers').select('*').eq('company_id', companyId).order('cust_id'),
    supabase.from('staff').select('*').eq('company_id', companyId).order('staff_code'),
    supabase.from('fund_accounts').select('*').eq('company_id', companyId).order('code'),
    supabase.from('receipts').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('receipt_evidence').select('*').eq('company_id', companyId),
    supabase.from('bank_statement_batches').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('bank_statement_lines').select('*').eq('company_id', companyId).order('value_date', { ascending: false }),
    supabase.from('bank_matches').select('*').eq('company_id', companyId),
    supabase.from('cash_custody_accounts').select('*').eq('company_id', companyId),
    supabase.from('cash_deposits').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('cash_deposit_lines').select('*').eq('company_id', companyId),
    supabase.from('cash_transfers').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('discrepancy_cases').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('accounting_events').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('audit_events').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(200),
    supabase.from('profiles').select('*'),
  ]);

  if (companyRes.error) throw new Error(companyRes.error.message);

  return {
    company: companyRes.data as CompanyRow,
    branches: (branchesRes.data ?? []) as BranchRow[],
    appSettings: (settingsRes.data ?? {
      id: '',
      company_id: companyId,
      app1_url: window.location.origin,
      app2_url: null,
      app3_url: null,
      reconciliation_label: 'REKONSILIASI (ALMIRA)',
      rounding_mode: 'half_up',
      rounding_scale: 0,
      auto_post_enabled: false,
      require_evidence_for_transfer: true,
      require_evidence_for_cash: true,
      version: 1,
    }) as AppSettingsRow,
    customers: (customersRes.data ?? []) as CustomerRow[],
    staff: (staffRes.data ?? []) as StaffRow[],
    fundAccounts: (accountsRes.data ?? []) as FundAccountRow[],
    receipts: (receiptsRes.data ?? []) as ReceiptRow[],
    receiptEvidence: (evidenceRes.data ?? []) as ReceiptEvidenceRow[],
    bankBatches: (batchesRes.data ?? []) as BankStatementBatchRow[],
    bankLines: (linesRes.data ?? []) as BankStatementLineRow[],
    bankMatches: (matchesRes.data ?? []) as BankMatchRow[],
    custodyAccounts: (custodyRes.data ?? []) as CashCustodyAccountRow[],
    deposits: (depositsRes.data ?? []) as CashDepositRow[],
    depositLines: (depositLinesRes.data ?? []) as CashDepositLineRow[],
    cashTransfers: (transfersRes.data ?? []) as CashTransferRow[],
    discrepancies: (discRes.data ?? []) as DiscrepancyCaseRow[],
    accountingEvents: (eventsRes.data ?? []) as AccountingEventRow[],
    auditEvents: (auditRes.data ?? []) as AuditEventRow[],
    profiles: (profilesRes.data ?? []) as ProfileRow[],
  };
}

export async function fetchProductionMemberships(userId: string): Promise<MembershipRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) throw new Error(error.message);
  return (data ?? []) as MembershipRow[];
}

export function getDemoDataset(engine: DemoFinOpsEngine, actor: DemoActor): WorkspaceDataset {
  const s = engine.state;
  return {
    company: s.company,
    branches: s.branches,
    appSettings: s.appSettings,
    customers: s.customers,
    staff: s.staff,
    fundAccounts: s.fundAccounts,
    receipts: engine.getVisibleReceipts(actor),
    receiptEvidence: s.receiptEvidence,
    bankBatches: actor.role_code === 'collector_optional' ? [] : s.bankBatches,
    bankLines: actor.role_code === 'collector_optional' ? [] : s.bankLines,
    bankMatches: actor.role_code === 'collector_optional' ? [] : s.bankMatches,
    custodyAccounts: s.custodyAccounts.filter((c) =>
      actor.role_code === 'collector_optional' ? c.collector_staff_id === actor.staff_id : true
    ),
    deposits: s.deposits.filter((d) =>
      actor.role_code === 'collector_optional' ? d.collector_staff_id === actor.staff_id : true
    ),
    depositLines: s.depositLines,
    cashTransfers: actor.role_code === 'collector_optional' ? [] : s.cashTransfers,
    discrepancies: actor.role_code === 'collector_optional' ? [] : s.discrepancies,
    accountingEvents: actor.role_code === 'collector_optional' ? [] : s.accountingEvents,
    auditEvents: actor.role_code === 'collector_optional' ? [] : s.auditEvents,
    profiles: s.profiles,
  };
}

export async function callRpcDashboard(
  mode: WorkspaceMode,
  engine: DemoFinOpsEngine,
  actor: DemoActor | null,
  params: { company_id: string; branch_id: string | null; date_from: string | null; date_to: string | null }
): Promise<CollectionDashboardResponse> {
  if (mode === 'demo_sandbox') {
    return engine.listCollectionDashboard(actor, params);
  }
  if (!supabase) throw new Error('Database belum terhubung.');
  const { data, error } = await supabase.rpc('list_collection_dashboard', {
    p_company_id: params.company_id,
    p_branch_id: params.branch_id,
    p_date_from: params.date_from,
    p_date_to: params.date_to,
  });
  if (error) throw new Error(error.message);
  return data as CollectionDashboardResponse;
}

export async function callRpcCustodyDetail(
  mode: WorkspaceMode,
  engine: DemoFinOpsEngine,
  actor: DemoActor | null,
  companyId: string,
  collectorStaffId: string
): Promise<CollectorCustodyDetailResponse> {
  if (mode === 'demo_sandbox') {
    return engine.getCollectorCustodyDetail(actor, collectorStaffId);
  }
  if (!supabase) throw new Error('Database belum terhubung.');
  const { data, error } = await supabase.rpc('get_collector_custody_detail', {
    p_company_id: companyId,
    p_collector_staff_id: collectorStaffId,
  });
  if (error) throw new Error(error.message);
  return data as CollectorCustodyDetailResponse;
}

export async function uploadEvidenceToPrivateBucket(
  companyId: string,
  docType: string,
  docId: string,
  file: File
): Promise<{ storagePath: string }> {
  if (!supabase) throw new Error('Storage hanya tersedia pada mode Supabase live.');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${companyId}/${docType}/${docId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from('finops-evidence').upload(storagePath, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  return { storagePath };
}

export async function getEvidenceSignedUrl(storagePath: string): Promise<string> {
  if (!supabase) throw new Error('Signed URL hanya tersedia pada mode Supabase live.');
  const { data, error } = await supabase.storage.from('finops-evidence').createSignedUrl(storagePath, 120);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Gagal membuat signed URL.');
  return data.signedUrl;
}

export interface CreateReceiptPayload {
  idempotency_key: string;
  company_id: string;
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

export async function callCreateAndSubmitReceipt(
  mode: WorkspaceMode,
  engine: DemoFinOpsEngine,
  actor: DemoActor | null,
  payload: CreateReceiptPayload,
  submitImmediately: boolean
) {
  if (mode === 'demo_sandbox') {
    const draft = engine.createReceiptDraft(actor, payload);
    if (submitImmediately) {
      engine.submitReceipt(actor, {
        idempotency_key: `${payload.idempotency_key}:submit`,
        receipt_id: draft.receipt_id,
        expected_version: draft.version,
      });
    }
    return draft;
  }
  if (!supabase) throw new Error('Database belum terhubung.');
  const { data, error } = await supabase.rpc('create_receipt_draft', {
    p_idempotency_key: payload.idempotency_key,
    p_company_id: payload.company_id,
    p_branch_id: payload.branch_id,
    p_receipt_channel: payload.receipt_channel,
    p_customer_paid_at: payload.customer_paid_at,
    p_bank_value_date: payload.bank_value_date ?? null,
    p_fund_account_id: payload.fund_account_id ?? null,
    p_customer_id: payload.customer_id ?? null,
    p_is_unknown_identity: payload.is_unknown_identity,
    p_sender_name_raw: payload.sender_name_raw ?? null,
    p_customer_gross_amount: payload.customer_gross_amount,
    p_bank_net_amount: payload.bank_net_amount ?? payload.customer_gross_amount,
    p_bank_fee_amount: payload.bank_fee_amount ?? '0',
    p_bank_fee_bearer: payload.bank_fee_bearer ?? 'none',
    p_bank_reference: payload.bank_reference ?? null,
    p_optional_invoice_ref: payload.optional_invoice_ref ?? null,
    p_receipt_book_no: payload.receipt_book_no ?? null,
    p_actual_collector_id: payload.actual_collector_id ?? null,
    p_sales_owner_id: payload.sales_owner_id ?? null,
    p_location_note: payload.location_note ?? null,
    p_notes: payload.notes ?? null,
    p_evidence_hash: payload.evidence_hash ?? null,
  });
  if (error) throw new Error(error.message);
  const draft = data as { receipt_id: string; version: number };
  if (submitImmediately) {
    const { error: subErr } = await supabase.rpc('submit_receipt', {
      p_idempotency_key: `${payload.idempotency_key}:submit`,
      p_receipt_id: draft.receipt_id,
      p_expected_version: draft.version,
    });
    if (subErr) throw new Error(subErr.message);
  }
  return draft;
}

export async function callVerifyReceipt(
  mode: WorkspaceMode,
  engine: DemoFinOpsEngine,
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
  if (mode === 'demo_sandbox') {
    return engine.verifyReceipt(actor, params);
  }
  if (!supabase) throw new Error('Database belum terhubung.');
  const { data, error } = await supabase.rpc('verify_receipt', {
    p_idempotency_key: params.idempotency_key,
    p_receipt_id: params.receipt_id,
    p_expected_version: params.expected_version,
    p_verification_method: params.verification_method,
    p_bank_statement_line_id: params.bank_statement_line_id ?? null,
    p_verification_ref: params.verification_ref ?? null,
    p_verification_note: params.verification_note ?? null,
    p_bank_value_date: params.bank_value_date ?? null,
    p_bank_fee_amount: params.bank_fee_amount ?? null,
    p_bank_fee_bearer: params.bank_fee_bearer ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}
