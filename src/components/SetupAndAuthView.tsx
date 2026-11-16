import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileCode2,
  FlaskConical,
  KeyRound,
  Lock,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { ENV_STATUS, isSupabaseConfigured, supabase } from '../lib/supabase';

interface SetupAndAuthViewProps {
  authError: string | null;
  onEnterDemoSandbox: () => void;
  onSignedIn: () => void;
}

export function SetupAndAuthView({
  authError,
  onEnterDemoSandbox,
  onSignedIn,
}: SetupAndAuthViewProps) {
  const [guideTab, setGuideTab] = useState<'owner' | 'engineer'>('owner');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setLoginError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setLoginError(error.message);
      } else {
        onSignedIn();
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Gagal masuk ke sistem.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-display font-bold text-sm">
            PS
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-slate-900">
            Penerimaan &amp; Setoran
          </span>
        </div>
        <div className="text-xs text-slate-500 whitespace-nowrap shrink-0">
          Kontrak Bersama FINOPS_SHARED_V1 · Mata Uang IDR · Asia/Jakarta
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Honest Service Status & Setup Guide */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                {isSupabaseConfigured
                  ? 'Koneksi Database Siap — Silakan Masuk'
                  : 'Database Supabase Belum Terhubung'}
              </h1>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                {isSupabaseConfigured
                  ? 'Proyek Supabase bersama telah terkonfigurasi. Masuk menggunakan akun undangan resmi perusahaan Anda.'
                  : 'Aplikasi ini tidak beralih ke data palsu secara diam-diam. Hubungkan proyek Supabase bersama agar data transaksi penerimaan, setoran, dan event akuntansi tersimpan secara nyata.'}
              </p>
            </div>
            {isSupabaseConfigured ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                Env Terdeteksi
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 shrink-0">
                <AlertTriangle className="w-4 h-4" />
                Belum Terhubung
              </span>
            )}
          </div>

          {/* Environment & Migration Status Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Database className="w-4 h-4 text-slate-500" />
                Status Konfigurasi Environment
              </div>
              <div className="text-xs space-y-1 text-slate-600">
                <div className="flex justify-between gap-2">
                  <span>VITE_SUPABASE_URL</span>
                  <span className={`font-mono ${ENV_STATUS.hasUrl ? 'text-emerald-700' : 'text-red-700'}`}>
                    {ENV_STATUS.hasUrl ? 'Tersedia' : 'Belum diisi'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>VITE_SUPABASE_PUBLISHABLE_KEY</span>
                  <span className={`font-mono ${ENV_STATUS.hasKey ? 'text-emerald-700' : 'text-red-700'}`}>
                    {ENV_STATUS.hasKey ? 'Tersedia' : 'Belum diisi'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <FileCode2 className="w-4 h-4 text-slate-500" />
                Paket Migrasi Tersedia di Repo
              </div>
              <ul className="text-xs space-y-1 text-slate-600 font-mono">
                <li>0001_finops_shared_v1_foundation.sql</li>
                <li>0002_finops_shared_v1_rls_security.sql</li>
                <li>0003_finops_app1_rpcs.sql</li>
                <li>0004_finops_app2_views_and_realtime.sql</li>
              </ul>
            </div>
          </div>

          {/* Separated Owner vs Technical Setup Guide */}
          <div className="space-y-4">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setGuideTab('owner')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  guideTab === 'owner'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Panduan Pemilik Usaha
              </button>
              <button
                type="button"
                onClick={() => setGuideTab('engineer')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  guideTab === 'engineer'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Panduan Teknis (Engineer)
              </button>
            </div>

            {guideTab === 'owner' ? (
              <ol className="space-y-2.5 text-sm text-slate-700 list-decimal pl-5 leading-relaxed">
                <li>
                  Pastikan tim teknis menyiapkan <strong>satu proyek Supabase</strong> yang dipakai bersama oleh App 1 (Penerimaan &amp; Setoran), App 2 (Penjualan), dan App 3 (Akuntansi).
                </li>
                <li>
                  Siapkan data awal: nama perusahaan, cabang aktif, rekening bank perusahaan, kas kantor, daftar sales/sopir penagih, serta daftar pelanggan beserta kode pelanggan (<span className="font-mono text-xs">CUST ID</span>).
                </li>
                <li>
                  Tetapkan pemisahan tugas: siapa pencatat (<span className="font-medium">Maker</span>) dan siapa pemeriksa (<span className="font-medium">Checker</span>). Sistem menolak jika seseorang menyetujui dokumennya sendiri.
                </li>
                <li>
                  Jangan pernah membagikan password database atau kunci rahasia (<span className="font-mono text-xs">service_role</span>) melalui chat.
                </li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-sm text-slate-700 list-decimal pl-5 leading-relaxed">
                <li>
                  Jalankan 4 file migrasi di <span className="font-mono text-xs">supabase/migrations/</span> secara berurutan sekali saja (status saat ini di repo: <strong>siap diterapkan</strong>, belum otomatis dieksekusi ke cloud).
                </li>
                <li>
                  Salin <span className="font-mono text-xs">.env.example</span> menjadi <span className="font-mono text-xs">.env</span> lalu isi <span className="font-mono text-xs">VITE_SUPABASE_URL</span> dan <span className="font-mono text-xs">VITE_SUPABASE_PUBLISHABLE_KEY</span>.
                </li>
                <li>
                  Buat user undangan di Supabase Auth dan daftarkan baris ke <span className="font-mono text-xs">public.profiles</span> serta <span className="font-mono text-xs">public.memberships</span>.
                </li>
                <li>
                  Lampiran kontrak lintas app tersedia di root repo: <span className="font-mono text-xs">SHARED_BACKEND_CONTRACT.md</span>, <span className="font-mono text-xs">RPC_CONTRACT.md</span>, <span className="font-mono text-xs">RLS_ACCESS_MATRIX.md</span>, <span className="font-mono text-xs">database.types.ts</span>, dan <span className="font-mono text-xs">UAT.md</span>.
                </li>
              </ol>
            )}
          </div>
        </section>

        {/* Right Column: Auth Login OR Isolated Demo Sandbox */}
        <aside className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-teal-700" />
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Masuk Akun Perusahaan
              </h2>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                {authError}
              </div>
            )}

            {isSupabaseConfigured ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email Pengguna
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@perusahaan.co.id"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kata Sandi
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                {loginError && (
                  <p className="text-xs text-red-700">{loginError}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  {loading ? 'Memeriksa sesi...' : 'Masuk ke Aplikasi'}
                </button>
                <p className="text-xs text-slate-500 flex items-start gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  Hak akses &amp; cabang ditetapkan administrator melalui tabel memberships di backend, bukan dipilih di browser.
                </p>
              </form>
            ) : (
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2 leading-relaxed">
                <div className="font-semibold flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4" />
                  Login Produksi Nonaktif Sementara
                </div>
                <p>
                  Formulir login produksi aktif otomatis setelah variabel <span className="font-mono">VITE_SUPABASE_URL</span> dan <span className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</span> diisi.
                </p>
              </div>
            )}
          </div>

          {/* Isolated Demo Sandbox Entry */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <FlaskConical className="w-5 h-5 text-slate-700" />
              <h2 className="font-display text-base font-semibold text-slate-900">
                Mode Demo Terpisah (Data Sintetis)
              </h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Untuk meninjau alur kerja Penerimaan, Verifikasi Maker-Checker, Custody Penagih, Setoran Parsial/Kurang Setor, dan Impor Mutasi Bank tanpa database produksi. Semua data bersifat sintetis dan tidak tersimpan ke Supabase produksi.
            </p>
            <button
              type="button"
              onClick={onEnterDemoSandbox}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Masuk Sandbox Demo (Data Sintetis)
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
