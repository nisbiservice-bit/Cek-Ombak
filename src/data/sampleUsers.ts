import { User } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'usr_superadmin',
    username: 'superadmin',
    password: '123456',
    namaLengkap: 'Super Admin (Pimpinan)',
    role: 'super_admin',
    rwTugas: 'all',
    rtTugas: 'all',
    createdBy: 'Sistem Pusat',
    createdAt: new Date().toISOString(),
    status: 'aktif',
    deviceId: null,
    phone: '081234567890',
  },
];
