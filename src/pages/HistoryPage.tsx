import React, { useState } from 'react';
import { Download } from 'lucide-react';
import type { AppRoleCode, ReceiptRow } from '../../database.types';
import type { WorkspaceDataset } from '../services/finopsClient';
import { formatDateID, formatDateTimeJakarta, formatIDR } from '../lib/money';
import {
  AccountingDimensionLabel,
  CashDepositStatusLabel,
  ReceiptStatusLabel,
} from '../components/ui/StatusText';

interface HistoryPageProps {
  dataset: WorkspaceDataset;
  actorRole: AppRoleCode;
  onSelectReceipt: (r: ReceiptRow) => void;
}

export function HistoryPage({ dataset, actorRole, onSelectReceipt }: HistoryPageProps) {
  const [tab, setTab] = useState<'receipts' | 'deposits' | 'accounting_events' | 'audit'>('receipts');

  const canExport = actorRole !== 'collector_optional';

  function handleExportCsv() {
    const label = dataset.appSettings.reconciliation_label || 'REKONSILIASI (ALMIRA)';
    const header = [
      'Penanggung Jawab Label',
      'Nomor Dokumen',
      'Kanal',
      'Tanggal Pelanggan Bayar',
      'Tanggal Nilai Bank',
      'CUST ID',
      'Nama Pelanggan',
      'Nominal Pelanggan (IDR)',
      'Biaya Bank (IDR)',
      'Terverifikasi (IDR)',
      'Status Verifikasi',
      'Status Setoran',
      'Status Rekonsiliasi',
      'Status Jurnal',
    ];
    const rows = dataset.receipts.map((r) => {
      const cust = dataset.customers.find((c) => c.id === r.customer_id);
      return [
        label,
        r.receipt_number,
        r.receipt_channel,
        r.customer_paid_at,
        r.bank_value_date ?? '',
        cust?.cust_id ?? (r.is_unknown_identity ? 'BELUM_DIKETAHUI' : ''),
        cust?.name ?? r.sender_name_raw ?? '',
        r.customer_gross_amount,
        r.bank_fee_amount,
        r.verified_amount,
        r.status,
        r.deposit_status,
        r.reconciliation_status,
        r.accounting_status,
      ];
    });
    const csvContent =
      '\uFEFF' +
      [header, ...rows]
        .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `riwayat_penerimaan_${dataset.company.code}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Riwayat, Audit &amp; Status Kiriman App 2/3
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Penelusuran seluruh dokumen penerimaan, setoran, event outbox ke Akuntansi (App 3), serta jejak audit append-only.
          </p>
        </div>
        {canExport && (
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg"
          >
            <Download className="w-4 h-4" />
            Ekspor CSV ({dataset.appSettings.reconciliation_label})
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        {[
          { id: 'receipts', label: `Penerimaan (${dataset.receipts.length})` },
          { id: 'deposits', label: `Setoran (${dataset.deposits.length})` },
          { id: 'accounting_events', label: `Outbox Event App 3 (${dataset.accountingEvents.length})` },
          { id: 'audit', label: `Jejak Audit (${dataset.auditEvents.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {tab === 'receipts' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Nomor</th>
                  <th className="text-left px-4 py-3 font-semibold">Kanal</th>
                  <th className="text-left px-4 py-3 font-semibold">Tgl Bayar</th>
                  <th className="text-right px-4 py-3 font-semibold">Nominal</th>
                  <th className="text-left px-4 py-3 font-semibold">Verifikasi</th>
                  <th className="text-left px-4 py-3 font-semibold">Status Jurnal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataset.receipts.map((r) => (
                  <tr key={r.id} onClick={() => onSelectReceipt(r)} className="hover:bg-slate-50 cursor-pointer">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{r.receipt_number}</td>
                    <td className="px-4 py-3">{r.receipt_channel === 'bank_transfer' ? 'Transfer' : 'Tunai'}</td>
                    <td className="px-4 py-3 font-mono">{formatDateID(r.customer_paid_at)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">{formatIDR(r.customer_gross_amount)}</td>
                    <td className="px-4 py-3"><ReceiptStatusLabel status={r.status} /></td>
                    <td className="px-4 py-3"><AccountingDimensionLabel status={r.accounting_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'deposits' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">No. Setoran</th>
                  <th className="text-left px-4 py-3 font-semibold">Tanggal</th>
                  <th className="text-right px-4 py-3 font-semibold">Dinyatakan</th>
                  <th className="text-right px-4 py-3 font-semibold">Diterima</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Status Jurnal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataset.deposits.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 font-mono font-semibold">{d.deposit_number}</td>
                    <td className="px-4 py-3 font-mono">{formatDateID(d.deposit_date)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatIDR(d.declared_amount)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">{formatIDR(d.received_amount)}</td>
                    <td className="px-4 py-3"><CashDepositStatusLabel status={d.status} /></td>
                    <td className="px-4 py-3"><AccountingDimensionLabel status={d.accounting_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'accounting_events' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Waktu</th>
                  <th className="text-left px-4 py-3 font-semibold">Event Type</th>
                  <th className="text-left px-4 py-3 font-semibold">Sumber</th>
                  <th className="text-left px-4 py-3 font-semibold">Tgl Efektif</th>
                  <th className="text-left px-4 py-3 font-semibold">Status Pemrosesan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataset.accountingEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td className="px-4 py-3 font-mono text-slate-600">{formatDateTimeJakarta(ev.created_at)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{ev.event_type}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{ev.source_type} (v{ev.source_version})</td>
                    <td className="px-4 py-3 font-mono">{formatDateID(ev.effective_date)}</td>
                    <td className="px-4 py-3">
                      <span className="text-amber-700 font-medium">
                        {ev.processing_status === 'waiting_accounting_module'
                          ? 'Menunggu modul akuntansi (App 3)'
                          : ev.processing_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Waktu</th>
                  <th className="text-left px-4 py-3 font-semibold">Aktor</th>
                  <th className="text-left px-4 py-3 font-semibold">Aksi</th>
                  <th className="text-left px-4 py-3 font-semibold">Entitas</th>
                  <th className="text-left px-4 py-3 font-semibold">Alasan / Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataset.auditEvents.map((au) => {
                  const actor = dataset.profiles.find((p) => p.id === au.actor_id);
                  return (
                    <tr key={au.id}>
                      <td className="px-4 py-3 font-mono text-slate-600">{formatDateTimeJakarta(au.created_at)}</td>
                      <td className="px-4 py-3 text-slate-800">{actor?.full_name ?? au.actor_id ?? '-'}</td>
                      <td className="px-4 py-3 font-mono font-medium text-slate-900">{au.event_action}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{au.entity_type}</td>
                      <td className="px-4 py-3 text-slate-600">{au.reason ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
