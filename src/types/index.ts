export type Role = 'petugas_rt' | 'kordes_rw' | 'korlap' | 'admin' | 'super_admin';

export type FontSize = 'normal' | 'large' | 'xlarge';

export interface User {
  id: string;
  username: string;
  password?: string;
  namaLengkap: string;
  role: Role;
  rwTugas?: string; // e.g. "01", "all"
  rtTugas?: string; // e.g. "01", "all"
  createdBy: string;
  createdAt: string;
  status: 'aktif' | 'terblokir';
  deviceId?: string | null;
  lastActive?: string;
  phone?: string;
}

export type CandidateChoice = 
  | 'CENGHAR' // Aceng Saepulloh
  | 'LAWAN' 
  | 'BELUM_MEMILIH' 
  | 'TIDAK_MEMILIH';

export type OpponentCandidate = 
  | 'Komar Budiawan' 
  | 'Samiran' 
  | 'Sanusi' 
  | 'Fajar';

export type NonVotingReason = 
  | 'Luar Negeri' 
  | 'Luar Kota' 
  | 'Sakit/Lansia' 
  | 'Alasan Lainnya';

export interface MasterDptItem {
  no: number;
  nama: string;
  jk: 'L' | 'P';
  tglLahir: string;
  usia: number;
  alamat: string;
  dusun: number;
  rt: string; // "01" - "07"
  rw: string; // "01" - "06"
}

export interface SupervisionNote {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  text: string;
  createdAt: string;
}

export interface DeleteRequest {
  id: string;
  voterId: string;
  voterName: string;
  requestedByUserId: string;
  requestedByUserName: string;
  requestedByUserRole: Role;
  requestedAt: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  resolvedByUserId?: string;
  resolvedAt?: string;
}

export interface Voter {
  id: string; // client uuid
  namaPemilih: string; // Wajib
  rw: string; // "01" - "06"
  rt: string; // "01" - "07"
  dusun: number; // 1 - 4
  kampung: string;
  pilihan: CandidateChoice;
  subPilihanLawan?: OpponentCandidate;
  subPilihanTidakMemilih?: NonVotingReason;
  aspirasi?: string; // Opsional
  noRumah?: string; // Opsional
  kepalaKeluarga?: string; // Opsional
  inputByUserId: string;
  inputByUserName: string;
  inputByUserRole: Role;
  createdAt: string;
  updatedAt?: string;
  syncStatus: 'synced' | 'pending';
  notes: SupervisionNote[];
  deleteRequested?: boolean;
}

export interface Region {
  id: string; // e.g. "rw01_rt01"
  no: number;
  dusun: number;
  rw: string; // "01"
  rt: string; // "01"
  kampung: string;
  baselineDpt: number;
  remainingDpt: number;
  voterCount: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: Role;
  action: 'INPUT_VOTER' | 'EDIT_VOTER' | 'DELETE_VOTER' | 'REQ_DELETE_VOTER' | 'APPROVE_DELETE_VOTER' | 'ADD_NOTE' | 'CREATE_USER' | 'BLOCK_USER' | 'DELETE_USER' | 'RESET_DEVICE' | 'UPDATE_DPT' | 'UPDATE_ZONE_SETTINGS';
  description: string;
  dptImpact: number; // e.g. -1, +1, or 0
  rw?: string;
  rt?: string;
}

export interface ZoneThresholds {
  greenMinPercent: number; // Default 50%
  yellowMinPercent: number; // Default 30%
}

export interface AppState {
  regions: Region[];
  voters: Voter[];
  users: User[];
  auditLogs: AuditLog[];
  deleteRequests: DeleteRequest[];
  zoneThresholds: ZoneThresholds;
  lastUpdated: string;
}
