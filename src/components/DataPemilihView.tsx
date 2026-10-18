import React, { useState, useMemo } from 'react';
import { FontSize, MasterDptItem, Role, User, Voter } from '../types';
import { Search, Trash2, MessageSquare, AlertTriangle, CheckCircle, Clock, ShieldAlert, ShieldCheck, MapPin, X, Target, UserPlus, Users, Lock } from 'lucide-react';
import { RW_LIST } from '../data/regionsData';
import { WatermarkOverlay } from './WatermarkOverlay';

interface DataPemilihViewProps {
  voters: Voter[];
  currentUser: User | null;
  masterDpt?: MasterDptItem[];
  fontSize?: FontSize;
  onQuickInputDpt?: (dptItem: MasterDptItem) => void;
  onDeleteVoter: (id: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  onRequestDeleteVoter: (id: string, reason: string) => Promise<{ success: boolean; error?: string }>;
  onAddSupervisionNote: (voterId: string, text: string) => Promise<{ success: boolean }>;
}

export const DataPemilihView: React.FC<DataPemilihViewProps> = ({
  voters,
  currentUser,
  masterDpt = [],
  fontSize = 'normal',
  onQuickInputDpt,
  onDeleteVoter,
  onRequestDeleteVoter,
  onAddSupervisionNote,
}) => {
  // View mode: 'surveyed' (Sudah didata) | 'target_dpt' (Belum dikunjungi)
  const [viewMode, setViewMode] = useState<'surveyed' | 'target_dpt'>('surveyed');

  // Search & Filter for Surveyed
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRw, setFilterRw] = useState<string>('ALL');
  const [filterPilihan, setFilterPilihan] = useState<string>('ALL');

  // Search & Filter for Target DPT
  const [targetDptSearch, setTargetDptSearch] = useState('');
  const [targetFilterRw, setTargetFilterRw] = useState<string>(
    currentUser?.rwTugas && currentUser.rwTugas !== 'all' ? currentUser.rwTugas : 'ALL'
  );
  const [targetFilterRt, setTargetFilterRt] = useState<string>(
    currentUser?.rtTugas && currentUser.rtTugas !== 'all' ? currentUser.rtTugas : 'ALL'
  );

  // Modal States
  const [activeVoterForDelete, setActiveVoterForDelete] = useState<Voter | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRequestingDelete, setIsRequestingDelete] = useState(false);

  const [activeVoterForNote, setActiveVoterForNote] = useState<Voter | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Filtered Voters
  const filteredVoters = useMemo(() => {
    return voters.filter((v) => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = v.namaPemilih.toLowerCase().includes(query);
        const matchesKampung = v.kampung.toLowerCase().includes(query);
        const matchesAspirasi = v.aspirasi?.toLowerCase().includes(query);
        if (!matchesName && !matchesKampung && !matchesAspirasi) return false;
      }

      // Filter RW
      if (filterRw !== 'ALL' && v.rw !== filterRw) {
        return false;
      }

      // Filter Choice
      if (filterPilihan !== 'ALL' && v.pilihan !== filterPilihan) {
        return false;
      }

      return true;
    });
  }, [voters, searchQuery, filterRw, filterPilihan]);

  // Set of surveyed voter keys: "rw_rt_lowercaseName"
  const surveyedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const v of voters) {
      set.add(`${v.rw}_${v.rt}_${v.namaPemilih.toLowerCase().trim()}`);
    }
    return set;
  }, [voters]);

  // Scoped Master DPT according to user role
  const scopedMasterDpt = useMemo(() => {
    if (!masterDpt) return [];
    if (!currentUser) return [];
    if (currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'korlap') {
      return masterDpt;
    }
    if (currentUser.role === 'kordes_rw') {
      return masterDpt.filter((d) => d.rw === currentUser.rwTugas);
    }
    if (currentUser.role === 'petugas_rt') {
      return masterDpt.filter((d) => d.rw === currentUser.rwTugas && d.rt === currentUser.rtTugas);
    }
    return masterDpt;
  }, [masterDpt, currentUser]);

  // Unsurveyed DPT citizens (haven't been recorded in voters yet)
  const unsurveyedDpt = useMemo(() => {
    return scopedMasterDpt.filter((d) => {
      const key = `${d.rw}_${d.rt}_${d.nama.toLowerCase().trim()}`;
      return !surveyedKeys.has(key);
    });
  }, [scopedMasterDpt, surveyedKeys]);

  // Filtered Unsurveyed DPT
  const filteredUnsurveyedDpt = useMemo(() => {
    return unsurveyedDpt.filter((d) => {
      if (targetFilterRw !== 'ALL' && d.rw !== targetFilterRw) return false;
      if (targetFilterRt !== 'ALL' && d.rt !== targetFilterRt) return false;
      if (targetDptSearch.trim()) {
        const q = targetDptSearch.trim().toLowerCase();
        if (!d.nama.toLowerCase().includes(q) && !d.alamat.toLowerCase().includes(q) && !String(d.no).includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [unsurveyedDpt, targetFilterRw, targetFilterRt, targetDptSearch]);

  // Check if current user can directly delete
  const canDirectDelete = (voter: Voter): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'super_admin' || currentUser.role === 'admin') return true;
    if (currentUser.role === 'petugas_rt' && voter.inputByUserId === currentUser.id) return true;
    if (currentUser.role === 'kordes_rw' && voter.inputByUserId === currentUser.id) return true;
    return false;
  };

  // Check if current user should request delete to super admin
  const canRequestDelete = (voter: Voter): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'kordes_rw' && voter.rw === currentUser.rwTugas && voter.inputByUserId !== currentUser.id) {
      return true;
    }
    return false;
  };

  // Check if current user can add notes
  const canAddNote = (role?: Role): boolean => {
    return role === 'korlap' || role === 'admin' || role === 'super_admin' || role === 'kordes_rw';
  };

  // Perform Delete
  const handleConfirmDelete = async () => {
    if (!activeVoterForDelete || !deleteReason.trim()) return;
    setIsDeleting(true);
    if (isRequestingDelete) {
      await onRequestDeleteVoter(activeVoterForDelete.id, deleteReason.trim());
    } else {
      await onDeleteVoter(activeVoterForDelete.id, deleteReason.trim());
    }
    setIsDeleting(false);
    setActiveVoterForDelete(null);
    setDeleteReason('');
    setIsRequestingDelete(false);
  };

  // Submit Note
  const handleAddNoteSubmit = async () => {
    if (!activeVoterForNote || !noteText.trim()) return;
    setIsSubmittingNote(true);
    await onAddSupervisionNote(activeVoterForNote.id, noteText.trim());
    setIsSubmittingNote(false);
    setActiveVoterForNote(null);
    setNoteText('');
  };

  return (
    <div
      className="pb-24 pt-2 px-3 max-w-xl mx-auto relative protected-data select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Forensic Watermark Overlay for Leaker Deterrence */}
      <WatermarkOverlay currentUser={currentUser} />

      {/* Security notice indicator */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 px-1">
        <span className="flex items-center gap-1 text-cyan-400/90 font-medium">
          <Lock className="w-3 h-3 text-cyan-400" />
          Data Internal Rahasia & Cap Air Forensik Aktif
        </span>
        <span className="text-slate-400">
          Akun: <strong className="text-slate-200">@{currentUser?.username || 'user'}</strong>
        </span>
      </div>

      {/* Mode Switcher: Hasil Survei vs Target Belum Disurvei */}
      <div className="grid grid-cols-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl mb-3 text-xs sm:text-sm font-bold">
        <button
          type="button"
          onClick={() => setViewMode('surveyed')}
          className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            viewMode === 'surveyed'
              ? 'bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Hasil Survei ({filteredVoters.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('target_dpt')}
          className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            viewMode === 'target_dpt'
              ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Target DPT ({unsurveyedDpt.length})</span>
        </button>
      </div>

      {viewMode === 'surveyed' ? (
        <>
          {/* Header & Search */}
          <div className="mb-3 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                Daftar Data Pemilih Terdata ({filteredVoters.length})
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">
                {currentUser?.role === 'petugas_rt'
                  ? `Wilayah RT ${currentUser.rtTugas} RW ${currentUser.rwTugas}`
                  : currentUser?.role === 'kordes_rw'
                  ? `Wilayah Binaan RW ${currentUser.rwTugas}`
                  : `Total se-Desa: ${voters.length}`}
              </span>
            </div>

            {/* Protection Scoping Banner */}
            {currentUser?.role === 'petugas_rt' && (
              <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-xs text-cyan-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="leading-snug">
                  <strong>Mode Petugas RT {currentUser.rtTugas} RW {currentUser.rwTugas}:</strong> Menampilkan data warga RT Anda & data input mandiri. Akses data RW/RT lain ditutup demi keamanan.
                </div>
              </div>
            )}
            {currentUser?.role === 'kordes_rw' && (
              <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-xs text-cyan-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="leading-snug">
                  <strong>Mode Koor RW {currentUser.rwTugas}:</strong> Menampilkan seluruh data warga di lingkungan binaan RW {currentUser.rwTugas}.
                </div>
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama pemilih, kampung, atau aspirasi..."
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin' || currentUser?.role === 'korlap') && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                <button
                  onClick={() => setFilterRw('ALL')}
                  className={`px-2.5 py-1 rounded-lg shrink-0 font-medium border cursor-pointer ${
                    filterRw === 'ALL'
                      ? 'bg-cyan-600 text-white border-cyan-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  Semua RW
                </button>
                {RW_LIST.map((rw) => (
                  <button
                    key={rw}
                    onClick={() => setFilterRw(rw)}
                    className={`px-2.5 py-1 rounded-lg shrink-0 font-medium border cursor-pointer ${
                      filterRw === rw
                        ? 'bg-cyan-600 text-white border-cyan-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    RW {rw}
                  </button>
                ))}
              </div>
            )}

            {/* Filter Choice Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                onClick={() => setFilterPilihan('ALL')}
                className={`px-2 py-0.8 rounded-md shrink-0 text-[11px] font-medium border cursor-pointer ${
                  filterPilihan === 'ALL'
                    ? 'bg-slate-700 text-white border-slate-500'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800'
                }`}
              >
                Semua Pilihan
              </button>
              <button
                onClick={() => setFilterPilihan('CENGHAR')}
                className={`px-2 py-0.8 rounded-md shrink-0 text-[11px] font-medium border cursor-pointer ${
                  filterPilihan === 'CENGHAR'
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-slate-900/60 text-emerald-400/80 border-slate-800'
                }`}
              >
                Cénghar
              </button>
              <button
                onClick={() => setFilterPilihan('BELUM_MEMILIH')}
                className={`px-2 py-0.8 rounded-md shrink-0 text-[11px] font-medium border cursor-pointer ${
                  filterPilihan === 'BELUM_MEMILIH'
                    ? 'bg-amber-600 text-white border-amber-400'
                    : 'bg-slate-900/60 text-amber-400/80 border-slate-800'
                }`}
              >
                Belum Punya Pilihan
              </button>
              <button
                onClick={() => setFilterPilihan('LAWAN')}
                className={`px-2 py-0.8 rounded-md shrink-0 text-[11px] font-medium border cursor-pointer ${
                  filterPilihan === 'LAWAN'
                    ? 'bg-rose-600 text-white border-rose-400'
                    : 'bg-slate-900/60 text-rose-400/80 border-slate-800'
                }`}
              >
                Calon Lawan
              </button>
              <button
                onClick={() => setFilterPilihan('TIDAK_MEMILIH')}
                className={`px-2 py-0.8 rounded-md shrink-0 text-[11px] font-medium border cursor-pointer ${
                  filterPilihan === 'TIDAK_MEMILIH'
                    ? 'bg-slate-600 text-white border-slate-400'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800'
                }`}
              >
                Golput / Halangan
              </button>
            </div>
          </div>

          {/* Voters List */}
          {filteredVoters.length === 0 ? (
            <div className="py-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
              <p className="text-xs">Belum ada data pemilih yang sesuai pencarian / filter.</p>
              <p className="text-[11px] text-slate-600 mt-1">Buka tab "Input" untuk mulai mencatat warga.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredVoters.map((v) => {
                const isCenghar = v.pilihan === 'CENGHAR';
                const isBelum = v.pilihan === 'BELUM_MEMILIH';
                const isLawan = v.pilihan === 'LAWAN';

                return (
                  <div
                    key={v.id}
                    className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-md space-y-2.5 transition hover:border-slate-700"
                  >
                    {/* Top Row: Name, Location, Sync status */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-extrabold text-white tracking-tight ${
                              fontSize === 'xlarge'
                                ? 'text-lg sm:text-xl'
                                : fontSize === 'large'
                                ? 'text-base sm:text-lg'
                                : 'text-sm sm:text-base'
                            }`}
                          >
                            {v.namaPemilih}
                          </span>
                          {v.syncStatus === 'pending' ? (
                            <span
                              title="Tersimpan lokal di HP (Offline)"
                              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            >
                              <Clock className="w-3 h-3" /> Offline
                            </span>
                          ) : (
                            <span
                              title="Tersinkron dengan Server"
                              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            >
                              <CheckCircle className="w-3 h-3" /> Sinkron
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-slate-300 flex items-center gap-1.5 mt-1 font-medium ${
                            fontSize === 'xlarge'
                              ? 'text-sm'
                              : fontSize === 'large'
                              ? 'text-xs sm:text-sm'
                              : 'text-[11px]'
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>
                            RW {v.rw} / RT {v.rt} • {v.kampung} (Dusun {v.dusun})
                          </span>
                        </div>
                      </div>

                      {/* Choice Badge */}
                      <div className="shrink-0 text-right">
                        {isCenghar && (
                          <span
                            className={`inline-block rounded-xl font-extrabold bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-sm ${
                              fontSize === 'xlarge'
                                ? 'text-sm px-3.5 py-1.5'
                                : fontSize === 'large'
                                ? 'text-xs sm:text-sm px-3 py-1.5'
                                : 'text-xs px-2.5 py-1'
                            }`}
                          >
                            Cénghar
                          </span>
                        )}
                        {isBelum && (
                          <span
                            className={`inline-block rounded-xl font-bold bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-sm ${
                              fontSize === 'xlarge'
                                ? 'text-sm px-3.5 py-1.5'
                                : fontSize === 'large'
                                ? 'text-xs sm:text-sm px-2.5 py-1'
                                : 'text-[11px] px-2 py-0.8'
                            }`}
                          >
                            Belum Memilih
                          </span>
                        )}
                        {isLawan && (
                          <span
                            className={`inline-block rounded-xl font-bold bg-rose-500/25 text-rose-300 border border-rose-500/50 shadow-sm ${
                              fontSize === 'xlarge'
                                ? 'text-sm px-3.5 py-1.5'
                                : fontSize === 'large'
                                ? 'text-xs sm:text-sm px-2.5 py-1'
                                : 'text-[11px] px-2 py-0.8'
                            }`}
                          >
                            {v.subPilihanLawan || 'Calon Lawan'}
                          </span>
                        )}
                        {v.pilihan === 'TIDAK_MEMILIH' && (
                          <span
                            className={`inline-block rounded-xl font-bold bg-slate-800 text-slate-200 border border-slate-700 ${
                              fontSize === 'xlarge'
                                ? 'text-sm px-3.5 py-1.5'
                                : fontSize === 'large'
                                ? 'text-xs sm:text-sm px-2.5 py-1'
                                : 'text-[11px] px-2 py-0.8'
                            }`}
                          >
                            Golput: {v.subPilihanTidakMemilih || 'Halangan'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Aspirasi or Remarks if any */}
                    {v.aspirasi && (
                      <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300">
                        <span className="text-[10px] uppercase font-bold text-cyan-400 block mb-0.5">
                          Aspirasi Warga:
                        </span>
                        <p className="italic">"{v.aspirasi}"</p>
                      </div>
                    )}

                    {/* Supervision Notes Thread */}
                    {v.notes && v.notes.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-800/30 space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-cyan-300 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Catatan Arahan Tim ({v.notes.length}):
                        </span>
                        {v.notes.map((n) => (
                          <div key={n.id} className="text-xs text-slate-300 bg-slate-900/60 p-1.5 rounded-lg">
                            <span className="font-semibold text-cyan-200">
                              {n.authorName} ({n.authorRole}):
                            </span>{' '}
                            <span>{n.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Delete Requested Banner */}
                    {v.deleteRequested && (
                      <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-600/40 text-[11px] text-amber-200 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Permohonan penghapusan sedang menunggu persetujuan Super Admin.</span>
                      </div>
                    )}

                    {/* Meta info & Action Buttons */}
                    <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        Diinput: <strong className="text-slate-400">{v.inputByUserName}</strong> (
                        {new Date(v.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        )
                      </span>

                      <div className="flex items-center gap-1.5">
                        {/* Add Supervision Note Button */}
                        {canAddNote(currentUser?.role) && (
                          <button
                            onClick={() => {
                              setActiveVoterForNote(v);
                              setNoteText('');
                            }}
                            className="p-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/50 text-xs transition cursor-pointer"
                            title="Beri Catatan Arahan"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Direct Delete Button */}
                        {canDirectDelete(v) && (
                          <button
                            onClick={() => {
                              setActiveVoterForDelete(v);
                              setDeleteReason('');
                              setIsRequestingDelete(false);
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs transition cursor-pointer"
                            title="Hapus Data (Wajib Catatan Alasan)"
                          >
                            <Trash2 className="w-3 h-3 text-rose-400" />
                            <span>Hapus</span>
                          </button>
                        )}

                        {/* Request Delete Button (Koor RW for RT input) */}
                        {canRequestDelete(v) && !v.deleteRequested && (
                          <button
                            onClick={() => {
                              setActiveVoterForDelete(v);
                              setDeleteReason('');
                              setIsRequestingDelete(true);
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50 text-xs transition cursor-pointer"
                            title="Ajukan Hapus ke Super Admin"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>Ajukan Hapus</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* TARGET DPT (Belum Disurvei) VIEW */
        <div className="space-y-3">
          {/* Header & Filter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-emerald-400" />
                  <span>Target Warga DPT Belum Terdata ({unsurveyedDpt.length})</span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Warga di DPT resmi yang belum memiliki rekam input survei
                </p>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={targetDptSearch}
                onChange={(e) => setTargetDptSearch(e.target.value)}
                placeholder="Cari nama warga, nomor DPT, atau alamat..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {targetDptSearch && (
                <button
                  type="button"
                  onClick={() => setTargetDptSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter RW if user has broad scope */}
            {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin' || currentUser?.role === 'korlap') && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-[11px] text-slate-400 shrink-0 font-medium">Filter RW:</span>
                <button
                  type="button"
                  onClick={() => {
                    setTargetFilterRw('ALL');
                    setTargetFilterRt('ALL');
                  }}
                  className={`px-2.5 py-1 rounded-lg shrink-0 text-xs font-semibold cursor-pointer border ${
                    targetFilterRw === 'ALL'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  Semua RW
                </button>
                {RW_LIST.map((rw) => (
                  <button
                    key={rw}
                    type="button"
                    onClick={() => {
                      setTargetFilterRw(rw);
                      setTargetFilterRt('ALL');
                    }}
                    className={`px-2.5 py-1 rounded-lg shrink-0 text-xs font-semibold cursor-pointer border ${
                      targetFilterRw === rw
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    RW {rw}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* List of Unsurveyed DPT Items */}
          {filteredUnsurveyedDpt.length === 0 ? (
            <div className="py-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
              <CheckCircle className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-300">Tidak ada target DPT yang cocok.</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Semua warga pada filter ini mungkin sudah berhasil didata atau sesuaikan kata kunci pencarian.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>Menampilkan {Math.min(filteredUnsurveyedDpt.length, 100)} dari {filteredUnsurveyedDpt.length} target warga</span>
                <span>Klik "+ Input" untuk catat</span>
              </div>
              {filteredUnsurveyedDpt.slice(0, 100).map((dpt) => (
                <div
                  key={`${dpt.rw}_${dpt.rt}_${dpt.no}_${dpt.nama}`}
                  className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-emerald-500/50 transition flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        #{dpt.no}
                      </span>
                      <strong
                        className={`font-bold text-white truncate ${
                          fontSize === 'xlarge'
                            ? 'text-base sm:text-lg'
                            : fontSize === 'large'
                            ? 'text-sm sm:text-base'
                            : 'text-xs sm:text-sm'
                        }`}
                      >
                        {dpt.nama}
                      </strong>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-slate-800 text-slate-200">
                        {dpt.jk === 'L' ? 'Laki-laki' : 'Perempuan'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-slate-800 text-slate-200">
                        {dpt.usia} thn
                      </span>
                    </div>
                    <div
                      className={`text-slate-300 flex items-center gap-2 font-medium ${
                        fontSize === 'xlarge'
                          ? 'text-sm'
                          : fontSize === 'large'
                          ? 'text-xs sm:text-sm'
                          : 'text-[11px]'
                      }`}
                    >
                      <span className="text-emerald-400 font-bold">RW {dpt.rw} / RT {dpt.rt}</span>
                      <span>•</span>
                      <span>Dusun {dpt.dusun}</span>
                      {dpt.alamat && dpt.alamat !== '-' && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[180px]">{dpt.alamat}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onQuickInputDpt && onQuickInputDpt(dpt)}
                    className="shrink-0 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold transition flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)] cursor-pointer active:scale-95"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ Input</span>
                  </button>
                </div>
              ))}
              {filteredUnsurveyedDpt.length > 100 && (
                <div className="p-3 text-center text-xs text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
                  Gunakan kolom pencarian nama di atas untuk mempersempit daftar warga (menampilkan 100 teratas dari {filteredUnsurveyedDpt.length} warga).
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal: Konfirmasi Hapus Data dengan Wajib Catatan Alasan */}
      {activeVoterForDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {isRequestingDelete ? 'Ajukan Penghapusan ke Super Admin' : 'Hapus Data Pemilih'}
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Nama: <strong>{activeVoterForDelete.namaPemilih}</strong> (RT {activeVoterForDelete.rt} RW{' '}
                  {activeVoterForDelete.rw})
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-amber-300">
              *Konsekuensi: Jika dihapus sah, kuota <strong>sisa DPT RT {activeVoterForDelete.rt} akan bertambah +1</strong> dan tercatat permanen di jejak audit.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Catatan Alasan Penghapusan <span className="text-rose-400">*Wajib</span>:
              </label>
              <textarea
                rows={3}
                required
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Contoh: Salah input nama warga / warga ternyata pindah domisili..."
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveVoterForDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!deleteReason.trim() || isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-50 transition cursor-pointer"
              >
                {isDeleting ? 'Memproses...' : isRequestingDelete ? 'Kirim Permohonan' : 'Konfirmasi Hapus (+1 DPT)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tambah Catatan Arahan Supervisi */}
      {activeVoterForNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Beri Catatan Arahan Tim</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Untuk data: <strong>{activeVoterForNote.namaPemilih}</strong> (RT {activeVoterForNote.rt} RW{' '}
                  {activeVoterForNote.rw})
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Catatan ini langsung tampil pada akun penginput, koordinator RW, Admin, dan Super Admin.
            </p>

            <div>
              <textarea
                rows={3}
                required
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Tuliskan arahan, tindak lanjut, atau catatan verifikasi..."
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveVoterForNote(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!noteText.trim() || isSubmittingNote}
                onClick={handleAddNoteSubmit}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Kirim Catatan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
