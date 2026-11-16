import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownUp,
  Banknote,
  Building2,
  ClipboardList,
  FileSpreadsheet,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldAlert,
  Wallet,
  X,
} from 'lucide-react';
import type {
  AppRoleCode,
  CashDepositRow,
  MembershipRow,
  ReceiptRow,
} from '../database.types';
import { DEMO_ACTORS, DemoFinOpsEngine, type DemoActor } from './engine/demoEngine';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  callCreateAndSubmitReceipt,
  callRpcDashboard,
  callVerifyReceipt,
  fetchProductionDataset,
  fetchProductionMemberships,
  getDemoDataset,
  type WorkspaceMode,
} from './services/finopsClient';
import { formatDateTimeJakarta } from './lib/money';
import { SetupAndAuthView } from './components/SetupAndAuthView';
import { ReceiptDetailDrawer } from './components/ReceiptDetailDrawer';
import { OverviewPage } from './pages/OverviewPage';
import { ReceiptsPage } from './pages/ReceiptsPage';
import { DepositsPage } from './pages/DepositsPage';
import { CustodyPage } from './pages/CustodyPage';
import { BankStatementsPage } from './pages/BankStatementsPage';
import { DiscrepanciesPage } from './pages/DiscrepanciesPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';

type NavTab =
  | 'overview'
  | 'transfers'
  | 'cash_receipts'
  | 'deposits'
  | 'custody'
  | 'bank_statements'
  | 'discrepancies'
  | 'history'
  | 'settings';

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'transfers', label: 'Penerimaan Transfer', icon: ArrowDownUp },
  { id: 'cash_receipts', label: 'Penerimaan Tunai', icon: Banknote },
  { id: 'deposits', label: 'Setoran Sales/Sopir', icon: Building2 },
  { id: 'custody', label: 'Saldo di Penagih', icon: Wallet },
  { id: 'bank_statements', label: 'Mutasi Bank', icon: FileSpreadsheet },
  { id: 'discrepancies', label: 'Selisih & Tindak Lanjut', icon: ShieldAlert },
  { id: 'history', label: 'Riwayat & Ekspor', icon: ClipboardList },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

function FinOpsWorkspace() {
  const qc = useQueryClient();
  const demoEngineRef = useRef<DemoFinOpsEngine>(new DemoFinOpsEngine());
  const [demoTick, setDemoTick] = useState(0);

  const [mode, setMode] = useState<WorkspaceMode>(
    isSupabaseConfigured ? 'production_live' : 'production_unconfigured'
  );
  const [demoActor, setDemoActor] = useState<DemoActor>(DEMO_ACTORS[0]);

  // Production Supabase auth session & memberships
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [authLoading, setAuthLoading] = useState<boolean>(isSupabaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);

  // Navigation & Filters
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() =>
    formatDateTimeJakarta(new Date().toISOString())
  );
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'polling' | 'offline'>('offline');
  const [toastError, setToastError] = useState<string | null>(null);

  const bumpDemo = useCallback(() => {
    setDemoTick((t) => t + 1);
    setLastSyncedAt(formatDateTimeJakarta(new Date().toISOString()));
  }, []);

  // Load Supabase session when configured
  const loadAuthSession = useCallback(async () => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      if (!user) {
        setSessionUserId(null);
        setSessionEmail(null);
        setMemberships([]);
        return;
      }
      setSessionUserId(user.id);
      setSessionEmail(user.email ?? null);
      const mems = await fetchProductionMemberships(user.id);
      if (mems.length === 0) {
        setAuthError(
          'Akun ini belum terdaftar pada tabel memberships perusahaan. Hubungi administrator sistem untuk penugasan cabang dan peran.'
        );
      }
      setMemberships(mems);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Gagal memuat sesi autentikasi.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    loadAuthSession();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadAuthSession();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [loadAuthSession]);

  const activeMembership = memberships[0] ?? null;
  const activeCompanyId =
    mode === 'demo_sandbox' ? demoEngineRef.current.state.company.id : activeMembership?.company_id ?? '';
  const activeActorId = mode === 'demo_sandbox' ? demoActor.id : sessionUserId ?? '';
  const activeRole: AppRoleCode =
    mode === 'demo_sandbox' ? demoActor.role_code : activeMembership?.role_code ?? 'owner_viewer';

  const isAuthenticatedWorkspace =
    mode === 'demo_sandbox' || (mode === 'production_live' && Boolean(sessionUserId && activeMembership));

  // Dataset Query
  const datasetQuery = useQuery({
    queryKey: ['finops_dataset', mode, activeCompanyId, demoActor.id, demoTick],
    enabled: isAuthenticatedWorkspace && Boolean(activeCompanyId),
    queryFn: async () => {
      if (mode === 'demo_sandbox') {
        return getDemoDataset(demoEngineRef.current, demoActor);
      }
      const res = await fetchProductionDataset(activeCompanyId);
      setLastSyncedAt(formatDateTimeJakarta(new Date().toISOString()));
      return res;
    },
  });

  // Dashboard Summary Query
  const dashboardQuery = useQuery({
    queryKey: ['finops_dashboard', mode, activeCompanyId, branchFilter, dateFrom, dateTo, demoActor.id, demoTick],
    enabled: isAuthenticatedWorkspace && Boolean(activeCompanyId),
    queryFn: () =>
      callRpcDashboard(mode, demoEngineRef.current, demoActor, {
        company_id: activeCompanyId,
        branch_id: branchFilter || null,
        date_from: dateFrom || null,
        date_to: dateTo || null,
      }),
  });

  // Supabase Realtime Cache Invalidation
  useEffect(() => {
    if (mode !== 'production_live' || !supabase || !activeCompanyId || !sessionUserId) return;
    const channel = supabase
      .channel(`finops-app1-${activeCompanyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'receipts' },
        () => {
          qc.invalidateQueries({ queryKey: ['finops_dataset'] });
          qc.invalidateQueries({ queryKey: ['finops_dashboard'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_deposits' },
        () => {
          qc.invalidateQueries({ queryKey: ['finops_dataset'] });
          qc.invalidateQueries({ queryKey: ['finops_dashboard'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_custody_accounts' },
        () => {
          qc.invalidateQueries({ queryKey: ['finops_dataset'] });
          qc.invalidateQueries({ queryKey: ['finops_dashboard'] });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('polling');
      });

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [mode, activeCompanyId, sessionUserId, qc]);

  const refreshAll = useCallback(() => {
    if (mode === 'demo_sandbox') bumpDemo();
    qc.invalidateQueries({ queryKey: ['finops_dataset'] });
    qc.invalidateQueries({ queryKey: ['finops_dashboard'] });
  }, [mode, bumpDemo, qc]);

  const dataset = datasetQuery.data;
  const selectedReceipt = useMemo(
    () => dataset?.receipts.find((r) => r.id === selectedReceiptId) ?? null,
    [dataset, selectedReceiptId]
  );

  // Show honest Setup / Auth screen if not connected or not authenticated
  if (!isAuthenticatedWorkspace) {
    if (authLoading) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
          Memeriksa sesi autentikasi Supabase...
        </div>
      );
    }
    return (
      <SetupAndAuthView
        authError={authError}
        onEnterDemoSandbox={() => {
          setMode('demo_sandbox');
          setActiveTab('overview');
          bumpDemo();
        }}
        onSignedIn={() => loadAuthSession()}
      />
    );
  }

  if (datasetQuery.isError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 rounded-xl p-6 max-w-lg w-full space-y-4">
          <div className="flex items-center gap-2 text-red-700 font-display font-bold text-lg">
            <AlertTriangle className="w-5 h-5" />
            Gagal Memuat Data dari Database
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            {(datasetQuery.error as Error)?.message ?? 'Koneksi ke backend gagal. Pastikan migrasi 0001–0004 telah diterapkan.'}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={refreshAll}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg"
            >
              Coba Lagi
            </button>
            <button
              type="button"
              onClick={() => supabase?.auth.signOut()}
              className="px-4 py-2 border border-slate-300 text-xs font-medium rounded-lg"
            >
              Keluar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        Memuat data operasional perusahaan...
      </div>
    );
  }

  // Filter nav items by role (e.g., collector_optional doesn't see Bank Statements / Settings)
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (activeRole === 'collector_optional') {
      return ['overview', 'cash_receipts', 'deposits', 'custody', 'history'].includes(item.id);
    }
    return true;
  });

  async function runRpcSafe(fn: () => Promise<unknown>) {
    setToastError(null);
    try {
      await fn();
      refreshAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Operasi gagal diproses.';
      setToastError(msg);
      throw err;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Explicit Isolated DEMO Banner */}
      {mode === 'demo_sandbox' && (
        <div className="no-print bg-amber-950 text-amber-50 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 border-b border-amber-800">
          <div className="flex items-center gap-2 font-medium">
            <FlaskConical className="w-4 h-4 text-amber-300 shrink-0" />
            <span>
              MODE DEMO (DATA SINTETIS TERPISAH) — Tidak terhubung ke database produksi.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-amber-200">Simulasi Aktor:</label>
            <select
              value={demoActor.id}
              onChange={(e) => {
                const next = DEMO_ACTORS.find((a) => a.id === e.target.value);
                if (next) {
                  setDemoActor(next);
                  setSelectedReceiptId(null);
                  bumpDemo();
                }
              }}
              className="px-2.5 py-1 rounded bg-amber-900 border border-amber-700 text-amber-50 text-xs"
            >
              {DEMO_ACTORS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name} [{a.role_code}]
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setMode(isSupabaseConfigured ? 'production_live' : 'production_unconfigured');
                setSelectedReceiptId(null);
              }}
              className="px-2.5 py-1 rounded bg-amber-200 text-amber-950 font-semibold hover:bg-white transition-colors"
            >
              Keluar Mode Demo
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Sidebar Navigation (256px Desktop) */}
        <aside
          className={`no-print fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform lg:static lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="px-5 py-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-display font-bold text-sm shrink-0">
                PS
              </div>
              <div className="min-w-0">
                <div className="font-display font-bold text-sm text-white truncate">
                  Penerimaan &amp; Setoran
                </div>
                <div className="text-[11px] text-slate-400 truncate">{dataset.company.code}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Menu Utama">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left ${
                    active
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-800 text-xs space-y-2">
            <div className="text-slate-300 font-medium truncate">
              {mode === 'demo_sandbox' ? demoActor.full_name : sessionEmail}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">{activeRole}</div>
            {mode === 'production_live' && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">
                  Sync: {realtimeStatus === 'connected' ? 'Realtime' : 'Polling'}
                </span>
                <button
                  type="button"
                  onClick={() => supabase?.auth.signOut()}
                  className="inline-flex items-center gap-1 text-slate-300 hover:text-white"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Keluar
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <header className="no-print bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Buka menu navigasi"
                className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="text-xs text-slate-500 flex items-center gap-2 whitespace-nowrap">
                <span className="font-medium text-slate-900">{dataset.company.name}</span>
                <span aria-hidden="true">/</span>
                <span>{NAV_ITEMS.find((n) => n.id === activeTab)?.label}</span>
              </div>
            </div>

            {/* Scope Filters */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                aria-label="Filter Cabang"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700"
              >
                <option value="">Semua Cabang Diizinkan</option>
                {dataset.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                aria-label="Periode Dari"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-700"
              />
              <span className="text-slate-400">–</span>
              <input
                type="date"
                aria-label="Periode Sampai"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-700"
              />
            </div>
          </header>

          {toastError && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between">
              <span>{toastError}</span>
              <button type="button" onClick={() => setToastError(null)} className="text-red-700 font-semibold">
                Tutup
              </button>
            </div>
          )}

          <main className="flex-1 p-6 max-w-[1400px] w-full mx-auto">
            {activeTab === 'overview' && (
              <OverviewPage
                dashboard={dashboardQuery.data ?? null}
                loading={dashboardQuery.isLoading}
                dataset={dataset}
                lastSyncedAt={lastSyncedAt}
                onRefresh={refreshAll}
                onNavigate={(tab) => setActiveTab(tab as NavTab)}
                onSelectReceipt={(r) => setSelectedReceiptId(r.id)}
              />
            )}

            {activeTab === 'transfers' && (
              <ReceiptsPage
                channel="bank_transfer"
                dataset={dataset}
                mode={mode}
                actorRole={activeRole}
                branchFilter={branchFilter}
                onSelectReceipt={(r) => setSelectedReceiptId(r.id)}
                onCreateReceipt={async (payload, submitNow) => {
                  await runRpcSafe(() =>
                    callCreateAndSubmitReceipt(mode, demoEngineRef.current, demoActor, payload, submitNow)
                  );
                }}
              />
            )}

            {activeTab === 'cash_receipts' && (
              <ReceiptsPage
                channel="cash"
                dataset={dataset}
                mode={mode}
                actorRole={activeRole}
                branchFilter={branchFilter}
                onSelectReceipt={(r) => setSelectedReceiptId(r.id)}
                onCreateReceipt={async (payload, submitNow) => {
                  await runRpcSafe(() =>
                    callCreateAndSubmitReceipt(mode, demoEngineRef.current, demoActor, payload, submitNow)
                  );
                }}
              />
            )}

            {activeTab === 'deposits' && (
              <DepositsPage
                dataset={dataset}
                mode={mode}
                engine={demoEngineRef.current}
                demoActor={demoActor}
                actorId={activeActorId}
                actorRole={activeRole}
                onCreateDeposit={async (params, submitNow) => {
                  await runRpcSafe(async () => {
                    if (mode === 'demo_sandbox') {
                      const d = demoEngineRef.current.createCashDeposit(demoActor, params);
                      if (submitNow) {
                        demoEngineRef.current.submitCashDeposit(demoActor, {
                          idempotency_key: `${params.idempotency_key}:sub`,
                          deposit_id: d.deposit_id,
                          expected_version: d.version,
                        });
                      }
                    } else if (supabase) {
                      const { data, error } = await supabase.rpc('create_cash_deposit', {
                        p_idempotency_key: params.idempotency_key,
                        p_company_id: dataset.company.id,
                        p_branch_id: params.branch_id,
                        p_collector_staff_id: params.collector_staff_id,
                        p_target_type: params.target_type,
                        p_target_fund_account_id: params.target_fund_account_id,
                        p_deposit_date: params.deposit_date,
                        p_lines: params.lines,
                        p_is_planned_partial: params.is_planned_partial,
                        p_notes: params.notes ?? null,
                      });
                      if (error) throw new Error(error.message);
                      if (submitNow) {
                        const created = data as { deposit_id: string; version: number };
                        const { error: subErr } = await supabase.rpc('submit_cash_deposit', {
                          p_idempotency_key: `${params.idempotency_key}:sub`,
                          p_deposit_id: created.deposit_id,
                          p_expected_version: created.version,
                        });
                        if (subErr) throw new Error(subErr.message);
                      }
                    }
                  });
                }}
                onSubmitDeposit={async (deposit: CashDepositRow) => {
                  await runRpcSafe(async () => {
                    if (mode === 'demo_sandbox') {
                      demoEngineRef.current.submitCashDeposit(demoActor, {
                        idempotency_key: crypto.randomUUID(),
                        deposit_id: deposit.id,
                        expected_version: deposit.version,
                      });
                    } else if (supabase) {
                      const { error } = await supabase.rpc('submit_cash_deposit', {
                        p_idempotency_key: crypto.randomUUID(),
                        p_deposit_id: deposit.id,
                        p_expected_version: deposit.version,
                      });
                      if (error) throw new Error(error.message);
                    }
                  });
                }}
                onAcceptDeposit={async ({ deposit, received_amount, bank_statement_line_id, notes }) => {
                  await runRpcSafe(async () => {
                    if (mode === 'demo_sandbox') {
                      demoEngineRef.current.acceptCashDeposit(demoActor, {
                        idempotency_key: crypto.randomUUID(),
                        deposit_id: deposit.id,
                        expected_version: deposit.version,
                        received_amount,
                        bank_statement_line_id,
                        notes,
                      });
                    } else if (supabase) {
                      const { error } = await supabase.rpc('accept_cash_deposit', {
                        p_idempotency_key: crypto.randomUUID(),
                        p_deposit_id: deposit.id,
                        p_expected_version: deposit.version,
                        p_received_amount: received_amount,
                        p_bank_statement_line_id: bank_statement_line_id ?? null,
                        p_notes: notes ?? null,
                      });
                      if (error) throw new Error(error.message);
                    }
                  });
                }}
                onCreateInternalTransfer={async (params) => {
                  await runRpcSafe(async () => {
                    if (mode === 'demo_sandbox') {
                      demoEngineRef.current.createInternalFundTransfer(demoActor, params);
                    } else if (supabase) {
                      const { error } = await supabase.rpc('create_internal_fund_transfer', {
                        p_idempotency_key: params.idempotency_key,
                        p_company_id: dataset.company.id,
                        p_branch_id: params.branch_id,
                        p_transfer_date: params.transfer_date,
                        p_from_fund_account_id: params.from_fund_account_id,
                        p_to_fund_account_id: params.to_fund_account_id,
                        p_amount: params.amount,
                        p_reference_no: params.reference_no ?? null,
                        p_notes: params.notes ?? null,
                      });
                      if (error) throw new Error(error.message);
                    }
                  });
                }}
                onApproveInternalTransfer={async (transferId, expectedVersion) => {
                  await runRpcSafe(async () => {
                    if (mode === 'demo_sandbox') {
                      demoEngineRef.current.approveInternalFundTransfer(demoActor, {
                        idempotency_key: crypto.randomUUID(),
                        transfer_id: transferId,
                        expected_version: expectedVersion,
                      });
                    } else if (supabase) {
                      const { error } = await supabase.rpc('approve_internal_fund_transfer', {
                        p_idempotency_key: crypto.randomUUID(),
                        p_transfer_id: transferId,
                        p_expected_version: expectedVersion,
                      });
                      if (error) throw new Error(error.message);
                    }
                  });
                }}
              />
            )}

            {activeTab === 'custody' && (
              <CustodyPage
                dataset={dataset}
                mode={mode}
                engine={demoEngineRef.current}
                demoActor={demoActor}
              />
            )}

            {activeTab === 'bank_statements' && (
              <BankStatementsPage
                dataset={dataset}
                actorId={activeActorId}
                actorRole={activeRole}
                onImportCommit={async (params) => {
                  await runRpcSafe(async () => {
                    if (mode === 'demo_sandbox') {
                      const prev = demoEngineRef.current.importBankStatementPreview(demoActor, params);
                      demoEngineRef.current.commitBankStatementImport(demoActor, {
                        idempotency_key: `${params.idempotency_key}:commit`,
                        batch_id: prev.batch_id,
                        expected_version: prev.version,
                      });
                    } else if (supabase) {
                      const { data, error } = await supabase.rpc('import_bank_statement_preview', {
                        p_idempotency_key: params.idempotency_key,
                        p_company_id: dataset.company.id,
                        p_fund_account_id: params.fund_account_id,
                        p_file_name: params.file_name,
                        p_file_hash: params.file_hash,
                        p_period_start: params.period_start,
                        p_period_end: params.period_end,
                        p_date_format: params.date_format,
                        p_decimal_format: params.decimal_format,
                        p_opening_balance: params.opening_balance,
                        p_closing_balance: params.closing_balance,
                        p_rows: params.rows,
                      });
                      if (error) throw new Error(error.message);
                      const prev = data as { batch_id: string };
                      const { error: comErr } = await supabase.rpc('commit_bank_statement_import', {
                        p_idempotency_key: `${params.idempotency_key}:commit`,
                        p_batch_id: prev.batch_id,
                        p_expected_version: 1,
                      });
                      if (comErr) throw new Error(comErr.message);
                    }
                  });
                }}
                onProposeMatch={async (params) => {
                  await runRpcSafe(async () => {
                    if (mode === 'demo_sandbox') {
                      demoEngineRef.current.proposeBankMatch(demoActor, params);
                    } else if (supabase) {
                      const { error } = await supabase.rpc('propose_bank_match', {
                        p_idempotency_key: params.idempotency_key,
                        p_company_id: dataset.company.id,
                        p_items: params.items,
                        p_notes: params.notes ?? null,
                      });
                      if (error) throw new Error(error.message);
                    }
                  });
                }}
                onApproveMatch={async (matchGroupId) => {
                  await runRpcSafe(async () => {
                    if (mode === 'demo_sandbox') {
                      demoEngineRef.current.approveBankMatch(demoActor, {
                        idempotency_key: crypto.randomUUID(),
                        match_group_id: matchGroupId,
                      });
                    } else if (supabase) {
                      const { error } = await supabase.rpc('approve_bank_match', {
                        p_idempotency_key: crypto.randomUUID(),
                        p_company_id: dataset.company.id,
                        p_match_group_id: matchGroupId,
                      });
                      if (error) throw new Error(error.message);
                    }
                  });
                }}
              />
            )}

            {activeTab === 'discrepancies' && (
              <DiscrepanciesPage
                dataset={dataset}
                actorRole={activeRole}
                onSelectReceipt={(r) => setSelectedReceiptId(r.id)}
                onResolveCase={async (caseId, note) => {
                  await runRpcSafe(async () => {
                    if (mode === 'demo_sandbox') {
                      demoEngineRef.current.resolveDiscrepancyCase(demoActor, {
                        idempotency_key: crypto.randomUUID(),
                        case_id: caseId,
                        resolution_note: note,
                      });
                    } else {
                      throw new Error('Gunakan prosedur penyelesaian berizin pada backend.');
                    }
                  });
                }}
              />
            )}

            {activeTab === 'history' && (
              <HistoryPage
                dataset={dataset}
                actorRole={activeRole}
                onSelectReceipt={(r) => setSelectedReceiptId(r.id)}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPage
                dataset={dataset}
                actorRole={activeRole}
                onUpdateAppSettings={async (params) => {
                  await runRpcSafe(async () => {
                    if (mode === 'demo_sandbox') {
                      demoEngineRef.current.updateAppSettings(demoActor, params);
                    } else {
                      throw new Error('Gunakan Supabase SQL / Admin RPC untuk memperbarui app_settings.');
                    }
                  });
                }}
                onAddCustomer={async (params) => {
                  await runRpcSafe(async () => {
                    if (mode === 'demo_sandbox') {
                      demoEngineRef.current.addMasterCustomer(demoActor, params);
                    } else {
                      throw new Error('Tambahkan master pelanggan melalui admin backend.');
                    }
                  });
                }}
                onAddFundAccount={async (params) => {
                  await runRpcSafe(async () => {
                    if (mode === 'demo_sandbox') {
                      demoEngineRef.current.addMasterFundAccount(demoActor, params);
                    } else {
                      throw new Error('Tambahkan rekening melalui admin backend.');
                    }
                  });
                }}
                onAddStaff={async (params) => {
                  await runRpcSafe(async () => {
                    if (mode === 'demo_sandbox') {
                      demoEngineRef.current.addMasterStaff(demoActor, params);
                    } else {
                      throw new Error('Tambahkan petugas melalui admin backend.');
                    }
                  });
                }}
              />
            )}
          </main>
        </div>
      </div>

      {/* Receipt Inspection & Action Drawer */}
      <ReceiptDetailDrawer
        receipt={selectedReceipt}
        dataset={dataset}
        mode={mode}
        actorId={activeActorId}
        actorRole={activeRole}
        onClose={() => setSelectedReceiptId(null)}
        onSubmitDraft={async (r: ReceiptRow) => {
          await runRpcSafe(async () => {
            if (mode === 'demo_sandbox') {
              demoEngineRef.current.submitReceipt(demoActor, {
                idempotency_key: crypto.randomUUID(),
                receipt_id: r.id,
                expected_version: r.version,
              });
            } else if (supabase) {
              const { error } = await supabase.rpc('submit_receipt', {
                p_idempotency_key: crypto.randomUUID(),
                p_receipt_id: r.id,
                p_expected_version: r.version,
              });
              if (error) throw new Error(error.message);
            }
          });
        }}
        onVerify={async (r, params) => {
          await runRpcSafe(() =>
            callVerifyReceipt(mode, demoEngineRef.current, demoActor, {
              idempotency_key: crypto.randomUUID(),
              receipt_id: r.id,
              expected_version: r.version,
              ...params,
            })
          );
        }}
        onReject={async (r, reason) => {
          await runRpcSafe(async () => {
            if (mode === 'demo_sandbox') {
              demoEngineRef.current.rejectReceipt(demoActor, {
                idempotency_key: crypto.randomUUID(),
                receipt_id: r.id,
                expected_version: r.version,
                reason,
              });
            } else if (supabase) {
              const { error } = await supabase.rpc('reject_receipt', {
                p_idempotency_key: crypto.randomUUID(),
                p_receipt_id: r.id,
                p_expected_version: r.version,
                p_reason: reason,
              });
              if (error) throw new Error(error.message);
            }
          });
        }}
        onProposeIdentity={async (r, customerId, reason) => {
          await runRpcSafe(async () => {
            if (mode === 'demo_sandbox') {
              demoEngineRef.current.proposeReceiptIdentity(demoActor, {
                idempotency_key: crypto.randomUUID(),
                receipt_id: r.id,
                expected_version: r.version,
                proposed_customer_id: customerId,
                reason,
              });
            } else if (supabase) {
              const { error } = await supabase.rpc('propose_receipt_identity', {
                p_idempotency_key: crypto.randomUUID(),
                p_receipt_id: r.id,
                p_expected_version: r.version,
                p_proposed_customer_id: customerId,
                p_reason: reason,
              });
              if (error) throw new Error(error.message);
            }
          });
        }}
        onApproveIdentity={async (r, customerId, reason) => {
          await runRpcSafe(async () => {
            if (mode === 'demo_sandbox') {
              demoEngineRef.current.approveReceiptIdentity(demoActor, {
                idempotency_key: crypto.randomUUID(),
                receipt_id: r.id,
                expected_version: r.version,
                customer_id: customerId,
                reason,
              });
            } else if (supabase) {
              const { error } = await supabase.rpc('approve_receipt_identity', {
                p_idempotency_key: crypto.randomUUID(),
                p_receipt_id: r.id,
                p_expected_version: r.version,
                p_customer_id: customerId,
                p_reason: reason,
              });
              if (error) throw new Error(error.message);
            }
          });
        }}
        onRequestReversal={async (r, reason) => {
          await runRpcSafe(async () => {
            if (mode === 'demo_sandbox') {
              demoEngineRef.current.requestReceiptReversal(demoActor, {
                idempotency_key: crypto.randomUUID(),
                receipt_id: r.id,
                expected_version: r.version,
                reason,
              });
            } else if (supabase) {
              const { error } = await supabase.rpc('request_receipt_reversal', {
                p_idempotency_key: crypto.randomUUID(),
                p_receipt_id: r.id,
                p_expected_version: r.version,
                p_reason: reason,
              });
              if (error) throw new Error(error.message);
            }
          });
        }}
        onApproveReversal={async (r, reason) => {
          await runRpcSafe(async () => {
            if (mode === 'demo_sandbox') {
              demoEngineRef.current.approveReceiptReversal(demoActor, {
                idempotency_key: crypto.randomUUID(),
                receipt_id: r.id,
                expected_version: r.version,
                reason,
              });
            } else if (supabase) {
              const { error } = await supabase.rpc('approve_receipt_reversal', {
                p_idempotency_key: crypto.randomUUID(),
                p_receipt_id: r.id,
                p_expected_version: r.version,
                p_reason: reason,
              });
              if (error) throw new Error(error.message);
            }
          });
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FinOpsWorkspace />
    </QueryClientProvider>
  );
}
