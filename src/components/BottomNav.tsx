import React from 'react';
import { UserPlus, Users, BarChart3, ShieldCheck } from 'lucide-react';

export type TabType = 'input' | 'voters' | 'rekap' | 'akun';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  voterCount: number;
  unreadNotesCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  voterCount,
  unreadNotesCount = 0,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F19]/95 backdrop-blur-lg border-t border-slate-800/90 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="max-w-md mx-auto grid grid-cols-4 h-16 px-1">
        {/* Tab 1: Input */}
        <button
          onClick={() => onChangeTab('input')}
          className={`flex flex-col items-center justify-center gap-1 transition-all relative cursor-pointer ${
            activeTab === 'input'
              ? 'text-cyan-400 font-semibold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition ${
              activeTab === 'input'
                ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : ''
            }`}
          >
            <UserPlus className="w-5 h-5" />
          </div>
          <span className="text-[11px] tracking-tight">Input</span>
        </button>

        {/* Tab 2: Data Pemilih */}
        <button
          onClick={() => onChangeTab('voters')}
          className={`flex flex-col items-center justify-center gap-1 transition-all relative cursor-pointer ${
            activeTab === 'voters'
              ? 'text-cyan-400 font-semibold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition relative ${
              activeTab === 'voters'
                ? 'bg-cyan-500/20 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : ''
            }`}
          >
            <Users className="w-5 h-5" />
            {voterCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1.5 py-0.2 bg-slate-800 text-slate-300 border border-slate-700 rounded-full text-[9px] font-bold">
                {voterCount}
              </span>
            )}
          </div>
          <span className="text-[11px] tracking-tight">Data Warga</span>
        </button>

        {/* Tab 3: Rekap & Grafik */}
        <button
          onClick={() => onChangeTab('rekap')}
          className={`flex flex-col items-center justify-center gap-1 transition-all relative cursor-pointer ${
            activeTab === 'rekap'
              ? 'text-emerald-400 font-semibold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition ${
              activeTab === 'rekap'
                ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : ''
            }`}
          >
            <BarChart3 className="w-5 h-5" />
          </div>
          <span className="text-[11px] tracking-tight">Rekap & Peta</span>
        </button>

        {/* Tab 4: Tim & Pengaturan */}
        <button
          onClick={() => onChangeTab('akun')}
          className={`flex flex-col items-center justify-center gap-1 transition-all relative cursor-pointer ${
            activeTab === 'akun'
              ? 'text-amber-400 font-semibold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div
            className={`p-1.5 rounded-xl transition relative ${
              activeTab === 'akun'
                ? 'bg-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : ''
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
            {unreadNotesCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
            )}
          </div>
          <span className="text-[11px] tracking-tight">Tim & Akun</span>
        </button>
      </div>
    </nav>
  );
};
