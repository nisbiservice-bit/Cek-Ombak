import React, { useState, useMemo } from 'react';
import { FontSize, Region, User, Voter, ZoneThresholds } from '../types';
import { RW_LIST } from '../data/regionsData';
import { BarChart3, Sliders, MapPin, Flame, ShieldAlert, Lock } from 'lucide-react';
import { WatermarkOverlay } from './WatermarkOverlay';

interface RekapViewProps {
  regions: Region[];
  voters: Voter[];
  currentUser: User | null;
  zoneThresholds: ZoneThresholds;
  fontSize?: FontSize;
  onUpdateZoneThresholds: (greenMin: number, yellowMin: number) => Promise<{ success: boolean }>;
}

export const RekapView: React.FC<RekapViewProps> = ({
  regions,
  voters,
  currentUser,
  zoneThresholds,
  fontSize = 'normal',
  onUpdateZoneThresholds,
}) => {
  const [filterDusun, setFilterDusun] = useState<string>('ALL');
  const [filterRw, setFilterRw] = useState<string>('ALL');
  const [showThresholdModal, setShowThresholdModal] = useState<boolean>(false);
  const [greenInput, setGreenInput] = useState<number>(zoneThresholds.greenMinPercent);
  const [yellowInput, setYellowInput] = useState<number>(zoneThresholds.yellowMinPercent);
  const [isUpdatingThresholds, setIsUpdatingThresholds] = useState<boolean>(false);

  // Filtered Regions
  const filteredRegions = useMemo(() => {
    return regions.filter((r) => {
      if (filterDusun !== 'ALL' && r.dusun !== Number(filterDusun)) return false;
      if (filterRw !== 'ALL' && r.rw !== filterRw) return false;
      return true;
    });
  }, [regions, filterDusun, filterRw]);

  // Filtered Voters based on active filters
  const filteredVoters = useMemo(() => {
    const regionIds = new Set(filteredRegions.map((r) => `${r.rw}:${r.rt}`));
    return voters.filter((v) => regionIds.has(`${v.rw}:${v.rt}`));
  }, [voters, filteredRegions]);

  // Aggregate Metrics
  const totalBaselineDpt = useMemo(() => {
    return filteredRegions.reduce((sum, r) => sum + r.baselineDpt, 0);
  }, [filteredRegions]);

  const totalTerdata = filteredVoters.length;
  const totalSisaDpt = Math.max(0, totalBaselineDpt - totalTerdata);
  const persentaseTerdata = totalBaselineDpt > 0 ? ((totalTerdata / totalBaselineDpt) * 100).toFixed(1) : '0';

  // Vote Distribution
  const voteCounts = useMemo(() => {
    const counts = {
      cenghar: 0,
      belum: 0,
      lawanTotal: 0,
      lawanKomar: 0,
      lawanSamiran: 0,
      lawanSanusi: 0,
      lawanFajar: 0,
      tidakMemilih: 0,
      tidakLuarNegeri: 0,
      tidakLuarKota: 0,
      tidakSakitLansia: 0,
      tidakLainnya: 0,
    };

    filteredVoters.forEach((v) => {
      if (v.pilihan === 'CENGHAR') counts.cenghar++;
      else if (v.pilihan === 'BELUM_MEMILIH') counts.belum++;
      else if (v.pilihan === 'LAWAN') {
        counts.lawanTotal++;
        if (v.subPilihanLawan === 'Komar Budiawan') counts.lawanKomar++;
        else if (v.subPilihanLawan === 'Samiran') counts.lawanSamiran++;
        else if (v.subPilihanLawan === 'Sanusi') counts.lawanSanusi++;
        else if (v.subPilihanLawan === 'Fajar') counts.lawanFajar++;
      } else if (v.pilihan === 'TIDAK_MEMILIH') {
        counts.tidakMemilih++;
        if (v.subPilihanTidakMemilih === 'Luar Negeri') counts.tidakLuarNegeri++;
        else if (v.subPilihanTidakMemilih === 'Luar Kota') counts.tidakLuarKota++;
        else if (v.subPilihanTidakMemilih === 'Sakit/Lansia') counts.tidakSakitLansia++;
        else counts.tidakLainnya++;
      }
    });

    return counts;
  }, [filteredVoters]);

  const cengharPercent = totalTerdata > 0 ? ((voteCounts.cenghar / totalTerdata) * 100).toFixed(1) : '0';
  const lawanPercent = totalTerdata > 0 ? ((voteCounts.lawanTotal / totalTerdata) * 100).toFixed(1) : '0';
  const belumPercent = totalTerdata > 0 ? ((voteCounts.belum / totalTerdata) * 100).toFixed(1) : '0';
  const tidakPercent = totalTerdata > 0 ? ((voteCounts.tidakMemilih / totalTerdata) * 100).toFixed(1) : '0';

  // Zone Classifier function
  const getZone = (cCount: number, total: number) => {
    if (total === 0) return { label: 'Belum Terdata', color: 'text-slate-400 bg-slate-800 border-slate-700', badge: 'neutral' };
    const pct = (cCount / total) * 100;
    if (pct >= zoneThresholds.greenMinPercent) {
      return { label: 'Zona Hijau (Unggul)', color: 'text-emerald-300 bg-emerald-950/80 border-emerald-500/50', badge: 'green' };
    } else if (pct >= zoneThresholds.yellowMinPercent) {
      return { label: 'Zona Kuning (Ketat)', color: 'text-amber-300 bg-amber-950/80 border-amber-500/50', badge: 'yellow' };
    } else {
      return { label: 'Zona Merah (Rentan)', color: 'text-rose-300 bg-rose-950/80 border-rose-500/50', badge: 'red' };
    }
  };

  // RTs needing special attention (Zona Merah or Low Canvassing)
  const specialAttentionRts = useMemo(() => {
    return filteredRegions
      .map((r) => {
        const rVoters = voters.filter((v) => v.rw === r.rw && v.rt === r.rt);
        const cCount = rVoters.filter((v) => v.pilihan === 'CENGHAR').length;
        const total = rVoters.length;
        const pct = total > 0 ? (cCount / total) * 100 : 0;
        const zone = getZone(cCount, total);
        return {
          ...r,
          cCount,
          total,
          pct: pct.toFixed(1),
          zone,
        };
      })
      .filter((item) => item.zone.badge === 'red' || (item.total === 0 && item.baselineDpt > 150))
      .sort((a, b) => Number(a.pct) - Number(b.pct));
  }, [filteredRegions, voters, zoneThresholds]);

  // Handle Save Thresholds
  const handleSaveThresholds = async () => {
    setIsUpdatingThresholds(true);
    await onUpdateZoneThresholds(Number(greenInput), Number(yellowInput));
    setIsUpdatingThresholds(false);
    setShowThresholdModal(false);
  };

  const canEditThresholds = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

  return (
    <div
      className="pb-24 pt-2 px-3 max-w-xl mx-auto space-y-4 relative protected-data select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Forensic Watermark Overlay */}
      <WatermarkOverlay currentUser={currentUser} />

      {/* Security notice indicator */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
        <span className="flex items-center gap-1 text-cyan-400/90 font-medium">
          <Lock className="w-3 h-3 text-cyan-400" />
          Rekapitulasi Suara Internal • Dilindungi Cap Air
        </span>
        <span className="text-slate-400">
          Akun: <strong className="text-slate-200">@{currentUser?.username || 'user'}</strong>
        </span>
      </div>

      {/* Header & Filter Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className={`font-extrabold text-white tracking-tight flex items-center gap-1.5 ${
              fontSize === 'xlarge' ? 'text-lg sm:text-xl' : fontSize === 'large' ? 'text-base sm:text-lg' : 'text-sm'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            Rekapitulasi Suara & Peta Zona
          </h2>
          <p
            className={`text-slate-300 font-medium ${
              fontSize === 'xlarge' ? 'text-xs sm:text-sm' : 'text-[11px]'
            }`}
          >
            Peta dukungan Desa Langensari terkini
          </p>
        </div>

        {canEditThresholds && (
          <button
            onClick={() => {
              setGreenInput(zoneThresholds.greenMinPercent);
              setYellowInput(zoneThresholds.yellowMinPercent);
              setShowThresholdModal(true);
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-bold transition cursor-pointer active:scale-95"
            title="Atur Ambang Batas Persentase Zona (Super Admin / Admin)"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Atur Zona</span>
          </button>
        )}
      </div>

      {/* Filter Row: Dusun & RW */}
      <div className="flex items-center gap-2">
        {/* Dusun Filter */}
        <select
          value={filterDusun}
          onChange={(e) => setFilterDusun(e.target.value)}
          className={`px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-medium focus:outline-none focus:border-cyan-500 cursor-pointer ${
            fontSize === 'xlarge' ? 'text-sm' : 'text-xs'
          }`}
        >
          <option value="ALL">Semua Dusun (1-4)</option>
          <option value="1">Dusun 1</option>
          <option value="2">Dusun 2</option>
          <option value="3">Dusun 3</option>
          <option value="4">Dusun 4</option>
        </select>

        {/* RW Filter */}
        <select
          value={filterRw}
          onChange={(e) => setFilterRw(e.target.value)}
          className={`px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-medium focus:outline-none focus:border-cyan-500 cursor-pointer ${
            fontSize === 'xlarge' ? 'text-sm' : 'text-xs'
          }`}
        >
          <option value="ALL">Semua RW (01-06)</option>
          {RW_LIST.map((rw) => (
            <option key={rw} value={rw}>
              RW {rw}
            </option>
          ))}
        </select>
      </div>

      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
          <span className="text-[10px] sm:text-xs text-slate-300 uppercase font-bold block">Total DPT</span>
          <span
            className={`font-black text-white block my-0.5 ${
              fontSize === 'xlarge' ? 'text-xl sm:text-2xl' : fontSize === 'large' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
            }`}
          >
            {totalBaselineDpt.toLocaleString('id-ID')}
          </span>
          <span className="text-[10px] text-slate-400 block">35 RT se-Desa</span>
        </div>

        <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 text-center">
          <span className="text-[10px] sm:text-xs text-cyan-300 uppercase font-bold block">Terdata</span>
          <span
            className={`font-black text-cyan-400 block my-0.5 ${
              fontSize === 'xlarge' ? 'text-xl sm:text-2xl' : fontSize === 'large' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
            }`}
          >
            {totalTerdata.toLocaleString('id-ID')}
          </span>
          <span className="text-[10px] text-cyan-300 font-medium block">{persentaseTerdata}% Cakupan</span>
        </div>

        <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-800/40 text-center">
          <span className="text-[10px] sm:text-xs text-amber-300 uppercase font-bold block">Sisa DPT</span>
          <span
            className={`font-black text-amber-400 block my-0.5 ${
              fontSize === 'xlarge' ? 'text-xl sm:text-2xl' : fontSize === 'large' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
            }`}
          >
            {totalSisaDpt.toLocaleString('id-ID')}
          </span>
          <span className="text-[10px] text-amber-300 font-medium block">Belum Terdata</span>
        </div>
      </div>

      {/* Card: Perolehan Suara Utama (Aceng Saepulloh vs Calon Lawan) */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-emerald-400" />
            Sebaran Pilihan Suara Terdata
          </h3>
          <span className="text-[11px] text-slate-400">Total Masuk: {totalTerdata} Warga</span>
        </div>

        {/* Progress Bar Multi-Segment */}
        <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden flex border border-slate-800">
          <div
            style={{ width: `${cengharPercent}%` }}
            className="bg-emerald-500 transition-all duration-500"
            title={`Cénghar: ${cengharPercent}%`}
          />
          <div
            style={{ width: `${belumPercent}%` }}
            className="bg-amber-500 transition-all duration-500"
            title={`Belum Memilih: ${belumPercent}%`}
          />
          <div
            style={{ width: `${lawanPercent}%` }}
            className="bg-rose-500 transition-all duration-500"
            title={`Calon Lawan: ${lawanPercent}%`}
          />
          <div
            style={{ width: `${tidakPercent}%` }}
            className="bg-slate-500 transition-all duration-500"
            title={`Tidak Memilih: ${tidakPercent}%`}
          />
        </div>

        {/* Breakdown Cards */}
        <div className="space-y-2.5 pt-1">
          {/* 1. Cénghar */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <span
                  className={`font-black text-white block ${
                    fontSize === 'xlarge' ? 'text-base sm:text-lg' : fontSize === 'large' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                  }`}
                >
                  Aceng Saepulloh (Cénghar)
                </span>
                <span className="text-xs text-emerald-300 font-semibold">Kandidat Utama Tim Kita</span>
              </div>
            </div>
            <div className="text-right">
              <span
                className={`font-black text-emerald-400 block ${
                  fontSize === 'xlarge' ? 'text-xl sm:text-2xl' : fontSize === 'large' ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'
                }`}
              >
                {voteCounts.cenghar.toLocaleString('id-ID')} Suara
              </span>
              <span
                className={`text-emerald-300 block font-bold ${
                  fontSize === 'xlarge' ? 'text-sm' : 'text-xs'
                }`}
              >
                {cengharPercent}%
              </span>
            </div>
          </div>

          {/* 2. Belum Memilih */}
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-600/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0" />
              <div>
                <span
                  className={`font-bold text-white block ${
                    fontSize === 'xlarge' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                  }`}
                >
                  Belum Punya Pilihan
                </span>
                <span className="text-[11px] text-amber-300 font-medium">Potensi Suara Mengambang (Swing)</span>
              </div>
            </div>
            <div className="text-right">
              <span
                className={`font-bold text-amber-400 block ${
                  fontSize === 'xlarge' ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'
                }`}
              >
                {voteCounts.belum.toLocaleString('id-ID')} Suara
              </span>
              <span className="text-[11px] text-amber-300 font-medium block">{belumPercent}%</span>
            </div>
          </div>

          {/* 3. Calon Lawan & Rincian 4 Kandidat */}
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shrink-0" />
                <span
                  className={`font-bold text-white ${
                    fontSize === 'xlarge' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                  }`}
                >
                  Gabungan Calon Lawan
                </span>
              </div>
              <div className="text-right">
                <span
                  className={`font-bold text-rose-400 block ${
                    fontSize === 'xlarge' ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'
                  }`}
                >
                  {voteCounts.lawanTotal.toLocaleString('id-ID')} Suara
                </span>
                <span className="text-[11px] text-rose-300 font-medium block">{lawanPercent}%</span>
              </div>
            </div>

            {/* Rincian 4 Calon Lawan */}
            <div className="grid grid-cols-2 gap-2 pt-1.5 text-xs border-t border-rose-900/40">
              <div className="p-2 rounded-xl bg-slate-900/80 flex justify-between">
                <span className="text-slate-300">Komar Budiawan:</span>
                <strong className="text-rose-300 font-bold">{voteCounts.lawanKomar}</strong>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/80 flex justify-between">
                <span className="text-slate-300">Samiran:</span>
                <strong className="text-rose-300 font-bold">{voteCounts.lawanSamiran}</strong>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/80 flex justify-between">
                <span className="text-slate-300">Sanusi:</span>
                <strong className="text-rose-300 font-bold">{voteCounts.lawanSanusi}</strong>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/80 flex justify-between">
                <span className="text-slate-300">Fajar:</span>
                <strong className="text-rose-300 font-bold">{voteCounts.lawanFajar}</strong>
              </div>
            </div>
          </div>

          {/* 4. Tidak Memilih & Alasan */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-slate-500 shrink-0" />
                <span
                  className={`font-semibold text-slate-200 ${
                    fontSize === 'xlarge' ? 'text-sm' : 'text-xs'
                  }`}
                >
                  Tidak Akan Memilih (Golput)
                </span>
              </div>
              <div className="text-right">
                <span
                  className={`font-bold text-slate-300 block ${
                    fontSize === 'xlarge' ? 'text-base' : 'text-xs'
                  }`}
                >
                  {voteCounts.tidakMemilih.toLocaleString('id-ID')} Suara
                </span>
                <span className="text-[11px] text-slate-400 block">{tidakPercent}%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300 font-medium">
              <span>• Luar Negeri: {voteCounts.tidakLuarNegeri}</span>
              <span>• Luar Kota: {voteCounts.tidakLuarKota}</span>
              <span>• Sakit / Lansia: {voteCounts.tidakSakitLansia}</span>
              <span>• Alasan Lain: {voteCounts.tidakLainnya}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card: Peringatan RT Butuh Penanganan Khusus */}
      {specialAttentionRts.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/40 via-slate-900/80 to-slate-900 border border-rose-500/30 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              RT Butuh Penanganan Khusus ({specialAttentionRts.length} RT)
            </h3>
            <span className="text-[10px] text-rose-400/80 font-medium">Prioritas Lapangan</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Daftar RT dengan capaian Cénghar di bawah ambang batas ({zoneThresholds.yellowMinPercent}%) atau cakupan data masih minim:
          </p>
          <div className="space-y-2">
            {specialAttentionRts.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-slate-950/80 border border-rose-900/40 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-white">
                    RW {item.rw} / RT {item.rt} • {item.kampung}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Dusun {item.dusun} | DPT: {item.baselineDpt} | Sisa DPT: {item.remainingDpt}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-rose-400 block">{item.cCount} / {item.total} Cénghar</span>
                  <span className="text-[10px] text-slate-500">{item.pct}% Dukungan</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card: Rincian Lengkap Seluruh RT & Zona Wilayah */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-cyan-400" />
            Status Zona Wilayah Tiap RT ({filteredRegions.length} RT)
          </h3>
          <span className="text-[10px] text-slate-400">
            Hijau: &ge;{zoneThresholds.greenMinPercent}% | Kuning: &ge;{zoneThresholds.yellowMinPercent}%
          </span>
        </div>

        <div className="space-y-2">
          {filteredRegions.map((reg) => {
            const regVoters = voters.filter((v) => v.rw === reg.rw && v.rt === reg.rt);
            const cCount = regVoters.filter((v) => v.pilihan === 'CENGHAR').length;
            const lCount = regVoters.filter((v) => v.pilihan === 'LAWAN').length;
            const bCount = regVoters.filter((v) => v.pilihan === 'BELUM_MEMILIH').length;
            const total = regVoters.length;
            const cPercent = total > 0 ? ((cCount / total) * 100).toFixed(1) : '0';
            const zone = getZone(cCount, total);

            return (
              <div
                key={reg.id}
                className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-2 hover:border-slate-700 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-white text-xs flex items-center gap-2">
                      <span>RW {reg.rw} / RT {reg.rt}</span>
                      <span className="text-slate-400 font-normal">• {reg.kampung}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Dusun {reg.dusun} | DPT Asal: {reg.baselineDpt} | Sisa DPT:{' '}
                      <strong className="text-amber-400">{reg.remainingDpt}</strong>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${zone.color}`}>
                    {zone.label}
                  </span>
                </div>

                {/* Progress bar per RT */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-emerald-400 font-semibold">
                      Cénghar: {cCount} ({cPercent}%)
                    </span>
                    <span className="text-slate-400">
                      Lawan: {lCount} | Belum: {bCount} | Terdata: {total}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden flex">
                    <div
                      style={{ width: `${cPercent}%` }}
                      className="bg-emerald-500 h-full"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Atur Ambang Batas Persentase Zona */}
      {showThresholdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Kalibrasi Ambang Batas Zona</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Khusus Super Admin & Admin Lapangan
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Tentukan standar persentase suara Aceng Saepulloh (Cénghar) untuk mengklasifikasikan wilayah:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-emerald-400 mb-1">
                  Minimal Zona Hijau (Aman/Unggul) %:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={greenInput}
                    onChange={(e) => setGreenInput(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-bold"
                  />
                  <span className="text-sm text-slate-400">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-400 mb-1">
                  Minimal Zona Kuning (Persaingan Ketat) %:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={yellowInput}
                    onChange={(e) => setYellowInput(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-bold"
                  />
                  <span className="text-sm text-slate-400">%</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  *Di bawah nilai ini otomatis dikategorikan sebagai Zona Merah (Perlu Penanganan Khusus).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowThresholdModal(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isUpdatingThresholds}
                onClick={handleSaveThresholds}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:opacity-50 transition cursor-pointer"
              >
                {isUpdatingThresholds ? 'Menyimpan...' : 'Terapkan Pengaturan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
