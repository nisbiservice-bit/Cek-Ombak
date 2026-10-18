import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_REGIONS } from './src/data/regionsData';
import { INITIAL_USERS } from './src/data/sampleUsers';
import { AppState, DeleteRequest, MasterDptItem, User, Voter } from './src/types/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.resolve(__dirname, 'db-state.json');
const DB_BACKUP_FILE = path.resolve(__dirname, 'db-state.backup.json');
const DB_TMP_FILE = path.resolve(__dirname, 'db-state.json.tmp');
const MASTER_DPT_FILE = path.resolve(__dirname, 'src/data/masterDpt.json');

let masterDpt: MasterDptItem[] = [];

function loadMasterDpt(): MasterDptItem[] {
  try {
    if (fs.existsSync(MASTER_DPT_FILE)) {
      const raw = fs.readFileSync(MASTER_DPT_FILE, 'utf-8');
      if (raw && raw.trim().length > 0) {
        return JSON.parse(raw);
      }
    }
  } catch (err) {
    console.error('Failed to load masterDpt.json:', err);
  }
  return [];
}

masterDpt = loadMasterDpt();

function saveMasterDpt() {
  try {
    fs.writeFileSync(MASTER_DPT_FILE, JSON.stringify(masterDpt), 'utf-8');
  } catch (err) {
    console.error('Failed to save masterDpt.json:', err);
  }
}

function loadState(): AppState {
  // 1. Try primary db-state.json
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      if (raw && raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.regions) && Array.isArray(parsed.users)) {
          try {
            fs.writeFileSync(DB_BACKUP_FILE, raw, 'utf-8');
          } catch {
            // ignore backup write errors
          }
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load primary db-state.json, attempting backup:', err);
  }

  // 2. Try backup file
  try {
    if (fs.existsSync(DB_BACKUP_FILE)) {
      const backupRaw = fs.readFileSync(DB_BACKUP_FILE, 'utf-8');
      if (backupRaw && backupRaw.trim().length > 0) {
        const backupParsed = JSON.parse(backupRaw);
        if (backupParsed && Array.isArray(backupParsed.regions) && Array.isArray(backupParsed.users)) {
          console.info('Successfully recovered database from db-state.backup.json');
          return backupParsed;
        }
      }
    }
  } catch (backupErr) {
    console.error('Failed to load backup state:', backupErr);
  }

  // 3. Fallback to default
  return {
    regions: JSON.parse(JSON.stringify(INITIAL_REGIONS)),
    voters: [],
    users: JSON.parse(JSON.stringify(INITIAL_USERS)),
    auditLogs: [
      {
        id: 'log_init',
        timestamp: new Date().toISOString(),
        userId: 'usr_superadmin',
        userName: 'Super Admin (Pimpinan)',
        userRole: 'super_admin',
        action: 'UPDATE_DPT',
        description: 'Inisialisasi Master Data 35 RT Desa Langensari (Total 5.661 DPT)',
        dptImpact: 0,
      },
    ],
    deleteRequests: [],
    zoneThresholds: {
      greenMinPercent: 50,
      yellowMinPercent: 30,
    },
    lastUpdated: new Date().toISOString(),
  };
}

const state: AppState = loadState();

function persistState() {
  try {
    const jsonStr = JSON.stringify(state, null, 2);
    fs.writeFileSync(DB_TMP_FILE, jsonStr, 'utf-8');
    fs.renameSync(DB_TMP_FILE, DB_FILE);
    try {
      fs.writeFileSync(DB_BACKUP_FILE, jsonStr, 'utf-8');
    } catch {
      // ignore backup write error
    }
  } catch (err) {
    console.error('Failed to write db-state.json atomically:', err);
  }
}

function recalculateRegion(rw: string, rt: string) {
  const region = state.regions.find((r) => r.rw === rw && r.rt === rt);
  if (!region) return;
  const count = state.voters.filter((v) => v.rw === rw && v.rt === rt).length;
  region.voterCount = count;
  region.remainingDpt = Math.max(0, region.baselineDpt - count);
  state.lastUpdated = new Date().toISOString();
  persistState();
}

function recalculateAllRegions() {
  for (const region of state.regions) {
    const count = state.voters.filter((v) => v.rw === region.rw && v.rt === region.rt).length;
    region.voterCount = count;
    region.remainingDpt = Math.max(0, region.baselineDpt - count);
  }
}

recalculateAllRegions();

async function startServer() {
  const app = express();
  app.use(express.json());

  // Universal CORS & Mobile Connectivity Headers
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-device-id, Cache-Control, Pragma');
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    next();
  });

  app.options('*', (_req, res) => {
    res.sendStatus(200);
  });

  // Health / Ping
  app.get('/api/ping', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // State provider (preserves credentials for team distribution via WhatsApp)
  function getSanitizedState(rawState: AppState): AppState {
    return rawState;
  }

  // Get consolidated app state
  app.get('/api/state', (_req, res) => {
    res.json(getSanitizedState(state));
  });

  // Authentication & Device Lock with Flexible Username / Full Name / Phone Matching
  app.post('/api/login', (req, res) => {
    const { username, password, deviceId, resetDevice } = req.body;
    const cleanInput = (username || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanInput) {
      return res.status(400).json({ error: 'EMPTY_USERNAME', message: 'Nama pengguna atau username tidak boleh kosong.' });
    }

    const user = state.users.find((u) => {
      const uUser = (u.username || '').trim().toLowerCase();
      const uNama = (u.namaLengkap || '').trim().toLowerCase();
      const uPhone = (u.phone || '').replace(/\D/g, '');
      const inputPhone = cleanInput.replace(/\D/g, '');

      return (
        uUser === cleanInput ||
        uNama === cleanInput ||
        (u.id === 'usr_superadmin' && (cleanInput === 'superadmin' || cleanInput === 'admin')) ||
        (inputPhone.length >= 8 && uPhone === inputPhone)
      );
    });

    if (!user) {
      return res.status(401).json({
        error: 'USER_NOT_FOUND',
        message: `Username atau nama "${username}" tidak ditemukan. Pastikan Anda memasukkan username yang tepat.`,
      });
    }

    if (user.status === 'terblokir') {
      return res.status(403).json({ error: 'USER_BLOCKED', message: 'Akun Anda sedang diblokir oleh pimpinan.' });
    }

    const userPass = (user.password || '123456').trim();
    const isPassMatch =
      userPass === cleanPassword ||
      (cleanPassword === '123456' && userPass === '123') ||
      (cleanPassword === '123' && userPass === '123456');

    if (!isPassMatch) {
      return res.status(401).json({ error: 'WRONG_PASSWORD', message: 'Kata sandi tidak sesuai.' });
    }

    const isLeadership = user.role === 'super_admin' || user.role === 'admin' || user.role === 'korlap';

    if (isLeadership) {
      if (deviceId) {
        user.deviceId = deviceId;
      }
      user.lastActive = new Date().toISOString();
      persistState();
    } else {
      if (!user.deviceId || resetDevice) {
        if (deviceId) {
          user.deviceId = deviceId;
        }
        user.lastActive = new Date().toISOString();
        persistState();
      } else if (deviceId && user.deviceId !== deviceId) {
        return res.status(403).json({
          error: 'DEVICE_LOCKED',
          canReset: true,
          userId: user.id,
          message: 'Akun ini sebelumnya telah terikat pada ponsel lain. Klik tombol di bawah jika ingin memindahkan ke HP ini.',
        });
      } else {
        user.lastActive = new Date().toISOString();
        persistState();
      }
    }

    const { password: _, ...safeUser } = user;
    res.json({ success: true, user: safeUser, state: getSanitizedState(state) });
  });

  // Sync / ensure user exists on server
  app.post('/api/users/sync-user', (req, res) => {
    const { user } = req.body;
    if (!user || !user.username) {
      return res.status(400).json({ error: 'Invalid user payload' });
    }

    const exists = state.users.find(
      (u) => u.username.toLowerCase() === user.username.trim().toLowerCase()
    );

    if (!exists) {
      state.users.unshift({
        ...user,
        username: user.username.trim(),
        password: user.password || '123456',
      });
      persistState();
    }

    res.json({ success: true });
  });

  // Change password
  app.post('/api/users/change-password', (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;
    const user = state.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

    if (user.password && user.password !== oldPassword) {
      return res.status(400).json({ error: 'Kata sandi lama salah' });
    }

    user.password = newPassword;
    state.auditLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.namaLengkap,
      userRole: user.role,
      action: 'EDIT_VOTER',
      description: `Pengguna ${user.namaLengkap} mengganti kata sandi login`,
      dptImpact: 0,
    });
    persistState();
    res.json({ success: true });
  });

  // Update profile
  app.put('/api/users/profile', (req, res) => {
    const { userId, namaLengkap, username, phone } = req.body;
    const user = state.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

    if (username && username.trim().toLowerCase() !== user.username.toLowerCase()) {
      const exists = state.users.some(
        (u) => u.id !== userId && u.username.toLowerCase() === username.trim().toLowerCase()
      );
      if (exists) {
        return res.status(409).json({ error: 'Username sudah digunakan oleh akun lain.' });
      }
      user.username = username.trim();
    }

    const oldNama = user.namaLengkap;
    if (namaLengkap && namaLengkap.trim()) {
      user.namaLengkap = namaLengkap.trim();
    }
    if (phone !== undefined) {
      user.phone = phone.trim();
    }

    state.auditLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.namaLengkap,
      userRole: user.role,
      action: 'EDIT_VOTER',
      description: `Profil diubah: dari "${oldNama}" menjadi "${user.namaLengkap}" (@${user.username})`,
      dptImpact: 0,
    });
    persistState();

    const { password: _, ...safeUser } = user;
    res.json({ success: true, user: safeUser, state: getSanitizedState(state) });
  });

  // Create Voter Entry
  app.post('/api/voters', (req, res) => {
    const voterData: Voter = req.body;
    if (!voterData.namaPemilih || !voterData.rw || !voterData.rt || !voterData.pilihan) {
      return res.status(400).json({ error: 'Nama, RW, RT, dan Pilihan wajib diisi.' });
    }

    const isDuplicate = state.voters.some(
      (v) =>
        v.namaPemilih.trim().toLowerCase() === voterData.namaPemilih.trim().toLowerCase() &&
        v.rw === voterData.rw &&
        v.rt === voterData.rt
    );

    if (isDuplicate) {
      return res.status(409).json({
        error: 'DUPLICATE_VOTER',
        message: `Warga dengan nama "${voterData.namaPemilih}" sudah terdaftar di RT ${voterData.rt} RW ${voterData.rw}. Hindari input ganda.`,
      });
    }

    const newVoter: Voter = {
      ...voterData,
      id: voterData.id || 'vtr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: voterData.createdAt || new Date().toISOString(),
      syncStatus: 'synced',
      notes: voterData.notes || [],
    };

    state.voters.unshift(newVoter);
    recalculateRegion(newVoter.rw, newVoter.rt);

    state.auditLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: newVoter.inputByUserId,
      userName: newVoter.inputByUserName,
      userRole: newVoter.inputByUserRole,
      action: 'INPUT_VOTER',
      description: `Mencatat pemilih di RT ${newVoter.rt} RW ${newVoter.rw} (${newVoter.kampung}) [Pilihan: ${newVoter.pilihan}]`,
      dptImpact: -1,
      rw: newVoter.rw,
      rt: newVoter.rt,
    });

    persistState();
    res.json({ success: true, voter: newVoter, state: getSanitizedState(state) });
  });

  // Batch Offline Sync
  app.post('/api/voters/sync', (req, res) => {
    const { offlineVoters, userId, userName, userRole } = req.body;
    if (!Array.isArray(offlineVoters) || offlineVoters.length === 0) {
      return res.json({ success: true, syncedCount: 0, state: getSanitizedState(state) });
    }

    let syncedCount = 0;
    const affectedRegions = new Set<string>();

    for (const v of offlineVoters) {
      const existing = state.voters.find((ev) => ev.id === v.id);
      if (!existing) {
        state.voters.unshift({
          ...v,
          syncStatus: 'synced',
        });
        affectedRegions.add(`${v.rw}:${v.rt}`);
        syncedCount++;
      }
    }

    for (const key of affectedRegions) {
      const [rw, rt] = key.split(':');
      const region = state.regions.find((r) => r.rw === rw && r.rt === rt);
      if (region) {
        const count = state.voters.filter((v) => v.rw === rw && v.rt === rt).length;
        region.voterCount = count;
        region.remainingDpt = Math.max(0, region.baselineDpt - count);
      }
    }

    if (syncedCount > 0) {
      state.auditLogs.unshift({
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        userId: userId || 'unknown',
        userName: userName || 'Petugas Lapangan',
        userRole: userRole || 'petugas_rt',
        action: 'INPUT_VOTER',
        description: `Sinkronisasi otomatis ${syncedCount} data pemilih hasil input offline dari lapangan`,
        dptImpact: -syncedCount,
      });
    }

    persistState();
    res.json({ success: true, syncedCount, state: getSanitizedState(state) });
  });

  // Edit Voter
  app.put('/api/voters/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const voter = state.voters.find((v) => v.id === id);
    if (!voter) return res.status(404).json({ error: 'Data pemilih tidak ditemukan' });

    const oldRw = voter.rw;
    const oldRt = voter.rt;
    Object.assign(voter, updates, { updatedAt: new Date().toISOString() });

    if (oldRw !== voter.rw || oldRt !== voter.rt) {
      recalculateRegion(oldRw, oldRt);
      recalculateRegion(voter.rw, voter.rt);
    }

    state.auditLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: updates.editorId || voter.inputByUserId,
      userName: updates.editorName || voter.inputByUserName,
      userRole: updates.editorRole || voter.inputByUserRole,
      action: 'EDIT_VOTER',
      description: `Mengubah data pemilih di RT ${voter.rt} RW ${voter.rw}`,
      dptImpact: 0,
      rw: voter.rw,
      rt: voter.rt,
    });

    persistState();
    res.json({ success: true, voter, state: getSanitizedState(state) });
  });

  // Delete Voter
  app.delete('/api/voters/:id', (req, res) => {
    const { id } = req.params;
    const { reason, deleterId, deleterName, deleterRole } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Wajib memberikan catatan alasan sebelum menghapus data!' });
    }

    const index = state.voters.findIndex((v) => v.id === id);
    if (index === -1) return res.status(404).json({ error: 'Data pemilih tidak ditemukan' });

    const deleted = state.voters[index];
    state.voters.splice(index, 1);
    recalculateRegion(deleted.rw, deleted.rt);

    state.auditLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: deleterId,
      userName: deleterName,
      userRole: deleterRole,
      action: 'DELETE_VOTER',
      description: `Menghapus data pemilih di RT ${deleted.rt} RW ${deleted.rw}. Alasan: "${reason}". Sisa DPT bertambah +1.`,
      dptImpact: +1,
      rw: deleted.rw,
      rt: deleted.rt,
    });

    persistState();
    res.json({ success: true, state: getSanitizedState(state) });
  });

  // Request Deletion (for Koor RW to Super Admin)
  app.post('/api/voters/:id/request-delete', (req, res) => {
    const { id } = req.params;
    const { reason, requestedByUserId, requestedByUserName, requestedByUserRole } = req.body;

    const voter = state.voters.find((v) => v.id === id);
    if (!voter) return res.status(404).json({ error: 'Data pemilih tidak ditemukan' });

    voter.deleteRequested = true;

    const newRequest: DeleteRequest = {
      id: 'delreq_' + Date.now(),
      voterId: voter.id,
      voterName: voter.namaPemilih,
      requestedByUserId,
      requestedByUserName,
      requestedByUserRole,
      requestedAt: new Date().toISOString(),
      reason,
      status: 'pending',
    };

    state.deleteRequests.unshift(newRequest);
    state.auditLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: requestedByUserId,
      userName: requestedByUserName,
      userRole: requestedByUserRole,
      action: 'REQ_DELETE_VOTER',
      description: `Mengajukan permohonan hapus data di RT ${voter.rt} RW ${voter.rw}. Alasan: "${reason}"`,
      dptImpact: 0,
    });

    persistState();
    res.json({ success: true, deleteRequest: newRequest, state: getSanitizedState(state) });
  });

  // Approve Delete Request (Super Admin)
  app.post('/api/delete-requests/:reqId/resolve', (req, res) => {
    const { reqId } = req.params;
    const { action, resolverId, resolverName } = req.body;

    const delReq = state.deleteRequests.find((r) => r.id === reqId);
    if (!delReq) return res.status(404).json({ error: 'Permohonan tidak ditemukan' });

    delReq.status = action === 'approve' ? 'approved' : 'rejected';
    delReq.resolvedByUserId = resolverId;
    delReq.resolvedAt = new Date().toISOString();

    const voterIndex = state.voters.findIndex((v) => v.id === delReq.voterId);
    if (action === 'approve' && voterIndex !== -1) {
      const deleted = state.voters[voterIndex];
      state.voters.splice(voterIndex, 1);
      recalculateRegion(deleted.rw, deleted.rt);

      state.auditLogs.unshift({
        id: 'log_' + Date.now(),
        timestamp: new Date().toISOString(),
        userId: resolverId,
        userName: resolverName,
        userRole: 'super_admin',
        action: 'APPROVE_DELETE_VOTER',
        description: `Super Admin menyetujui penghapusan data RT ${deleted.rt} RW ${deleted.rw}. Alasan pemohon: "${delReq.reason}". Sisa DPT bertambah +1.`,
        dptImpact: +1,
        rw: deleted.rw,
        rt: deleted.rt,
      });
    } else if (voterIndex !== -1) {
      state.voters[voterIndex].deleteRequested = false;
    }

    persistState();
    res.json({ success: true, state: getSanitizedState(state) });
  });

  // Add Supervision Note to Voter Entry
  app.post('/api/voters/:id/notes', (req, res) => {
    const { id } = req.params;
    const { authorId, authorName, authorRole, text } = req.body;

    const voter = state.voters.find((v) => v.id === id);
    if (!voter) return res.status(404).json({ error: 'Data pemilih tidak ditemukan' });

    const note = {
      id: 'nt_' + Date.now(),
      authorId,
      authorName,
      authorRole,
      text,
      createdAt: new Date().toISOString(),
    };

    voter.notes.unshift(note);

    state.auditLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: authorId,
      userName: authorName,
      userRole: authorRole,
      action: 'ADD_NOTE',
      description: `Memberikan catatan arahan pada pemilih di RT ${voter.rt} RW ${voter.rw}: "${text}"`,
      dptImpact: 0,
      rw: voter.rw,
      rt: voter.rt,
    });

    persistState();
    res.json({ success: true, note, state: getSanitizedState(state) });
  });

  // Create or Update User
  app.post('/api/users', (req, res) => {
    const { id, username, password, namaLengkap, role, rwTugas, rtTugas, creatorId, creatorName, creatorRole, phone } = req.body;
    if (!username || !namaLengkap || !role) {
      return res.status(400).json({ error: 'Username, Nama Lengkap, dan Tingkatan Akun wajib diisi' });
    }

    if (creatorRole === 'kordes_rw' || creatorRole === 'petugas_rt') {
      return res.status(403).json({ error: 'Akun tingkat Koor RW dan Petugas RT tidak memiliki wewenang untuk membuat akun baru.' });
    }
    if (creatorRole === 'korlap' && role !== 'kordes_rw' && role !== 'petugas_rt') {
      return res.status(403).json({ error: 'Korlap hanya berhak membuat akun Koor RW dan Petugas RT.' });
    }

    const cleanUsername = username.trim();
    const cleanPassword = (password && String(password).trim()) 
      ? String(password).trim() 
      : '123456';

    const existingIdx = state.users.findIndex(
      (u) => u.username.toLowerCase() === cleanUsername.toLowerCase() || (id && u.id === id)
    );

    if (existingIdx !== -1) {
      // Idempotent update: preserve deviceId, update credentials
      state.users[existingIdx] = {
        ...state.users[existingIdx],
        namaLengkap: namaLengkap.trim(),
        role: role || state.users[existingIdx].role,
        password: cleanPassword || state.users[existingIdx].password,
        rwTugas: rwTugas || state.users[existingIdx].rwTugas,
        rtTugas: rtTugas || state.users[existingIdx].rtTugas,
        phone: phone !== undefined ? phone : state.users[existingIdx].phone,
      };
      persistState();
      return res.json({ success: true, user: state.users[existingIdx], state: getSanitizedState(state) });
    }

    const newUser: User = {
      id: id || ('usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
      username: cleanUsername,
      password: cleanPassword,
      namaLengkap: namaLengkap.trim(),
      role,
      rwTugas: rwTugas || 'all',
      rtTugas: rtTugas || 'all',
      createdBy: creatorName || 'Admin',
      createdAt: new Date().toISOString(),
      status: 'aktif',
      deviceId: null,
      phone: phone || '',
    };

    state.users.unshift(newUser);
    state.auditLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: creatorId || 'usr_sys',
      userName: creatorName || 'Admin',
      userRole: creatorRole || 'super_admin',
      action: 'CREATE_USER',
      description: `Membuat akun baru "${newUser.namaLengkap}" (${newUser.username}) tingkat ${newUser.role}`,
      dptImpact: 0,
    });
    persistState();

    res.json({ success: true, user: newUser, state: getSanitizedState(state) });
  });

  // Batch Synchronize Users across Devices & Cloud
  app.post('/api/users/sync', (req, res) => {
    const { users } = req.body;
    let changed = false;
    if (Array.isArray(users)) {
      for (const u of users) {
        if (!u || !u.username) continue;
        const idx = state.users.findIndex(
          (x) => x.id === u.id || x.username.toLowerCase() === u.username.toLowerCase()
        );
        if (idx === -1) {
          state.users.unshift({
            ...u,
            status: u.status || 'aktif',
            deviceId: u.deviceId || null,
          });
          changed = true;
        } else {
          // Keep existing deviceId and merge passwords
          const current = state.users[idx];
          state.users[idx] = {
            ...current,
            ...u,
            password: u.password || current.password,
            deviceId: current.deviceId || u.deviceId || null,
          };
          changed = true;
        }
      }
      if (changed) {
        persistState();
      }
    }
    res.json({ success: true, count: state.users.length, state: getSanitizedState(state) });
  });

  // Reset Device
  app.post('/api/users/:id/reset-device', (req, res) => {
    const { id } = req.params;
    const { adminId, adminName, adminRole } = req.body;

    const user = state.users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });

    const isSuperAdmin = adminRole === 'super_admin';
    const isAdminOfSub = adminRole === 'admin' && (user.role === 'korlap' || user.role === 'kordes_rw' || user.role === 'petugas_rt');
    const isKorlapOwner = adminRole === 'korlap' && (user.createdBy === adminName || user.createdBy === adminId) && (user.role === 'kordes_rw' || user.role === 'petugas_rt');

    if (!isSuperAdmin && !isAdminOfSub && !isKorlapOwner) {
      return res.status(403).json({ error: 'Anda tidak memiliki hak untuk mereset perangkat akun ini.' });
    }

    user.deviceId = null;

    state.auditLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: adminId,
      userName: adminName,
      userRole: adminRole,
      action: 'RESET_DEVICE',
      description: `${adminName} (${adminRole}) mereset kunci perangkat untuk akun ${user.namaLengkap} (${user.username}). Akun kini dapat login di HP baru.`,
      dptImpact: 0,
    });
    persistState();

    res.json({ success: true, state: getSanitizedState(state) });
  });

  // Block / Unblock User
  app.post('/api/users/:id/toggle-block', (req, res) => {
    const { id } = req.params;
    const { actorId, actorName, actorRole } = req.body;

    const user = state.users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });

    const isSuperAdmin = actorRole === 'super_admin';
    const isAdminOfSub = actorRole === 'admin' && (user.role === 'korlap' || user.role === 'kordes_rw' || user.role === 'petugas_rt');
    const isKorlapOwner = actorRole === 'korlap' && (user.createdBy === actorName || user.createdBy === actorId) && (user.role === 'kordes_rw' || user.role === 'petugas_rt');

    if (!isSuperAdmin && !isAdminOfSub && !isKorlapOwner) {
      return res.status(403).json({ error: 'Anda tidak memiliki hak untuk mengubah status akun ini.' });
    }

    user.status = user.status === 'aktif' ? 'terblokir' : 'aktif';

    state.auditLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: actorId,
      userName: actorName,
      userRole: actorRole,
      action: 'BLOCK_USER',
      description: `Mengubah status akun ${user.namaLengkap} menjadi ${user.status}`,
      dptImpact: 0,
    });
    persistState();

    const { password: _, ...safeUser } = user;
    res.json({ success: true, user: safeUser, state: getSanitizedState(state) });
  });

  // Delete User
  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { actorId, actorName, actorRole } = req.body;

    const index = state.users.findIndex((u) => u.id === id);
    if (index === -1) return res.status(404).json({ error: 'Pengguna tidak ditemukan' });

    const deleted = state.users[index];
    if (deleted.role === 'super_admin') {
      return res.status(403).json({ error: 'Akun Super Admin tidak dapat dihapus!' });
    }

    const isSuperAdmin = actorRole === 'super_admin';
    const isAdminOfSub = actorRole === 'admin' && (deleted.role === 'korlap' || deleted.role === 'kordes_rw' || deleted.role === 'petugas_rt');
    const isKorlapOwner = actorRole === 'korlap' && (deleted.createdBy === actorName || deleted.createdBy === actorId) && (deleted.role === 'kordes_rw' || deleted.role === 'petugas_rt');

    if (!isSuperAdmin && !isAdminOfSub && !isKorlapOwner) {
      return res.status(403).json({ error: 'Anda tidak memiliki hak untuk menghapus akun ini.' });
    }

    state.users.splice(index, 1);
    state.auditLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: actorId,
      userName: actorName,
      userRole: actorRole,
      action: 'DELETE_USER',
      description: `Menghapus akun ${deleted.namaLengkap} (${deleted.username}) tingkat ${deleted.role}`,
      dptImpact: 0,
    });
    persistState();

    res.json({ success: true, state: getSanitizedState(state) });
  });

  // Update Baseline DPT for an RT (Super Admin)
  app.put('/api/regions/:id/dpt', (req, res) => {
    const { id } = req.params;
    const { newBaselineDpt, adminId, adminName } = req.body;

    const region = state.regions.find((r) => r.id === id);
    if (!region) return res.status(404).json({ error: 'Wilayah tidak ditemukan' });

    const oldBaseline = region.baselineDpt;
    region.baselineDpt = Number(newBaselineDpt);
    recalculateRegion(region.rw, region.rt);

    state.auditLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: adminId,
      userName: adminName,
      userRole: 'super_admin',
      action: 'UPDATE_DPT',
      description: `Super Admin memperbarui baseline DPT RT ${region.rt} RW ${region.rw} dari ${oldBaseline} menjadi ${newBaselineDpt}`,
      dptImpact: newBaselineDpt - oldBaseline,
      rw: region.rw,
      rt: region.rt,
    });
    persistState();

    res.json({ success: true, region, state: getSanitizedState(state) });
  });

  // Update Zone Thresholds (Admin & Super Admin)
  app.put('/api/settings/zones', (req, res) => {
    const { greenMinPercent, yellowMinPercent, updaterId, updaterName, updaterRole } = req.body;

    state.zoneThresholds.greenMinPercent = Number(greenMinPercent);
    state.zoneThresholds.yellowMinPercent = Number(yellowMinPercent);
    state.lastUpdated = new Date().toISOString();

    state.auditLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: updaterId,
      userName: updaterName,
      userRole: updaterRole,
      action: 'UPDATE_ZONE_SETTINGS',
      description: `Memperbarui ambang batas persentase zona: Hijau >= ${greenMinPercent}%, Kuning >= ${yellowMinPercent}%`,
      dptImpact: 0,
    });
    persistState();

    res.json({ success: true, zoneThresholds: state.zoneThresholds, state: getSanitizedState(state) });
  });

  // ==========================================
  // MASTER DPT ENDPOINTS (5.661 DPT LANGENSARI)
  // ==========================================

  // Get or search Master DPT records
  app.get('/api/master-dpt', (req, res) => {
    const { rw, rt, q, limit } = req.query;
    let list = masterDpt;

    if (rw && rw !== 'ALL' && rw !== 'all') {
      const padRw = String(rw).padStart(2, '0');
      list = list.filter((item) => item.rw === padRw);
    }

    if (rt && rt !== 'ALL' && rt !== 'all') {
      const padRt = String(rt).padStart(2, '0');
      list = list.filter((item) => item.rt === padRt);
    }

    if (q && typeof q === 'string' && q.trim()) {
      const query = q.trim().toLowerCase();
      list = list.filter((item) => 
        item.nama.toLowerCase().includes(query) ||
        item.alamat.toLowerCase().includes(query)
      );
    }

    const maxLimit = limit === 'all'
      ? list.length
      : (limit ? Math.min(10000, parseInt(String(limit), 10) || 100) : 100);

    res.json({
      totalMaster: masterDpt.length,
      filteredTotal: list.length,
      items: list.slice(0, maxLimit),
    });
  });

  // Get Master DPT Statistics
  app.get('/api/master-dpt/stats', (_req, res) => {
    const byRw: Record<string, number> = {};
    for (const item of masterDpt) {
      byRw[item.rw] = (byRw[item.rw] || 0) + 1;
    }
    res.json({
      total: masterDpt.length,
      grandTotalBaseline: 5661,
      byRw,
      coveragePercent: Math.round((masterDpt.length / 5661) * 100),
    });
  });

  // Import / Upload / Append Master DPT (Super Admin & Admin)
  app.post('/api/master-dpt/import', (req, res) => {
    const { rawText, items: inputItems, mode = 'append', actorId, actorName, actorRole } = req.body;
    if (actorRole !== 'super_admin' && actorRole !== 'admin') {
      return res.status(403).json({ error: 'Hanya Super Admin atau Admin yang berhak mengimpor data master DPT.' });
    }

    let parsedItems: MasterDptItem[] = [];

    if (Array.isArray(inputItems) && inputItems.length > 0) {
      parsedItems = inputItems;
    } else if (rawText && typeof rawText === 'string') {
      const lines = rawText.trim().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        let parts = line.split('\t');
        if (parts.length < 5) parts = line.split(';');
        if (parts.length < 5) parts = line.split(',');

        if (parts.length >= 8) {
          if (parts[0].toLowerCase().includes('no') || parts[1].toLowerCase().includes('nama')) {
            continue;
          }
          const no = parseInt(parts[0].replace(/[^0-9]/g, ''), 10) || (masterDpt.length + parsedItems.length + 1);
          const nama = parts[1].trim();
          if (!nama) continue;
          const jk = parts[2].trim().toUpperCase().startsWith('P') ? 'P' : 'L';
          const tglLahir = parts[3]?.trim() || '';
          const usia = parseInt(parts[4]?.replace(/[^0-9]/g, ''), 10) || 0;
          const alamat = parts[5]?.trim() || '';
          const dusun = parseInt(parts[6]?.replace(/[^0-9]/g, ''), 10) || 1;
          const rawRt = parts[7]?.replace(/[^0-9]/g, '') || '1';
          const rawRw = parts[8]?.replace(/[^0-9]/g, '') || '1';
          const rt = String(parseInt(rawRt, 10)).padStart(2, '0');
          const rw = String(parseInt(rawRw, 10)).padStart(2, '0');

          parsedItems.push({
            no,
            nama,
            jk,
            tglLahir,
            usia,
            alamat,
            dusun,
            rt,
            rw,
          });
        }
      }
    }

    if (parsedItems.length === 0) {
      return res.status(400).json({ error: 'Tidak ada data valid yang dapat diproses dari input yang diberikan.' });
    }

    const previousCount = masterDpt.length;
    if (mode === 'replace') {
      masterDpt = parsedItems;
    } else {
      const existingKeySet = new Set(masterDpt.map((d) => `${d.rw}_${d.rt}_${d.nama.toLowerCase()}`));
      const newUnique: MasterDptItem[] = [];
      for (const item of parsedItems) {
        const key = `${item.rw}_${item.rt}_${item.nama.toLowerCase()}`;
        if (!existingKeySet.has(key)) {
          existingKeySet.add(key);
          newUnique.push(item);
        }
      }
      masterDpt = [...masterDpt, ...newUnique];
    }

    saveMasterDpt();

    state.auditLogs.unshift({
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      userId: actorId || 'sys',
      userName: actorName || 'Admin',
      userRole: actorRole || 'super_admin',
      action: 'UPDATE_DPT',
      description: `${actorName} berhasil memperbarui Master DPT Desa Langensari. Total pemilih kini ${masterDpt.length} jiwa (${mode === 'replace' ? 'Reset data' : `+${masterDpt.length - previousCount} pemilih baru`}).`,
      dptImpact: 0,
    });
    persistState();

    res.json({
      success: true,
      total: masterDpt.length,
      importedCount: parsedItems.length,
      mode,
    });
  });

  // Vite Integration
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Cek Ombak server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Cek Ombak server:', err);
  process.exit(1);
});
