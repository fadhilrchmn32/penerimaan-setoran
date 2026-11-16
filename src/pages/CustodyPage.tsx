import React, { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import type { CollectorCustodyDetailResponse } from '../../database.types';
import type { WorkspaceDataset, WorkspaceMode } from '../services/finopsClient';
import { callRpcCustodyDetail } from '../services/finopsClient';
import type { DemoActor, DemoFinOpsEngine } from '../engine/demoEngine';
import { formatDateID, formatDateTimeJakarta, formatIDR } from '../lib/money';
import { InfoTip } from '../components/ui/StatusText';

interface CustodyPageProps {
  dataset: WorkspaceDataset;
  mode: WorkspaceMode;
  engine: DemoFinOpsEngine;
  demoActor: DemoActor | null;
}

export function CustodyPage({ dataset, mode, engine, demoActor }: CustodyPageProps) {
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    dataset.custodyAccounts[0]?.collector_staff_id ?? dataset.staff[0]?.id ?? ''
  );
  const [detail, setDetail] = useState<CollectorCustodyDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedStaffId) return;
    let active = true;
    callRpcCustodyDetail(mode, engine, demoActor, dataset.company.id, selectedStaffId)
      .then((res) => {
        if (active) {
          setDetail(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Gagal memuat saldo penagih.');
      });
    return () => {
      active = false;
    };
  }, [selectedStaffId, mode, engine, demoActor, dataset.company.id, dataset.custodyAccounts]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
          Saldo Kas di Penagih
          <InfoTip
            title="Kas di Penagih (Akun 1102)"
            body="Mencatat uang tunai pelanggan yang sudah diverifikasi berada di tangan sales/sopir. Saldo ini baru berkurang saat setoran diterima oleh kasir kantor atau cocok dengan mutasi bank."
          />
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Rincian sumber penerimaan terverifikasi yang belum disetor dan mutasi keluar-masuk per petugas.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Collector list */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {dataset.staff.map((st) => {
            const cust = dataset.custodyAccounts.find((c) => c.collector_staff_id === st.id);
            const active = selectedStaffId === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStaffId(st.id)}
                className={`w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 transition-colors ${
                  active ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">{st.full_name}</div>
                  <div className="text-xs text-slate-500">
                    {st.staff_code} · {st.staff_role}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono tabular-nums text-sm font-bold text-teal-800">
                    {formatIDR(cust?.verified_balance ?? '0')}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Dilaporkan: {formatIDR(cust?.unverified_reported_balance ?? '0')}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Collector Detail */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500">Saldo Terverifikasi Siap Setor</div>
                <div className="font-mono tabular-nums text-2xl font-bold text-slate-900">
                  {formatIDR(detail?.custody?.verified_balance ?? '0')}
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-slate-600">
              <div>Dilaporkan (Belum Diverifikasi Checker)</div>
              <div className="font-mono tabular-nums font-semibold text-amber-700 text-sm">
                {formatIDR(detail?.custody?.unverified_reported_balance ?? '0')}
              </div>
            </div>
          </div>

          {/* Itemized Verified Sources */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 font-display font-semibold text-sm text-slate-900">
              Rincian Sumber Penerimaan Belum Disetor Penuh
            </div>
            {!detail || detail.sources.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Tidak ada sisa sumber penerimaan tunai yang belum disetor.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">No. Penerimaan</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Pelanggan</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Tgl Bayar</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Terverifikasi</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Sudah Disetor</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Sisa Wajib Setor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.sources.map((s) => {
                    const cust = dataset.customers.find((c) => c.id === s.customer_id);
                    return (
                      <tr key={s.receipt_id}>
                        <td className="px-4 py-2.5 font-mono font-medium text-slate-900">{s.receipt_number}</td>
                        <td className="px-4 py-2.5 text-slate-700">
                          {cust ? `${cust.cust_id} — ${cust.name}` : '-'}
                        </td>
                        <td className="px-4 py-2.5 font-mono tabular-nums text-slate-600">
                          {formatDateID(s.customer_paid_at)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatIDR(s.verified_amount)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-500">{formatIDR(s.deposited_amount)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-teal-800">{formatIDR(s.remaining_amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Movements Ledger */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 font-display font-semibold text-sm text-slate-900">
              Riwayat Mutasi Saldo Penagih
            </div>
            {!detail || detail.movements.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">Belum ada mutasi tercatat.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Waktu</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Jenis Mutasi</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Masuk / Keluar</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Saldo Setelah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.movements.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-2.5 font-mono text-slate-600">
                        {formatDateTimeJakarta(m.created_at)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-800 font-mono">{m.movement_type}</td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono tabular-nums font-semibold ${
                          m.direction === 'in' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {m.direction === 'in' ? '+' : '-'} {formatIDR(m.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium text-slate-900">
                        {formatIDR(m.balance_after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
