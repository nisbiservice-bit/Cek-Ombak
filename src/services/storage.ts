import { AppState, User, Voter } from '../types';

const STORAGE_KEY_STATE = 'cek_ombak_state_v1';
const STORAGE_KEY_QUEUE = 'cek_ombak_offline_queue_v1';
const STORAGE_KEY_USER = 'cek_ombak_current_user_v1';
const STORAGE_KEY_DEVICE = 'cek_ombak_device_id_v1';

export function getDeviceId(): string {
  let deviceId = localStorage.getItem(STORAGE_KEY_DEVICE);
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY_DEVICE, deviceId);
  }
  return deviceId;
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredUser(user: User | null): void {
  try {
    if (!user) {
      localStorage.removeItem(STORAGE_KEY_USER);
    } else {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    }
  } catch (err) {
    console.warn('Storage error on saveStoredUser:', err);
  }
}

export function getStoredState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STATE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
  } catch (err) {
    console.warn('LocalStorage quota or write error:', err);
  }
}

export function getOfflineQueue(): Voter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function enqueueOfflineVoter(voter: Voter): Voter[] {
  const queue = getOfflineQueue();
  // Ensure no duplicate in queue
  if (!queue.some((item) => item.id === voter.id)) {
    queue.push(voter);
    localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
  }
  return queue;
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(STORAGE_KEY_QUEUE);
}

export function removeOfflineVoter(id: string): void {
  const queue = getOfflineQueue().filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
}

const STORAGE_KEY_PASSWORDS = 'cek_ombak_passwords_v1';

export function getStoredPasswords(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PASSWORDS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveUserPassword(userIdOrUsername: string, pass: string): void {
  if (!userIdOrUsername || !pass) return;
  try {
    const map = getStoredPasswords();
    map[userIdOrUsername.toLowerCase()] = pass;
    localStorage.setItem(STORAGE_KEY_PASSWORDS, JSON.stringify(map));
  } catch (err) {
    console.warn('Storage error on saveUserPassword:', err);
  }
}

export function getStoredUserPassword(userIdOrUsername?: string): string | null {
  if (!userIdOrUsername) return null;
  try {
    const map = getStoredPasswords();
    return map[userIdOrUsername.toLowerCase()] || null;
  } catch {
    return null;
  }
}
