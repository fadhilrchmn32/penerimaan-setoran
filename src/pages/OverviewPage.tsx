import React from 'react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import type {
  CollectionDashboardResponse,
  ReceiptRow,
} from '../../database.types';
import type { WorkspaceDataset } from '../services/finopsClient';
import { formatDateID, formatIDR, toDecimal } from '../lib/money';
import {
  AccountingDimensionLabel,
  CashDepositStatusLabel,
  InfoTip,
  ReceiptStatusLabel,
} from '../components/ui/StatusText';

interface OverviewPageProps {
  dashboard: CollectionDashboardResponse | null;
  loading: boolean;
  dataset: WorkspaceDataset;
  lastSyncedAt: string;
  onRefresh: () => void;
  onNavigate: (tab: string) => void;
  onSelectReceipt: (r: ReceiptRow) => void;
}

export function OverviewPage({
  dashboard,
  loading,
  dataset,
  lastSyncedAt,
  onRefresh,
  onNavigate,
  onSelectReceipt,
}: OverviewPageProps) {
  const kpis = [
    {
      label: 'Transfer Menunggu Verifikasi',
      bucket: dashboard?.transfer_waiting_verification,
      accent: 'text-amber-700',
      nav: 'transfers',
      tip: 'Transfer yang sudah dilaporkan namun belum dicocokkan mutasi bank oleh checker.',
    },
    {
      label: 'Tunai Dilaporkan (Belum Sah)',
      bucket: dashboard?.cash_reported,
      accent: 'text-amber-700',
      nav: 'cash_receipts',
      tip: 'Laporan uang tunai pelanggan yang belum diverifikasi bukti kuitansinya. Belum menambah saldo kas sah.',
    },
    {
      label: 'Kas Terverifikasi di Penagih',
      bucket: dashboard?.collector_verified_cash,
      accent: 'text-teal-800',
      nav: 'custody',
      tip: 'Uang tunai pelanggan yang telah diverifikasi berada dalam penguasaan sales/sopir dan siap disetor ke kantor/bank.',
    },
    {
      label: 'Setoran Diajukan',
      bucket: dashboard?.deposit_submitted,
      accent: 'text-amber-700',
      nav: 'deposits',
      tip: 'Pengajuan setoran dari penagih yang menunggu penghitungan dan penerimaan oleh checker keuangan.',
    },
    {
      label: 'Setoran Diterima',
      bucket: dashboard?.deposit_accepted,
      accent: 'text-emerald-700',
      nav: 'deposits',
      tip: 'Nominal fisik setoran yang telah diterima ke Kas Kantor atau Bank pada periode terpilih.',
    },
    {
      label: 'Selisih Terbuka',
      bucket: dashboard?.open_discrepancies,
      accent: 'text-red-700',
      nav: 'discrepancies',
      tip: 'Kasus kurang setor, pengirim belum diketahui, potongan biaya bank, atau indikasi bukti ganda yang belum selesai.',
    },
    {
      label: 'Dana Belum Dialokasikan',
      bucket: dashboard?.unallocated_funds,
      accent: 'text-slate-900',
      nav: 'history',
      tip: 'Dana terverifikasi (Titipan Pelanggan / Belum Teridentifikasi) yang siap dicocokkan ke nota di App 2.',
    },
  ];

  const pendingReceipts = dataset.receipts
    .filter((r) => ['draft', 'submitted', 'waiting_verification'].includes(r.status))
    .slice(0, 6);

  const pendingDeposits = dataset.deposits.filter((d) => d.status === 'submitted').slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Ringkasan Penerimaan &amp; Setoran
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Pemantauan posisi dana terverifikasi, penguasaan kas penagih, setoran, dan kesiapan handoff ke Penjualan &amp; Akuntansi.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Diperbarui {lastSyncedAt}</span>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Segarkan
          </button>
        </div>
      </div>

      {/* 7 KPI Grid — Memisahkan Nilai Transaksi & Jumlah Dokumen */}
      <section aria-label="Indikator Utama" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onNavigate(item.nav)}
            className="text-left bg-white border border-slate-200 hover:border-teal-600/50 rounded-xl p-5 transition-colors flex flex-col justify-between gap-3"
          >
            <div className="flex items-start justify-between gap-2 text-xs font-medium text-slate-600">
              <span>
                {item.label}
                <InfoTip title={item.label} body={item.tip} />
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </div>
            <div>
              <div className={`font-mono tabular-nums text-xl font-bold ${item.accent}`}>
                {loading && !dashboard ? '...' : formatIDR(item.bucket?.amount ?? '0')}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                {loading && !dashboard ? '...' : `${item.bucket?.count ?? 0} dokumen`}
              </div>
            </div>
          </button>
        ))}
      </section>

      {/* Split Operational View: Collector Cash Balances + Verification Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Verification Queue */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-display font-semibold text-base text-slate-900">
              Antrian Verifikasi &amp; Draft Terbaru
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('transfers')}
              className="text-xs font-medium text-teal-700 hover:underline"
            >
              Lihat Semua
            </button>
          </div>
          {pendingReceipts.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Tidak ada penerimaan yang menunggu verifikasi pada periode ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Nomor &amp; Kanal</th>
                    <th className="text-left px-4 py-3 font-semibold">Pelanggan</th>
                    <th className="text-left px-4 py-3 font-semibold">Tgl Bayar</th>
                    <th className="text-right px-4 py-3 font-semibold">Nominal</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingReceipts.map((r) => {
                    const cust = dataset.customers.find((c) => c.id === r.customer_id);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => onSelectReceipt(r)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono font-medium text-slate-900">{r.receipt_number}</div>
                          <div className="text-slate-500">
                            {r.receipt_channel === 'bank_transfer' ? 'Transfer' : 'Tunai'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {r.is_unknown_identity
                            ? 'Belum Diketahui'
                            : cust
                            ? `${cust.cust_id} · ${cust.name}`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-slate-600">
                          {formatDateID(r.customer_paid_at)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatIDR(r.customer_gross_amount)}
                        </td>
                        <td className="px-4 py-3">
                          <ReceiptStatusLabel status={r.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Collector Verified Cash Breakdown & Submitted Deposits */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-display font-semibold text-base text-slate-900">
                Kas Terverifikasi per Penagih
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('custody')}
                className="text-xs font-medium text-teal-700 hover:underline"
              >
                Rincian
              </button>
            </div>
            {dataset.custodyAccounts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Belum ada saldo kas di penagih.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {dataset.custodyAccounts.map((c) => {
                  const person = dataset.staff.find((s) => s.id === c.collector_staff_id);
                  return (
                    <div key={c.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {person?.full_name ?? c.collector_staff_id}
                        </div>
                        <div className="text-xs text-slate-500">
                          {person?.staff_code} · Dilaporkan belum sah: {formatIDR(c.unverified_reported_balance)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-mono tabular-nums text-sm font-bold ${
                            toDecimal(c.verified_balance).gt(0) ? 'text-teal-800' : 'text-slate-400'
                          }`}
                        >
                          {formatIDR(c.verified_balance)}
                        </div>
                        <div className="text-[11px] text-slate-500">Siap setor</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-display font-semibold text-base text-slate-900">
                Setoran Diajukan &amp; Outbox Akuntansi
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('deposits')}
                className="text-xs font-medium text-teal-700 hover:underline"
              >
                Kelola Setoran
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              {pendingDeposits.length === 0 ? (
                <p className="text-slate-500">Tidak ada setoran penagih yang menunggu penerimaan checker.</p>
              ) : (
                pendingDeposits.map((d) => {
                  const col = dataset.staff.find((s) => s.id === d.collector_staff_id);
                  return (
                    <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-slate-100">
                      <div>
                        <div className="font-mono font-medium text-slate-900">{d.deposit_number}</div>
                        <div className="text-slate-500">{col?.full_name} · {formatDateID(d.deposit_date)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono tabular-nums font-semibold">{formatIDR(d.declared_amount)}</div>
                        <CashDepositStatusLabel status={d.status} />
                      </div>
                    </div>
                  );
                })
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-600">
                <span>Event Akuntansi Menunggu App 3</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {dataset.accountingEvents.filter((e) => e.processing_status === 'waiting_accounting_module').length} event
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Status Mesin Pembukuan</span>
                <AccountingDimensionLabel
                  status={dataset.accountingEvents.length > 0 ? 'queued' : 'not_ready'}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
