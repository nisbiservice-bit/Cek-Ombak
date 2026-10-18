import { useCallback, useEffect, useRef, useState } from 'react';
import { INITIAL_REGIONS } from '../data/regionsData';
import { INITIAL_USERS } from '../data/sampleUsers';
import {
  clearOfflineQueue,
  enqueueOfflineVoter,
  getOfflineQueue,
  getStoredState,
  getStoredUser,
  saveStoredState,
  saveStoredUser,
  saveUserPassword,
  getStoredUserPassword,
} from '../services/storage';
import { AppState, AuditLog, MasterDptItem, User, Voter } from '../types';
import initialMasterDpt from '../data/masterDpt.json';
import { subscribeToFirestoreState, saveToCloudFirestore } from '../services/firebase';

function mergeUsersList(primaryUsers: User[], secondaryUsers: User[]): User[] {
  const map = new Map<string, User>();
  for (const u of primaryUsers || []) {
    if (!u || !u.id) continue;
    const pass = u.password || getStoredUserPassword(u.id) || getStoredUserPassword(u.username);
    map.set(u.id, { ...u, password: pass || u.password });
  }
  for (const u of secondaryUsers || []) {
    if (!u || !u.id) continue;
    const existing = map.get(u.id) || (u.username ? map.get(u.username.toLowerCase()) : undefined);
    const pass = u.password || (existing && existing.password) || getStoredUserPassword(u.id) || getStoredUserPassword(u.username);
    if (!existing) {
      map.set(u.id, { ...u, password: pass || u.password });
    } else {
      map.set(existing.id, {
        ...existing,
        ...u,
        id: existing.id,
        password: pass || existing.password || u.password,
        deviceId: existing.deviceId || u.deviceId || null,
      });
    }
  }
  return Array.from(map.values());
}

const INITIAL_FALLBACK_STATE: AppState = {
  regions: JSON.parse(JSON.stringify(INITIAL_REGIONS)),
  voters: [],
  users: JSON.parse(JSON.stringify(INITIAL_USERS)),
  auditLogs: [],
  deleteRequests: [],
  zoneThresholds: {
    greenMinPercent: 50,
    yellowMinPercent: 30,
  },
  lastUpdated: new Date().toISOString(),
};

export function useSyncState() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());
  const [state, setState] = useState<AppState>(() => getStoredState() || INITIAL_FALLBACK_STATE);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [offlineCount, setOfflineCount] = useState<number>(() => getOfflineQueue().length);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [masterDpt, setMasterDpt] = useState<MasterDptItem[]>(() => (initialMasterDpt as MasterDptItem[]) || []);
  const isSyncingRef = useRef(false);

  // Helper to update state and cache to storage
  const updateLocalState = useCallback((newStateOrFn: AppState | ((prev: AppState) => AppState)) => {
    setState((prev) => {
      const next = typeof newStateOrFn === 'function' ? newStateOrFn(prev) : newStateOrFn;
      saveStoredState(next);
      return next;
    });
  }, []);

  // Update current user
  const updateUser = useCallback((user: User | null) => {
    setCurrentUser(user);
    saveStoredUser(user);
  }, []);

  // Sync offline queue to server
  const flushOfflineQueue = useCallback(async () => {
    if (isSyncingRef.current) return;
    const queue = getOfflineQueue();
    if (queue.length === 0) {
      setOfflineCount(0);
      return;
    }

    try {
      isSyncingRef.current = true;
      setIsSyncing(true);
      setSyncMessage(`Menyinkronkan ${queue.length} data offline ke server...`);

      const res = await fetch('/api/voters/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({
          offlineVoters: queue,
          userId: currentUser?.id,
          userName: currentUser?.namaLengkap,
          userRole: currentUser?.role,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        clearOfflineQueue();
        setOfflineCount(0);
        setIsOnline(true);
        if (data.state) {
          updateLocalState(data.state);
        }
        setSyncMessage(`Berhasil menyinkronkan ${data.syncedCount || queue.length} data!`);
        setTimeout(() => setSyncMessage(null), 3500);
      }
    } catch (err) {
      console.warn('Gagal sinkronisasi offline queue:', err);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [currentUser, updateLocalState]);

  // Fetch full state from server with active heartbeat detection
  const fetchServerState = useCallback(async () => {
    try {
      const res = await fetch('/api/state?_t=' + Date.now(), {
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      if (res.ok) {
        const serverState: AppState = await res.json();
        setIsOnline(true);

        // Keep local offline pending voters visible while awaiting network sync
        const queue = getOfflineQueue();
        if (queue.length > 0) {
          const serverVoterIds = new Set(serverState.voters.map((v) => v.id));
          const pendingUnsynced = queue.filter((q) => !serverVoterIds.has(q.id));
          if (pendingUnsynced.length > 0) {
            serverState.voters = [...pendingUnsynced, ...serverState.voters];
          }
        }

        // Merge users safely so local and cloud users are never wiped
        setState((prevState) => {
          const mergedUsers = mergeUsersList(serverState.users, prevState.users);
          const finalState: AppState = {
            ...serverState,
            users: mergedUsers,
          };
          saveStoredState(finalState);
          return finalState;
        });

        // Keep current session user synchronized with server state in real-time
        if (currentUser) {
          const freshUser = serverState.users.find((u) => u.id === currentUser.id);
          if (freshUser) {
            if (freshUser.status === 'terblokir') {
              updateUser(null);
            } else if (
              freshUser.namaLengkap !== currentUser.namaLengkap ||
              freshUser.username !== currentUser.username ||
              freshUser.role !== currentUser.role ||
              freshUser.rwTugas !== currentUser.rwTugas ||
              freshUser.rtTugas !== currentUser.rtTugas
            ) {
              updateUser(freshUser);
            }
          }
        }
        return true;
      }
    } catch {
      // offline or server unreachable
      setIsOnline(false);
    }
    return false;
  }, [currentUser, updateLocalState, updateUser]);

  // Fetch Master DPT records from server
  const fetchMasterDpt = useCallback(async () => {
    try {
      const res = await fetch('/api/master-dpt?limit=all');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          setMasterDpt(data.items);
        }
      }
    } catch {
      // Offline fallback already loaded via initialMasterDpt
    }
  }, []);

  // Online / Offline listener & High-Frequency Polling
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      fetchServerState().then((ok) => {
        if (ok) flushOfflineQueue();
      });
      fetchMasterDpt();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Mobile app switch / screen unlock event listener
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' || !document.hidden) {
        fetchServerState().then((ok) => {
          if (ok) {
            const queue = getOfflineQueue();
            if (queue.length > 0) flushOfflineQueue();
          }
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // Initial fetch
    fetchServerState().then((ok) => {
      if (ok) flushOfflineQueue();
    });
    fetchMasterDpt();

    // 3-second heartbeat polling for live collaboration across all devices (PC & HP)
    const interval = setInterval(() => {
      if (!isSyncingRef.current) {
        fetchServerState().then((ok) => {
          if (ok) {
            const queue = getOfflineQueue();
            if (queue.length > 0) {
              flushOfflineQueue();
            }
          }
        });
      }
    }, 3000);

    // Real-time Cloud Firestore subscription
    const unsubscribeFirestore = subscribeToFirestoreState((cloudState) => {
      setIsOnline(true);
      // Merge local offline pending voters
      const queue = getOfflineQueue();
      if (queue.length > 0) {
        const cloudVoterIds = new Set(cloudState.voters.map((v) => v.id));
        const pendingUnsynced = queue.filter((q) => !cloudVoterIds.has(q.id));
        if (pendingUnsynced.length > 0) {
          cloudState.voters = [...pendingUnsynced, ...cloudState.voters];
        }
      }

      setState((prevState) => {
        const mergedUsers = mergeUsersList(cloudState.users, prevState.users);
        const finalCloudState: AppState = {
          ...cloudState,
          users: mergedUsers,
        };
        saveStoredState(finalCloudState);
        return finalCloudState;
      });

      // Synchronize users to server.ts backend so PC db-state.json has them
      if (Array.isArray(cloudState.users) && cloudState.users.length > 0) {
        fetch('/api/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ users: cloudState.users }),
        }).catch(console.warn);
      }

      // Keep active session user synchronized in real-time
      if (currentUser) {
        const freshUser = cloudState.users.find((u) => u.id === currentUser.id);
        if (freshUser) {
          if (freshUser.status === 'terblokir') {
            updateUser(null);
          } else if (
            freshUser.namaLengkap !== currentUser.namaLengkap ||
            freshUser.username !== currentUser.username ||
            freshUser.role !== currentUser.role ||
            freshUser.rwTugas !== currentUser.rwTugas ||
            freshUser.rtTugas !== currentUser.rtTugas
          ) {
            updateUser(freshUser);
          }
        }
      }
    }, state);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearInterval(interval);
      if (typeof unsubscribeFirestore === 'function') {
        unsubscribeFirestore();
      }
    };
  }, [fetchServerState, flushOfflineQueue, fetchMasterDpt, currentUser, updateLocalState, updateUser]);

  // Add voter (always attempts server save first, falls back gracefully to offline queue)
  const addVoter = useCallback(
    async (voterData: Omit<Voter, 'id' | 'createdAt' | 'syncStatus' | 'notes'>) => {
      const tempId = 'vtr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const newVoter: Voter = {
        ...voterData,
        id: tempId,
        createdAt: new Date().toISOString(),
        syncStatus: 'synced',
        notes: [],
      };

      // Optimistic local update: add voter and decrement DPT for RT
      updateLocalState((prev) => {
        const updatedVoters = [newVoter, ...prev.voters];
        const updatedRegions = prev.regions.map((reg) => {
          if (reg.rw === newVoter.rw && reg.rt === newVoter.rt) {
            const count = reg.voterCount + 1;
            return {
              ...reg,
              voterCount: count,
              remainingDpt: Math.max(0, reg.baselineDpt - count),
            };
          }
          return reg;
        });

        const newLog: AuditLog = {
          id: 'log_' + Date.now(),
          timestamp: new Date().toISOString(),
          userId: newVoter.inputByUserId,
          userName: newVoter.inputByUserName,
          userRole: newVoter.inputByUserRole,
          action: 'INPUT_VOTER',
          description: `Mencatat pemilih ${newVoter.namaPemilih} di RT ${newVoter.rt} RW ${newVoter.rw} (${newVoter.kampung}) [${newVoter.pilihan}]`,
          dptImpact: -1,
          rw: newVoter.rw,
          rt: newVoter.rt,
        };

        const next = {
          ...prev,
          voters: updatedVoters,
          regions: updatedRegions,
          auditLogs: [newLog, ...prev.auditLogs],
          lastUpdated: new Date().toISOString(),
        };
        saveToCloudFirestore(next).catch(console.warn);
        return next;
      });

      // Always attempt network POST first!
      try {
        const res = await fetch('/api/voters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
          body: JSON.stringify(newVoter),
        });

        if (res.ok) {
          const data = await res.json();
          setIsOnline(true);
          if (data.state) {
            updateLocalState(data.state);
          }
          return { success: true, voter: data.voter };
        } else {
          const errData = await res.json();
          if (errData.error === 'DUPLICATE_VOTER') {
            // Rollback optimistic update
            fetchServerState();
            return { success: false, error: errData.message };
          }
          // Other server error -> fallback to offline queue
          newVoter.syncStatus = 'pending';
          enqueueOfflineVoter(newVoter);
          setOfflineCount(getOfflineQueue().length);
          updateLocalState((prev) => ({
            ...prev,
            voters: prev.voters.map((v) => (v.id === newVoter.id ? { ...v, syncStatus: 'pending' } : v)),
          }));
          return { success: true, voter: newVoter, offline: true };
        }
      } catch {
        // Network failed during send -> mark offline & enqueue
        setIsOnline(false);
        newVoter.syncStatus = 'pending';
        enqueueOfflineVoter(newVoter);
        setOfflineCount(getOfflineQueue().length);
        updateLocalState((prev) => ({
          ...prev,
          voters: prev.voters.map((v) => (v.id === newVoter.id ? { ...v, syncStatus: 'pending' } : v)),
        }));
        return { success: true, voter: newVoter, offline: true };
      }
    },
    [updateLocalState, fetchServerState]
  );

  // Delete voter with required reason
  const deleteVoter = useCallback(
    async (id: string, reason: string) => {
      if (!currentUser) return { success: false, error: 'Silakan login terlebih dahulu' };

      // Local optimistic removal
      const target = state.voters.find((v) => v.id === id);
      if (!target) return { success: false, error: 'Data pemilih tidak ditemukan' };

      updateLocalState((prev) => {
        const updatedVoters = prev.voters.filter((v) => v.id !== id);
        const updatedRegions = prev.regions.map((reg) => {
          if (reg.rw === target.rw && reg.rt === target.rt) {
            const count = Math.max(0, reg.voterCount - 1);
            return {
              ...reg,
              voterCount: count,
              remainingDpt: reg.baselineDpt - count,
            };
          }
          return reg;
        });

        const newLog: AuditLog = {
          id: 'log_' + Date.now(),
          timestamp: new Date().toISOString(),
          userId: currentUser.id,
          userName: currentUser.namaLengkap,
          userRole: currentUser.role,
          action: 'DELETE_VOTER',
          description: `Menghapus data pemilih di RT ${target.rt} RW ${target.rw}. Alasan: "${reason}". Sisa DPT bertambah +1.`,
          dptImpact: +1,
          rw: target.rw,
          rt: target.rt,
        };

        const next = {
          ...prev,
          voters: updatedVoters,
          regions: updatedRegions,
          auditLogs: [newLog, ...prev.auditLogs],
          lastUpdated: new Date().toISOString(),
        };
        saveToCloudFirestore(next).catch(console.warn);
        return next;
      });

      if (isOnline) {
        try {
          const res = await fetch(`/api/voters/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reason,
              deleterId: currentUser.id,
              deleterName: currentUser.namaLengkap,
              deleterRole: currentUser.role,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.state) updateLocalState(data.state);
            return { success: true };
          }
        } catch {
          // Re-sync later
        }
      }
      return { success: true };
    },
    [currentUser, state.voters, updateLocalState, isOnline]
  );

  // Request deletion (for Koor RW to Super Admin)
  const requestDeleteVoter = useCallback(
    async (id: string, reason: string) => {
      if (!currentUser) return { success: false, error: 'Login diperlukan' };

      updateLocalState((prev) => ({
        ...prev,
        voters: prev.voters.map((v) => (v.id === id ? { ...v, deleteRequested: true } : v)),
      }));

      try {
        const res = await fetch(`/api/voters/${id}/request-delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason,
            requestedByUserId: currentUser.id,
            requestedByUserName: currentUser.namaLengkap,
            requestedByUserRole: currentUser.role,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.state) updateLocalState(data.state);
          return { success: true };
        }
      } catch (err) {
        console.warn(err);
      }
      return { success: true };
    },
    [currentUser, updateLocalState]
  );

  // Resolve deletion request (Super Admin)
  const resolveDeleteRequest = useCallback(
    async (reqId: string, action: 'approve' | 'reject') => {
      if (!currentUser || currentUser.role !== 'super_admin') return { success: false };

      try {
        const res = await fetch(`/api/delete-requests/${reqId}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            resolverId: currentUser.id,
            resolverName: currentUser.namaLengkap,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.state) updateLocalState(data.state);
          return { success: true };
        }
      } catch (err) {
        console.warn(err);
      }
      return { success: false };
    },
    [currentUser, updateLocalState]
  );

  // Add supervision note
  const addSupervisionNote = useCallback(
    async (voterId: string, text: string) => {
      if (!currentUser) return { success: false };

      updateLocalState((prev) => ({
        ...prev,
        voters: prev.voters.map((v) =>
          v.id === voterId
            ? {
                ...v,
                notes: [
                  {
                    id: 'nt_' + Date.now(),
                    authorId: currentUser.id,
                    authorName: currentUser.namaLengkap,
                    authorRole: currentUser.role,
                    text,
                    createdAt: new Date().toISOString(),
                  },
                  ...v.notes,
                ],
              }
            : v
        ),
      }));

      try {
        const res = await fetch(`/api/voters/${voterId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authorId: currentUser.id,
            authorName: currentUser.namaLengkap,
            authorRole: currentUser.role,
            text,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.state) updateLocalState(data.state);
          return { success: true };
        }
      } catch (err) {
        console.warn(err);
      }
      return { success: true };
    },
    [currentUser, updateLocalState]
  );

  // Update baseline DPT (Super Admin only)
  const updateBaselineDpt = useCallback(
    async (regionId: string, newBaselineDpt: number) => {
      if (!currentUser || currentUser.role !== 'super_admin') return { success: false };

      try {
        const res = await fetch(`/api/regions/${regionId}/dpt`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newBaselineDpt,
            adminId: currentUser.id,
            adminName: currentUser.namaLengkap,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.state) updateLocalState(data.state);
          return { success: true };
        }
      } catch (err) {
        console.warn(err);
      }
      return { success: false };
    },
    [currentUser, updateLocalState]
  );

  // Update zone thresholds (Admin & Super Admin)
  const updateZoneThresholds = useCallback(
    async (greenMinPercent: number, yellowMinPercent: number) => {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return { success: false };
      }

      try {
        const res = await fetch('/api/settings/zones', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            greenMinPercent,
            yellowMinPercent,
            updaterId: currentUser.id,
            updaterName: currentUser.namaLengkap,
            updaterRole: currentUser.role,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.state) updateLocalState(data.state);
          return { success: true };
        }
      } catch (err) {
        console.warn(err);
      }
      return { success: false };
    },
    [currentUser, updateLocalState]
  );

  // Reset Device (Super Admin, Admin, and Korlap for own accounts)
  const resetDevice = useCallback(
    async (targetUserId: string) => {
      if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin' && currentUser.role !== 'korlap')) {
        return { success: false, error: 'Tidak memiliki wewenang untuk Reset Device' };
      }

      try {
        const res = await fetch(`/api/users/${targetUserId}/reset-device`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminId: currentUser.id,
            adminName: currentUser.namaLengkap,
            adminRole: currentUser.role,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.state) updateLocalState(data.state);
          return { success: true };
        } else {
          const errData = await res.json();
          return { success: false, error: errData.error || 'Gagal mereset perangkat' };
        }
      } catch (err) {
        console.warn(err);
      }
      return { success: false, error: 'Gagal mereset perangkat' };
    },
    [currentUser, updateLocalState]
  );

  // Toggle Block User
  const toggleBlockUser = useCallback(
    async (targetUserId: string) => {
      if (!currentUser) return { success: false };

      try {
        const res = await fetch(`/api/users/${targetUserId}/toggle-block`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actorId: currentUser.id,
            actorName: currentUser.namaLengkap,
            actorRole: currentUser.role,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.state) updateLocalState(data.state);
          return { success: true };
        }
      } catch (err) {
        console.warn(err);
      }
      return { success: false };
    },
    [currentUser, updateLocalState]
  );

  // Delete User
  const deleteUser = useCallback(
    async (targetUserId: string) => {
      if (!currentUser) return { success: false };

      // Optimistic local update so UI reflects deletion immediately
      updateLocalState((prev) => ({
        ...prev,
        users: prev.users.filter((u) => u.id !== targetUserId),
      }));

      try {
        const res = await fetch(`/api/users/${targetUserId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actorId: currentUser.id,
            actorName: currentUser.namaLengkap,
            actorRole: currentUser.role,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.state) updateLocalState(data.state);
          return { success: true };
        }
      } catch (err) {
        console.warn(err);
      }
      return { success: false };
    },
    [currentUser, updateLocalState]
  );

  // Create User
  const createUser = useCallback(
    async (userData: {
      username: string;
      password?: string;
      namaLengkap: string;
      role: User['role'];
      rwTugas?: string;
      rtTugas?: string;
      phone?: string;
    }) => {
      if (!currentUser) return { success: false, error: 'Login diperlukan' };

      const cleanPass = (userData.password && userData.password.trim())
        ? userData.password.trim()
        : '123456';

      const newUserId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const newUser: User = {
        id: newUserId,
        username: userData.username.trim(),
        password: cleanPass,
        namaLengkap: userData.namaLengkap.trim(),
        role: userData.role,
        rwTugas: userData.rwTugas || 'all',
        rtTugas: userData.rtTugas || 'all',
        createdBy: currentUser.namaLengkap,
        createdAt: new Date().toISOString(),
        status: 'aktif',
        deviceId: null,
        phone: userData.phone || '',
      };

      const newLog: AuditLog = {
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        userId: currentUser.id,
        userName: currentUser.namaLengkap,
        userRole: currentUser.role,
        action: 'CREATE_USER',
        description: `Membuat akun baru "${newUser.namaLengkap}" (${newUser.username}) tingkat ${newUser.role}`,
        dptImpact: 0,
      };

      // Cache password locally for WhatsApp sharing
      saveUserPassword(newUserId, cleanPass);
      saveUserPassword(newUser.username, cleanPass);

      // Optimistic update locally and broadcast via Firestore to all devices
      updateLocalState((prev) => {
        const next = {
          ...prev,
          users: [newUser, ...prev.users.filter((u) => u.username.toLowerCase() !== newUser.username.toLowerCase())],
          auditLogs: [newLog, ...prev.auditLogs],
          lastUpdated: new Date().toISOString(),
        };
        saveToCloudFirestore(next).catch(console.warn);
        return next;
      });

      // Also sync to backend server immediately
      try {
        fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: newUserId,
            ...userData,
            password: cleanPass,
            creatorId: currentUser.id,
            creatorName: currentUser.namaLengkap,
            creatorRole: currentUser.role,
          }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d?.state) {
              updateLocalState(d.state);
            }
          })
          .catch(console.warn);
      } catch {
        // offline
      }

      return { success: true, user: newUser };
    },
    [currentUser, updateLocalState]
  );

  // Update Profile (Nama Lengkap, Username, Phone)
  const updateProfile = useCallback(
    async (profileData: { namaLengkap?: string; username?: string; phone?: string }) => {
      if (!currentUser) return { success: false, error: 'User tidak ditemukan' };

      try {
        const res = await fetch('/api/users/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            ...profileData,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            updateUser(data.user);
          }
          if (data.state) {
            updateLocalState(data.state);
          }
          return { success: true, user: data.user };
        } else {
          const errData = await res.json();
          return { success: false, error: errData.error || errData.message };
        }
      } catch {
        return { success: false, error: 'Gagal menghubungi server' };
      }
    },
    [currentUser, updateUser, updateLocalState]
  );

  // Import / Append Master DPT (Super Admin & Admin)
  const importMasterDpt = useCallback(
    async (payload: { rawText?: string; items?: MasterDptItem[]; mode?: 'append' | 'replace' }) => {
      if (!currentUser) return { success: false, error: 'Silakan login terlebih dahulu' };

      try {
        const res = await fetch('/api/master-dpt/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            actorId: currentUser.id,
            actorName: currentUser.namaLengkap,
            actorRole: currentUser.role,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          await fetchMasterDpt();
          await fetchServerState();
          return { success: true, total: data.total, importedCount: data.importedCount };
        } else {
          return { success: false, error: data.error || 'Gagal mengimpor data DPT' };
        }
      } catch (err: any) {
        return { success: false, error: err?.message || 'Gagal menghubungi server' };
      }
    },
    [currentUser, fetchMasterDpt, fetchServerState]
  );

  return {
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
    refreshState: fetchServerState,
    refreshMasterDpt: fetchMasterDpt,
    importMasterDpt,
  };
}
