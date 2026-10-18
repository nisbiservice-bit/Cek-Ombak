import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { FontSize, User } from '../types';
import { Wifi, WifiOff, RefreshCw, Smartphone, Download, UserCheck, LogOut, ChevronDown, Shield, Type } from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  isOnline: boolean;
  isSyncing: boolean;
  offlineCount: number;
  syncMessage: string | null;
  fontSize: FontSize;
  onChangeFontSize: (size: FontSize) => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  onRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  isOnline,
  isSyncing,
  offlineCount,
  syncMessage,
  fontSize,
  onChangeFontSize,
  onOpenLogin,
  onLogout,
  onRefresh,
}) => {
  const { isInstallable, install, isIOS } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const getRoleBadge = (role?: User['role']) => {
    switch (role) {
      case 'super_admin':
        return { label: 'Super Admin', bg: 'bg-purple-950/80 text-purple-300 border-purple-500/40' };
      case 'admin':
        return { label: 'Admin Lapangan', bg: 'bg-blue-950/80 text-blue-300 border-blue-500/40' };
      case 'korlap':
        return { label: 'Korlap Desa', bg: 'bg-amber-950/80 text-amber-300 border-amber-500/40' };
      case 'kordes_rw':
        return { label: `Koor RW ${currentUser?.rwTugas || ''}`, bg: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40' };
      case 'petugas_rt':
        return { label: `Petugas RT ${currentUser?.rtTugas || ''} RW ${currentUser?.rwTugas || ''}`, bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' };
      default:
        return { label: 'Tamu', bg: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const roleInfo = getRoleBadge(currentUser?.role);

  return (
    <header className="sticky top-0 z-40 bg-[#0B0F19]/95 backdrop-blur-md border-b border-slate-800/80 px-3 py-2.5 transition-all">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
        {/* Brand & Emblem */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <img
              src="/logo.svg"
              alt="Cek Ombak"
              className="w-10 h-10 object-contain drop-shadow-[0_0_12px_rgba(6,182,212,0.35)]"
            />
            {isSyncing && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
            )}
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <h1 className="text-base font-extrabold tracking-tight text-white leading-tight">
              Cek Ombak
            </h1>
            <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
              Cénghar
            </span>
          </div>
        </div>

        {/* Right Status & Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* PWA Install Button */}
          {isInstallable && (
            <button
              onClick={install}
              title="Pasang di Layar Utama HP"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-medium transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Pasang</span>
            </button>
          )}

          {isIOS && (
            <button
              onClick={() => setShowIosGuide(true)}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs cursor-pointer"
            >
              <Smartphone className="w-3 h-3" />
              <span>Instal iOS</span>
            </button>
          )}

          {/* Ukuran Huruf / Mode Ramah Lansia (A- / A+) */}
          <button
            type="button"
            onClick={() => {
              const next: FontSize = fontSize === 'normal' ? 'large' : fontSize === 'large' ? 'xlarge' : 'normal';
              onChangeFontSize(next);
            }}
            title="Ubah Ukuran Tulisan: Standar, Besar (Ramah Mata), Ekstra Besar"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer active:scale-95 ${
              fontSize === 'large'
                ? 'bg-amber-500/25 text-amber-300 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.35)]'
                : fontSize === 'xlarge'
                ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <Type className="w-3 h-3 text-cyan-400" />
            <span>
              {fontSize === 'normal' ? 'Teks 1x' : fontSize === 'large' ? 'Teks 1.5x' : 'Teks 2x'}
            </span>
          </button>

          {/* Online/Offline Status Indicator (Click to sync) */}
          <button
            type="button"
            onClick={onRefresh}
            title="Status koneksi. Klik untuk tes koneksi dan sinkronisasi data seketika."
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition cursor-pointer active:scale-95 ${
              !isOnline
                ? 'bg-amber-950/80 text-amber-300 border-amber-600/50 hover:bg-amber-900/60'
                : isSyncing
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-600/50'
                : offlineCount > 0
                ? 'bg-amber-950/80 text-amber-300 border-amber-600/50 hover:bg-amber-900/60'
                : 'bg-emerald-950/70 text-emerald-300 border-emerald-600/40 hover:bg-emerald-900/50'
            }`}
          >
            {!isOnline ? (
              <>
                <WifiOff className="w-3 h-3 text-amber-400" />
                <span>Offline ({offlineCount})</span>
              </>
            ) : isSyncing ? (
              <>
                <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
                <span>Sinkron...</span>
              </>
            ) : offlineCount > 0 ? (
              <>
                <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                <span>Antre ({offlineCount})</span>
              </>
            ) : (
              <>
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span className="hidden xs:inline">Online (Live)</span>
              </>
            )}
          </button>

          {/* User Account / Profile Menu */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition cursor-pointer ${roleInfo.bg}`}
                title="Menu Pengguna"
              >
                <Shield className="w-3 h-3" />
                <span className="max-w-[85px] sm:max-w-[120px] truncate text-left">
                  {currentUser.namaLengkap.split(' ')[0]}
                </span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-48 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-2 z-50 text-xs space-y-1 animate-in fade-in">
                  <div className="px-2.5 py-1.5 border-b border-slate-800">
                    <p className="font-bold text-white truncate">{currentUser.namaLengkap}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{currentUser.role.replace('_', ' ')}</p>
                  </div>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-rose-300 hover:bg-rose-950/50 hover:text-rose-200 transition text-left font-medium cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar (Logout)</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/40 transition cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Masuk</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Message Notification Toast */}
      {syncMessage && (
        <div className="max-w-4xl mx-auto mt-2 px-3 py-1.5 bg-cyan-950/90 border border-cyan-500/40 rounded-lg text-xs text-cyan-200 flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            <span>{syncMessage}</span>
          </div>
        </div>
      )}

      {/* Offline Alert Strip */}
      {!isOnline && (
        <div className="max-w-4xl mx-auto mt-1.5 px-3 py-1 bg-amber-950/90 border border-amber-600/40 rounded-lg text-[11px] text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <WifiOff className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Koneksi internet terputus. Input tetap disimpan aman di HP & terkirim otomatis saat online.</span>
          </div>
        </div>
      )}

      {/* iOS Safari Installation Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              Pasang di iPhone / iPad
            </h3>
            <p className="mt-2.5 text-xs text-slate-300 leading-relaxed">
              1. Buka peramban <strong>Safari</strong>.<br />
              2. Ketuk tombol <strong>Bagikan (Share)</strong> di bilah bawah.<br />
              3. Gulir ke bawah lalu pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.<br />
              4. Aplikasi Cek Ombak akan muncul di layar utama layaknya aplikasi resmi.
            </p>
            <button
              onClick={() => setShowIosGuide(false)}
              className="mt-4 w-full rounded-xl bg-cyan-600 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 transition cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
