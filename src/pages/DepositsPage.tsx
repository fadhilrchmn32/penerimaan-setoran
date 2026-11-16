import React, { useEffect, useState } from 'react';
import { ArrowRightLeft, CheckCircle2, Plus, Printer, X } from 'lucide-react';
import type {
  AppRoleCode,
  CashDepositRow,
  CollectorCustodyDetailResponse,
} from '../../database.types';
import type { WorkspaceDataset, WorkspaceMode } from '../services/finopsClient';
import { callRpcCustodyDetail } from '../services/finopsClient';
import type { DemoActor, DemoFinOpsEngine } from '../engine/demoEngine';
import { formatDateID, formatIDR, toDecimal, todayISOJakarta } from '../lib/money';
import { CashDepositStatusLabel, InfoTip } from '../components/ui/StatusText';
import { DepositReceiptPrintModal } from '../components/DepositReceiptPrintModal';

interface DepositsPageProps {
  dataset: WorkspaceDataset;
  mode: WorkspaceMode;
  engine: DemoFinOpsEngine;
  demoActor: DemoActor | null;
  actorId: string;
  actorRole: AppRoleCode;
  onCreateDeposit: (params: {
    idempotency_key: string;
    branch_id: string;
    collector_staff_id: string;
    target_type: 'office_cash' | 'bank_direct';
    target_fund_account_id: string;
    deposit_date: string;
    lines: Array<{ receipt_id: string; declared_amount: string }>;
    is_planned_partial: boolean;
    notes?: string;
  }, submitNow: boolean) => Promise<void>;
  onSubmitDeposit: (deposit: CashDepositRow) => Promise<void>;
  onAcceptDeposit: (params: {
    deposit: CashDepositRow;
    received_amount: string;
    bank_statement_line_id?: string | null;
    notes?: string;
  }) => Promise<void>;
  onCreateInternalTransfer: (params: {
    idempotency_key: string;
    branch_id: string;
    transfer_date: string;
    from_fund_account_id: string;
    to_fund_account_id: string;
    amount: string;
    reference_no?: string;
    notes?: string;
  }) => Promise<void>;
  onApproveInternalTransfer: (transferId: string, expectedVersion: number) => Promise<void>;
}

export function DepositsPage({
  dataset,
  mode,
  engine,
  demoActor,
  actorId,
  actorRole,
  onCreateDeposit,
  onSubmitDeposit,
  onAcceptDeposit,
  onCreateInternalTransfer,
  onApproveInternalTransfer,
}: DepositsPageProps) {
  const [activeTab, setActiveTab] = useState<'collector_deposits' | 'internal_transfers'>('collector_deposits');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<CashDepositRow | null>(null);
  const [printTarget, setPrintTarget] = useState<CashDepositRow | null>(null);

  // Create deposit state
  const [collectorId, setCollectorId] = useState(dataset.staff[0]?.id ?? '');
  const [custodyDetail, setCustodyDetail] = useState<CollectorCustodyDetailResponse | null>(null);
  const [selectedLines, setSelectedLines] = useState<Record<string, string>>({});
  const [targetType, setTargetType] = useState<'office_cash' | 'bank_direct'>('office_cash');
  const [targetAccountId, setTargetAccountId] = useState(
    dataset.fundAccounts.find((a) => a.account_type === 'office_cash')?.id ?? ''
  );
  const [depositDate, setDepositDate] = useState(todayISOJakarta());
  const [isPlannedPartial, setIsPlannedPartial] = useState(false);
  const [depositNotes, setDepositNotes] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Accept deposit modal state
  const [receivedAmount, setReceivedAmount] = useState('');
  const [selectedBankLineId, setSelectedBankLineId] = useState('');
  const [acceptNotes, setAcceptNotes] = useState('');
  const [acceptErr, setAcceptErr] = useState<string | null>(null);

  // Internal transfer state
  const [showInternalModal, setShowInternalModal] = useState(false);
  const [fromAccId, setFromAccId] = useState(
    dataset.fundAccounts.find((a) => a.account_type === 'office_cash')?.id ?? ''
  );
  const [toAccId, setToAccId] = useState(
    dataset.fundAccounts.find((a) => a.account_type === 'bank')?.id ?? ''
  );
  const [transferAmount, setTransferAmount] = useState('');
  const [transferRef, setTransferRef] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  const canCreateDeposit = ['finance_maker', 'finance_checker', 'collector_optional'].includes(actorRole);
  const canAcceptDeposit = actorRole === 'finance_checker';

  useEffect(() => {
    if (!showCreateModal || !collectorId) return;
    callRpcCustodyDetail(mode, engine, demoActor, dataset.company.id, collectorId)
      .then((res) => {
        setCustodyDetail(res);
        setSelectedLines({});
      })
      .catch(() => setCustodyDetail(null));
  }, [showCreateModal, collectorId, mode, engine, demoActor, dataset.company.id]);

  const targetAccounts = dataset.fundAccounts.filter((a) =>
    targetType === 'office_cash' ? a.account_type === 'office_cash' : a.account_type === 'bank'
  );

  const totalDeclaredForm = Object.values(selectedLines).reduce(
    (acc, v) => acc.plus(toDecimal(v || '0')),
    toDecimal('0')
  );

  const unmatchedBankLinesForAccept = dataset.bankLines.filter(
    (l) =>
      l.direction === 'credit' &&
      toDecimal(l.amount).minus(toDecimal(l.matched_amount)).gt(0) &&
      (!acceptTarget || l.fund_account_id === acceptTarget.target_fund_account_id)
  );

  async function handleSaveDeposit(submitNow: boolean) {
    setFormErr(null);
    const lines = Object.entries(selectedLines)
      .filter(([, amt]) => toDecimal(amt || '0').gt(0))
      .map(([receipt_id, declared_amount]) => ({
        receipt_id,
        declared_amount: toDecimal(declared_amount).toFixed(2),
      }));

    if (lines.length === 0) {
      setFormErr('Pilih minimal satu sumber penerimaan terverifikasi dengan nominal > 0.');
      return;
    }
    if (!targetAccountId) {
      setFormErr('Pilih rekening/kas tujuan setoran.');
      return;
    }

    const col = dataset.staff.find((s) => s.id === collectorId);
    setBusy(true);
    try {
      await onCreateDeposit(
        {
          idempotency_key: crypto.randomUUID(),
          branch_id: col?.branch_id ?? dataset.branches[0].id,
          collector_staff_id: collectorId,
          target_type: targetType,
          target_fund_account_id: targetAccountId,
          deposit_date: depositDate,
          lines,
          is_planned_partial: isPlannedPartial,
          notes: depositNotes || undefined,
        },
        submitNow
      );
      setShowCreateModal(false);
      setDepositNotes('');
    } catch (err) {
      setFormErr(err instanceof Error ? err.message : 'Gagal membuat setoran.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmAccept() {
    if (!acceptTarget) return;
    setAcceptErr(null);
    setBusy(true);
    try {
      await onAcceptDeposit({
        deposit: acceptTarget,
        received_amount: toDecimal(receivedAmount || '0').toFixed(2),
        bank_statement_line_id: acceptTarget.target_type === 'bank_direct' ? selectedBankLineId || null : null,
        notes: acceptNotes || undefined,
      });
      setAcceptTarget(null);
    } catch (err) {
      setAcceptErr(err instanceof Error ? err.message : 'Gagal menerima setoran.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Setoran Sales/Sopir &amp; Transfer Kas Internal
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Setoran hanya dapat diambil dari saldo custody terverifikasi. Membedakan setoran parsial direncanakan dan kurang setor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'collector_deposits' && canCreateDeposit && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Ajukan Setoran Penagih
            </button>
          )}
          {activeTab === 'internal_transfers' && ['finance_maker', 'finance_checker'].includes(actorRole) && (
            <button
              type="button"
              onClick={() => setShowInternalModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Setor Kas Kantor ke Bank
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('collector_deposits')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'collector_deposits' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          Setoran Penagih ({dataset.deposits.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('internal_transfers')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'internal_transfers' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          Transfer Kas Kantor ke Bank ({dataset.cashTransfers.length})
        </button>
      </div>

      {activeTab === 'collector_deposits' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {dataset.deposits.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm text-slate-500">Belum ada pengajuan setoran penagih.</p>
              {canCreateDeposit && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-teal-700 text-white text-xs font-medium rounded-lg"
                >
                  Buat Setoran Pertama
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">No. Setoran</th>
                    <th className="text-left px-4 py-3 font-semibold">Tgl Setor</th>
                    <th className="text-left px-4 py-3 font-semibold">Penagih</th>
                    <th className="text-left px-4 py-3 font-semibold">Tujuan</th>
                    <th className="text-right px-4 py-3 font-semibold">Dinyatakan</th>
                    <th className="text-right px-4 py-3 font-semibold">Diterima</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-right px-4 py-3 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dataset.deposits.map((d) => {
                    const col = dataset.staff.find((s) => s.id === d.collector_staff_id);
                    const acc = dataset.fundAccounts.find((a) => a.id === d.target_fund_account_id);
                    const isMaker = d.created_by === actorId || d.submitted_by === actorId;
                    return (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                          {d.deposit_number}
                          {d.is_planned_partial && (
                            <span className="block text-[11px] font-sans font-normal text-teal-700">
                              Setoran parsial direncanakan
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-slate-700">
                          {formatDateID(d.deposit_date)}
                        </td>
                        <td className="px-4 py-3 text-slate-800">{col?.full_name ?? '-'}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {d.target_type === 'bank_direct' ? 'Langsung Bank · ' : 'Kas Kantor · '}
                          {acc?.code ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {formatIDR(d.declared_amount)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-teal-800">
                          {formatIDR(d.received_amount)}
                          {toDecimal(d.shortage_amount).gt(0) && (
                            <span className="block text-[11px] text-red-700">
                              Kurang: {formatIDR(d.shortage_amount)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <CashDepositStatusLabel status={d.status} />
                        </td>
                        <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                          {d.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => onSubmitDeposit(d)}
                              className="px-2.5 py-1 bg-slate-900 text-white rounded font-medium"
                            >
                              Ajukan
                            </button>
                          )}
                          {d.status === 'submitted' && canAcceptDeposit && !isMaker && (
                            <button
                              type="button"
                              onClick={() => {
                                setAcceptTarget(d);
                                setReceivedAmount(d.declared_amount);
                                setSelectedBankLineId('');
                                setAcceptErr(null);
                              }}
                              className="px-2.5 py-1 bg-teal-700 text-white rounded font-medium"
                            >
                              Terima &amp; Hitung
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPrintTarget(d)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 rounded text-slate-700 hover:bg-slate-100"
                          >
                            <Printer className="w-3 h-3" />
                            Cetak
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {dataset.cashTransfers.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Belum ada transfer kas kantor ke rekening bank perusahaan.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">No. Transfer</th>
                  <th className="text-left px-4 py-3 font-semibold">Tanggal</th>
                  <th className="text-left px-4 py-3 font-semibold">Dari Kas → Ke Bank</th>
                  <th className="text-right px-4 py-3 font-semibold">Nominal</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-right px-4 py-3 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataset.cashTransfers.map((t) => {
                  const fromAcc = dataset.fundAccounts.find((a) => a.id === t.from_fund_account_id);
                  const toAcc = dataset.fundAccounts.find((a) => a.id === t.to_fund_account_id);
                  return (
                    <tr key={t.id}>
                      <td className="px-4 py-3 font-mono font-semibold">{t.transfer_number}</td>
                      <td className="px-4 py-3 font-mono">{formatDateID(t.transfer_date)}</td>
                      <td className="px-4 py-3">
                        {fromAcc?.name} → {toAcc?.name}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                        {formatIDR(t.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={t.status === 'approved' ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                          {t.status === 'approved' ? 'Disetujui' : 'Menunggu Checker'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {t.status === 'submitted' && canAcceptDeposit && t.created_by !== actorId && (
                          <button
                            type="button"
                            onClick={() => onApproveInternalTransfer(t.id, t.version)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-700 text-white rounded font-medium"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Setujui
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal Create Cash Deposit */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display font-bold text-base text-slate-900">
                Pengajuan Setoran Kas di Penagih
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {formErr && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800">{formErr}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Penagih (Sales / Sopir)</label>
                  <select
                    value={collectorId}
                    onChange={(e) => setCollectorId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {dataset.staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.staff_code} — {s.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tanggal Setor</label>
                  <input
                    type="date"
                    value={depositDate}
                    onChange={(e) => setDepositDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tujuan Setoran</label>
                  <select
                    value={targetType}
                    onChange={(e) => {
                      const nextType = e.target.value as 'office_cash' | 'bank_direct';
                      setTargetType(nextType);
                      const firstMatch = dataset.fundAccounts.find((a) =>
                        nextType === 'office_cash' ? a.account_type === 'office_cash' : a.account_type === 'bank'
                      );
                      setTargetAccountId(firstMatch?.id ?? '');
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="office_cash">Kas Kantor (Tunai Fisik)</option>
                    <option value="bank_direct">Setor Langsung ke Rekening Bank</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Akun Kas / Rekening Tujuan</label>
                  <select
                    value={targetAccountId}
                    onChange={(e) => setTargetAccountId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {targetAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Verified Sources Picker */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center font-semibold text-slate-700">
                  <span>Pilih Sumber Penerimaan Terverifikasi</span>
                  <span className="font-mono">
                    Saldo Custody: {formatIDR(custodyDetail?.custody?.verified_balance ?? '0')}
                  </span>
                </div>
                {!custodyDetail || custodyDetail.sources.length === 0 ? (
                  <div className="p-4 text-slate-500 text-center">
                    Penagih ini tidak memiliki saldo penerimaan tunai terverifikasi. Verifikasi laporan tunai terlebih dahulu.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {custodyDetail.sources.map((src) => (
                      <div key={src.receipt_id} className="p-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-mono font-semibold text-slate-900">{src.receipt_number}</div>
                          <div className="text-slate-500">
                            Tgl Bayar {formatDateID(src.customer_paid_at)} · Sisa: {formatIDR(src.remaining_amount)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedLines((prev) => ({
                                ...prev,
                                [src.receipt_id]: src.remaining_amount,
                              }))
                            }
                            className="px-2 py-1 text-[11px] border border-slate-200 rounded hover:bg-slate-50"
                          >
                            Penuh
                          </button>
                          <input
                            type="number"
                            min="0"
                            max={src.remaining_amount}
                            value={selectedLines[src.receipt_id] ?? ''}
                            onChange={(e) =>
                              setSelectedLines((prev) => ({
                                ...prev,
                                [src.receipt_id]: e.target.value,
                              }))
                            }
                            placeholder="0"
                            className="w-32 px-2.5 py-1.5 text-right font-mono border border-slate-300 rounded-lg"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <label className="flex items-center gap-2 font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPlannedPartial}
                    onChange={(e) => setIsPlannedPartial(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700"
                  />
                  Setoran parsial direncanakan (sisa tetap di penagih tanpa kasus selisih)
                  <InfoTip
                    title="Parsial Direncanakan vs Kurang Setor"
                    body="Jika saldo Rp300.000 dan direncanakan setor Rp250.000 serta diterima Rp250.000, sisa Rp50.000 tetap sah di custody penagih. Kasus kurang setor hanya terbuka jika nominal fisik lebih kecil dari yang dinyatakan."
                  />
                </label>
                <div className="font-mono tabular-nums font-bold text-sm text-teal-800">
                  Total: {formatIDR(totalDeclaredForm)}
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Catatan</label>
                <input
                  type="text"
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleSaveDeposit(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg"
              >
                Simpan Draft
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleSaveDeposit(true)}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg"
              >
                Ajukan Setoran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Checker Accept Deposit */}
      {acceptTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display font-bold text-base text-slate-900">
                Terima &amp; Hitung Fisik — {acceptTarget.deposit_number}
              </h2>
              <button type="button" onClick={() => setAcceptTarget(null)}>
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {acceptErr && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800">{acceptErr}</div>
            )}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between">
              <span className="text-slate-600">Total Dinyatakan Penagih</span>
              <span className="font-mono font-bold text-slate-900">{formatIDR(acceptTarget.declared_amount)}</span>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Nominal Fisik Dihitung / Diterima (IDR)
              </label>
              <input
                type="number"
                min="1"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
              />
              {receivedAmount &&
                toDecimal(receivedAmount).lt(toDecimal(acceptTarget.declared_amount)) && (
                  <p className="mt-1.5 text-red-700 font-medium">
                    Peringatan: Diterima lebih kecil dari dinyatakan. Selisih{' '}
                    {formatIDR(toDecimal(acceptTarget.declared_amount).minus(toDecimal(receivedAmount)))} akan membuka kasus Kurang Setor tanpa menambah piutang pelanggan.
                  </p>
                )}
            </div>

            {acceptTarget.target_type === 'bank_direct' && (
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Pilih Baris Mutasi Bank (Wajib untuk Setoran Langsung Bank)
                </label>
                <select
                  value={selectedBankLineId}
                  onChange={(e) => setSelectedBankLineId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">-- Pilih mutasi kredit rekening tujuan --</option>
                  {unmatchedBankLinesForAccept.map((l) => (
                    <option key={l.id} value={l.id}>
                      {formatDateID(l.value_date)} · {formatIDR(l.amount)} · {l.description}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-medium text-slate-700 mb-1">Catatan Penerimaan</label>
              <input
                type="text"
                value={acceptNotes}
                onChange={(e) => setAcceptNotes(e.target.value)}
                placeholder="Catatan penghitungan kas / selisih"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAcceptTarget(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmAccept}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-lg"
              >
                {busy ? 'Memproses...' : 'Konfirmasi Terima Setoran'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Internal Transfer */}
      {showInternalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display font-bold text-base text-slate-900">
                Setor Kas Kantor ke Rekening Bank
              </h2>
              <button type="button" onClick={() => setShowInternalModal(false)}>
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Dari Kas / Rekening Asal</label>
              <select
                value={fromAccId}
                onChange={(e) => setFromAccId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {dataset.fundAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Ke Rekening Bank Tujuan</label>
              <select
                value={toAccId}
                onChange={(e) => setToAccId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                {dataset.fundAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Nominal (IDR)</label>
              <input
                type="number"
                min="1"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Referensi Slip Setor</label>
              <input
                type="text"
                value={transferRef}
                onChange={(e) => setTransferRef(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowInternalModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onCreateInternalTransfer({
                    idempotency_key: crypto.randomUUID(),
                    branch_id: dataset.branches[0].id,
                    transfer_date: todayISOJakarta(),
                    from_fund_account_id: fromAccId,
                    to_fund_account_id: toAccId,
                    amount: toDecimal(transferAmount || '0').toFixed(2),
                    reference_no: transferRef || undefined,
                    notes: transferNotes || undefined,
                  });
                  setShowInternalModal(false);
                }}
                className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg"
              >
                Simpan &amp; Ajukan
              </button>
            </div>
          </div>
        </div>
      )}

      <DepositReceiptPrintModal
        deposit={printTarget}
        dataset={dataset}
        onClose={() => setPrintTarget(null)}
      />
    </div>
  );
}
