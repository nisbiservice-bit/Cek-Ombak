import React, { useState, useEffect, useMemo } from 'react';
import { AuditLog, DeleteRequest, MasterDptItem, Region, Role, User } from '../types';
import { Shield, Smartphone, Key, UserPlus, Trash2, Ban, CheckCircle, Share2, Download, Check, ExternalLink, Edit3, Database, UploadCloud, AlertCircle, RefreshCw, Eye, EyeOff, Search } from 'lucide-react';
import { RW_LIST } from '../data/regionsData';
import { getStoredUserPassword, saveUserPassword } from '../services/storage';

interface AkunViewProps {
  currentUser: User | null;
  users: User[];
  regions: Region[];
  auditLogs: AuditLog[];
  deleteRequests: DeleteRequest[];
  masterDpt?: MasterDptItem[];
  fontSize?: string;
  onRefresh?: () => void;
  onImportMasterDpt?: (payload: { rawText?: string; items?: MasterDptItem[]; mode?: 'append' | 'replace' }) => Promise<{ success: boolean; total?: number; importedCount?: number; error?: string }>;
  onResetDevice: (userId: string) => Promise<{ success: boolean; error?: string }>;
  onToggleBlockUser: (userId: string) => Promise<{ success: boolean }>;
  onDeleteUser: (userId: string) => Promise<{ success: boolean }>;
  onCreateUser: (userData: {
    username: string;
    password?: string;
    namaLengkap: string;
    role: Role;
    rwTugas?: string;
    rtTugas?: string;
    phone?: string;
  }) => Promise<{ success: boolean; user?: User; error?: string }>;
  onResolveDeleteRequest: (reqId: string, action: 'approve' | 'reject') => Promise<{ success: boolean }>;
  onUpdateBaselineDpt: (regionId: string, newBaseline: number) => Promise<{ success: boolean }>;
  onChangePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateProfile: (profileData: { namaLengkap?: string; username?: string; phone?: string }) => Promise<{ success: boolean; error?: string }>;
}

export const AkunView: React.FC<AkunViewProps> = ({
  currentUser,
  users,
  regions,
  auditLogs,
  deleteRequests,
  masterDpt = [],
  fontSize,
  onRefresh,
  onImportMasterDpt,
  onResetDevice,
  onToggleBlockUser,
  onDeleteUser,
  onCreateUser,
  onResolveDeleteRequest,
  onUpdateBaselineDpt,
  onChangePassword,
  onUpdateProfile,
}) => {
  // Tabs within Akun View: 'profil' | 'tim' | 'permohonan' | 'audit' | 'dpt'
  const [activeSubTab, setActiveSubTab] = useState<'profil' | 'tim' | 'permohonan' | 'audit' | 'dpt'>('profil');

  // Change Password Modal
  const [showPassModal, setShowPassModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  // Edit Profile Modal (Ubah Nama & Username)
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editNama, setEditNama] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Standard 6-digit password for campaign team
  const STANDARD_DEFAULT_PASSWORD = '123456';
  const generate6DigitCode = () => Math.floor(100000 + Math.random() * 900000).toString();

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPasswordVal, setNewPasswordVal] = useState<string>(STANDARD_DEFAULT_PASSWORD);
  const [newNama, setNewNama] = useState('');
  const [newRole, setNewRole] = useState<Role>('petugas_rt');
  const [newRw, setNewRw] = useState('01');
  const [newRt, setNewRt] = useState('01');
  const [newPhone, setNewPhone] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [justCreatedUser, setJustCreatedUser] = useState<User | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Delete User Confirmation Modal
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Edit DPT Modal
  const [selectedRegionForDpt, setSelectedRegionForDpt] = useState<Region | null>(null);
  const [newDptInput, setNewDptInput] = useState<number>(0);

  // Master DPT Import Modal
  const [showDptImportModal, setShowDptImportModal] = useState(false);
  const [dptImportText, setDptImportText] = useState('');
  const [dptImportMode, setDptImportMode] = useState<'append' | 'replace'>('append');
  const [isImportingDpt, setIsImportingDpt] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setDptImportText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!dptImportText.trim() || !onImportMasterDpt) return;
    setIsImportingDpt(true);
    setImportResult(null);
    try {
      const res = await onImportMasterDpt({
        rawText: dptImportText,
        mode: dptImportMode,
      });
      if (res.success) {
        setImportResult({
          success: true,
          message: `Berhasil mengimpor ${res.importedCount || 0} data pemilih. Total database Master DPT sekarang: ${res.total || 0} data.`,
        });
        setDptImportText('');
      } else {
        setImportResult({
          success: false,
          message: res.error || 'Gagal mengimpor data DPT.',
        });
      }
    } catch (err: any) {
      setImportResult({
        success: false,
        message: err?.message || 'Terjadi kesalahan sistem saat impor data.',
      });
    } finally {
      setIsImportingDpt(false);
    }
  };

  // Allowed Roles to Create
  const getAllowedCreateRoles = (): Role[] => {
    if (!currentUser) return [];
    if (currentUser.role === 'super_admin') {
      return ['admin', 'korlap', 'kordes_rw', 'petugas_rt'];
    }
    if (currentUser.role === 'admin') {
      return ['korlap', 'kordes_rw', 'petugas_rt'];
    }
    if (currentUser.role === 'korlap') {
      return ['kordes_rw', 'petugas_rt'];
    }
    return [];
  };

  const allowedRoles = getAllowedCreateRoles();

  // Handle WhatsApp Share
  const getWhatsAppShareUrl = (user: User, rawPassword?: string) => {
    let appUrl = window.location.origin;
    if (appUrl.includes('ais-dev-')) {
      appUrl = appUrl.replace('ais-dev-', 'ais-pre-');
    }
    const storedPass = getStoredUserPassword(user.id) || getStoredUserPassword(user.username);
    const pass = rawPassword || user.password || storedPass || '123456';
    const message = `*AKUN RESMI CEK OMBAK - TIM CÉNGHAR*\n` +
      `Pemenangan Aceng Saepulloh - Desa Langensari\n\n` +
      `👤 Nama: *${user.namaLengkap}*\n` +
      `🏷️ Jabatan/Level: *${user.role.toUpperCase()}*\n` +
      `📍 Wilayah Penugasan: *${user.rwTugas !== 'all' ? `RW ${user.rwTugas}` : 'Semua Wilayah'} ${user.rtTugas && user.rtTugas !== 'all' ? `RT ${user.rtTugas}` : ''}*\n\n` +
      `🔐 *KREDENSIAL LOGIN:*\n` +
      `Username: *${user.username}*\n` +
      `Password: *${pass}*\n` +
      `Tautan Aplikasi: ${appUrl}\n\n` +
      `⚠️ *CATATAN PENTING:* Akun ini akan terkunci otomatis pada HP pertama yang Anda gunakan untuk login. Jaga kerahasiaan akun demi kemenangan Cénghar!`;

    const phoneClean = user.phone ? user.phone.replace(/[^0-9]/g, '') : '';
    const phoneFormatted = phoneClean.startsWith('0') ? '62' + phoneClean.slice(1) : phoneClean;
    return phoneFormatted
      ? `https://wa.me/${phoneFormatted}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  // Submit Password Change
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);
    const res = await onChangePassword(oldPassword, newPassword);
    if (res.success) {
      setPassSuccess('Kata sandi berhasil diganti!');
      setOldPassword('');
      setNewPassword('');
      setTimeout(() => setShowPassModal(false), 2000);
    } else {
      setPassError(res.error || 'Gagal mengubah kata sandi.');
    }
  };

  // Submit Edit Profile
  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    if (!editNama.trim() || !editUsername.trim()) {
      setProfileError('Nama Lengkap dan Username wajib diisi.');
      return;
    }
    setIsUpdatingProfile(true);
    const res = await onUpdateProfile({
      namaLengkap: editNama.trim(),
      username: editUsername.trim(),
      phone: editPhone.trim(),
    });
    setIsUpdatingProfile(false);
    if (res.success) {
      setProfileSuccess('Profil berhasil diperbarui!');
      setTimeout(() => setShowEditProfileModal(false), 1500);
    } else {
      setProfileError(res.error || 'Gagal memperbarui profil.');
    }
  };

  // Submit Create User
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const cleanUName = newUsername.trim().toLowerCase().replace(/\s+/g, '_');
    const cleanFull = newNama.trim();
    const cleanPass = newPasswordVal.trim() || STANDARD_DEFAULT_PASSWORD;

    if (!cleanUName || !cleanFull) {
      setCreateError('Nama lengkap dan username wajib diisi.');
      return;
    }

    const res = await onCreateUser({
      username: cleanUName,
      password: cleanPass,
      namaLengkap: cleanFull,
      role: newRole,
      rwTugas: newRole === 'kordes_rw' || newRole === 'petugas_rt' ? newRw : 'all',
      rtTugas: newRole === 'petugas_rt' ? newRt : 'all',
      phone: newPhone.trim(),
    });

    if (res.success && res.user) {
      const userWithExactPass: User = {
        ...res.user,
        password: cleanPass,
      };
      saveUserPassword(userWithExactPass.id, cleanPass);
      saveUserPassword(userWithExactPass.username, cleanPass);
      setJustCreatedUser(userWithExactPass);
      setNewUsername('');
      setNewNama('');
      setNewPhone('');
    } else {
      setCreateError(res.error || 'Gagal membuat akun.');
    }
  };

  // Export JSON Backup
  const handleExportBackup = () => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      exportedBy: currentUser?.namaLengkap,
      users,
      regions,
      auditLogs,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_cek_ombak_langensari_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Role & Team Visibility Hierarchy
  const visibleUsers = useMemo(() => {
    return users.filter((u) => {
      if (!currentUser) return false;
      if (currentUser.role === 'super_admin') {
        return true; // Super Admin can see all team accounts
      }
      if (currentUser.role === 'admin') {
        return u.role !== 'super_admin'; // Admin sees all fellow Admins, Korlaps, Koor RW, and Petugas RT
      }
      if (currentUser.role === 'korlap') {
        return u.role === 'kordes_rw' || u.role === 'petugas_rt';
      }
      if (currentUser.role === 'kordes_rw') {
        return u.role === 'petugas_rt' && (currentUser.rwTugas === 'all' || u.rwTugas === currentUser.rwTugas);
      }
      return false;
    });
  }, [users, currentUser]);

  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  const toggleRevealPassword = (userId: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const filteredVisibleUsers = useMemo(() => {
    return visibleUsers.filter((u) => {
      if (selectedRoleFilter !== 'all' && u.role !== selectedRoleFilter) {
        return false;
      }
      if (teamSearchQuery.trim()) {
        const q = teamSearchQuery.toLowerCase().trim();
        const matchName = u.namaLengkap.toLowerCase().includes(q);
        const matchUser = u.username.toLowerCase().includes(q);
        const matchRw = (u.rwTugas || '').toLowerCase().includes(q);
        return matchName || matchUser || matchRw;
      }
      return true;
    });
  }, [visibleUsers, selectedRoleFilter, teamSearchQuery]);

  const canAccessTimTab = Boolean(currentUser && currentUser.role !== 'petugas_rt');

  useEffect(() => {
    if (!canAccessTimTab && activeSubTab === 'tim') {
      setActiveSubTab('profil');
    }
    if (currentUser?.role !== 'super_admin' && (activeSubTab === 'audit' || activeSubTab === 'permohonan' || activeSubTab === 'dpt')) {
      setActiveSubTab('profil');
    }
  }, [canAccessTimTab, currentUser, activeSubTab]);

  const pendingDeleteReqs = deleteRequests.filter((r) => r.status === 'pending');

  return (
    <div className="pb-24 pt-2 px-3 max-w-xl mx-auto space-y-4">
      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          onClick={() => setActiveSubTab('profil')}
          className={`px-3 py-1.5 rounded-xl font-bold transition border cursor-pointer ${
            activeSubTab === 'profil'
              ? 'bg-amber-600 text-white border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
              : 'bg-slate-900 text-slate-400 border-slate-800'
          }`}
        >
          Profil Saya
        </button>

        {canAccessTimTab && (
          <button
            onClick={() => setActiveSubTab('tim')}
            className={`px-3 py-1.5 rounded-xl font-bold transition border cursor-pointer ${
              activeSubTab === 'tim'
                ? 'bg-amber-600 text-white border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            Manajemen Tim ({visibleUsers.length})
          </button>
        )}

        {currentUser?.role === 'super_admin' && (
          <button
            onClick={() => setActiveSubTab('permohonan')}
            className={`px-3 py-1.5 rounded-xl font-bold transition border relative cursor-pointer ${
              activeSubTab === 'permohonan'
                ? 'bg-amber-600 text-white border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            Permohonan Hapus
            {pendingDeleteReqs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-[10px]">
                {pendingDeleteReqs.length}
              </span>
            )}
          </button>
        )}

        {currentUser?.role === 'super_admin' && (
          <button
            onClick={() => setActiveSubTab('dpt')}
            className={`px-3 py-1.5 rounded-xl font-bold transition border cursor-pointer ${
              activeSubTab === 'dpt'
                ? 'bg-amber-600 text-white border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            Edit Master DPT
          </button>
        )}

        {currentUser?.role === 'super_admin' && (
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-3 py-1.5 rounded-xl font-bold transition border cursor-pointer ${
              activeSubTab === 'audit'
                ? 'bg-amber-600 text-white border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            Jejak Audit ({auditLogs.length})
          </button>
        )}
      </div>

      {/* SUB-TAB 1: PROFIL SAYA */}
      {activeSubTab === 'profil' && currentUser && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="px-2 py-0.8 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {currentUser.role.replace('_', ' ')}
                </span>
                <h3 className="text-base font-bold text-white mt-1.5">{currentUser.namaLengkap}</h3>
                <p className="text-xs text-slate-400">@{currentUser.username}</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-slate-800 text-amber-400">
                <Shield className="w-6 h-6" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
              <div className="p-2.5 rounded-xl bg-slate-950">
                <span className="text-[10px] text-slate-500 block uppercase">Wilayah Tugas</span>
                <strong className="text-white">
                  {currentUser.rwTugas !== 'all' ? `RW ${currentUser.rwTugas}` : 'Seluruh Desa'}
                  {currentUser.rtTugas && currentUser.rtTugas !== 'all' ? ` / RT ${currentUser.rtTugas}` : ''}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950">
                <span className="text-[10px] text-slate-500 block uppercase">Status Akun</span>
                <strong className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Aktif Bekerja
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950">
                <span className="text-[10px] text-slate-500 block uppercase">Dibuat Oleh</span>
                <span className="text-slate-300">{currentUser.createdBy || 'Pusat'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950">
                <span className="text-[10px] text-slate-500 block uppercase">Penguncian Perangkat</span>
                <span className="text-cyan-400 font-semibold truncate block">
                  {currentUser.deviceId ? 'Terkunci di HP ini' : 'Belum Terkunci'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => {
                  setEditNama(currentUser.namaLengkap);
                  setEditUsername(currentUser.username);
                  setEditPhone(currentUser.phone || '');
                  setShowEditProfileModal(true);
                  setProfileError(null);
                  setProfileSuccess(null);
                }}
                className="py-2.5 px-2 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/70 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5 border border-cyan-800/60 transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Ubah Nama Profil</span>
              </button>
              <button
                onClick={() => {
                  setShowPassModal(true);
                  setPassError(null);
                  setPassSuccess(null);
                }}
                className="py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Ganti Sandi</span>
              </button>
            </div>
          </div>

          {/* Backup / Ekspor Data - Khusus Super Admin */}
          {currentUser.role === 'super_admin' && (
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Cadangan Data Desa (JSON)</h4>
                <p className="text-[11px] text-slate-400">Unduh seluruh catatan pemilih & audit log</p>
              </div>
              <button
                onClick={handleExportBackup}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Data</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: MANAJEMEN TIM */}
      {activeSubTab === 'tim' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Daftar Akun Tim Lapangan</h3>
              <p className="text-[11px] text-slate-400">Total {visibleUsers.length} akun tim terdaftar</p>
            </div>
            <div className="flex items-center gap-2">
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700 transition cursor-pointer active:scale-95 shadow"
                  title="Sinkronkan data akun dari server & cloud seketika"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Sinkron</span>
                </button>
              )}
              {allowedRoles.length > 0 && (
                <button
                  onClick={() => {
                    setShowCreateModal(true);
                    setNewPasswordVal(STANDARD_DEFAULT_PASSWORD);
                    setJustCreatedUser(null);
                    setCreateError(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Buat Akun</span>
                </button>
              )}
            </div>
          </div>

          {/* Role Filter & Search Bar */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {[
                { id: 'all', label: `Semua (${visibleUsers.length})` },
                { id: 'admin', label: `Admin (${visibleUsers.filter((u) => u.role === 'admin').length})` },
                { id: 'korlap', label: `Korlap (${visibleUsers.filter((u) => u.role === 'korlap').length})` },
                { id: 'kordes_rw', label: `Koor RW (${visibleUsers.filter((u) => u.role === 'kordes_rw').length})` },
                { id: 'petugas_rt', label: `Petugas RT (${visibleUsers.filter((u) => u.role === 'petugas_rt').length})` },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setSelectedRoleFilter(pill.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition text-xs whitespace-nowrap cursor-pointer ${
                    selectedRoleFilter === pill.id
                      ? 'bg-amber-600 text-white border border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={teamSearchQuery}
                onChange={(e) => setTeamSearchQuery(e.target.value)}
                placeholder="Cari nama, username (@admin), atau wilayah tugas..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {teamSearchQuery && (
                <button
                  type="button"
                  onClick={() => setTeamSearchQuery('')}
                  className="absolute right-3 top-2 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Official Public Link */}
          {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin' || currentUser?.role === 'korlap') && (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-cyan-950/60 border border-emerald-500/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Tautan Aplikasi untuk Tim Lapangan
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const url = window.location.origin.includes('ais-dev-')
                      ? window.location.origin.replace('ais-dev-', 'ais-pre-')
                      : window.location.origin;
                    navigator.clipboard.writeText(url);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition flex items-center gap-1 shadow cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3 h-3 text-white" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3 h-3 text-white" />
                      <span>Salin Tautan</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-300 font-mono break-all bg-slate-950/70 p-2 rounded-xl border border-slate-800 select-all">
                {window.location.origin.includes('ais-dev-')
                  ? window.location.origin.replace('ais-dev-', 'ais-pre-')
                  : window.location.origin}
              </p>
            </div>
          )}

          {/* List of visible users */}
          <div className="space-y-2.5">
            {filteredVisibleUsers.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 text-xs text-slate-500 space-y-2">
                <p>Tidak ada akun tim yang sesuai dengan filter.</p>
                {selectedRoleFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => { setSelectedRoleFilter('all'); setTeamSearchQuery(''); }}
                    className="text-cyan-400 hover:underline text-xs"
                  >
                    Tampilkan Semua Akun
                  </button>
                )}
              </div>
            ) : (
              filteredVisibleUsers.map((u) => {
                const isSelf = u.id === currentUser?.id;
                const isCreatedByCurrentKorlap =
                  currentUser?.role === 'korlap' &&
                  (u.createdBy === currentUser.namaLengkap || u.createdBy === currentUser.username);

                const canResetDev =
                  !isSelf &&
                  Boolean(u.deviceId) &&
                  (currentUser?.role === 'super_admin' ||
                    (currentUser?.role === 'admin' && (u.role === 'korlap' || u.role === 'kordes_rw' || u.role === 'petugas_rt')) ||
                    isCreatedByCurrentKorlap);

                const canToggleBlock =
                  !isSelf &&
                  (currentUser?.role === 'super_admin' ||
                    (currentUser?.role === 'admin' && (u.role === 'korlap' || u.role === 'kordes_rw' || u.role === 'petugas_rt')) ||
                    isCreatedByCurrentKorlap);

                const canDel =
                  !isSelf &&
                  (currentUser?.role === 'super_admin' ||
                    (currentUser?.role === 'admin' && (u.role === 'korlap' || u.role === 'kordes_rw' || u.role === 'petugas_rt')) ||
                    isCreatedByCurrentKorlap);

                const canShare =
                  !isSelf &&
                  currentUser?.role !== 'kordes_rw' &&
                  (currentUser?.role === 'super_admin' ||
                    currentUser?.role === 'admin' ||
                    isCreatedByCurrentKorlap);

                const resolvedPass =
                  u.password ||
                  getStoredUserPassword(u.id) ||
                  getStoredUserPassword(u.username) ||
                  '123456';

                return (
                  <div
                    key={u.id}
                    className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-bold text-white">{u.namaLengkap}</strong>
                          {isSelf && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-cyan-500/20 text-cyan-300">
                              Saya
                            </span>
                          )}
                          {u.role === 'admin' && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          @{u.username} • Level: <strong className="text-amber-300 uppercase">{u.role.replace('_', ' ')}</strong>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Tugas: {u.rwTugas !== 'all' ? `RW ${u.rwTugas}` : 'Semua RW'}{' '}
                          {u.rtTugas && u.rtTugas !== 'all' ? `/ RT ${u.rtTugas}` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.status === 'aktif'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {u.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Password Credentials Box */}
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Key className="w-3.5 h-3.5 text-amber-400" />
                        <span>Password:</span>
                        <span className="font-mono font-bold tracking-widest text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700 select-all">
                          {revealedPasswords[u.id] ? resolvedPass : '••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleRevealPassword(u.id)}
                          className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
                          title={revealedPasswords[u.id] ? 'Sembunyikan password' : 'Lihat 6 digit password'}
                        >
                          {revealedPasswords[u.id] ? <EyeOff className="w-3.5 h-3.5 text-cyan-400" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      {canShare && (
                        <a
                          href={getWhatsAppShareUrl(u, resolvedPass)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition shadow cursor-pointer"
                          title="Kirim kredensial username & password ke WhatsApp"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>Bagi ke WA</span>
                        </a>
                      )}
                    </div>

                    {/* Device Lock status */}
                    <div className="p-2 rounded-xl bg-slate-950 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                        <span>
                          Status HP:{' '}
                          {u.role === 'super_admin' || u.role === 'admin' || u.role === 'korlap' ? (
                            <strong className="text-emerald-400">Bebas Multi-Perangkat (Manajemen)</strong>
                          ) : (
                            <strong className={u.deviceId ? 'text-amber-300' : 'text-slate-400'}>
                              {u.deviceId ? 'Terkunci di HP Petugas' : 'Belum Terkunci (Siap Login)'}
                            </strong>
                          )}
                        </span>
                      </div>
                      {canResetDev && (
                        <button
                          onClick={() => onResetDevice(u.id)}
                          className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold border border-amber-500/40 transition cursor-pointer"
                          title="Buka kunci agar petugas bisa login di HP baru"
                        >
                          Buka Kunci HP
                        </button>
                      )}
                    </div>

                    {/* Action buttons */}
                    {(canToggleBlock || canDel) && (
                      <div className="flex items-center justify-end pt-1 text-xs gap-1.5">
                          {canToggleBlock && (
                            <button
                              onClick={() => onToggleBlockUser(u.id)}
                              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                              title={u.status === 'aktif' ? 'Blokir Akun' : 'Buka Blokir'}
                            >
                              <Ban className="w-3.5 h-3.5 text-rose-400" />
                            </button>
                          )}
                          {canDel && (
                            <button
                              type="button"
                              onClick={() => setUserToDelete(u)}
                              className="p-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/40 cursor-pointer transition active:scale-95 shadow-sm"
                              title={`Hapus Akun ${u.namaLengkap}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            </button>
                          )}
                        </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: PERMOHONAN HAPUS DATA */}
      {activeSubTab === 'permohonan' && currentUser?.role === 'super_admin' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Permohonan Hapus Data Pemilih ({pendingDeleteReqs.length})
            </h3>
          </div>

          {pendingDeleteReqs.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 text-xs text-slate-500">
              Tidak ada permohonan penghapusan tertunda dari koordinator RW.
            </div>
          ) : (
            pendingDeleteReqs.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-md"
              >
                <div>
                  <div className="text-xs text-slate-400">
                    Diajukan oleh: <strong className="text-cyan-300">{req.requestedByUserName}</strong> ({req.requestedByUserRole})
                  </div>
                  <div className="text-sm font-bold text-white mt-1">
                    Warga: {req.voterName}
                  </div>
                  <div className="text-xs text-amber-300 bg-amber-950/40 p-2 rounded-lg mt-2 border border-amber-800/30">
                    Alasan: "{req.reason}"
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => onResolveDeleteRequest(req.id, 'reject')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Tolak
                  </button>
                  <button
                    onClick={() => onResolveDeleteRequest(req.id, 'approve')}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-950 cursor-pointer"
                  >
                    Setujui Hapus (+1 Sisa DPT)
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SUB-TAB 4: EDIT MASTER DPT */}
      {activeSubTab === 'dpt' && currentUser?.role === 'super_admin' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 shadow-lg space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Database Master DPT (Desa Langensari)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Data warga resmi by-name by-address untuk autocomplete & target per RT
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDptImportModal(true);
                  setImportResult(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-950 cursor-pointer shrink-0"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Import / Tambah DPT</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-[10px] text-slate-400">Total Dimuat di Sistem</div>
                <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                  {masterDpt.length.toLocaleString('id-ID')} <span className="text-[10px] text-slate-400 font-normal">warga</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="text-[10px] text-slate-400">Target DPT Resmi</div>
                <div className="text-sm font-bold text-white font-mono mt-0.5">
                  5.661 <span className="text-[10px] text-slate-400 font-normal">warga</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 col-span-2 sm:col-span-1">
                <div className="text-[10px] text-slate-400">Kelengkapan Database</div>
                <div className="text-sm font-bold text-cyan-400 font-mono mt-0.5">
                  {((masterDpt.length / 5661) * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (masterDpt.length / 5661) * 100)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Penyesuaian Baseline Kuota DPT Tiap RT
              </h3>
              <p className="text-[11px] text-slate-400">Total DPT Resmi Desa Langensari: 5.661</p>
            </div>
          </div>

          <div className="space-y-2">
            {regions.map((reg) => (
              <div
                key={reg.id}
                className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-white">
                    RW {reg.rw} / RT {reg.rt} • {reg.kampung}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Dusun {reg.dusun} | Terdata: {reg.voterCount} | Sisa:{' '}
                    <strong className="text-amber-400">{reg.remainingDpt}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-cyan-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                    {reg.baselineDpt} DPT
                  </span>
                  <button
                    onClick={() => {
                      setSelectedRegionForDpt(reg);
                      setNewDptInput(reg.baselineDpt);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    title="Ubah angka DPT RT ini"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: JEJAK AUDIT PERMANEN */}
      {activeSubTab === 'audit' && currentUser?.role === 'super_admin' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Jejak Audit Aktivitas Sistem
            </h3>
            <span className="text-[11px] text-slate-400">Tercatat permanen di server</span>
          </div>

          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/90 text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-bold text-cyan-400">
                    {log.userName} ({log.userRole})
                  </span>
                  <span>
                    {new Date(log.timestamp).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-slate-200">{log.description}</p>
                {log.dptImpact !== 0 && (
                  <span
                    className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      log.dptImpact < 0 ? 'bg-amber-950 text-amber-400' : 'bg-emerald-950 text-emerald-400'
                    }`}
                  >
                    Dampak DPT: {log.dptImpact > 0 ? `+${log.dptImpact}` : log.dptImpact}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: Ganti Password */}
      {showPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleChangePasswordSubmit}
            className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Ganti Kata Sandi Akun</h3>
            </div>
            {passError && <div className="text-xs text-rose-400 bg-rose-950/60 p-2 rounded-lg">{passError}</div>}
            {passSuccess && <div className="text-xs text-emerald-400 bg-emerald-950/60 p-2 rounded-lg">{passSuccess}</div>}
            <div>
              <label className="block text-xs text-slate-300 mb-1">Kata Sandi Lama:</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Kata Sandi Baru:</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPassModal(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
              >
                Simpan Kata Sandi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Buat Akun Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateUserSubmit}
            className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Buat Akun Tim Baru</h3>
            </div>
            {createError && <div className="text-xs text-rose-400 bg-rose-950/60 p-2 rounded-lg">{createError}</div>}
            {justCreatedUser ? (
              <div className="space-y-3 p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                  <CheckCircle className="w-4 h-4" />
                  <span>Akun Berhasil Dibuat!</span>
                </div>
                <div className="text-xs text-slate-300 space-y-1.5 p-2 bg-slate-950/80 rounded-lg border border-slate-800">
                  <div>Nama Petugas: <strong className="text-white">{justCreatedUser.namaLengkap}</strong></div>
                  <div>Username Login: <strong className="text-cyan-400 font-mono text-sm tracking-wide bg-slate-900 px-1.5 py-0.5 rounded border border-cyan-800/60">{justCreatedUser.username}</strong></div>
                  <div>Kata Sandi: <strong className="text-amber-300 font-mono">{justCreatedUser.password || newPasswordVal}</strong></div>
                  <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                    Petugas dapat login menggunakan <strong>Username</strong> atau <strong>Nama Lengkap</strong> di atas.
                  </p>
                </div>
                <a
                  href={getWhatsAppShareUrl(justCreatedUser, newPasswordVal)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Kirim Kredensial via WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setJustCreatedUser(null);
                    setShowCreateModal(false);
                  }}
                  className="w-full py-2 text-center text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Nama Lengkap Petugas:</label>
                  <input
                    type="text"
                    required
                    value={newNama}
                    onChange={(e) => setNewNama(e.target.value)}
                    placeholder="Contoh: Bpk. Suhendi"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Tingkatan Akun (Role):</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as Role)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    {allowedRoles.map((r) => (
                      <option key={r} value={r}>
                        {r.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Username Login:</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Contoh: suhendi_rt02"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span>Password Akun:</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                        6 Digit Standar
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNewPasswordVal(STANDARD_DEFAULT_PASSWORD)}
                        className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                        title="Kembalikan ke standar 123456"
                      >
                        Standar (123456)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewPasswordVal(generate6DigitCode())}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer transition active:scale-95"
                        title="Klik untuk acak 6 digit unik"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Acak</span>
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      required
                      value={newPasswordVal}
                      onChange={(e) => setNewPasswordVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      placeholder="123456"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-cyan-500/60 text-emerald-400 font-mono text-base font-black tracking-widest text-center focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 shadow-inner"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    *Password default adalah <strong>123456</strong> untuk seluruh anggota tim agar seragam, mudah diingat, dan tidak berubah-ubah.
                  </p>
                </div>
                {(newRole === 'kordes_rw' || newRole === 'petugas_rt') && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Pilih RW:</label>
                      <select
                        value={newRw}
                        onChange={(e) => setNewRw(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                      >
                        {RW_LIST.map((rw) => (
                          <option key={rw} value={rw}>
                            RW {rw}
                          </option>
                        ))}
                      </select>
                    </div>
                    {newRole === 'petugas_rt' && (
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Pilih RT:</label>
                        <select
                          value={newRt}
                          onChange={(e) => setNewRt(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                        >
                          {['01', '02', '03', '04', '05', '06', '07'].map((rt) => (
                            <option key={rt} value={rt}>
                              RT {rt}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">No. WhatsApp Petugas (Opsional):</label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Contoh: 08123456789"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Buat Akun & Lanjut WA
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}

      {/* MODAL: Edit DPT Per RT */}
      {selectedRegionForDpt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">
              Edit Kuota Baseline DPT: RT {selectedRegionForDpt.rt} RW {selectedRegionForDpt.rw}
            </h3>
            <p className="text-xs text-slate-400">
              Kampung: {selectedRegionForDpt.kampung} (Dusun {selectedRegionForDpt.dusun})
            </p>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Jumlah DPT Baru:</label>
              <input
                type="number"
                min="1"
                value={newDptInput}
                onChange={(e) => setNewDptInput(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm font-bold"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedRegionForDpt(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onUpdateBaselineDpt(selectedRegionForDpt.id, newDptInput);
                  setSelectedRegionForDpt(null);
                }}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Profil Akun */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleEditProfileSubmit}
            className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-3"
          >
            <div className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Ubah Nama & Profil Akun</h3>
            </div>
            {profileError && (
              <div className="text-xs text-rose-400 bg-rose-950/60 p-2 rounded-lg border border-rose-800/40">
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="text-xs text-emerald-400 bg-emerald-950/60 p-2 rounded-lg border border-emerald-800/40">
                {profileSuccess}
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Nama Lengkap Anda <span className="text-rose-400">*</span>:
              </label>
              <input
                type="text"
                required
                value={editNama}
                onChange={(e) => setEditNama(e.target.value)}
                placeholder="Masukkan nama asli Anda..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Username Login <span className="text-rose-400">*</span>:
              </label>
              <input
                type="text"
                required
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="Username login..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                No. WhatsApp / Telepon:
              </label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="08123456789"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isUpdatingProfile}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:opacity-50 transition cursor-pointer"
              >
                {isUpdatingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Konfirmasi Hapus Akun Tim */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Hapus Akun Petugas</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Yakin ingin menghapus akun <strong>{userToDelete.namaLengkap}</strong>?
                </p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Username:</span>
                <strong className="text-cyan-400 font-mono">@{userToDelete.username}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tingkat / Role:</span>
                <strong className="text-amber-300 uppercase">{userToDelete.role}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Wilayah Tugas:</span>
                <span className="text-white font-medium">
                  {userToDelete.rwTugas !== 'all' ? `RW ${userToDelete.rwTugas}` : 'Semua RW'}{' '}
                  {userToDelete.rtTugas && userToDelete.rtTugas !== 'all' ? `/ RT ${userToDelete.rtTugas}` : ''}
                </span>
              </div>
              <p className="text-rose-400 text-[10px] pt-1.5 border-t border-slate-800/80">
                *Akun ini akan dihapus permanen dan tidak akan dapat digunakan untuk masuk lagi.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={async () => {
                  setIsDeletingUser(true);
                  await onDeleteUser(userToDelete.id);
                  setIsDeletingUser(false);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-rose-950"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingUser ? 'Menghapus...' : 'Ya, Hapus Akun'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Import / Tambah Data Master DPT */}
      {showDptImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Import Data Master DPT</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Tambahkan atau perbarui database DPT resmi Desa Langensari
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDptImportModal(false);
                  setImportResult(null);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Mode selection */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDptImportMode('append')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                  dptImportMode === 'append'
                    ? 'bg-emerald-950/60 border-emerald-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>Tambah (Append)</span>
                  {dptImportMode === 'append' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                  Gabungkan data baru dengan data yang sudah ada (disarankan)
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDptImportMode('replace')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                  dptImportMode === 'replace'
                    ? 'bg-rose-950/60 border-rose-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>Ganti Total (Replace)</span>
                  {dptImportMode === 'replace' && <Check className="w-3.5 h-3.5 text-rose-400" />}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                  Hapus data lama dan ganti penuh dengan data yang diimpor
                </div>
              </button>
            </div>

            {/* Upload File Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Pilih File Dokumen (.txt / .tsv / .csv):
              </label>
              <input
                type="file"
                accept=".txt,.tsv,.csv"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer bg-slate-950 p-1.5 rounded-xl border border-slate-800"
              />
            </div>

            {/* Or Paste Raw Text */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Atau Tempel (Paste) Teks Baris DPT di Sini:
              </label>
              <textarea
                rows={5}
                value={dptImportText}
                onChange={(e) => setDptImportText(e.target.value)}
                placeholder="Contoh format TSV/Tab: 1 [tab] NAMA [tab] L [tab] 1990-01-01 [tab] 34 [tab] Dusun I [tab] 01 [tab] 01..."
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Format didukung: Kolom pemisah Tab (\t) atau Koma (,) sesuai data resmi DPT desa.
              </p>
            </div>

            {/* Result message */}
            {importResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  importResult.success
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                }`}
              >
                {importResult.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="leading-snug">{importResult.message}</div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowDptImportModal(false);
                  setImportResult(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={!dptImportText.trim() || isImportingDpt}
                onClick={handleExecuteImport}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-950"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{isImportingDpt ? 'Mengimpor...' : 'Mulai Proses Impor'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
