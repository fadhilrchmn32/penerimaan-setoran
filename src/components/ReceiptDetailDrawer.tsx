import React, { useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  RotateCcw,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  AppRoleCode,
  BankFeeBearer,
  ReceiptRow,
  VerificationMethod,
} from '../../database.types';
import type { WorkspaceDataset, WorkspaceMode } from '../services/finopsClient';
import { formatDateID, formatDateTimeJakarta, formatIDR, toDecimal } from '../lib/money';
import {
  AccountingDimensionLabel,
  DepositDimensionLabel,
  InfoTip,
  ReceiptStatusLabel,
  ReconciliationDimensionLabel,
} from './ui/StatusText';
import { getEvidenceSignedUrl } from '../services/finopsClient';

interface ReceiptDetailDrawerProps {
  receipt: ReceiptRow | null;
  dataset: WorkspaceDataset;
  mode: WorkspaceMode;
  actorId: string;
  actorRole: AppRoleCode;
  onClose: () => void;
  onSubmitDraft: (receipt: ReceiptRow) => Promise<void>;
  onVerify: (
    receipt: ReceiptRow,
    params: {
      verification_method: VerificationMethod;
      bank_statement_line_id?: string | null;
      verification_ref?: string | null;
      verification_note?: string | null;
      bank_value_date?: string | null;
      bank_fee_amount?: string | null;
      bank_fee_bearer?: BankFeeBearer | null;
    }
  ) => Promise<void>;
  onReject: (receipt: ReceiptRow, reason: string) => Promise<void>;
  onProposeIdentity: (receipt: ReceiptRow, customerId: string, reason: string) => Promise<void>;
  onApproveIdentity: (receipt: ReceiptRow, customerId: string, reason: string) => Promise<void>;
  onRequestReversal: (receipt: ReceiptRow, reason: string) => Promise<void>;
  onApproveReversal: (receipt: ReceiptRow, reason: string) => Promise<void>;
}

export function ReceiptDetailDrawer({
  receipt,
  dataset,
  mode,
  actorId,
  actorRole,
  onClose,
  onSubmitDraft,
  onVerify,
  onReject,
  onProposeIdentity,
  onApproveIdentity,
  onRequestReversal,
  onApproveReversal,
}: ReceiptDetailDrawerProps) {
  const [verifyMethod, setVerifyMethod] = useState<VerificationMethod>(
    receipt?.receipt_channel === 'cash' ? 'cash_evidence_check' : 'bank_statement_match'
  );
  const [selectedBankLineId, setSelectedBankLineId] = useState('');
  const [manualRef, setManualRef] = useState('');
  const [verifyNote, setVerifyNote] = useState('');
  const [bankValueDate, setBankValueDate] = useState(receipt?.customer_paid_at ?? '');
  const [feeAmount, setFeeAmount] = useState(receipt?.bank_fee_amount ?? '0');
  const [feeBearer, setFeeBearer] = useState<BankFeeBearer>(receipt?.bank_fee_bearer ?? 'none');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);

  const [identityCustomerId, setIdentityCustomerId] = useState('');
  const [identityReason, setIdentityReason] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [showReversalBox, setShowReversalBox] = useState(false);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [signedUrlPreview, setSignedUrlPreview] = useState<string | null>(null);

  if (!receipt) return null;

  const customer = dataset.customers.find((c) => c.id === receipt.customer_id);
  const account = dataset.fundAccounts.find((a) => a.id === receipt.fund_account_id);
  const collector = dataset.staff.find((s) => s.id === receipt.actual_collector_id);
  const salesOwner = dataset.staff.find((s) => s.id === receipt.sales_owner_id);
  const creator = dataset.profiles.find((p) => p.id === receipt.created_by);
  const verifier = dataset.profiles.find((p) => p.id === receipt.verified_by);
  const evidenceFiles = dataset.receiptEvidence.filter((e) => e.receipt_id === receipt.id);
  const docAudit = dataset.auditEvents.filter((a) => a.entity_id === receipt.id);
  const docEvents = dataset.accountingEvents.filter((e) => e.source_id === receipt.id);
  const unknownCase = dataset.discrepancies.find(
    (d) => d.source_id === receipt.id && d.case_type === 'unknown_sender'
  );

  const unmatchedCreditLines = dataset.bankLines.filter(
    (l) =>
      l.direction === 'credit' &&
      toDecimal(l.amount).minus(toDecimal(l.matched_amount)).gt(0) &&
      (!receipt.fund_account_id || l.fund_account_id === receipt.fund_account_id)
  );

  const isMaker = receipt.created_by === actorId || receipt.submitted_by === actorId;
  const canVerify =
    actorRole === 'finance_checker' &&
    ['submitted', 'waiting_verification'].includes(receipt.status) &&
    !isMaker;
  const canSubmit =
    ['finance_maker', 'finance_checker', 'collector_optional'].includes(actorRole) &&
    receipt.status === 'draft';

  const app2Href = dataset.appSettings.app2_url
    ? `${dataset.appSettings.app2_url.replace(/\/$/, '')}/?doc_type=receipt&id=${encodeURIComponent(receipt.id)}`
    : null;
  const app3Href = dataset.appSettings.app3_url
    ? `${dataset.appSettings.app3_url.replace(/\/$/, '')}/?source_type=receipt&source_id=${encodeURIComponent(receipt.id)}`
    : null;

  async function runAction(fn: () => Promise<void>) {
    setBusy(true);
    setErrorMsg(null);
    try {
      await fn();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses aksi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-label={`Detail Penerimaan ${receipt.receipt_number}`}
        className="w-full max-w-[580px] bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{receipt.receipt_channel === 'bank_transfer' ? 'Penerimaan Transfer' : 'Penerimaan Tunai'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">v{receipt.version}</span>
            </div>
            <h2 className="font-display text-lg font-bold text-slate-900 font-mono mt-0.5">
              {receipt.receipt_number}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel detail"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          {receipt.duplicate_flag && (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Peringatan Kemungkinan Transaksi Ganda</div>
                <p className="mt-0.5 leading-relaxed">{receipt.duplicate_reason}</p>
              </div>
            </div>
          )}

          {/* 4 Separate Status Dimensions */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <div className="text-xs text-slate-500">Status Verifikasi Dana</div>
              <div className="mt-1">
                <ReceiptStatusLabel status={receipt.status} />
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Status Setoran</div>
              <div className="mt-1">
                <DepositDimensionLabel status={receipt.deposit_status} />
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Status Rekonsiliasi (App 2)</div>
              <div className="mt-1">
                <ReconciliationDimensionLabel status={receipt.reconciliation_status} />
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">
                Status Jurnal (App 3)
                <InfoTip
                  title="Status Jurnal Terpisah"
                  body="Lunas di penjualan tidak sama dengan sudah terjurnal. Status 'Menunggu App 3' berarti event akuntansi sudah tersimpan atomik di outbox."
                />
              </div>
              <div className="mt-1">
                <AccountingDimensionLabel status={receipt.accounting_status} />
              </div>
            </div>
          </div>

          {/* Monetary Details */}
          <div className="border-t border-slate-100 pt-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-500">Rincian Nominal</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-slate-600">Nominal Pembayaran Pelanggan</span>
              <span className="text-right font-mono tabular-nums font-semibold text-slate-900">
                {formatIDR(receipt.customer_gross_amount)}
              </span>

              {receipt.receipt_channel === 'bank_transfer' && (
                <>
                  <span className="text-slate-600">Kredit Bank Bersih</span>
                  <span className="text-right font-mono tabular-nums text-slate-800">
                    {formatIDR(receipt.bank_net_amount)}
                  </span>
                  <span className="text-slate-600">Potongan Biaya Bank</span>
                  <span className="text-right font-mono tabular-nums text-slate-800">
                    {formatIDR(receipt.bank_fee_amount)} ({receipt.bank_fee_bearer})
                  </span>
                </>
              )}

              <span className="text-slate-600 font-medium">
                Dana Terverifikasi Sah
                <InfoTip
                  title="Dana Terverifikasi vs Titipan"
                  body="Hanya dana terverifikasi yang dapat dialokasikan ke nota oleh App 2 (masuk akun Titipan Pelanggan 2102 atau Penerimaan Belum Teridentifikasi 2103)."
                />
              </span>
              <span className="text-right font-mono tabular-nums font-bold text-teal-800">
                {formatIDR(receipt.verified_amount)}
              </span>
            </div>
          </div>

          {/* Parties, Dates & References */}
          <div className="border-t border-slate-100 pt-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-500">Identitas, Tanggal &amp; Referensi</h3>
            <dl className="grid grid-cols-2 gap-y-2 text-xs">
              <dt className="text-slate-500">Pelanggan</dt>
              <dd className="text-right font-medium text-slate-900">
                {receipt.is_unknown_identity
                  ? 'Identitas Pengirim Belum Diketahui'
                  : customer
                  ? `${customer.cust_id} — ${customer.name}`
                  : '-'}
              </dd>

              <dt className="text-slate-500">Nama Pengirim Asli</dt>
              <dd className="text-right text-slate-800">{receipt.sender_name_raw || '-'}</dd>

              <dt className="text-slate-500">
                Tanggal Pelanggan Bayar
                <InfoTip
                  title="Pemisahan Tanggal"
                  body="Tanggal bayar pelanggan tidak mengubah tanggal kirim/penjualan. Tanggal valuta bank dipakai untuk posisi kas bank, sedangkan tanggal akuntansi ditentukan oleh periode terbuka."
                />
              </dt>
              <dd className="text-right font-mono tabular-nums text-slate-800">
                {formatDateID(receipt.customer_paid_at)}
              </dd>

              <dt className="text-slate-500">Tanggal Nilai Bank</dt>
              <dd className="text-right font-mono tabular-nums text-slate-800">
                {formatDateID(receipt.bank_value_date)}
              </dd>

              <dt className="text-slate-500">Waktu Verifikasi</dt>
              <dd className="text-right font-mono tabular-nums text-slate-800">
                {formatDateTimeJakarta(receipt.verified_at)}
              </dd>

              {receipt.receipt_channel === 'bank_transfer' ? (
                <>
                  <dt className="text-slate-500">Rekening Tujuan</dt>
                  <dd className="text-right text-slate-800">{account ? `${account.code} (${account.name})` : '-'}</dd>
                  <dt className="text-slate-500">Referensi Bank</dt>
                  <dd className="text-right font-mono text-slate-800">{receipt.bank_reference || '-'}</dd>
                </>
              ) : (
                <>
                  <dt className="text-slate-500">Penagih Riil (Pemegang Kas)</dt>
                  <dd className="text-right text-slate-800">{collector ? `${collector.staff_code} — ${collector.full_name}` : '-'}</dd>
                  <dt className="text-slate-500">Sales Penanggung Jawab</dt>
                  <dd className="text-right text-slate-800">{salesOwner ? salesOwner.full_name : 'Sama dgn penagih'}</dd>
                  <dt className="text-slate-500">Nomor Kuitansi</dt>
                  <dd className="text-right font-mono text-slate-800">{receipt.receipt_book_no || '-'}</dd>
                </>
              )}

              <dt className="text-slate-500">Referensi Nota Opsional</dt>
              <dd className="text-right font-mono text-slate-800">{receipt.optional_invoice_ref || '-'}</dd>

              <dt className="text-slate-500">Dicatat Oleh</dt>
              <dd className="text-right text-slate-800">{creator?.full_name ?? receipt.created_by}</dd>

              <dt className="text-slate-500">Diverifikasi Oleh</dt>
              <dd className="text-right text-slate-800">{verifier?.full_name ?? '-'}</dd>
            </dl>
            {receipt.notes && (
              <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                Catatan: {receipt.notes}
              </p>
            )}
            {receipt.rejection_reason && (
              <p className="text-xs text-red-800 bg-red-50 p-2.5 rounded-lg border border-red-200">
                Alasan Penolakan: {receipt.rejection_reason}
              </p>
            )}
          </div>

          {/* Evidence */}
          <div className="border-t border-slate-100 pt-4 space-y-2">
            <h3 className="text-xs font-semibold text-slate-500">Bukti Lampiran</h3>
            {evidenceFiles.length === 0 && !receipt.evidence_hash ? (
              <p className="text-xs text-slate-500">Tidak ada berkas bukti terlampir.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {receipt.evidence_hash && (
                  <div className="text-slate-600 font-mono break-all">
                    SHA-256: {receipt.evidence_hash}
                  </div>
                )}
                {evidenceFiles.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="truncate font-medium text-slate-800">{ev.file_name}</span>
                    </div>
                    {mode === 'production_live' && (
                      <button
                        type="button"
                        onClick={() =>
                          runAction(async () => {
                            const url = await getEvidenceSignedUrl(ev.storage_path);
                            setSignedUrlPreview(url);
                          })
                        }
                        className="text-teal-700 hover:underline font-medium shrink-0"
                      >
                        Minta Signed URL
                      </button>
                    )}
                  </div>
                ))}
                {signedUrlPreview && (
                  <a
                    href={signedUrlPreview}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-teal-700 hover:underline font-medium"
                  >
                    Buka Bukti (Berlaku 120 detik) <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Action: Submit Draft */}
          {canSubmit && (
            <div className="border-t border-slate-200 pt-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction(() => onSubmitDraft(receipt))}
                className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Ajukan ke Antrian Verifikasi Checker
              </button>
            </div>
          )}

          {/* Action: Checker Verification */}
          {['submitted', 'waiting_verification'].includes(receipt.status) && actorRole === 'finance_checker' && isMaker && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              Pemisahan tugas (maker-checker): Anda adalah pencatat dokumen ini sehingga tidak dapat memverifikasi atau menolaknya sendiri.
            </div>
          )}

          {canVerify && (
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-teal-700" />
                Keputusan Verifikasi Checker
              </div>

              {receipt.receipt_channel === 'bank_transfer' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVerifyMethod('bank_statement_match')}
                      className={`py-2 px-3 text-xs font-medium rounded-lg border ${
                        verifyMethod === 'bank_statement_match'
                          ? 'bg-teal-50 border-teal-600 text-teal-900'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Cocokkan Mutasi Bank
                    </button>
                    <button
                      type="button"
                      onClick={() => setVerifyMethod('manual_bank_check')}
                      className={`py-2 px-3 text-xs font-medium rounded-lg border ${
                        verifyMethod === 'manual_bank_check'
                          ? 'bg-teal-50 border-teal-600 text-teal-900'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Pemeriksaan Manual
                    </button>
                  </div>

                  {verifyMethod === 'bank_statement_match' ? (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Pilih Baris Mutasi Bank Kredit
                      </label>
                      <select
                        value={selectedBankLineId}
                        onChange={(e) => setSelectedBankLineId(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">-- Pilih mutasi bank --</option>
                        {unmatchedCreditLines.map((l) => {
                          const avail = toDecimal(l.amount).minus(toDecimal(l.matched_amount));
                          return (
                            <option key={l.id} value={l.id}>
                              {formatDateID(l.value_date)} · {formatIDR(avail)} · {l.description}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Referensi Pemeriksaan
                        </label>
                        <input
                          type="text"
                          value={manualRef}
                          onChange={(e) => setManualRef(e.target.value)}
                          placeholder="No. mutasi / IBiz"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Tanggal Nilai Bank
                        </label>
                        <input
                          type="date"
                          value={bankValueDate}
                          onChange={(e) => setBankValueDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Potongan Biaya Bank (IDR)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={feeAmount}
                        onChange={(e) => setFeeAmount(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Penanggung Biaya Bank
                      </label>
                      <select
                        value={feeBearer}
                        onChange={(e) => setFeeBearer(e.target.value as BankFeeBearer)}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="none">Tidak Ada Potongan</option>
                        <option value="company">Disahkan Ditanggung Perusahaan</option>
                        <option value="customer">Ditanggung Pelanggan</option>
                        <option value="pending_review">Tahan Review Selisih</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan Pemeriksaan Checker
                </label>
                <input
                  type="text"
                  value={verifyNote}
                  onChange={(e) => setVerifyNote(e.target.value)}
                  placeholder="Keterangan verifikasi dana / penguasaan kas"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    runAction(() =>
                      onVerify(receipt, {
                        verification_method:
                          receipt.receipt_channel === 'cash' ? 'cash_evidence_check' : verifyMethod,
                        bank_statement_line_id: selectedBankLineId || null,
                        verification_ref: manualRef || receipt.receipt_book_no || null,
                        verification_note: verifyNote || null,
                        bank_value_date: bankValueDate || receipt.customer_paid_at,
                        bank_fee_amount: feeAmount || '0',
                        bank_fee_bearer: feeBearer,
                      })
                    )
                  }
                  className="flex-1 py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Setujui &amp; Verifikasi Dana
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectBox((v) => !v)}
                  className="py-2.5 px-4 bg-white border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors"
                >
                  Tolak
                </button>
              </div>

              {showRejectBox && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
                  <label className="block text-xs font-medium text-red-900">Alasan Penolakan Wajib</label>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Contoh: Dana belum masuk mutasi rekening / kuitansi tidak terbaca"
                    className="w-full px-3 py-2 text-xs border border-red-300 rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction(() => onReject(receipt, rejectReason))}
                    className="py-2 px-3 bg-red-700 hover:bg-red-800 text-white text-xs font-medium rounded-lg"
                  >
                    Konfirmasi Tolak Penerimaan
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Unknown Identity Resolution */}
          {receipt.is_unknown_identity && (
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <UserPlus className="w-4 h-4 text-amber-700" />
                Tindak Lanjut Identitas Pengirim
              </div>
              <select
                value={identityCustomerId}
                onChange={(e) => setIdentityCustomerId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="">-- Pilih pelanggan sebenarnya --</option>
                {dataset.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.cust_id} — {c.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={identityReason}
                onChange={(e) => setIdentityReason(e.target.value)}
                placeholder="Alasan / bukti konfirmasi dari sales atau pelanggan"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
              <div className="flex gap-2">
                {['finance_maker', 'finance_checker', 'sales_admin'].includes(actorRole) && (
                  <button
                    type="button"
                    disabled={busy || !identityCustomerId}
                    onClick={() =>
                      runAction(() => onProposeIdentity(receipt, identityCustomerId, identityReason || 'Usulan identitas pengirim'))
                    }
                    className="py-2 px-3 bg-slate-900 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                  >
                    Usulkan Identitas
                  </button>
                )}
                {['finance_checker', 'reconciliation_reviewer'].includes(actorRole) && (
                  <button
                    type="button"
                    disabled={busy || !(identityCustomerId || unknownCase?.proposed_resolution)}
                    onClick={() =>
                      runAction(() =>
                        onApproveIdentity(
                          receipt,
                          identityCustomerId || unknownCase?.proposed_resolution || '',
                          identityReason || 'Identitas disahkan checker'
                        )
                      )
                    }
                    className="py-2 px-3 bg-teal-700 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                  >
                    Sahkan Identitas
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Reversal Request / Approval */}
          {(receipt.status === 'verified' || receipt.status === 'reversal_requested') &&
            ['finance_maker', 'finance_checker', 'accounting_approver'].includes(actorRole) && (
              <div className="border-t border-slate-200 pt-4 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setShowReversalBox((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-red-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {receipt.status === 'reversal_requested'
                    ? 'Proses Persetujuan Reversal'
                    : 'Ajukan Pembatalan / Reversal'}
                </button>
                {showReversalBox && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <input
                      type="text"
                      value={reversalReason}
                      onChange={(e) => setReversalReason(e.target.value)}
                      placeholder="Alasan pembatalan (cek dependensi alokasi/setoran)"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                    {receipt.status === 'verified' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(() => onRequestReversal(receipt, reversalReason))}
                        className="py-2 px-3 bg-amber-700 hover:bg-amber-800 text-white text-xs font-medium rounded-lg"
                      >
                        Kirim Permintaan Reversal
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(() => onApproveReversal(receipt, reversalReason))}
                        className="py-2 px-3 bg-red-700 hover:bg-red-800 text-white text-xs font-medium rounded-lg"
                      >
                        Setujui Reversal (Cek Dependensi)
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

          {/* Cross-App Links (No tokens in URL) */}
          <div className="border-t border-slate-200 pt-4 space-y-2">
            <h3 className="text-xs font-semibold text-slate-500">Navigasi Lintas Aplikasi</h3>
            <div className="flex flex-wrap gap-2">
              {app2Href ? (
                <a
                  href={app2Href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Buka di Penjualan (App 2) <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="text-xs text-slate-400">
                  URL App 2 (Penjualan) belum diatur di Pengaturan.
                </span>
              )}
              {app3Href ? (
                <a
                  href={app3Href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Lihat Jurnal (App 3) <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="text-xs text-slate-400">
                  URL App 3 (Akuntansi) belum diatur di Pengaturan.
                </span>
              )}
            </div>
          </div>

          {/* Accounting Events & Audit Trail */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-500">Event Akuntansi &amp; Jejak Audit</h3>
            {docEvents.length > 0 && (
              <div className="space-y-1.5">
                {docEvents.map((ev) => (
                  <div key={ev.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    <div className="flex justify-between font-medium text-slate-800">
                      <span className="font-mono">{ev.event_type}</span>
                      <span className="text-amber-700">{ev.processing_status}</span>
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      Tanggal efektif: {formatDateID(ev.effective_date)} · Versi sumber: v{ev.source_version}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              {docAudit.map((au) => (
                <div key={au.id} className="text-xs text-slate-600 flex justify-between gap-2 py-1 border-b border-slate-100">
                  <span>
                    <span className="font-mono font-medium text-slate-800">{au.event_action}</span>
                    {au.reason ? ` — ${au.reason}` : ''}
                  </span>
                  <span className="font-mono text-slate-400 shrink-0">{formatDateTimeJakarta(au.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
