import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react';
import type {
  AppRoleCode,
  BankFeeBearer,
  ReceiptChannel,
  ReceiptRow,
  ReceiptStatus,
} from '../../database.types';
import type { CreateReceiptPayload, WorkspaceDataset, WorkspaceMode } from '../services/finopsClient';
import { formatDateID, formatIDR, sha256Hex, toDecimal, todayISOJakarta } from '../lib/money';
import {
  AccountingDimensionLabel,
  DepositDimensionLabel,
  ReceiptStatusLabel,
} from '../components/ui/StatusText';
import { uploadEvidenceToPrivateBucket } from '../services/finopsClient';

interface ReceiptsPageProps {
  channel: ReceiptChannel;
  dataset: WorkspaceDataset;
  mode: WorkspaceMode;
  actorRole: AppRoleCode;
  branchFilter: string;
  onSelectReceipt: (r: ReceiptRow) => void;
  onCreateReceipt: (payload: CreateReceiptPayload, submitImmediately: boolean) => Promise<void>;
}

export function ReceiptsPage({
  channel,
  dataset,
  mode,
  actorRole,
  branchFilter,
  onSelectReceipt,
  onCreateReceipt,
}: ReceiptsPageProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReceiptStatus>('all');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Form modal state
  const [showForm, setShowForm] = useState(false);
  const [formBranchId, setFormBranchId] = useState(dataset.branches[0]?.id ?? '');
  const [paidAt, setPaidAt] = useState(todayISOJakarta());
  const [bankValueDate, setBankValueDate] = useState(todayISOJakarta());
  const [fundAccountId, setFundAccountId] = useState(
    dataset.fundAccounts.find((a) => a.account_type === 'bank')?.id ?? ''
  );
  const [isUnknownIdentity, setIsUnknownIdentity] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [senderNameRaw, setSenderNameRaw] = useState('');
  const [grossAmount, setGrossAmount] = useState('');
  const [feeAmount, setFeeAmount] = useState('0');
  const [feeBearer, setFeeBearer] = useState<BankFeeBearer>('none');
  const [bankReference, setBankReference] = useState('');
  const [optionalInvoiceRef, setOptionalInvoiceRef] = useState('');
  const [receiptBookNo, setReceiptBookNo] = useState('');
  const [actualCollectorId, setActualCollectorId] = useState(dataset.staff[0]?.id ?? '');
  const [salesOwnerId, setSalesOwnerId] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [notes, setNotes] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceHash, setEvidenceHash] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID());

  const isTransfer = channel === 'bank_transfer';
  const canCreate = isTransfer
    ? ['finance_maker', 'finance_checker'].includes(actorRole)
    : ['finance_maker', 'finance_checker', 'collector_optional'].includes(actorRole);

  const bankAccounts = dataset.fundAccounts.filter((a) => a.account_type === 'bank' && a.is_active);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = dataset.receipts.filter((r) => {
      if (r.receipt_channel !== channel) return false;
      if (branchFilter && r.branch_id !== branchFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      const cust = dataset.customers.find((c) => c.id === r.customer_id);
      const col = dataset.staff.find((s) => s.id === r.actual_collector_id);
      return (
        r.receipt_number.toLowerCase().includes(q) ||
        (r.sender_name_raw ?? '').toLowerCase().includes(q) ||
        (r.bank_reference ?? '').toLowerCase().includes(q) ||
        (r.optional_invoice_ref ?? '').toLowerCase().includes(q) ||
        (r.receipt_book_no ?? '').toLowerCase().includes(q) ||
        (cust?.cust_id ?? '').toLowerCase().includes(q) ||
        (cust?.name ?? '').toLowerCase().includes(q) ||
        (col?.full_name ?? '').toLowerCase().includes(q) ||
        r.customer_gross_amount.includes(q)
      );
    });
    list.sort((a, b) =>
      sortDir === 'desc'
        ? b.customer_paid_at.localeCompare(a.customer_paid_at) || b.created_at.localeCompare(a.created_at)
        : a.customer_paid_at.localeCompare(b.customer_paid_at)
    );
    return list;
  }, [dataset, channel, branchFilter, statusFilter, search, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Live duplicate pre-check hint
  const duplicatePreview = useMemo(() => {
    if (!grossAmount || !paidAt) return [];
    const g = toDecimal(grossAmount);
    if (g.lte(0)) return [];
    return dataset.receipts.filter(
      (r) =>
        r.status !== 'rejected' &&
        r.status !== 'reversed' &&
        r.customer_paid_at === paidAt &&
        toDecimal(r.customer_gross_amount).eq(g) &&
        ((bankReference && r.bank_reference === bankReference) ||
          (evidenceHash && r.evidence_hash === evidenceHash) ||
          (isTransfer && fundAccountId && r.fund_account_id === fundAccountId))
    );
  }, [dataset.receipts, grossAmount, paidAt, bankReference, evidenceHash, isTransfer, fundAccountId]);

  async function handleFileSelect(file: File | null) {
    setEvidenceFile(file);
    if (!file) {
      setEvidenceHash(null);
      return;
    }
    const buf = await file.arrayBuffer();
    const hex = await sha256Hex(buf);
    setEvidenceHash(hex);
  }

  async function handleSubmitForm(submitImmediately: boolean) {
    setFormError(null);
    if (!grossAmount || toDecimal(grossAmount).lte(0)) {
      setFormError('Nominal pembayaran wajib lebih dari 0.');
      return;
    }
    if (!isUnknownIdentity && !customerId) {
      setFormError('Pilih pelanggan atau centang Identitas Pengirim Belum Diketahui.');
      return;
    }
    if (!isTransfer && !actualCollectorId) {
      setFormError('Pilih sales/sopir yang benar-benar menerima uang tunai.');
      return;
    }

    setSubmitting(true);
    try {
      const feeDec = isTransfer ? toDecimal(feeAmount || '0') : toDecimal('0');
      const netDec = toDecimal(grossAmount).minus(feeDec);

      const created = await onCreateReceipt(
        {
          idempotency_key: attemptKey,
          company_id: dataset.company.id,
          branch_id: formBranchId || dataset.branches[0].id,
          receipt_channel: channel,
          customer_paid_at: paidAt,
          bank_value_date: isTransfer ? bankValueDate || null : null,
          fund_account_id: isTransfer ? fundAccountId || null : null,
          customer_id: isUnknownIdentity ? null : customerId,
          is_unknown_identity: isUnknownIdentity,
          sender_name_raw: senderNameRaw || null,
          customer_gross_amount: toDecimal(grossAmount).toFixed(2),
          bank_net_amount: netDec.toFixed(2),
          bank_fee_amount: feeDec.toFixed(2),
          bank_fee_bearer: isTransfer ? (feeDec.gt(0) ? feeBearer : 'none') : 'none',
          bank_reference: isTransfer ? bankReference || null : null,
          optional_invoice_ref: optionalInvoiceRef || null,
          receipt_book_no: !isTransfer ? receiptBookNo || null : null,
          actual_collector_id: !isTransfer ? actualCollectorId : null,
          sales_owner_id: !isTransfer && salesOwnerId ? salesOwnerId : null,
          location_note: !isTransfer ? locationNote || null : null,
          notes: notes || null,
          evidence_hash: evidenceHash,
          evidence_file: evidenceFile
            ? {
                file_name: evidenceFile.name,
                mime_type: evidenceFile.type || 'application/octet-stream',
                file_size_bytes: evidenceFile.size,
              }
            : null,
        },
        submitImmediately
      );
      void created;
      if (mode === 'production_live' && evidenceFile) {
        // Note: in production live, evidence metadata upload can follow
        await uploadEvidenceToPrivateBucket(dataset.company.id, 'receipt', attemptKey, evidenceFile).catch(() => null);
      }

      setAttemptKey(crypto.randomUUID());
      setShowForm(false);
      setGrossAmount('');
      setFeeAmount('0');
      setBankReference('');
      setOptionalInvoiceRef('');
      setSenderNameRaw('');
      setNotes('');
      setEvidenceFile(null);
      setEvidenceHash(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan penerimaan.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            {isTransfer ? 'Penerimaan Transfer Pelanggan' : 'Penerimaan Tunai & Penguasaan Penagih'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {isTransfer
              ? 'Bukti transfer yang diunggah tetap berstatus Menunggu Verifikasi hingga checker mencocokkan kredit rekening perusahaan.'
              : 'Laporan tunai belum menambah saldo kas sah sampai checker memverifikasi bukti kuitansi dan penguasaan uang penagih.'}
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setAttemptKey(crypto.randomUUID());
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            {isTransfer ? 'Catat Transfer Pelanggan' : 'Laporkan Tunai Pelanggan'}
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari no. dokumen, CUST ID, nama pengirim, referensi, nota, atau nominal..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {[
            { key: 'all', label: 'Semua' },
            { key: 'draft', label: 'Draft' },
            { key: 'waiting_verification', label: 'Menunggu' },
            { key: 'verified', label: 'Terverifikasi' },
            { key: 'rejected', label: 'Ditolak' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatusFilter(tab.key as 'all' | ReceiptStatus);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                statusFilter === tab.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {paged.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-slate-500">
              Belum ada data {isTransfer ? 'penerimaan transfer' : 'penerimaan tunai'} yang sesuai filter.
            </p>
            {canCreate && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg"
              >
                Catat Penerimaan Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Nomor Dokumen</th>
                  <th className="text-left px-4 py-3 font-semibold">
                    <button
                      type="button"
                      onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Tgl Bayar <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold">Pelanggan / Pengirim</th>
                  <th className="text-left px-4 py-3 font-semibold">
                    {isTransfer ? 'Rekening & Ref' : 'Penagih & Kuitansi'}
                  </th>
                  <th className="text-right px-4 py-3 font-semibold">Nominal Pelanggan</th>
                  <th className="text-right px-4 py-3 font-semibold">Terverifikasi</th>
                  <th className="text-left px-4 py-3 font-semibold">Verifikasi</th>
                  <th className="text-left px-4 py-3 font-semibold">
                    {isTransfer ? 'Jurnal' : 'Setoran'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.map((r) => {
                  const cust = dataset.customers.find((c) => c.id === r.customer_id);
                  const acc = dataset.fundAccounts.find((a) => a.id === r.fund_account_id);
                  const col = dataset.staff.find((s) => s.id === r.actual_collector_id);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => onSelectReceipt(r)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-slate-900">{r.receipt_number}</div>
                        {r.optional_invoice_ref && (
                          <div className="text-slate-500 font-mono">Nota: {r.optional_invoice_ref}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-700">
                        <div>{formatDateID(r.customer_paid_at)}</div>
                        {r.bank_value_date && isTransfer && (
                          <div className="text-[11px] text-slate-400">Valuta: {formatDateID(r.bank_value_date)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {r.is_unknown_identity
                            ? 'Identitas Belum Diketahui'
                            : cust
                            ? `${cust.cust_id} — ${cust.name}`
                            : '-'}
                        </div>
                        {r.sender_name_raw && (
                          <div className="text-slate-500 truncate max-w-[200px]">{r.sender_name_raw}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {isTransfer ? (
                          <>
                            <div>{acc?.code ?? '-'}</div>
                            <div className="font-mono text-slate-500">{r.bank_reference || '-'}</div>
                          </>
                        ) : (
                          <>
                            <div>{col ? `${col.staff_code} · ${col.full_name}` : '-'}</div>
                            <div className="font-mono text-slate-500">{r.receipt_book_no || '-'}</div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-slate-900">
                        {formatIDR(r.customer_gross_amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-teal-800">
                        {formatIDR(r.verified_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <ReceiptStatusLabel status={r.status} />
                        {r.duplicate_flag && (
                          <div className="text-[11px] text-amber-700 font-medium mt-0.5">
                            Tinjau Duplikat
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isTransfer ? (
                          <AccountingDimensionLabel status={r.accounting_status} />
                        ) : (
                          <DepositDimensionLabel status={r.deposit_status} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Menampilkan {paged.length} dari {filtered.length} dokumen
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-2.5 py-1 border border-slate-200 rounded disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span className="font-mono">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 border border-slate-200 rounded disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      {/* Create Receipt Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display font-bold text-base text-slate-900">
                {isTransfer ? 'Catat Penerimaan Transfer Baru' : 'Laporkan Penerimaan Tunai Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800">
                  {formError}
                </div>
              )}

              {duplicatePreview.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Deteksi Transaksi Serupa:</span> Ditemukan{' '}
                    {duplicatePreview.map((d) => d.receipt_number).join(', ')} dengan tanggal, nominal, dan referensi/rekening/hash yang sama. Jika ini pembayaran sah kedua di hari yang sama, dokumen tetap boleh disimpan untuk ditinjau checker.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Cabang</label>
                  <select
                    value={formBranchId}
                    onChange={(e) => setFormBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {dataset.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tanggal Pelanggan Bayar</label>
                  <input
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Customer or explicit Unknown Identity */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                <label className="flex items-center gap-2 font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isUnknownIdentity}
                    onChange={(e) => {
                      setIsUnknownIdentity(e.target.checked);
                      if (e.target.checked) setCustomerId('');
                    }}
                    className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  Identitas pengirim belum diketahui (bukan pelanggan dummy)
                </label>

                {!isUnknownIdentity && (
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Pelanggan (CUST ID)</label>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="">-- Pilih pelanggan --</option>
                      {dataset.customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.cust_id} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Nama Pengirim Asli (Sesuai Mutasi / Kuitansi)
                  </label>
                  <input
                    type="text"
                    value={senderNameRaw}
                    onChange={(e) => setSenderNameRaw(e.target.value)}
                    placeholder="Contoh: BUDI / REKENING PRIBADI PEMILIK TOKO"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* Channel specific */}
              {isTransfer ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Rekening Tujuan Perusahaan</label>
                      <select
                        value={fundAccountId}
                        onChange={(e) => setFundAccountId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        {bankAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Tanggal Nilai Bank (Opsional)</label>
                      <input
                        type="date"
                        value={bankValueDate}
                        onChange={(e) => setBankValueDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Nominal Pelanggan (IDR)</label>
                      <input
                        type="number"
                        min="1"
                        value={grossAmount}
                        onChange={(e) => setGrossAmount(e.target.value)}
                        placeholder="1000000"
                        className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Potongan Biaya Bank</label>
                      <input
                        type="number"
                        min="0"
                        value={feeAmount}
                        onChange={(e) => setFeeAmount(e.target.value)}
                        className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Penanggung Biaya</label>
                      <select
                        value={feeBearer}
                        onChange={(e) => setFeeBearer(e.target.value as BankFeeBearer)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="none">Tidak Ada</option>
                        <option value="pending_review">Review Checker</option>
                        <option value="company">Perusahaan</option>
                        <option value="customer">Pelanggan</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Referensi Bank</label>
                      <input
                        type="text"
                        value={bankReference}
                        onChange={(e) => setBankReference(e.target.value)}
                        placeholder="No. referensi transfer"
                        className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">No. Nota Tujuan (Opsional)</label>
                      <input
                        type="text"
                        value={optionalInvoiceRef}
                        onChange={(e) => setOptionalInvoiceRef(e.target.value)}
                        placeholder="INV-2026-..."
                        className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Nominal Tunai (IDR)</label>
                      <input
                        type="number"
                        min="1"
                        value={grossAmount}
                        onChange={(e) => setGrossAmount(e.target.value)}
                        placeholder="300000"
                        className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Nomor Kuitansi</label>
                      <input
                        type="text"
                        value={receiptBookNo}
                        onChange={(e) => setReceiptBookNo(e.target.value)}
                        placeholder="KWT-00420"
                        className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Penagih Riil (Sales / Sopir Pemegang Uang)
                      </label>
                      <select
                        value={actualCollectorId}
                        onChange={(e) => setActualCollectorId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        {dataset.staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.staff_code} — {s.full_name} ({s.staff_role})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Sales Penanggung Jawab Pelanggan (Jika Berbeda)
                      </label>
                      <select
                        value={salesOwnerId}
                        onChange={(e) => setSalesOwnerId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">Sama dengan penagih riil</option>
                        {dataset.staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.staff_code} — {s.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">No. Nota Tujuan (Opsional)</label>
                      <input
                        type="text"
                        value={optionalInvoiceRef}
                        onChange={(e) => setOptionalInvoiceRef(e.target.value)}
                        placeholder="INV-2026-..."
                        className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Lokasi / Rute Penagihan</label>
                      <input
                        type="text"
                        value={locationNote}
                        onChange={(e) => setLocationNote(e.target.value)}
                        placeholder="Rute pengiriman / toko"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">Bukti Lampiran (JPG/PNG/PDF, di-hash SHA-256)</label>
                <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-600">
                    {evidenceFile ? `${evidenceFile.name} (SHA-256: ${evidenceHash?.slice(0, 12)}...)` : 'Pilih berkas bukti transfer / foto kuitansi'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Catatan</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmitForm(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-lg"
              >
                Simpan Draft
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmitForm(true)}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg"
              >
                {submitting ? 'Menyimpan...' : 'Simpan & Ajukan Verifikasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
