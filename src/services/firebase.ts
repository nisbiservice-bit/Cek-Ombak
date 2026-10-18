import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppState } from '../types';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(
  app,
  (firebaseConfig as any).firestoreDatabaseId || '(default)'
);

// Circuit breaker for Firestore quota exhaustion (Free tier write limit protection)
let isQuotaExceeded = false;
let quotaResetTimeout: any = null;
let lastSavedHash = '';

export function isFirestoreAvailable(): boolean {
  return !isQuotaExceeded;
}

function triggerQuotaCooldown() {
  if (isQuotaExceeded) return;
  isQuotaExceeded = true;
  console.warn('Firestore write quota limit reached. Falling back safely to direct Express server backend.');
  if (quotaResetTimeout) clearTimeout(quotaResetTimeout);
  quotaResetTimeout = setTimeout(() => {
    isQuotaExceeded = false;
  }, 15 * 60 * 1000);
}

// Validate Connection with graceful fallback
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'system', 'connection'));
  } catch (error: any) {
    if (
      error?.code === 'resource-exhausted' ||
      (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('Quota limit exceeded')))
    ) {
      triggerQuotaCooldown();
    }
  }
}
testFirestoreConnection();

const APP_STATE_DOC = 'langensari';

// Real-time Firestore sync listener
export function subscribeToFirestoreState(
  onStateChange: (state: AppState) => void,
  initialFallbackState: AppState
) {
  const stateDocRef = doc(db, 'appState', APP_STATE_DOC);

  // Check if document exists, only seed if not already marked quota exceeded
  getDoc(stateDocRef)
    .then((snap) => {
      if (!snap.exists() && !isQuotaExceeded) {
        setDoc(stateDocRef, initialFallbackState).catch((err: any) => {
          if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded')) {
            triggerQuotaCooldown();
          }
        });
      }
    })
    .catch((err: any) => {
      if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded')) {
        triggerQuotaCooldown();
      }
    });

  // Subscribe to real-time updates via onSnapshot WebSocket
  const unsubscribe = onSnapshot(
    stateDocRef,
    (snap) => {
      if (snap.exists()) {
        const cloudState = snap.data() as AppState;
        if (cloudState && Array.isArray(cloudState.regions) && Array.isArray(cloudState.users)) {
          onStateChange(cloudState);
        }
      }
    },
    (err: any) => {
      if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded')) {
        triggerQuotaCooldown();
      } else {
        console.warn('Firestore listener fallback notice:', err?.message || err);
      }
    }
  );

  return unsubscribe;
}

// Push local state update to Firestore Cloud (guarded by circuit-breaker and dirty check)
export async function saveToCloudFirestore(state: AppState): Promise<boolean> {
  if (isQuotaExceeded) {
    return false;
  }

  // Prevent duplicate writes of unchanged state
  const currentHash = `${state.lastUpdated}_${state.voters?.length || 0}_${state.users?.length || 0}`;
  if (currentHash === lastSavedHash) {
    return true;
  }

  try {
    const stateDocRef = doc(db, 'appState', APP_STATE_DOC);
    await setDoc(stateDocRef, state, { merge: true });
    lastSavedHash = currentHash;
    return true;
  } catch (err: any) {
    if (
      err?.code === 'resource-exhausted' ||
      (typeof err?.message === 'string' && err.message.includes('Quota limit exceeded'))
    ) {
      triggerQuotaCooldown();
      return false;
    }
    console.warn('Failed to save to Cloud Firestore:', err?.message || err);
    return false;
  }
}
