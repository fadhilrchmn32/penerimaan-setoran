import React, { useState } from 'react';
import { Lock, Plus, Save } from 'lucide-react';
import type { AppRoleCode, FundAccountRow, StaffRow } from '../../database.types';
import type { WorkspaceDataset } from '../services/finopsClient';

interface SettingsPageProps {
  dataset: WorkspaceDataset;
  actorRole: AppRoleCode;
  onUpdateAppSettings: (params: {
    app1_url: string;
    app2_url: string;
    app3_url: string;
    reconciliation_label: string;
  }) => Promise<void>;
  onAddCustomer: (params: { branch_id: string; cust_id: string; name: string; phone?: string }) => Promise<void>;
  onAddFundAccount: (params: {
    branch_id: string;
    code: string;
    name: string;
    account_type: FundAccountRow['account_type'];
    bank_name?: string;
    account_number?: string;
  }) => Promise<void>;
  onAddStaff: (params: {
    branch_id: string;
    staff_code: string;
    full_name: string;
    staff_role: StaffRow['staff_role'];
  }) => Promise<void>;
}

export function SettingsPage({
  dataset,
  actorRole,
  onUpdateAppSettings,
  onAddCustomer,
  onAddFundAccount,
  onAddStaff,
}: SettingsPageProps) {
  const canView = ['system_admin', 'accountant', 'owner_viewer', 'finance_checker', 'finance_maker'].includes(actorRole);
  const canManageUrls = ['system_admin', 'accountant'].includes(actorRole);
  const canManageMaster = ['system_admin', 'accountant', 'finance_maker'].includes(actorRole);

  const [app1Url, setApp1Url] = useState(dataset.appSettings.app1_url ?? '');
  const [app2Url, setApp2Url] = useState(dataset.appSettings.app2_url ?? '');
  const [app3Url, setApp3Url] = useState(dataset.appSettings.app3_url ?? '');
  const [rekonLabel, setRekonLabel] = useState(dataset.appSettings.reconciliation_label ?? 'REKONSILIASI (ALMIRA)');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [newCustId, setNewCustId] = useState('');
  const [newCustName, setNewCustName] = useState('');
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<FundAccountRow['account_type']>('bank');
  const [newStaffCode, setNewStaffCode] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRow['staff_role']>('sales');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  if (!canView) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
        <Lock className="w-6 h-6 text-slate-400 mx-auto" />
        <h2 className="font-display font-semibold text-base text-slate-900">Akses Terbatas</h2>
        <p className="text-xs text-slate-500">
          Peran Anda ({actorRole}) tidak memiliki hak membuka halaman Pengaturan perusahaan dan master.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
          Pengaturan &amp; Master Data Bersama
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Kelola perusahaan, cabang, master rekening/kas, petugas penagih, pelanggan (CUST ID teks), dan URL App 2/3.
        </p>
      </div>

      {errMsg && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">{errMsg}</div>
      )}
      {savedMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{savedMsg}</div>
      )}

      {/* Company & App URLs */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900">
              Identitas Badan Usaha &amp; URL Aplikasi Terhubung
            </h2>
            <p className="text-slate-500 mt-0.5">
              {dataset.company.code} — {dataset.company.name} · {dataset.branches.length} cabang aktif · {dataset.company.base_currency}
            </p>
          </div>
          {!canManageUrls && (
            <span className="text-slate-400 font-medium">Mode Baca Saja</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-slate-700 mb-1">URL App 1 (Penerimaan &amp; Setoran)</label>
            <input
              type="url"
              disabled={!canManageUrls}
              value={app1Url}
              onChange={(e) => setApp1Url(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">URL App 2 (Penjualan &amp; Rekonsiliasi)</label>
            <input
              type="url"
              disabled={!canManageUrls}
              value={app2Url}
              onChange={(e) => setApp2Url(e.target.value)}
              placeholder="https://app2-penjualan.contoh.id"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">URL App 3 (Akuntansi &amp; Laporan)</label>
            <input
              type="url"
              disabled={!canManageUrls}
              value={app3Url}
              onChange={(e) => setApp3Url(e.target.value)}
              placeholder="https://app3-akuntansi.contoh.id"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Label Penanggung Jawab Ekspor</label>
            <input
              type="text"
              disabled={!canManageUrls}
              value={rekonLabel}
              onChange={(e) => setRekonLabel(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-50"
            />
          </div>
        </div>

        {canManageUrls && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={async () => {
                setErrMsg(null);
                try {
                  await onUpdateAppSettings({
                    app1_url: app1Url,
                    app2_url: app2Url,
                    app3_url: app3Url,
                    reconciliation_label: rekonLabel,
                  });
                  setSavedMsg('Pengaturan URL dan label berhasil disimpan.');
                } catch (e) {
                  setErrMsg(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan.');
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-lg"
            >
              <Save className="w-3.5 h-3.5" />
              Simpan Pengaturan
            </button>
          </div>
        )}
      </section>

      {/* Master Grid: Accounts, Staff, Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        {/* Fund Accounts */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-sm text-slate-900">
            Master Rekening Bank &amp; Kas ({dataset.fundAccounts.length})
          </h3>
          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {dataset.fundAccounts.map((a) => (
              <div key={a.id} className="py-2">
                <div className="font-mono font-semibold text-slate-900">{a.code}</div>
                <div className="text-slate-600">{a.name} ({a.account_type})</div>
              </div>
            ))}
          </div>
          {canManageUrls && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <input
                type="text"
                value={newAccCode}
                onChange={(e) => setNewAccCode(e.target.value)}
                placeholder="Kode (mis. BANK-BRI-01)"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono"
              />
              <input
                type="text"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                placeholder="Nama Rekening / Kas"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
              />
              <div className="flex gap-2">
                <select
                  value={newAccType}
                  onChange={(e) => setNewAccType(e.target.value as FundAccountRow['account_type'])}
                  className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="bank">Rekening Bank</option>
                  <option value="office_cash">Kas Kantor</option>
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newAccCode || !newAccName) return;
                    await onAddFundAccount({
                      branch_id: dataset.branches[0].id,
                      code: newAccCode,
                      name: newAccName,
                      account_type: newAccType,
                    });
                    setNewAccCode('');
                    setNewAccName('');
                  }}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-medium inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Staff */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-sm text-slate-900">
            Master Petugas / Sales / Sopir ({dataset.staff.length})
          </h3>
          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {dataset.staff.map((s) => (
              <div key={s.id} className="py-2 flex justify-between">
                <div>
                  <div className="font-medium text-slate-900">{s.full_name}</div>
                  <div className="font-mono text-slate-500">{s.staff_code}</div>
                </div>
                <span className="text-slate-500">{s.staff_role}</span>
              </div>
            ))}
          </div>
          {canManageUrls && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <input
                type="text"
                value={newStaffCode}
                onChange={(e) => setNewStaffCode(e.target.value)}
                placeholder="Kode Petugas (mis. DRV-02)"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono"
              />
              <input
                type="text"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="Nama Lengkap"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
              />
              <div className="flex gap-2">
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as StaffRow['staff_role'])}
                  className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="sales">Sales</option>
                  <option value="driver">Sopir</option>
                  <option value="collector">Penagih</option>
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newStaffCode || !newStaffName) return;
                    await onAddStaff({
                      branch_id: dataset.branches[0].id,
                      staff_code: newStaffCode,
                      full_name: newStaffName,
                      staff_role: newStaffRole,
                    });
                    setNewStaffCode('');
                    setNewStaffName('');
                  }}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-medium inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Customers (CUST ID as TEXT preserving leading zero) */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-sm text-slate-900">
            Master Pelanggan ({dataset.customers.length})
          </h3>
          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {dataset.customers.map((c) => (
              <div key={c.id} className="py-2">
                <div className="font-mono font-semibold text-slate-900">{c.cust_id}</div>
                <div className="text-slate-600">{c.name}</div>
              </div>
            ))}
          </div>
          {canManageMaster && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <input
                type="text"
                value={newCustId}
                onChange={(e) => setNewCustId(e.target.value)}
                placeholder="CUST ID Teks (mis. 00512)"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Nama Toko / Pelanggan"
                  className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newCustId || !newCustName) return;
                    try {
                      await onAddCustomer({
                        branch_id: dataset.branches[0].id,
                        cust_id: newCustId,
                        name: newCustName,
                      });
                      setNewCustId('');
                      setNewCustName('');
                    } catch (e) {
                      setErrMsg(e instanceof Error ? e.message : 'Gagal menambah pelanggan.');
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-medium inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
