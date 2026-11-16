import React from 'react';
import { Printer, X } from 'lucide-react';
import type { CashDepositRow } from '../../database.types';
import type { WorkspaceDataset } from '../services/finopsClient';
import { formatDateID, formatDateTimeJakarta, formatIDR } from '../lib/money';
import { CashDepositStatusLabel } from './ui/StatusText';

interface DepositReceiptPrintModalProps {
  deposit: CashDepositRow | null;
  dataset: WorkspaceDataset;
  onClose: () => void;
}

export function DepositReceiptPrintModal({
  deposit,
  dataset,
  onClose,
}: DepositReceiptPrintModalProps) {
  if (!deposit) return null;

  const collector = dataset.staff.find((s) => s.id === deposit.collector_staff_id);
  const targetAccount = dataset.fundAccounts.find((a) => a.id === deposit.target_fund_account_id);
  const receiver = dataset.profiles.find((p) => p.id === deposit.received_by);
  const custody = dataset.custodyAccounts.find((c) => c.id === deposit.custody_account_id);
  const lines = dataset.depositLines.filter((l) => l.cash_deposit_id === deposit.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden">
        <div className="no-print px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display font-semibold text-base text-slate-900">
            Tanda Terima Setoran Penagih
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-lg"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Tanda Terima
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup modal cetak"
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6 text-slate-900 text-sm">
          <div className="flex justify-between items-start border-b border-slate-300 pb-4">
            <div>
              <div className="font-display font-bold text-lg">{dataset.company.name}</div>
              <div className="text-xs text-slate-500">Bukti Penyerahan &amp; Penerimaan Setoran Kas</div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-base">{deposit.deposit_number}</div>
              <div className="text-xs text-slate-500">Tanggal Setor: {formatDateID(deposit.deposit_date)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">Penagih (Sales / Sopir)</span>
              <span className="font-semibold text-slate-900">
                {collector ? `${collector.staff_code} — ${collector.full_name}` : deposit.collector_staff_id}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Tujuan Setoran</span>
              <span className="font-semibold text-slate-900">
                {deposit.target_type === 'bank_direct' ? 'Setor Langsung Bank: ' : 'Kas Kantor: '}
                {targetAccount?.name ?? '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Status Setoran</span>
              <CashDepositStatusLabel status={deposit.status} />
            </div>
            <div>
              <span className="text-slate-500 block">Diterima Oleh Keuangan</span>
              <span className="font-medium text-slate-900">
                {receiver?.full_name ?? 'Belum diterima checker'} ({formatDateTimeJakarta(deposit.approved_at)})
              </span>
            </div>
          </div>

          <table className="w-full text-xs border-collapse border border-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-2.5 border-b border-slate-200 font-semibold">No. Penerimaan Sumber</th>
                <th className="text-left p-2.5 border-b border-slate-200 font-semibold">Pelanggan</th>
                <th className="text-right p-2.5 border-b border-slate-200 font-semibold">Dinyatakan</th>
                <th className="text-right p-2.5 border-b border-slate-200 font-semibold">Diterima</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const rec = dataset.receipts.find((r) => r.id === line.source_receipt_id);
                const cust = dataset.customers.find((c) => c.id === rec?.customer_id);
                return (
                  <tr key={line.id} className="border-b border-slate-100">
                    <td className="p-2.5 font-mono">{rec?.receipt_number ?? line.source_receipt_id}</td>
                    <td className="p-2.5">{cust ? `${cust.cust_id} — ${cust.name}` : '-'}</td>
                    <td className="p-2.5 text-right font-mono tabular-nums">{formatIDR(line.declared_amount)}</td>
                    <td className="p-2.5 text-right font-mono tabular-nums">{formatIDR(line.accepted_amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-y-2 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
            <span className="text-slate-600">Total Dinyatakan Penagih</span>
            <span className="text-right font-mono tabular-nums font-medium">{formatIDR(deposit.declared_amount)}</span>

            <span className="text-slate-600 font-semibold">Total Fisik Diterima Sah</span>
            <span className="text-right font-mono tabular-nums font-bold text-teal-800">{formatIDR(deposit.received_amount)}</span>

            <span className="text-slate-600">Selisih Kurang Setor</span>
            <span className="text-right font-mono tabular-nums text-red-700">{formatIDR(deposit.shortage_amount)}</span>

            <span className="text-slate-600">Sisa Saldo Kas Terverifikasi di Penagih Saat Ini</span>
            <span className="text-right font-mono tabular-nums font-semibold">
              {formatIDR(custody?.verified_balance ?? '0')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-6 text-xs text-center text-slate-600">
            <div>
              <div className="h-14 border-b border-slate-300" />
              <div className="mt-2 font-medium">Penagih ({collector?.full_name ?? '-'})</div>
            </div>
            <div>
              <div className="h-14 border-b border-slate-300" />
              <div className="mt-2 font-medium">Penerima Keuangan ({receiver?.full_name ?? '-'})</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
