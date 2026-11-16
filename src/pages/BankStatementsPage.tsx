import React, { useMemo, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Link2, Upload } from 'lucide-react';
import type { AppRoleCode, BankMatchRow } from '../../database.types';
import type { WorkspaceDataset } from '../services/finopsClient';
import {
  type BankColumnMapping,
  type ParsedStatementRow,
  inferDefaultMapping,
  normalizeBankRows,
  readBankStatementFile,
} from '../lib/bankParser';
import { formatDateID, formatIDR, toDecimal } from '../lib/money';

interface BankStatementsPageProps {
  dataset: WorkspaceDataset;
  actorId: string;
  actorRole: AppRoleCode;
  onImportCommit: (params: {
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
    rows: ParsedStatementRow[];
  }) => Promise<void>;
  onProposeMatch: (params: {
    idempotency_key: string;
    items: Array<{
      bank_statement_line_id: string;
      target_type: BankMatchRow['target_type'];
      target_id: string;
      matched_amount: string;
    }>;
    notes?: string;
  }) => Promise<void>;
  onApproveMatch: (matchGroupId: string) => Promise<void>;
}

export function BankStatementsPage({
  dataset,
  actorId,
  actorRole,
  onImportCommit,
  onProposeMatch,
  onApproveMatch,
}: BankStatementsPageProps) {
  const [tab, setTab] = useState<'lines' | 'import'>('lines');
  const bankAccounts = dataset.fundAccounts.filter((a) => a.account_type === 'bank');
  const [selectedAccountId, setSelectedAccountId] = useState(bankAccounts[0]?.id ?? '');
  const [dirFilter, setDirFilter] = useState<'all' | 'credit' | 'debit'>('all');

  // Staging Importer state
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileHash, setFileHash] = useState('');
  const [mapping, setMapping] = useState<BankColumnMapping | null>(null);
  const [stagedRows, setStagedRows] = useState<ParsedStatementRow[]>([]);
  const [openingBal, setOpeningBal] = useState('');
  const [closingBal, setClosingBal] = useState('');
  const [importErr, setImportErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Match group builder state (1:1, 1:N, N:1)
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [targetType, setTargetType] = useState<BankMatchRow['target_type']>('receipt');
  const [targetId, setTargetId] = useState('');
  const [matchNote, setMatchNote] = useState('');
  const [matchErr, setMatchErr] = useState<string | null>(null);

  const canImport = ['finance_maker', 'finance_checker', 'accountant'].includes(actorRole);
  const canProposeMatch = ['finance_maker', 'finance_checker', 'reconciliation_reviewer'].includes(actorRole);
  const canApproveMatch = ['finance_checker', 'reconciliation_reviewer'].includes(actorRole);

  const visibleLines = useMemo(() => {
    return dataset.bankLines.filter((l) => {
      if (selectedAccountId && l.fund_account_id !== selectedAccountId) return false;
      if (dirFilter !== 'all' && l.direction !== dirFilter) return false;
      return true;
    });
  }, [dataset.bankLines, selectedAccountId, dirFilter]);

  const proposedGroups = useMemo(() => {
    const groups: Record<string, BankMatchRow[]> = {};
    for (const m of dataset.bankMatches) {
      if (m.status === 'proposed') {
        groups[m.match_group_id] = groups[m.match_group_id] ?? [];
        groups[m.match_group_id].push(m);
      }
    }
    return Object.entries(groups);
  }, [dataset.bankMatches]);

  async function handleFileUpload(file: File | null) {
    if (!file) return;
    setImportErr(null);
    try {
      const parsed = await readBankStatementFile(file);
      setRawHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setFileName(file.name);
      setFileHash(parsed.fileHash);
      const inferred = inferDefaultMapping(parsed.headers);
      setMapping(inferred);
      const normalized = await normalizeBankRows(selectedAccountId, parsed.rows, inferred);
      setStagedRows(normalized);
    } catch (err) {
      setImportErr(err instanceof Error ? err.message : 'Gagal membaca berkas mutasi.');
    }
  }

  async function refreshPreview(nextMapping: BankColumnMapping) {
    setMapping(nextMapping);
    const normalized = await normalizeBankRows(selectedAccountId, rawRows, nextMapping);
    setStagedRows(normalized);
  }

  async function handleCommitImport() {
    if (!mapping || stagedRows.length === 0) return;
    const hasError = stagedRows.some((r) => r.validation_error);
    if (hasError) {
      setImportErr('Masih ada baris dengan error format tanggal/nominal. Perbaiki mapping terlebih dahulu.');
      return;
    }
    setBusy(true);
    setImportErr(null);
    try {
      const dates = stagedRows.map((r) => r.value_date).sort();
      await onImportCommit({
        idempotency_key: crypto.randomUUID(),
        fund_account_id: selectedAccountId,
        file_name: fileName,
        file_hash: fileHash,
        period_start: dates[0],
        period_end: dates[dates.length - 1],
        date_format: mapping.dateFormat,
        decimal_format: mapping.decimalFormat,
        opening_balance: openingBal ? toDecimal(openingBal).toFixed(2) : null,
        closing_balance: closingBal ? toDecimal(closingBal).toFixed(2) : null,
        rows: stagedRows,
      });
      setRawRows([]);
      setStagedRows([]);
      setMapping(null);
      setTab('lines');
    } catch (err) {
      setImportErr(err instanceof Error ? err.message : 'Gagal mengimpor mutasi.');
    } finally {
      setBusy(false);
    }
  }

  const candidateTargets = useMemo(() => {
    if (targetType === 'receipt') {
      return dataset.receipts
        .filter((r) => r.receipt_channel === 'bank_transfer' && r.status !== 'rejected')
        .map((r) => ({
          id: r.id,
          label: `${r.receipt_number} · ${formatIDR(r.customer_gross_amount)} · ${r.sender_name_raw ?? '-'}`,
          amount: r.bank_net_amount,
        }));
    }
    if (targetType === 'cash_deposit') {
      return dataset.deposits
        .filter((d) => d.target_type === 'bank_direct')
        .map((d) => ({
          id: d.id,
          label: `${d.deposit_number} · ${formatIDR(d.declared_amount)}`,
          amount: d.declared_amount,
        }));
    }
    return dataset.cashTransfers.map((t) => ({
      id: t.id,
      label: `${t.transfer_number} · ${formatIDR(t.amount)}`,
      amount: t.amount,
    }));
  }, [targetType, dataset]);

  async function handleProposeGroupMatch() {
    setMatchErr(null);
    if (selectedLineIds.length === 0 || !targetId) {
      setMatchErr('Pilih minimal satu baris mutasi bank dan satu dokumen target.');
      return;
    }
    const items = selectedLineIds.map((lineId) => {
      const bl = dataset.bankLines.find((l) => l.id === lineId)!;
      const avail = toDecimal(bl.amount).minus(toDecimal(bl.matched_amount));
      return {
        bank_statement_line_id: lineId,
        target_type: targetType,
        target_id: targetId,
        matched_amount: avail.toFixed(2),
      };
    });
    setBusy(true);
    try {
      await onProposeMatch({
        idempotency_key: crypto.randomUUID(),
        items,
        notes: matchNote || undefined,
      });
      setSelectedLineIds([]);
      setMatchNote('');
    } catch (err) {
      setMatchErr(err instanceof Error ? err.message : 'Gagal mengusulkan match.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Mutasi Bank &amp; Pencocokan Terkontrol
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Impor CSV/XLSX dengan staging, deteksi duplikat fingerprint, dan pencocokan 1:1, 1:N, atau N:1 tanpa menggunakan mutasi yang sama dua kali.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setTab('lines')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md ${
              tab === 'lines' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Baris Mutasi &amp; Match ({visibleLines.length})
          </button>
          {canImport && (
            <button
              type="button"
              onClick={() => setTab('import')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 ${
                tab === 'import' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Impor CSV/XLSX (Staging)
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
          >
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
          {tab === 'lines' && (
            <select
              value={dirFilter}
              onChange={(e) => setDirFilter(e.target.value as 'all' | 'credit' | 'debit')}
              className="px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="all">Semua Arah (Debit &amp; Kredit)</option>
              <option value="credit">Hanya Kredit (Masuk)</option>
              <option value="debit">Hanya Debit (Keluar)</option>
            </select>
          )}
        </div>
      </div>

      {tab === 'lines' ? (
        <div className="space-y-6">
          {/* Controlled Match Workbench */}
          {canProposeMatch && selectedLineIds.length > 0 && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3 text-xs">
              <div className="font-semibold text-teal-900 flex items-center gap-1.5">
                <Link2 className="w-4 h-4" />
                Buat Grup Pencocokan Mutasi ({selectedLineIds.length} baris dipilih)
              </div>
              {matchErr && <div className="text-red-700 font-medium">{matchErr}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={targetType}
                  onChange={(e) => {
                    setTargetType(e.target.value as BankMatchRow['target_type']);
                    setTargetId('');
                  }}
                  className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="receipt">Penerimaan Pelanggan (Receipt)</option>
                  <option value="cash_deposit">Setoran Langsung Penagih</option>
                  <option value="cash_transfer">Transfer Kas Internal</option>
                </select>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">-- Pilih dokumen target --</option>
                  {candidateTargets.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={matchNote}
                  onChange={(e) => setMatchNote(e.target.value)}
                  placeholder="Catatan pencocokan"
                  className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLineIds([])}
                  className="px-3 py-1.5 border border-slate-300 bg-white rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleProposeGroupMatch}
                  className="px-4 py-1.5 bg-teal-700 text-white font-semibold rounded-lg"
                >
                  Usulkan Match Group
                </button>
              </div>
            </div>
          )}

          {/* Proposed Match Groups waiting for Checker */}
          {proposedGroups.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
              <div className="font-semibold text-slate-900">Usulan Pencocokan Menunggu Persetujuan Checker</div>
              {proposedGroups.map(([groupId, items]) => {
                const total = items.reduce((a, i) => a.plus(toDecimal(i.matched_amount)), toDecimal('0'));
                const isProposer = items.some((i) => i.proposed_by === actorId);
                return (
                  <div key={groupId} className="flex items-center justify-between py-2 border-t border-slate-100">
                    <div>
                      <span className="font-mono font-medium">{groupId.slice(0, 8)}</span> · {items.length} baris · Target{' '}
                      <span className="font-mono">{items[0].target_type}</span> · Total {formatIDR(total)}
                    </div>
                    {canApproveMatch && !isProposer && (
                      <button
                        type="button"
                        onClick={() => onApproveMatch(groupId)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-teal-700 text-white rounded-lg font-medium"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Setujui Match
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Statement Lines Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-3 text-center w-10">Pilih</th>
                    <th className="text-left px-4 py-3 font-semibold">Tgl Valuta</th>
                    <th className="text-left px-4 py-3 font-semibold">Referensi &amp; Keterangan</th>
                    <th className="text-left px-4 py-3 font-semibold">Arah</th>
                    <th className="text-right px-4 py-3 font-semibold">Nominal</th>
                    <th className="text-right px-4 py-3 font-semibold">Saldo Statement</th>
                    <th className="text-left px-4 py-3 font-semibold">Status Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleLines.map((l) => {
                    const avail = toDecimal(l.amount).minus(toDecimal(l.matched_amount));
                    const checked = selectedLineIds.includes(l.id);
                    return (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 text-center">
                          {avail.gt(0) && (
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedLineIds((prev) =>
                                  e.target.checked ? [...prev, l.id] : prev.filter((x) => x !== l.id)
                                );
                              }}
                              className="rounded border-slate-300 text-teal-700"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-slate-700">
                          <div>{formatDateID(l.value_date)}</div>
                          <div className="text-[11px] text-slate-400">Post: {formatDateID(l.posting_date)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{l.description}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {l.bank_reference || '-'} {l.external_txn_id ? `· ID: ${l.external_txn_id}` : ''}
                          </div>
                          {l.is_duplicate_suspect && (
                            <div className="text-[11px] text-amber-700 font-medium">
                              Potensi duplikat — {l.duplicate_note}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={l.direction === 'credit' ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
                            {l.direction === 'credit' ? 'Kredit (+)' : 'Debit (-)'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatIDR(l.amount)}
                          {toDecimal(l.matched_amount).gt(0) && (
                            <span className="block text-[11px] text-slate-500">
                              Terpakai: {formatIDR(l.matched_amount)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                          {l.running_balance ? formatIDR(l.running_balance) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-medium ${
                              l.match_status === 'matched'
                                ? 'text-emerald-700'
                                : l.match_status === 'proposed'
                                ? 'text-teal-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {l.match_status === 'matched'
                              ? 'Cocok Penuh'
                              : l.match_status === 'proposed'
                              ? 'Diusulkan'
                              : 'Belum Cocok'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Staging CSV/XLSX Importer */
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 text-xs">
          {importErr && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800">{importErr}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Unggah Berkas Rekening Koran (CSV / XLSX)</label>
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                <FileSpreadsheet className="w-4 h-4 text-teal-700" />
                <span className="truncate">{fileName || 'Pilih berkas .csv atau .xlsx'}</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => handleFileUpload(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Saldo Awal Statement (Opsional)</label>
              <input
                type="number"
                value={openingBal}
                onChange={(e) => setOpeningBal(e.target.value)}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Saldo Akhir Statement (Opsional)</label>
              <input
                type="number"
                value={closingBal}
                onChange={(e) => setClosingBal(e.target.value)}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {mapping && (
            <>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Format Tanggal</label>
                  <select
                    value={mapping.dateFormat}
                    onChange={(e) =>
                      refreshPreview({
                        ...mapping,
                        dateFormat: e.target.value as BankColumnMapping['dateFormat'],
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="dd/MM/yyyy">dd/MM/yyyy</option>
                    <option value="yyyy-MM-dd">yyyy-MM-dd</option>
                    <option value="MM/dd/yyyy">MM/dd/yyyy</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Format Desimal</label>
                  <select
                    value={mapping.decimalFormat}
                    onChange={(e) =>
                      refreshPreview({
                        ...mapping,
                        decimalFormat: e.target.value as BankColumnMapping['decimalFormat'],
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="id">Indonesia (1.000.000,00)</option>
                    <option value="us">Internasional (1,000,000.00)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kolom Tanggal Valuta</label>
                  <select
                    value={mapping.valueDateCol}
                    onChange={(e) => refreshPreview({ ...mapping, valueDateCol: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  >
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kolom Keterangan</label>
                  <select
                    value={mapping.descriptionCol}
                    onChange={(e) => refreshPreview({ ...mapping, descriptionCol: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  >
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Mode Debit/Kredit</label>
                  <select
                    value={mapping.directionMode}
                    onChange={(e) =>
                      refreshPreview({
                        ...mapping,
                        directionMode: e.target.value as BankColumnMapping['directionMode'],
                      })
                    }
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="split_debit_credit">Kolom Debit &amp; Kredit Terpisah</option>
                    <option value="signed_amount">Satu Kolom Nominal (+/-)</option>
                    <option value="amount_plus_type_col">Nominal + Kolom Tipe (CR/DB)</option>
                  </select>
                </div>
                {mapping.directionMode === 'split_debit_credit' ? (
                  <>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Kolom Kredit</label>
                      <select
                        value={mapping.creditCol}
                        onChange={(e) => refreshPreview({ ...mapping, creditCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      >
                        <option value="">--</option>
                        {rawHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Kolom Debit</label>
                      <select
                        value={mapping.debitCol}
                        onChange={(e) => refreshPreview({ ...mapping, debitCol: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      >
                        <option value="">--</option>
                        {rawHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Kolom Nominal</label>
                    <select
                      value={mapping.signedAmountCol}
                      onChange={(e) => refreshPreview({ ...mapping, signedAmountCol: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                    >
                      {rawHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Staging Preview Table */}
              <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-80">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Baris</th>
                      <th className="px-3 py-2 text-left">Valuta</th>
                      <th className="px-3 py-2 text-left">Arah</th>
                      <th className="px-3 py-2 text-right">Nominal</th>
                      <th className="px-3 py-2 text-left">Keterangan</th>
                      <th className="px-3 py-2 text-left">Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stagedRows.slice(0, 50).map((r) => (
                      <tr key={r.row_number} className={r.validation_error ? 'bg-red-50/70' : ''}>
                        <td className="px-3 py-2 font-mono">{r.row_number}</td>
                        <td className="px-3 py-2 font-mono">{r.value_date}</td>
                        <td className="px-3 py-2">{r.direction === 'credit' ? 'Kredit' : 'Debit'}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{formatIDR(r.amount)}</td>
                        <td className="px-3 py-2">{r.description}</td>
                        <td className="px-3 py-2">
                          {r.validation_error ? (
                            <span className="text-red-700 font-medium">{r.validation_error}</span>
                          ) : (
                            <span className="text-emerald-700">Valid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCommitImport}
                  className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-lg"
                >
                  {busy ? 'Mengimpor...' : `Commit Impor (${stagedRows.length} Baris)`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
