/**
 * Firebase Client Initialization & Firestore Connection
 * Configured with Cloud Firestore Enterprise database instance and Firebase Authentication.
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying firestoreDatabaseId
export const firestoreDb: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection validation
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore is running in offline cached mode. Please check network connectivity.');
      return false;
    }
    // Any permission error still means server responded
    return true;
  }
}

testFirestoreConnection();

/**
 * Strips all undefined properties from an object so Firestore setDoc/updateDoc
 * does not throw "Unsupported field value: undefined".
 */
export function sanitizeForFirestore<T extends Record<string, any>>(data: T): Partial<T> {
  if (!data || typeof data !== 'object') return data;
  const result: any = Array.isArray(data) ? [] : {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        result[key] = value.map(item =>
          item !== null && typeof item === 'object' && !(item instanceof Date)
            ? sanitizeForFirestore(item)
            : item
        );
      } else if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        result[key] = sanitizeForFirestore(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Secondary Firebase Auth helper for Admin operations.
 * Allows an authenticated Admin to create Firebase Authentication accounts for
 * newly registered Students and Teachers without overwriting or logging out
 * the Admin's active session in the client.
 */
export function getSecondaryAdminAuth() {
  const existing = getApps().find(a => a.name === 'UniAttendAdminProvisioner');
  const secApp = existing || initializeApp(firebaseConfig, 'UniAttendAdminProvisioner');
  return getAuth(secApp);
}

export {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
};
export type { FirebaseUser };
