import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  HelpCircle,
  MinusCircle,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import type {
  AccountingDimensionStatus,
  CashDepositStatus,
  DepositDimensionStatus,
  DiscrepancyCaseStatus,
  ReceiptStatus,
  ReconciliationDimensionStatus,
} from '../../../database.types';

export function InfoTip({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1.5 align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        aria-label={`Penjelasan ${title}`}
        className="text-slate-400 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-40 left-0 top-6 w-72 p-3 text-left text-xs leading-relaxed bg-slate-900 text-slate-100 rounded-lg shadow-lg border border-slate-700 font-normal normal-case"
        >
          <span className="block font-semibold text-white mb-1">{title}</span>
          <span className="block text-slate-300">{body}</span>
        </span>
      )}
    </span>
  );
}

export function ReceiptStatusLabel({ status }: { status: ReceiptStatus }) {
  switch (status) {
    case 'draft':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
          <MinusCircle className="w-3.5 h-3.5 text-slate-400" />
          Draft
        </span>
      );
    case 'submitted':
    case 'waiting_verification':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Menunggu Verifikasi
        </span>
      );
    case 'verified':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Terverifikasi
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
          <XCircle className="w-3.5 h-3.5 text-red-600" />
          Ditolak
        </span>
      );
    case 'reversal_requested':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          Ajuan Reversal
        </span>
      );
    case 'reversed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          Dibalik
        </span>
      );
  }
}

export function DepositDimensionLabel({ status }: { status: DepositDimensionStatus }) {
  const map: Record<DepositDimensionStatus, { label: string; cls: string }> = {
    not_applicable: { label: 'Langsung Bank', cls: 'text-slate-500' },
    not_deposited: { label: 'Belum Disetor', cls: 'text-amber-700' },
    partially_deposited: { label: 'Disetor Sebagian', cls: 'text-teal-700' },
    deposited: { label: 'Sudah Disetor', cls: 'text-emerald-700' },
    discrepancy: { label: 'Selisih Setoran', cls: 'text-red-700' },
  };
  const item = map[status];
  return <span className={`text-xs font-medium whitespace-nowrap ${item.cls}`}>{item.label}</span>;
}

export function CashDepositStatusLabel({ status }: { status: CashDepositStatus }) {
  switch (status) {
    case 'draft':
      return <span className="text-xs font-medium text-slate-600 whitespace-nowrap">Draft</span>;
    case 'submitted':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Diajukan
        </span>
      );
    case 'partially_accepted':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
          Diterima Parsial
        </span>
      );
    case 'accepted':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Diterima Penuh
        </span>
      );
    case 'accepted_with_discrepancy':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
          Diterima dgn Selisih
        </span>
      );
    case 'rejected':
      return <span className="text-xs font-medium text-red-700 whitespace-nowrap">Ditolak</span>;
    case 'reversed':
      return <span className="text-xs font-medium text-slate-600 whitespace-nowrap">Dibalik</span>;
  }
}

export function ReconciliationDimensionLabel({ status }: { status: ReconciliationDimensionStatus }) {
  const map: Record<ReconciliationDimensionStatus, { label: string; cls: string }> = {
    unreviewed: { label: 'Belum Diperiksa', cls: 'text-slate-500' },
    matched: { label: 'Cocok', cls: 'text-emerald-700' },
    needs_review: { label: 'Perlu Ditinjau', cls: 'text-amber-700' },
    discrepancy: { label: 'Selisih', cls: 'text-red-700' },
    reviewed: { label: 'Selesai Ditinjau', cls: 'text-teal-700' },
  };
  const item = map[status];
  return <span className={`text-xs font-medium whitespace-nowrap ${item.cls}`}>{item.label}</span>;
}

export function AccountingDimensionLabel({ status }: { status: AccountingDimensionStatus }) {
  const map: Record<AccountingDimensionStatus, { label: string; cls: string }> = {
    not_ready: { label: 'Belum Siap', cls: 'text-slate-500' },
    queued: { label: 'Menunggu App 3', cls: 'text-amber-700' },
    draft_journal: { label: 'Draft Jurnal', cls: 'text-teal-700' },
    posted: { label: 'Terjurnal', cls: 'text-emerald-700' },
    failed: { label: 'Gagal Posting', cls: 'text-red-700' },
    reversed: { label: 'Dibalik', cls: 'text-slate-600' },
  };
  const item = map[status];
  return <span className={`text-xs font-medium whitespace-nowrap ${item.cls}`}>{item.label}</span>;
}

export function DiscrepancyStatusLabel({ status }: { status: DiscrepancyCaseStatus }) {
  const map: Record<DiscrepancyCaseStatus, { label: string; cls: string }> = {
    open: { label: 'Terbuka', cls: 'text-red-700' },
    investigating: { label: 'Investigasi', cls: 'text-amber-700' },
    pending_approval: { label: 'Menunggu Approval', cls: 'text-teal-700' },
    resolved: { label: 'Selesai', cls: 'text-emerald-700' },
    closed: { label: 'Ditutup', cls: 'text-slate-600' },
  };
  const item = map[status];
  return <span className={`text-xs font-medium whitespace-nowrap ${item.cls}`}>{item.label}</span>;
}
