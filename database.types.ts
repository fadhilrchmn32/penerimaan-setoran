// ==============================================================================
// FINOPS_SHARED_V1 — Shared TypeScript Database & RPC Contract (v1.0.0)
// Pertukaran nilai uang & kuantitas menggunakan string desimal presisi.
// ==============================================================================

export type DecimalString = string;
export type ISODateString = string; // YYYY-MM-DD
export type ISOTimestampString = string; // TIMESTAMPTZ ISO

export type AppRoleCode =
  | 'finance_maker'
  | 'finance_checker'
  | 'sales_admin'
  | 'reconciliation_reviewer'
  | 'accountant'
  | 'accounting_approver'
  | 'owner_viewer'
  | 'system_admin'
  | 'collector_optional';

export type ReceiptChannel = 'bank_transfer' | 'cash';
export type BankFeeBearer = 'none' | 'company' | 'customer' | 'pending_review';
export type VerificationMethod = 'bank_statement_match' | 'manual_bank_check' | 'cash_evidence_check';

export type ReceiptStatus =
  | 'draft'
  | 'submitted'
  | 'waiting_verification'
  | 'verified'
  | 'rejected'
  | 'reversal_requested'
  | 'reversed';

export type DepositDimensionStatus =
  | 'not_applicable'
  | 'not_deposited'
  | 'partially_deposited'
  | 'deposited'
  | 'discrepancy';

export type ReconciliationDimensionStatus =
  | 'unreviewed'
  | 'matched'
  | 'needs_review'
  | 'discrepancy'
  | 'reviewed';

export type AccountingDimensionStatus =
  | 'not_ready'
  | 'queued'
  | 'draft_journal'
  | 'posted'
  | 'failed'
  | 'reversed';

export type CashDepositStatus =
  | 'draft'
  | 'submitted'
  | 'partially_accepted'
  | 'accepted'
  | 'accepted_with_discrepancy'
  | 'rejected'
  | 'reversed';

export type DiscrepancyCaseType =
  | 'deposit_shortage'
  | 'deposit_excess_unidentified'
  | 'unknown_sender'
  | 'unmatched_bank_line'
  | 'bank_fee_review'
  | 'duplicate_review'
  | 'missing_evidence';

export type DiscrepancyCaseStatus =
  | 'open'
  | 'investigating'
  | 'pending_approval'
  | 'resolved'
  | 'closed';

export interface CompanyRow {
  id: string;
  code: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  base_currency: string;
  timezone: string;
  is_active: boolean;
  version: number;
  created_at: ISOTimestampString;
  updated_at: ISOTimestampString;
}

export interface BranchRow {
  id: string;
  company_id: string;
  code: string;
  name: string;
  address: string | null;
  is_headquarters: boolean;
  is_active: boolean;
  version: number;
}

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
}

export interface MembershipRow {
  id: string;
  user_id: string;
  company_id: string;
  branch_id: string | null;
  all_branches: boolean;
  role_code: AppRoleCode;
  is_active: boolean;
}

export interface AppSettingsRow {
  id: string;
  company_id: string;
  app1_url: string | null;
  app2_url: string | null;
  app3_url: string | null;
  reconciliation_label: string;
  rounding_mode: string;
  rounding_scale: number;
  auto_post_enabled: boolean;
  require_evidence_for_transfer: boolean;
  require_evidence_for_cash: boolean;
  version: number;
}

export interface StaffRow {
  id: string;
  company_id: string;
  branch_id: string;
  profile_id: string | null;
  staff_code: string;
  full_name: string;
  staff_role: 'sales' | 'driver' | 'collector' | 'finance' | 'admin';
  phone: string | null;
  is_active: boolean;
  version: number;
}

export interface CustomerRow {
  id: string;
  company_id: string;
  branch_id: string;
  cust_id: string; // TEXT preserving leading zeros
  name: string;
  default_sales_id: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  version: number;
}

export interface FundAccountRow {
  id: string;
  company_id: string;
  branch_id: string | null;
  code: string;
  name: string;
  account_type: 'bank' | 'office_cash' | 'petty_cash';
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  currency: string;
  coa_account_code: string | null;
  is_active: boolean;
  version: number;
}

export interface ReceiptRow {
  id: string;
  company_id: string;
  branch_id: string;
  receipt_number: string;
  receipt_channel: ReceiptChannel;
  currency: string;
  customer_gross_amount: DecimalString;
  bank_net_amount: DecimalString;
  bank_fee_amount: DecimalString;
  bank_fee_bearer: BankFeeBearer;
  verified_amount: DecimalString;
  customer_paid_at: ISODateString;
  bank_value_date: ISODateString | null;
  verified_at: ISOTimestampString | null;
  accounting_date: ISODateString | null;
  is_unknown_identity: boolean;
  customer_id: string | null;
  sender_name_raw: string | null;
  fund_account_id: string | null;
  bank_reference: string | null;
  optional_invoice_ref: string | null;
  receipt_book_no: string | null;
  actual_collector_id: string | null;
  sales_owner_id: string | null;
  location_note: string | null;
  notes: string | null;
  verification_method: VerificationMethod | null;
  verification_ref: string | null;
  verification_note: string | null;
  evidence_hash: string | null;
  duplicate_flag: boolean;
  duplicate_reason: string | null;
  status: ReceiptStatus;
  deposit_status: DepositDimensionStatus;
  reconciliation_status: ReconciliationDimensionStatus;
  accounting_status: AccountingDimensionStatus;
  created_by: string;
  updated_by: string | null;
  submitted_by: string | null;
  submitted_at: ISOTimestampString | null;
  verified_by: string | null;
  approved_by: string | null;
  rejected_by: string | null;
  rejected_at: ISOTimestampString | null;
  rejection_reason: string | null;
  reason: string | null;
  version: number;
  source_app: string;
  correlation_id: string;
  created_at: ISOTimestampString;
  updated_at: ISOTimestampString;
}

export interface ReceiptEvidenceRow {
  id: string;
  company_id: string;
  receipt_id: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  sha256_hash: string;
  uploaded_by: string;
  created_at: ISOTimestampString;
}

export interface BankStatementBatchRow {
  id: string;
  company_id: string;
  branch_id: string | null;
  fund_account_id: string;
  batch_number: string;
  file_name: string;
  file_hash: string;
  period_start: ISODateString;
  period_end: ISODateString;
  date_format: string;
  decimal_format: string;
  opening_balance: DecimalString | null;
  closing_balance: DecimalString | null;
  total_rows: number;
  imported_rows: number;
  duplicate_rows: number;
  status: 'preview' | 'committed' | 'cancelled';
  created_by: string;
  committed_by: string | null;
  committed_at: ISOTimestampString | null;
  version: number;
  created_at: ISOTimestampString;
}

export interface BankStatementLineRow {
  id: string;
  company_id: string;
  batch_id: string;
  fund_account_id: string;
  row_number: number;
  raw_row: Record<string, unknown>;
  external_txn_id: string | null;
  fingerprint_hash: string;
  posting_date: ISODateString;
  value_date: ISODateString;
  direction: 'credit' | 'debit';
  amount: DecimalString;
  signed_amount: DecimalString;
  running_balance: DecimalString | null;
  bank_reference: string | null;
  description: string;
  suggested_classification:
    | 'customer_receipt'
    | 'collector_direct_deposit'
    | 'internal_cash_transfer'
    | 'loan_or_equity'
    | 'supplier_or_expense'
    | 'bank_fee'
    | 'refund'
    | 'unclassified'
    | null;
  is_duplicate_suspect: boolean;
  duplicate_note: string | null;
  match_status: 'unmatched' | 'proposed' | 'matched' | 'reviewed_exception';
  matched_amount: DecimalString;
  version: number;
  created_at: ISOTimestampString;
}

export interface BankMatchRow {
  id: string;
  company_id: string;
  match_group_id: string;
  bank_statement_line_id: string;
  target_type:
    | 'receipt'
    | 'cash_deposit'
    | 'cash_transfer'
    | 'customer_refund'
    | 'supplier_payment'
    | 'expense_document'
    | 'loan'
    | 'equity_transaction';
  target_id: string;
  matched_amount: DecimalString;
  status: 'proposed' | 'approved' | 'rejected' | 'reversed';
  notes: string | null;
  proposed_by: string;
  approved_by: string | null;
  approved_at: ISOTimestampString | null;
  version: number;
  created_at: ISOTimestampString;
}

export interface CashCustodyAccountRow {
  id: string;
  company_id: string;
  branch_id: string;
  collector_staff_id: string;
  currency: string;
  verified_balance: DecimalString;
  unverified_reported_balance: DecimalString;
  version: number;
  updated_at: ISOTimestampString;
}

export interface CustodyMovementRow {
  id: string;
  company_id: string;
  branch_id: string;
  custody_account_id: string;
  collector_staff_id: string;
  movement_type:
    | 'cash_receipt_verified'
    | 'deposit_to_office_cash'
    | 'deposit_direct_to_bank'
    | 'shortage_adjustment'
    | 'reversal';
  direction: 'in' | 'out';
  amount: DecimalString;
  balance_after: DecimalString;
  source_type: string;
  source_id: string;
  effective_date: ISODateString;
  actor_id: string;
  created_at: ISOTimestampString;
}

export interface CustodyMovementSourceRow {
  id: string;
  company_id: string;
  custody_account_id: string;
  receipt_id: string;
  verified_amount: DecimalString;
  deposited_amount: DecimalString;
  remaining_amount: DecimalString;
  version: number;
}

export interface CashDepositRow {
  id: string;
  company_id: string;
  branch_id: string;
  deposit_number: string;
  collector_staff_id: string;
  custody_account_id: string;
  target_type: 'office_cash' | 'bank_direct';
  target_fund_account_id: string;
  bank_statement_line_id: string | null;
  deposit_date: ISODateString;
  declared_amount: DecimalString;
  received_amount: DecimalString;
  shortage_amount: DecimalString;
  excess_amount: DecimalString;
  is_planned_partial: boolean;
  status: CashDepositStatus;
  accounting_status: AccountingDimensionStatus;
  evidence_path: string | null;
  notes: string | null;
  created_by: string;
  submitted_by: string | null;
  submitted_at: ISOTimestampString | null;
  received_by: string | null;
  approved_by: string | null;
  approved_at: ISOTimestampString | null;
  reason: string | null;
  version: number;
  correlation_id: string;
  created_at: ISOTimestampString;
  updated_at: ISOTimestampString;
}

export interface CashDepositLineRow {
  id: string;
  company_id: string;
  cash_deposit_id: string;
  source_receipt_id: string;
  declared_amount: DecimalString;
  accepted_amount: DecimalString;
}

export interface CashTransferRow {
  id: string;
  company_id: string;
  branch_id: string;
  transfer_number: string;
  transfer_date: ISODateString;
  from_fund_account_id: string;
  to_fund_account_id: string;
  amount: DecimalString;
  bank_statement_line_id: string | null;
  reference_no: string | null;
  notes: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'reversed';
  accounting_status: AccountingDimensionStatus;
  created_by: string;
  approved_by: string | null;
  approved_at: ISOTimestampString | null;
  version: number;
  created_at: ISOTimestampString;
}

export interface DiscrepancyCaseRow {
  id: string;
  company_id: string;
  branch_id: string;
  case_number: string;
  case_type: DiscrepancyCaseType;
  source_type: string;
  source_id: string;
  expected_amount: DecimalString | null;
  actual_amount: DecimalString | null;
  discrepancy_amount: DecimalString;
  status: DiscrepancyCaseStatus;
  proposed_resolution: string | null;
  resolution_note: string | null;
  created_by: string;
  proposed_by: string | null;
  resolved_by: string | null;
  resolved_at: ISOTimestampString | null;
  version: number;
  created_at: ISOTimestampString;
}

export interface AccountingEventRow {
  id: string;
  company_id: string;
  branch_id: string;
  event_type: string;
  source_type: string;
  source_id: string;
  source_version: number;
  effective_date: ISODateString;
  payload_snapshot: Record<string, unknown>;
  mapping_version: string;
  dependency_ids: string[];
  processing_status:
    | 'waiting_accounting_module'
    | 'queued'
    | 'draft_journal'
    | 'posted'
    | 'failed'
    | 'reversed';
  error_message: string | null;
  retry_count: number;
  correlation_id: string;
  created_at: ISOTimestampString;
}

export interface AuditEventRow {
  id: string;
  company_id: string;
  branch_id: string | null;
  actor_id: string | null;
  event_action: string;
  entity_type: string;
  entity_id: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  reason: string | null;
  source_app: string;
  correlation_id: string | null;
  created_at: ISOTimestampString;
}

export interface PaymentAllocationRow {
  id: string;
  company_id: string;
  branch_id: string;
  receipt_id: string;
  sales_document_id: string;
  allocated_amount: DecimalString;
  status: 'proposed' | 'approved' | 'rejected' | 'reversed';
  notes: string | null;
  created_by: string;
  approved_by: string | null;
  approved_at: ISOTimestampString | null;
  version: number;
  created_at: ISOTimestampString;
}

export interface DashboardMetricBucket {
  count: number;
  amount: DecimalString;
}

export interface CollectionDashboardResponse {
  transfer_waiting_verification: DashboardMetricBucket;
  cash_reported: DashboardMetricBucket;
  collector_verified_cash: DashboardMetricBucket;
  deposit_submitted: DashboardMetricBucket;
  deposit_accepted: DashboardMetricBucket;
  open_discrepancies: DashboardMetricBucket;
  unallocated_funds: DashboardMetricBucket;
}

export interface CollectorCustodyDetailResponse {
  custody: CashCustodyAccountRow | null;
  sources: Array<{
    receipt_id: string;
    receipt_number: string;
    customer_id: string | null;
    customer_paid_at: ISODateString;
    verified_amount: DecimalString;
    deposited_amount: DecimalString;
    remaining_amount: DecimalString;
  }>;
  movements: CustodyMovementRow[];
}
