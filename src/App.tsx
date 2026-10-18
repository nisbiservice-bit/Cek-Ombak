import { useState, useEffect, useMemo } from 'react';
import { useSyncState } from './hooks/useSyncState';
import { Header } from './components/Header';
import { BottomNav, TabType } from './components/BottomNav';
import { InputView } from './components/InputView';
import { DataPemilihView } from './components/DataPemilihView';
import { RekapView } from './components/RekapView';
import { AkunView } from './components/AkunView';
import { LoginModal } from './components/LoginModal';
import { FontSize, MasterDptItem } from './types';

export default function App() {
  const {
    currentUser,
    updateUser,
    state,
    masterDpt,
    isOnline,
    isSyncing,
    offlineCount,
    syncMessage,
    addVoter,
    deleteVoter,
    requestDeleteVoter,
    resolveDeleteRequest,
    addSupervisionNote,
    updateBaselineDpt,
    updateZoneThresholds,
    resetDevice,
    toggleBlockUser,
    deleteUser,
    createUser,
    updateProfile,
    updateLocalState,
    refreshState,
    importMasterDpt,
  } = useSyncState();

  const [activeTab, setActiveTab] = useState<TabType>('input');
  const [selectedDptVoter, setSelectedDptVoter] = useState<MasterDptItem | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Font size state (Normal, Besar/Lansia, Ekstra Besar)
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    return (localStorage.getItem('cek_ombak_font_size') as FontSize) || 'normal';
  });

  useEffect(() => {
    localStorage.setItem('cek_ombak_font_size', fontSize);
    document.documentElement.setAttribute('data-fontsize', fontSize);
  }, [fontSize]);

  // If no user is logged in, show login modal
  useEffect(() => {
    if (!currentUser) {
      setIsLoginModalOpen(true);
    }
  }, [currentUser]);

  // Handle Logout
  const handleLogout = () => {
    updateUser(null);
    setIsLoginModalOpen(true);
  };

  // Change Password
  const handleChangePassword = async (oldPass: string, newPass: string) => {
    if (!currentUser) return { success: false, error: 'User tidak ditemukan' };
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          oldPassword: oldPass,
          newPassword: newPass,
        }),
      });
      if (res.ok) {
        return { success: true };
      } else {
        const data = await res.json();
        return { success: false, error: data.error };
      }
    } catch {
      return { success: false, error: 'Gagal menghubungi server' };
    }
  };

  // Scope voters according to currentUser role
  const scopedVoters = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'korlap') {
      return state.voters;
    }
    if (currentUser.role === 'kordes_rw') {
      return state.voters.filter(
        (v) => v.rw === currentUser.rwTugas || v.inputByUserId === currentUser.id
      );
    }
    if (currentUser.role === 'petugas_rt') {
      return state.voters.filter(
        (v) =>
          (v.rw === currentUser.rwTugas && v.rt === currentUser.rtTugas) ||
          v.inputByUserId === currentUser.id
      );
    }
    return [];
  }, [state.voters, currentUser]);

  // Unread notes count for this user
  const unreadNotesCount = currentUser
    ? state.voters.reduce((acc, v) => (v.inputByUserId === currentUser.id ? acc + v.notes.length : acc), 0)
    : 0;

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Fixed Header */}
      <Header
        currentUser={currentUser}
        isOnline={isOnline}
        isSyncing={isSyncing}
        offlineCount={offlineCount}
        syncMessage={syncMessage}
        fontSize={fontSize}
        onChangeFontSize={setFontSize}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        onRefresh={refreshState}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-2xl w-full mx-auto">
        {activeTab === 'input' && (
          <InputView
            regions={state.regions}
            currentUser={currentUser}
            onAddVoter={addVoter}
            masterDpt={masterDpt}
            voters={state.voters}
            initialDptVoter={selectedDptVoter}
            onClearInitialDptVoter={() => setSelectedDptVoter(null)}
            fontSize={fontSize}
          />
        )}

        {activeTab === 'voters' && (
          <DataPemilihView
            voters={scopedVoters}
            currentUser={currentUser}
            masterDpt={masterDpt}
            onQuickInputDpt={(dptItem) => {
              setSelectedDptVoter(dptItem);
              setActiveTab('input');
            }}
            onDeleteVoter={deleteVoter}
            onRequestDeleteVoter={requestDeleteVoter}
            onAddSupervisionNote={addSupervisionNote}
            fontSize={fontSize}
          />
        )}

        {activeTab === 'rekap' && (
          <RekapView
            regions={state.regions}
            voters={state.voters}
            currentUser={currentUser}
            zoneThresholds={state.zoneThresholds}
            onUpdateZoneThresholds={updateZoneThresholds}
            fontSize={fontSize}
          />
        )}

        {activeTab === 'akun' && (
          <AkunView
            currentUser={currentUser}
            users={state.users}
            regions={state.regions}
            auditLogs={state.auditLogs}
            deleteRequests={state.deleteRequests}
            masterDpt={masterDpt}
            onImportMasterDpt={importMasterDpt}
            onResetDevice={resetDevice}
            onToggleBlockUser={toggleBlockUser}
            onDeleteUser={deleteUser}
            onCreateUser={createUser}
            onResolveDeleteRequest={resolveDeleteRequest}
            onUpdateBaselineDpt={updateBaselineDpt}
            onChangePassword={handleChangePassword}
            onUpdateProfile={updateProfile}
            onRefresh={refreshState}
            fontSize={fontSize}
          />
        )}
      </main>

      {/* Bottom Navigation for single-handed mobile usage */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        voterCount={scopedVoters.length}
        unreadNotesCount={unreadNotesCount}
      />

      {/* Login & Role Switcher Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={currentUser}
        users={state.users}
        onSelectUser={(u, s) => {
          updateUser(u);
          if (s) updateLocalState(s);
          setIsLoginModalOpen(false);
          refreshState();
        }}
      />
    </div>
  );
}
