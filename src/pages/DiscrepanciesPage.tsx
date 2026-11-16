import React, { useState } from 'react';
import { CheckCircle2, Search } from 'lucide-react';
import type { AppRoleCode, DiscrepancyCaseType, ReceiptRow } from '../../database.types';
import type { WorkspaceDataset } from '../services/finopsClient';
import { formatDateTimeJakarta, formatIDR } from '../lib/money';
import { DiscrepancyStatusLabel } from '../components/ui/StatusText';

interface DiscrepanciesPageProps {
  dataset: WorkspaceDataset;
  actorRole: AppRoleCode;
  onResolveCase: (caseId: string, note: string) => Promise<void>;
  onSelectReceipt: (r: ReceiptRow) => void;
}

const CASE_LABELS: Record<DiscrepancyCaseType, string> = {
  deposit_shortage: 'Kurang Setor Penagih',
  deposit_excess_unidentified: 'Lebih Setor Tanpa Sumber',
  unknown_sender: 'Identitas Pengirim Belum Diketahui',
  unmatched_bank_line: 'Mutasi Bank Belum Cocok',
  bank_fee_review: 'Review Potongan Biaya Bank',
  duplicate_review: 'Tinjau Indikasi Bukti/Transaksi Ganda',
  missing_evidence: 'Bukti Perlu Dilengkapi',
};

export function DiscrepanciesPage({
  dataset,
  actorRole,
  onResolveCase,
  onSelectReceipt,
}: DiscrepanciesPageProps) {
  const [filterType, setFilterType] = useState<'all' | DiscrepancyCaseType>('all');
  const [search, setSearch] = useState('');
  const [resolveNote, setResolveNote] = useState<Record<string, string>>({});

  const canResolve = ['finance_checker', 'reconciliation_reviewer', 'accounting_approver'].includes(actorRole);

  const items = dataset.discrepancies.filter((d) => {
    if (filterType !== 'all' && d.case_type !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        d.case_number.toLowerCase().includes(q) ||
        (d.resolution_note ?? '').toLowerCase().includes(q) ||
        CASE_LABELS[d.case_type].toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
          Selisih &amp; Tindak Lanjut
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Daftar terbuka kurang setor, pengirim belum diketahui, review biaya bank, indikasi ganda, dan bukti yang perlu dilengkapi.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor kasus atau catatan..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as 'all' | DiscrepancyCaseType)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
        >
          <option value="all">Semua Kategori Kasus</option>
          {Object.entries(CASE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
            Tidak ada kasus selisih atau tindak lanjut yang terbuka.
          </div>
        ) : (
          items.map((dc) => {
            const linkedReceipt =
              dc.source_type === 'receipt'
                ? dataset.receipts.find((r) => r.id === dc.source_id)
                : undefined;
            const isOpen = ['open', 'investigating', 'pending_approval'].includes(dc.status);
            return (
              <div
                key={dc.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-bold text-slate-900">{dc.case_number}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700">{CASE_LABELS[dc.case_type]}</span>
                    <span aria-hidden="true">·</span>
                    <DiscrepancyStatusLabel status={dc.status} />
                    <span aria-hidden="true">·</span>
                    <span>{formatDateTimeJakarta(dc.created_at)}</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {dc.resolution_note || 'Menunggu pemeriksaan dan penyelesaian berizin.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 font-mono tabular-nums">
                    {dc.expected_amount && <span>Diharapkan: {formatIDR(dc.expected_amount)}</span>}
                    {dc.actual_amount && <span>Aktual: {formatIDR(dc.actual_amount)}</span>}
                    <span className="font-bold text-red-700">Selisih: {formatIDR(dc.discrepancy_amount)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {linkedReceipt && (
                    <button
                      type="button"
                      onClick={() => onSelectReceipt(linkedReceipt)}
                      className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      Buka {linkedReceipt.receipt_number}
                    </button>
                  )}
                  {isOpen && canResolve && dc.case_type !== 'unknown_sender' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={resolveNote[dc.id] ?? ''}
                        onChange={(e) =>
                          setResolveNote((prev) => ({ ...prev, [dc.id]: e.target.value }))
                        }
                        placeholder="Keputusan penyelesaian..."
                        className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onResolveCase(dc.id, resolveNote[dc.id] || 'Diselesaikan oleh checker berizin')
                        }
                        className="inline-flex items-center gap-1 px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Selesaikan
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
