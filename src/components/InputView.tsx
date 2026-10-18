import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CandidateChoice, FontSize, MasterDptItem, NonVotingReason, OpponentCandidate, Region, User, Voter } from '../types';
import { RW_LIST } from '../data/regionsData';
import { CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Sparkles, MapPin, UserCheck, Flame, Users2, HelpCircle, XCircle, AlertTriangle, BookOpen, Check, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface InputViewProps {
  regions: Region[];
  currentUser: User | null;
  onAddVoter: (voterData: Omit<Voter, 'id' | 'createdAt' | 'syncStatus' | 'notes'>) => Promise<{ success: boolean; error?: string; voter?: Voter; offline?: boolean }>;
  masterDpt?: MasterDptItem[];
  voters?: Voter[];
  initialDptVoter?: MasterDptItem | null;
  onClearInitialDptVoter?: () => void;
  fontSize?: FontSize;
}

export const InputView: React.FC<InputViewProps> = ({
  regions,
  currentUser,
  onAddVoter,
  masterDpt = [],
  voters = [],
  initialDptVoter = null,
  onClearInitialDptVoter,
  fontSize = 'normal',
}) => {
  // Region Selection: Step 1 = RW, Step 2 = RT
  const [selectedRw, setSelectedRw] = useState<string>(currentUser?.rwTugas && currentUser.rwTugas !== 'all' ? currentUser.rwTugas : '01');
  const [selectedRt, setSelectedRt] = useState<string>(currentUser?.rtTugas && currentUser.rtTugas !== 'all' ? currentUser.rtTugas : '01');

  // Voter Information
  const [namaPemilih, setNamaPemilih] = useState<string>('');
  const [selectedDptCitizen, setSelectedDptCitizen] = useState<MasterDptItem | null>(null);
  const [showDptSuggestions, setShowDptSuggestions] = useState<boolean>(false);
  const [showDptPickerModal, setShowDptPickerModal] = useState<boolean>(false);
  const [dptPickerSearch, setDptPickerSearch] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronize initialDptVoter when selected from Target DPT view
  useEffect(() => {
    if (initialDptVoter) {
      setNamaPemilih(initialDptVoter.nama);
      setSelectedRw(initialDptVoter.rw);
      setSelectedRt(initialDptVoter.rt);
      setSelectedDptCitizen(initialDptVoter);
      if (initialDptVoter.alamat && initialDptVoter.alamat !== '-') {
        setNoRumah(initialDptVoter.alamat);
      }
      setShowDptSuggestions(false);
    }
  }, [initialDptVoter]);

  // Primary Choice
  const [pilihan, setPilihan] = useState<CandidateChoice>('CENGHAR');
  const [subPilihanLawan, setSubPilihanLawan] = useState<OpponentCandidate>('Komar Budiawan');
  const [subPilihanTidakMemilih, setSubPilihanTidakMemilih] = useState<NonVotingReason>('Luar Kota');

  // Optional Fields
  const [showOptionalFields, setShowOptionalFields] = useState<boolean>(false);
  const [aspirasi, setAspirasi] = useState<string>('');
  const [noRumah, setNoRumah] = useState<string>('');
  const [kepalaKeluarga, setKepalaKeluarga] = useState<string>('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Available RTs for selected RW
  const availableRts = useMemo(() => {
    return regions.filter((r) => r.rw === selectedRw).sort((a, b) => a.rt.localeCompare(b.rt));
  }, [regions, selectedRw]);

  // Selected region details (Dusun & Kampung)
  const currentRegion = useMemo(() => {
    return regions.find((r) => r.rw === selectedRw && r.rt === selectedRt) || availableRts[0];
  }, [regions, selectedRw, selectedRt, availableRts]);

  // Handle RW button click
  const handleSelectRw = (rw: string) => {
    setSelectedRw(rw);
    const rtsInRw = regions.filter((r) => r.rw === rw);
    if (rtsInRw.length > 0) {
      setSelectedRt(rtsInRw[0].rt);
    }
  };

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!namaPemilih.trim()) {
      setErrorMessage('Nama pemilih wajib diisi.');
      return;
    }

    if (!currentUser) {
      setErrorMessage('Silakan login terlebih dahulu untuk mencatat data.');
      return;
    }

    if (!currentRegion) {
      setErrorMessage('Wilayah belum valid.');
      return;
    }

    setIsSubmitting(true);

    const voterPayload: Omit<Voter, 'id' | 'createdAt' | 'syncStatus' | 'notes'> = {
      namaPemilih: namaPemilih.trim(),
      rw: selectedRw,
      rt: selectedRt,
      dusun: currentRegion.dusun,
      kampung: currentRegion.kampung,
      pilihan,
      subPilihanLawan: pilihan === 'LAWAN' ? subPilihanLawan : undefined,
      subPilihanTidakMemilih: pilihan === 'TIDAK_MEMILIH' ? subPilihanTidakMemilih : undefined,
      aspirasi: aspirasi.trim() || undefined,
      noRumah: noRumah.trim() || undefined,
      kepalaKeluarga: kepalaKeluarga.trim() || undefined,
      inputByUserId: currentUser.id,
      inputByUserName: currentUser.namaLengkap,
      inputByUserRole: currentUser.role,
    };

    const res = await onAddVoter(voterPayload);
    setIsSubmitting(false);

    if (res.success) {
      // Confetti burst if vote for Cénghar
      if (pilihan === 'CENGHAR') {
        try {
          confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.8 },
            colors: ['#10B981', '#06B6D4', '#F59E0B'],
          });
        } catch {
          // ignore canvas-confetti issues
        }
      }

      setSuccessToast(
        res.offline
          ? `Tersimpan di HP (Offline): ${namaPemilih} di RT ${selectedRt} RW ${selectedRw}. Sisa DPT berkurang 1.`
          : `Berhasil dicatat: ${namaPemilih} di RT ${selectedRt} RW ${selectedRw}. Sisa DPT berkurang 1!`
      );

      // Reset form but keep selected RW and RT for quick consecutive input!
      setNamaPemilih('');
      setSelectedDptCitizen(null);
      setAspirasi('');
      setNoRumah('');
      setKepalaKeluarga('');
      setPilihan('CENGHAR');
      if (onClearInitialDptVoter) onClearInitialDptVoter();

      setTimeout(() => {
        setSuccessToast(null);
      }, 4000);
    } else {
      setErrorMessage(res.error || 'Gagal menyimpan data.');
    }
  };

  // Master DPT Autocomplete suggestions
  const dptSuggestions = useMemo(() => {
    if (!namaPemilih.trim() || namaPemilih.trim().length < 2 || masterDpt.length === 0) return [];
    const q = namaPemilih.trim().toLowerCase();
    const matches = masterDpt.filter((d) => d.nama.toLowerCase().includes(q));
    // Prioritize voters in the currently selected RW & RT
    matches.sort((a, b) => {
      const aMatch = (a.rw === selectedRw && a.rt === selectedRt) ? 2 : (a.rw === selectedRw ? 1 : 0);
      const bMatch = (b.rw === selectedRw && b.rt === selectedRt) ? 2 : (b.rw === selectedRw ? 1 : 0);
      return bMatch - aMatch;
    });
    return matches.slice(0, 8);
  }, [namaPemilih, masterDpt, selectedRw, selectedRt]);

  // Check if voter already surveyed (duplicate warning)
  const duplicateVoter = useMemo(() => {
    if (!voters || !namaPemilih.trim()) return null;
    const cleanName = namaPemilih.trim().toLowerCase();
    return voters.find(
      (v) =>
        v.rw === selectedRw &&
        v.rt === selectedRt &&
        v.namaPemilih.toLowerCase() === cleanName
    );
  }, [voters, namaPemilih, selectedRw, selectedRt]);

  // DPT list for the currently selected RT & RW
  const rtsDptList = useMemo(() => {
    return masterDpt.filter((d) => d.rw === selectedRw && d.rt === selectedRt);
  }, [masterDpt, selectedRw, selectedRt]);

  const filteredRtsDptList = useMemo(() => {
    if (!dptPickerSearch.trim()) return rtsDptList;
    const q = dptPickerSearch.trim().toLowerCase();
    return rtsDptList.filter(
      (d) =>
        d.nama.toLowerCase().includes(q) ||
        d.alamat.toLowerCase().includes(q) ||
        String(d.no).includes(q)
    );
  }, [rtsDptList, dptPickerSearch]);

  const handleSelectDptCitizen = (citizen: MasterDptItem) => {
    setNamaPemilih(citizen.nama);
    if (!currentUser || currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'korlap') {
      setSelectedRw(citizen.rw);
      setSelectedRt(citizen.rt);
    }
    setSelectedDptCitizen(citizen);
    if (citizen.alamat && citizen.alamat !== '-') {
      setNoRumah(citizen.alamat);
    }
    setShowDptSuggestions(false);
    setShowDptPickerModal(false);
  };

  const isCitizenSurveyed = (citizen: MasterDptItem) => {
    const clean = citizen.nama.toLowerCase();
    return voters.find((v) => v.rw === citizen.rw && v.rt === citizen.rt && v.namaPemilih.toLowerCase() === clean);
  };

  return (
    <div className="pb-24 pt-2 px-3 max-w-xl mx-auto">
      {/* Success Notification Banner */}
      {successToast && (
        <div className="mb-4 p-3 bg-emerald-950/90 border border-emerald-500/50 rounded-xl text-xs text-emerald-200 flex items-start gap-2.5 shadow-lg shadow-emerald-950/50 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-snug">{successToast}</div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-rose-950/90 border border-rose-500/50 rounded-xl text-xs text-rose-200 flex items-start gap-2.5 shadow-lg shadow-rose-950/50 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-snug">{errorMessage}</div>
        </div>
      )}

      {/* Duplicate Warning Banner */}
      {duplicateVoter && (
        <div className="mb-4 p-3.5 bg-amber-950/90 border border-amber-500/60 rounded-xl text-xs text-amber-200 flex items-start gap-2.5 shadow-xl shadow-amber-950/50 animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <strong className="text-amber-300 block font-bold">PERINGATAN PENCATATAN GANDA</strong>
            Warga dengan nama <strong>&quot;{duplicateVoter.namaPemilih}&quot;</strong> di RT {duplicateVoter.rt} RW {duplicateVoter.rw} sudah pernah dicatat oleh{' '}
            <span className="text-white font-medium">{duplicateVoter.inputByUserName}</span> ({duplicateVoter.inputByUserRole}) pada{' '}
            {new Date(duplicateVoter.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} dengan pilihan{' '}
            <span className="font-bold text-amber-300 bg-amber-900/60 px-1.5 py-0.5 rounded border border-amber-700/50">
              {duplicateVoter.pilihan}
            </span>.
            <div className="text-[11px] text-amber-300/80 mt-1">
              Mohon pastikan Anda tidak mencatat orang yang sama dua kali.
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Card 1: Pemilihan Wilayah (Tombol RW -> Tombol RT) */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              1. Pilih Wilayah Pemilih
            </label>
            <span className="text-[11px] text-cyan-400/80 font-medium">Bebas Semua Wilayah</span>
          </div>

          {/* Baris Tombol RW */}
          <div className="mb-3">
            <span className="block text-[11px] text-slate-400 mb-1.5">Langkah 1: Pilih RW</span>
            <div className="grid grid-cols-6 gap-1.5">
              {RW_LIST.map((rw) => (
                <button
                  key={rw}
                  type="button"
                  onClick={() => handleSelectRw(rw)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    selectedRw === rw
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)] scale-102'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-700/60'
                  }`}
                >
                  RW {rw}
                </button>
              ))}
            </div>
          </div>

          {/* Baris Tombol RT (Dinamis sesuai RW terpilih) */}
          <div className="mb-3">
            <span className="block text-[11px] text-slate-400 mb-1.5">
              Langkah 2: Pilih RT di RW {selectedRw}
            </span>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {availableRts.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRt(r.rt)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    selectedRt === r.rt
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)] scale-102'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-700/60'
                  }`}
                >
                  RT {r.rt}
                </button>
              ))}
            </div>
          </div>

          {/* Hasil Wilayah Terpilih & Sisa DPT Live */}
          {currentRegion && (
            <div className="mt-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-white">
                  Dusun {currentRegion.dusun} • Kampung {currentRegion.kampung}
                </div>
                <div className="text-[11px] text-slate-400">
                  Total DPT: <span className="text-slate-200">{currentRegion.baselineDpt}</span> | Terdata:{' '}
                  <span className="text-cyan-400 font-medium">{currentRegion.voterCount}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Sisa DPT</span>
                <span className="text-sm font-extrabold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-500/30">
                  {currentRegion.remainingDpt}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Identitas Warga dengan Master DPT Autocomplete */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl relative">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              2. Identitas Warga
            </label>
            {rtsDptList.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDptPickerSearch('');
                  setShowDptPickerModal(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 hover:bg-cyan-900 text-[11px] font-semibold transition cursor-pointer"
              >
                <BookOpen className="w-3 h-3 text-cyan-400" />
                <span>Daftar DPT RT ({rtsDptList.length})</span>
              </button>
            )}
          </div>

          <div className="relative">
            <label className="block text-[11px] text-slate-400 mb-1">
              Nama Lengkap Pemilih <span className="text-rose-400 font-bold">*Wajib</span>
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                required
                value={namaPemilih}
                onChange={(e) => {
                  setNamaPemilih(e.target.value);
                  setShowDptSuggestions(true);
                  if (selectedDptCitizen && e.target.value !== selectedDptCitizen.nama) {
                    setSelectedDptCitizen(null);
                  }
                }}
                onFocus={() => {
                  if (namaPemilih.trim().length >= 2) setShowDptSuggestions(true);
                }}
                placeholder="Ketik 2-3 huruf nama warga (misal: Aas, Tatang, Cecep)..."
                className="w-full pl-3.5 pr-9 py-3 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
              />
              {namaPemilih && (
                <button
                  type="button"
                  onClick={() => {
                    setNamaPemilih('');
                    setSelectedDptCitizen(null);
                    setShowDptSuggestions(false);
                    if (onClearInitialDptVoter) onClearInitialDptVoter();
                  }}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Selected DPT Badge */}
            {selectedDptCitizen && (
              <div className="mt-2 p-2 bg-cyan-950/40 border border-cyan-600/40 rounded-xl text-xs flex items-center justify-between text-cyan-200 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-cyan-900/80 text-cyan-300 font-mono text-[10px] font-bold">
                    DPT #{selectedDptCitizen.no}
                  </span>
                  <span>
                    {selectedDptCitizen.jk === 'P' ? 'Perempuan' : 'Laki-laki'} • {selectedDptCitizen.usia} thn
                  </span>
                  <span className="text-slate-400 hidden sm:inline">
                    • {selectedDptCitizen.alamat}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                  <Check className="w-3 h-3" /> Terverifikasi DPT
                </span>
              </div>
            )}

            {/* Autocomplete Dropdown */}
            {showDptSuggestions && dptSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-slate-800 backdrop-blur-md">
                <div className="px-3 py-1.5 bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Hasil Rekomendasi Master DPT Langensari</span>
                  <span>{dptSuggestions.length} ditemukan</span>
                </div>
                {dptSuggestions.map((item) => {
                  const surveyed = isCitizenSurveyed(item);
                  const isCurrentRegion = item.rw === selectedRw && item.rt === selectedRt;
                  return (
                    <button
                      key={item.no}
                      type="button"
                      onClick={() => handleSelectDptCitizen(item)}
                      className={`w-full text-left p-3 hover:bg-slate-800/80 transition flex items-center justify-between cursor-pointer ${
                        isCurrentRegion ? 'bg-cyan-950/20' : ''
                      }`}
                    >
                      <div className="space-y-0.5 pr-2">
                        <div className="font-bold text-white text-xs flex items-center gap-1.5">
                          <span>{item.nama}</span>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                            #{item.no}
                          </span>
                          <span className={`text-[10px] px-1 py-0.2 rounded font-bold ${
                            item.jk === 'P' ? 'bg-pink-950/80 text-pink-300' : 'bg-blue-950/80 text-blue-300'
                          }`}>
                            {item.jk}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span className={isCurrentRegion ? 'text-cyan-400 font-bold' : ''}>
                            RT {item.rt} / RW {item.rw}
                          </span>
                          <span>• {item.usia} thn</span>
                          <span className="truncate max-w-[150px]">{item.alamat}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {surveyed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/60">
                            Sudah didata ({surveyed.pilihan})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                            Belum didata
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-1.5 text-[10px] text-slate-500">
              *Ketik nama warga untuk mencari otomatis di DPT resmi Desa Langensari. Data usia, jenis kelamin, dan alamat akan otomatis disesuaikan.
            </p>
          </div>
        </div>

        {/* Card 3: Pilihan Calon (Tombol Besar Ergonomis) */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            3. Arah Pilihan Pemilih
          </label>

          <div className="grid grid-cols-1 gap-2.5">
            {/* Pilihan 1: Cénghar (Aceng Saepulloh) */}
            <button
              type="button"
              onClick={() => setPilihan('CENGHAR')}
              className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                pilihan === 'CENGHAR'
                  ? 'bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-emerald-950/80 border-emerald-400 text-white shadow-[0_0_16px_rgba(16,185,129,0.35)] scale-[1.01]'
                  : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    pilihan === 'CENGHAR'
                      ? 'border-emerald-400 bg-emerald-500'
                      : 'border-slate-600 bg-slate-900'
                  }`}
                >
                  {pilihan === 'CENGHAR' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-sm font-bold flex items-center gap-2 text-white">
                    Aceng Saepulloh
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      Cénghar
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-300/80">Pilihan Utama Kemenangan</div>
                </div>
              </div>
              <Flame className={`w-5 h-5 ${pilihan === 'CENGHAR' ? 'text-emerald-400' : 'text-slate-600'}`} />
            </button>

            {/* Pilihan 2: Belum Punya Pilihan */}
            <button
              type="button"
              onClick={() => setPilihan('BELUM_MEMILIH')}
              className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                pilihan === 'BELUM_MEMILIH'
                  ? 'bg-amber-950/70 border-amber-400 text-white shadow-[0_0_14px_rgba(245,158,11,0.3)]'
                  : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    pilihan === 'BELUM_MEMILIH'
                      ? 'border-amber-400 bg-amber-500'
                      : 'border-slate-600 bg-slate-900'
                  }`}
                >
                  {pilihan === 'BELUM_MEMILIH' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Belum Punya Pilihan</div>
                  <div className="text-[11px] text-amber-300/80">Warga Mengambang (Swing Voter)</div>
                </div>
              </div>
              <HelpCircle
                className={`w-5 h-5 ${pilihan === 'BELUM_MEMILIH' ? 'text-amber-400' : 'text-slate-600'}`}
              />
            </button>

            {/* Pilihan 3: Calon Lawan */}
            <button
              type="button"
              onClick={() => setPilihan('LAWAN')}
              className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                pilihan === 'LAWAN'
                  ? 'bg-rose-950/70 border-rose-400 text-white shadow-[0_0_14px_rgba(244,63,94,0.3)]'
                  : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    pilihan === 'LAWAN'
                      ? 'border-rose-400 bg-rose-500'
                      : 'border-slate-600 bg-slate-900'
                  }`}
                >
                  {pilihan === 'LAWAN' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Memilih Calon Lawan</div>
                  <div className="text-[11px] text-rose-300/80">
                    {pilihan === 'LAWAN' ? `Dipilih: ${subPilihanLawan}` : 'Klik untuk memilih nama calon'}
                  </div>
                </div>
              </div>
              <Users2 className={`w-5 h-5 ${pilihan === 'LAWAN' ? 'text-rose-400' : 'text-slate-600'}`} />
            </button>

            {/* Sub-Pilihan Calon Lawan (4 Kandidat) */}
            {pilihan === 'LAWAN' && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 ml-4 space-y-2 animate-in fade-in">
                <span className="block text-[11px] font-medium text-rose-300 mb-1">
                  Pilih Nama Calon Lawan:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(['Komar Budiawan', 'Samiran', 'Sanusi', 'Fajar'] as OpponentCandidate[]).map(
                    (cand) => (
                      <button
                        key={cand}
                        type="button"
                        onClick={() => setSubPilihanLawan(cand)}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold text-center border transition cursor-pointer ${
                          subPilihanLawan === cand
                            ? 'bg-rose-600 text-white border-rose-300 shadow'
                            : 'bg-slate-900 text-slate-300 border-slate-700/70 hover:bg-slate-800'
                        }`}
                      >
                        {cand}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Pilihan 4: Tidak Akan Memilih (Golput/Berhalangan) */}
            <button
              type="button"
              onClick={() => setPilihan('TIDAK_MEMILIH')}
              className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                pilihan === 'TIDAK_MEMILIH'
                  ? 'bg-slate-800/80 border-slate-400 text-white shadow-[0_0_14px_rgba(148,163,184,0.3)]'
                  : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    pilihan === 'TIDAK_MEMILIH'
                      ? 'border-slate-400 bg-slate-400'
                      : 'border-slate-600 bg-slate-900'
                  }`}
                >
                  {pilihan === 'TIDAK_MEMILIH' && <div className="w-2 h-2 rounded-full bg-slate-950" />}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Tidak Akan Memilih (Golput)</div>
                  <div className="text-[11px] text-slate-400">
                    {pilihan === 'TIDAK_MEMILIH' ? `Alasan: ${subPilihanTidakMemilih}` : 'Berhalangan hadir / alasan lain'}
                  </div>
                </div>
              </div>
              <XCircle
                className={`w-5 h-5 ${pilihan === 'TIDAK_MEMILIH' ? 'text-slate-300' : 'text-slate-600'}`}
              />
            </button>

            {/* Sub-Pilihan Alasan Tidak Memilih */}
            {pilihan === 'TIDAK_MEMILIH' && (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 ml-4 space-y-2 animate-in fade-in">
                <span className="block text-[11px] font-medium text-slate-300 mb-1">
                  Pilih Alasan Tidak Memilih:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(['Luar Negeri', 'Luar Kota', 'Sakit/Lansia', 'Alasan Lainnya'] as NonVotingReason[]).map(
                    (rsn) => (
                      <button
                        key={rsn}
                        type="button"
                        onClick={() => setSubPilihanTidakMemilih(rsn)}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold text-center border transition cursor-pointer ${
                          subPilihanTidakMemilih === rsn
                            ? 'bg-slate-600 text-white border-slate-300 shadow'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {rsn}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Kolom Tambahan / Opsional (Aspirasi, No. Rumah, Kepala Keluarga) */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowOptionalFields(!showOptionalFields)}
            className="w-full p-3.5 flex items-center justify-between text-left text-xs font-medium text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <span>+ Catatan Aspirasi, No. Rumah / KK (Opsional)</span>
            {showOptionalFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showOptionalFields && (
            <div className="p-4 pt-1 space-y-3 border-t border-slate-800/80 animate-in fade-in">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Aspirasi / Keinginan Warga (Untuk Calon / Tim)
                </label>
                <textarea
                  rows={2}
                  value={aspirasi}
                  onChange={(e) => setAspirasi(e.target.value)}
                  placeholder="Contoh: Menginginkan perbaikan jalan gang dan saluran air lancar."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    No. Rumah / Patokan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={noRumah}
                    onChange={(e) => setNoRumah(e.target.value)}
                    placeholder="Contoh: No. 12 / Depan Mushola"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Nama Kepala Keluarga (Opsional)
                  </label>
                  <input
                    type="text"
                    value={kepalaKeluarga}
                    onChange={(e) => setKepalaKeluarga(e.target.value)}
                    placeholder="Contoh: Bpk. Ahmad"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit Action Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
        >
          {isSubmitting ? (
            <span>Menyimpan Catatan...</span>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Simpan Catatan Pemilih (-1 DPT RT {selectedRt})</span>
            </>
          )}
        </button>
      </form>

      {/* MODAL: Daftar DPT RT Ini (Quick Picker) */}
      {showDptPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-4 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  DPT RT {selectedRt} / RW {selectedRw}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Total {rtsDptList.length} Pemilih Terdaftar di RT ini
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDptPickerModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search in RT */}
            <div className="py-2.5">
              <div className="relative">
                <input
                  type="text"
                  value={dptPickerSearch}
                  onChange={(e) => setDptPickerSearch(e.target.value)}
                  placeholder="Cari nama warga di RT ini..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Citizen List in RT */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 pr-1 space-y-1">
              {filteredRtsDptList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Tidak ada nama warga yang cocok di RT ini.
                </div>
              ) : (
                filteredRtsDptList.map((citizen) => {
                  const surveyed = isCitizenSurveyed(citizen);
                  return (
                    <div
                      key={citizen.no}
                      className="py-2.5 flex items-center justify-between gap-2 hover:bg-slate-800/40 px-2 rounded-xl transition"
                    >
                      <div>
                        <div className="font-bold text-white text-xs flex items-center gap-1.5">
                          <span>{citizen.nama}</span>
                          <span className="text-[10px] font-mono text-slate-400">#{citizen.no}</span>
                          <span className={`text-[9px] px-1 rounded font-bold ${
                            citizen.jk === 'P' ? 'bg-pink-950 text-pink-300' : 'bg-blue-950 text-blue-300'
                          }`}>
                            {citizen.jk}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {citizen.usia} thn • {citizen.alamat}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {surveyed ? (
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800/50">
                            {surveyed.pilihan}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectDptCitizen(citizen)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer transition shadow"
                          >
                            Pilih
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
