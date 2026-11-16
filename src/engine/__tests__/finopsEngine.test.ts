import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_ACTORS, DemoEngineError, DemoFinOpsEngine } from '../demoEngine';

const maker = DEMO_ACTORS.find((a) => a.role_code === 'finance_maker')!;
const checker = DEMO_ACTORS.find((a) => a.role_code === 'finance_checker')!;
const collectorBudi = DEMO_ACTORS.find((a) => a.role_code === 'collector_optional')!;
const reviewer = DEMO_ACTORS.find((a) => a.role_code === 'reconciliation_reviewer')!;
const ownerViewer = DEMO_ACTORS.find((a) => a.role_code === 'owner_viewer')!;

const BRANCH_JKT = '22222222-2222-4222-8222-222222222222';
const BRANCH_BDG = '22222222-2222-4222-8222-222222222223';
const CUST_00104 = '33333333-3333-4333-8333-333333333001';
const BANK_BCA = '55555555-5555-4555-8555-555555555001';
const KAS_JKT = '55555555-5555-4555-8555-555555555003';
const STAFF_BUDI = '44444444-4444-4444-8444-444444444001';
const STAFF_AGUS = '44444444-4444-4444-8444-444444444002';

test('UAT-01 & UAT-02: Transfer Rp1.000.000 belum verifikasi vs verifikasi checker berbeda + maker-checker block', () => {
  const engine = new DemoFinOpsEngine();
  const dashBefore = engine.listCollectionDashboard(checker, {});
  const draft = engine.createReceiptDraft(maker, {
    idempotency_key: 'uat01-draft-1',
    branch_id: BRANCH_JKT,
    receipt_channel: 'bank_transfer',
    customer_paid_at: '2026-11-16',
    fund_account_id: BANK_BCA,
    customer_id: CUST_00104,
    is_unknown_identity: false,
    sender_name_raw: 'TOKO SUMBER MAKMUR',
    customer_gross_amount: '1000000.00',
    bank_reference: 'REF-UAT-01',
  });
  engine.submitReceipt(maker, {
    idempotency_key: 'uat01-sub-1',
    receipt_id: draft.receipt_id,
    expected_version: draft.version,
  });

  const recPending = engine.state.receipts.find((r) => r.id === draft.receipt_id)!;
  assert.equal(recPending.status, 'waiting_verification');
  assert.equal(recPending.verified_amount, '0.00');

  // Maker tidak boleh memverifikasi buatannya sendiri
  assert.throws(
    () =>
      engine.verifyReceipt(maker, {
        idempotency_key: 'uat02-self',
        receipt_id: draft.receipt_id,
        expected_version: 2,
        verification_method: 'manual_bank_check',
        verification_ref: 'REF-UAT-01',
      }),
    (err: unknown) => err instanceof DemoEngineError && err.code === '42501'
  );

  // Checker berbeda memverifikasi lewat mutasi bank baris #1 (Rp1.000.000)
  const verified = engine.verifyReceipt(checker, {
    idempotency_key: 'uat02-verify',
    receipt_id: draft.receipt_id,
    expected_version: 2,
    verification_method: 'bank_statement_match',
    bank_statement_line_id: '77777777-0000-4000-8000-000000000001',
    verification_note: 'Cocok mutasi BCA Rp1.000.000',
  });
  assert.equal(verified.status, 'verified');
  assert.equal(verified.verified_amount, '1000000.00');

  const dashAfter = engine.listCollectionDashboard(checker, {});
  assert.equal(
    Number(dashAfter.unallocated_funds.amount) - Number(dashBefore.unallocated_funds.amount),
    1000000
  );
});

test('UAT-03 & UAT-04: Tunai terverifikasi Rp300.000 lalu setor parsial direncanakan Rp250.000', () => {
  const engine = new DemoFinOpsEngine();
  // Budi awal punya 300.000 dari seed
  const detailBefore = engine.getCollectorCustodyDetail(checker, STAFF_BUDI);
  assert.equal(detailBefore.custody?.verified_balance, '300000.00');

  // Buat setoran parsial direncanakan Rp250.000 ke Kas Kantor
  const depDraft = engine.createCashDeposit(maker, {
    idempotency_key: 'uat04-dep-1',
    branch_id: BRANCH_JKT,
    collector_staff_id: STAFF_BUDI,
    target_type: 'office_cash',
    target_fund_account_id: KAS_JKT,
    deposit_date: '2026-11-16',
    lines: [{ receipt_id: '88888888-0000-4000-8000-000000000003', declared_amount: '250000.00' }],
    is_planned_partial: true,
    notes: 'Setoran parsial direncanakan siang',
  });
  engine.submitCashDeposit(maker, {
    idempotency_key: 'uat04-dep-sub',
    deposit_id: depDraft.deposit_id,
    expected_version: depDraft.version,
  });

  const openCasesBefore = engine.state.discrepancies.length;
  const accepted = engine.acceptCashDeposit(checker, {
    idempotency_key: 'uat04-dep-acc',
    deposit_id: depDraft.deposit_id,
    expected_version: 2,
    received_amount: '250000.00',
  });

  assert.equal(accepted.status, 'partially_accepted');
  assert.equal(accepted.shortage_amount, '0.00');
  assert.equal(accepted.custody_balance_after, '50000.00');
  // Tidak membuka kasus selisih
  assert.equal(engine.state.discrepancies.length, openCasesBefore);
});

test('UAT-05: Pengajuan Rp300.000 diterima fisik Rp250.000 -> buka kasus kurang setor Rp50.000', () => {
  const engine = new DemoFinOpsEngine();
  const depDraft = engine.createCashDeposit(maker, {
    idempotency_key: 'uat05-dep-1',
    branch_id: BRANCH_JKT,
    collector_staff_id: STAFF_BUDI,
    target_type: 'office_cash',
    target_fund_account_id: KAS_JKT,
    deposit_date: '2026-11-16',
    lines: [{ receipt_id: '88888888-0000-4000-8000-000000000003', declared_amount: '300000.00' }],
    is_planned_partial: false,
  });
  engine.submitCashDeposit(maker, {
    idempotency_key: 'uat05-dep-sub',
    deposit_id: depDraft.deposit_id,
    expected_version: depDraft.version,
  });

  const accepted = engine.acceptCashDeposit(checker, {
    idempotency_key: 'uat05-dep-acc',
    deposit_id: depDraft.deposit_id,
    expected_version: 2,
    received_amount: '250000.00',
    notes: 'Uang fisik kurang 1 lembar 50rb',
  });

  assert.equal(accepted.status, 'accepted_with_discrepancy');
  assert.equal(accepted.shortage_amount, '50000.00');
  assert.equal(accepted.custody_balance_after, '50000.00');

  const shortageCase = engine.state.discrepancies.find(
    (d) => d.source_id === depDraft.deposit_id && d.case_type === 'deposit_shortage'
  );
  assert.ok(shortageCase);
  assert.equal(shortageCase.discrepancy_amount, '50000.00');
});

test('UAT-06: Dua checker bersamaan menerima setoran atas sumber yang sama (optimistic/row lock)', () => {
  const engine = new DemoFinOpsEngine();
  const depDraft = engine.createCashDeposit(maker, {
    idempotency_key: 'uat06-dep-1',
    branch_id: BRANCH_JKT,
    collector_staff_id: STAFF_BUDI,
    target_type: 'office_cash',
    target_fund_account_id: KAS_JKT,
    deposit_date: '2026-11-16',
    lines: [{ receipt_id: '88888888-0000-4000-8000-000000000003', declared_amount: '300000.00' }],
    is_planned_partial: false,
  });
  engine.submitCashDeposit(maker, {
    idempotency_key: 'uat06-sub',
    deposit_id: depDraft.deposit_id,
    expected_version: 1,
  });

  // Checker 1 berhasil menerima dengan expected_version = 2
  const first = engine.acceptCashDeposit(checker, {
    idempotency_key: 'uat06-c1',
    deposit_id: depDraft.deposit_id,
    expected_version: 2,
    received_amount: '300000.00',
  });
  assert.equal(first.custody_balance_after, '0.00');

  // Checker 2 (atau retry key berbeda dengan version lama) ditolak dan saldo tidak pernah negatif
  assert.throws(
    () =>
      engine.acceptCashDeposit(checker, {
        idempotency_key: 'uat06-c2',
        deposit_id: depDraft.deposit_id,
        expected_version: 2,
        received_amount: '300000.00',
      }),
    (err: unknown) => err instanceof DemoEngineError && err.code === '40001'
  );

  const custodyAfter = engine.state.custodyAccounts.find((c) => c.collector_staff_id === STAFF_BUDI)!;
  assert.equal(custodyAfter.verified_balance, '0.00');
});

test('UAT-07: Setoran langsung penagih ke bank memilih mutasi tanpa membuat receipt pelanggan baru', () => {
  const engine = new DemoFinOpsEngine();
  const receiptCountBefore = engine.state.receipts.length;

  // Sopir Agus punya Rp450.000 tunai terverifikasi, setor ke BCA (mutasi baris #3 = Rp450.000)
  const dep = engine.createCashDeposit(maker, {
    idempotency_key: 'uat07-dep',
    branch_id: BRANCH_JKT,
    collector_staff_id: STAFF_AGUS,
    target_type: 'bank_direct',
    target_fund_account_id: BANK_BCA,
    deposit_date: '2026-11-16',
    lines: [{ receipt_id: '88888888-0000-4000-8000-000000000004', declared_amount: '450000.00' }],
    is_planned_partial: false,
  });
  engine.submitCashDeposit(maker, {
    idempotency_key: 'uat07-sub',
    deposit_id: dep.deposit_id,
    expected_version: 1,
  });

  const acc = engine.acceptCashDeposit(checker, {
    idempotency_key: 'uat07-acc',
    deposit_id: dep.deposit_id,
    expected_version: 2,
    received_amount: '450000.00',
    bank_statement_line_id: '77777777-0000-4000-8000-000000000003',
  });

  assert.equal(acc.status, 'accepted');
  assert.equal(acc.custody_balance_after, '0.00');
  assert.equal(engine.state.receipts.length, receiptCountBefore);
  const bankMatch = engine.state.bankMatches.find(
    (m) => m.target_type === 'cash_deposit' && m.target_id === dep.deposit_id
  );
  assert.ok(bankMatch);
});

test('UAT-08: Receipt yang sudah dialokasikan ke nota tidak dapat dibalik tanpa melepas alokasi', () => {
  const engine = new DemoFinOpsEngine();
  const targetReceiptId = '88888888-0000-4000-8000-000000000002';

  // Simulasikan App 2 sudah membuat alokasi aktif pada receipt ini
  engine.state.paymentAllocations.push({
    id: 'a1a1a1a1-0000-4000-8000-000000000001',
    company_id: engine.state.company.id,
    branch_id: BRANCH_JKT,
    receipt_id: targetReceiptId,
    sales_document_id: 's1s1s1s1-0000-4000-8000-000000000001',
    allocated_amount: '500000.00',
    status: 'approved',
    notes: 'Alokasi App 2',
    created_by: reviewer.id,
    approved_by: reviewer.id,
    approved_at: '2026-11-16T09:00:00.000Z',
    version: 1,
    created_at: '2026-11-16T09:00:00.000Z',
  });

  const req = engine.requestReceiptReversal(maker, {
    idempotency_key: 'uat08-req',
    receipt_id: targetReceiptId,
    expected_version: 3,
    reason: 'Uji tolak reversal berdependensi',
  });

  assert.throws(
    () =>
      engine.approveReceiptReversal(checker, {
        idempotency_key: 'uat08-app',
        receipt_id: targetReceiptId,
        expected_version: req.version as number,
        reason: 'Coba paksa reversal',
      }),
    (err: unknown) => err instanceof DemoEngineError && err.code === '23503'
  );
});

test('UAT-09: Keamanan peran, anonymous, lintas cabang, dan scope penagih ditolak', () => {
  const engine = new DemoFinOpsEngine();

  // 1. Anonymous ditolak
  assert.throws(
    () => engine.listCollectionDashboard(null, {}),
    (err: unknown) => err instanceof DemoEngineError && err.code === '42501'
  );

  // 2. Owner viewer tidak bisa membuat transaksi
  assert.throws(
    () =>
      engine.createReceiptDraft(ownerViewer, {
        idempotency_key: 'sec-owner',
        branch_id: BRANCH_JKT,
        receipt_channel: 'bank_transfer',
        customer_paid_at: '2026-11-16',
        customer_id: CUST_00104,
        is_unknown_identity: false,
        customer_gross_amount: '100000.00',
      }),
    (err: unknown) => err instanceof DemoEngineError && err.code === '42501'
  );

  // 3. Collector optional tidak bisa melihat custody penagih lain & tidak bisa masuk cabang Bandung
  assert.throws(
    () => engine.getCollectorCustodyDetail(collectorBudi, STAFF_AGUS),
    (err: unknown) => err instanceof DemoEngineError && err.code === '42501'
  );

  assert.throws(
    () =>
      engine.createReceiptDraft(collectorBudi, {
        idempotency_key: 'sec-branch',
        branch_id: BRANCH_BDG,
        receipt_channel: 'cash',
        customer_paid_at: '2026-11-16',
        customer_id: CUST_00104,
        is_unknown_identity: false,
        customer_gross_amount: '100000.00',
        actual_collector_id: STAFF_BUDI,
      }),
    (err: unknown) => err instanceof DemoEngineError && err.code === '42501'
  );
});

test('UAT-10 & Idempotency: Replay idempotency_key tidak menggandakan dokumen & duplikat tanggal sama tidak terhapus otomatis', () => {
  const engine = new DemoFinOpsEngine();
  const d1 = engine.createReceiptDraft(maker, {
    idempotency_key: 'idem-same-key-1',
    branch_id: BRANCH_JKT,
    receipt_channel: 'bank_transfer',
    customer_paid_at: '2026-11-16',
    fund_account_id: BANK_BCA,
    customer_id: CUST_00104,
    is_unknown_identity: false,
    customer_gross_amount: '750000.00',
    bank_reference: 'REF-SAMA-750',
  });
  const d1Replay = engine.createReceiptDraft(maker, {
    idempotency_key: 'idem-same-key-1',
    branch_id: BRANCH_JKT,
    receipt_channel: 'bank_transfer',
    customer_paid_at: '2026-11-16',
    fund_account_id: BANK_BCA,
    customer_id: CUST_00104,
    is_unknown_identity: false,
    customer_gross_amount: '750000.00',
    bank_reference: 'REF-SAMA-750',
  });
  assert.equal(d1.receipt_id, d1Replay.receipt_id);

  // Transaksi baru berbeda idempotency_key namun identik hari/nominal/rekening tetap disimpan dengan duplicate_flag = true
  const d2 = engine.createReceiptDraft(maker, {
    idempotency_key: 'idem-different-key-2',
    branch_id: BRANCH_JKT,
    receipt_channel: 'bank_transfer',
    customer_paid_at: '2026-11-16',
    fund_account_id: BANK_BCA,
    customer_id: CUST_00104,
    is_unknown_identity: false,
    customer_gross_amount: '750000.00',
    bank_reference: 'REF-SAMA-750',
  });
  assert.notEqual(d1.receipt_id, d2.receipt_id);
  assert.equal(d2.duplicate_flag, true);
});
