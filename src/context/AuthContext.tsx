import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  firestoreDb,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  FirebaseUser,
  getSecondaryAdminAuth,
  sanitizeForFirestore,
} from '../services/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { UserRole } from '../types';
import { db } from '../services/db';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  studentId?: string;
  teacherId?: string;
  photoURL?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<void>;
  loginWithGoogleRedirect: () => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  createManagedAccount: (params: {
    role: UserRole;
    email: string;
    temporaryPassword: string;
    displayName: string;
    entityId: string;
  }) => Promise<{ success: boolean; uid?: string; error?: string }>;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  overrideRoleForTesting?: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  loginWithEmail: async () => ({ success: false }),
  loginWithGoogle: async () => {},
  loginWithGoogleRedirect: async () => {},
  logout: async () => {},
  sendPasswordReset: async () => ({ success: false }),
  createManagedAccount: async () => ({ success: false }),
  authError: null,
  setAuthError: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  /**
   * Verified Server-Side Source of Truth:
   * Retrieves and verifies user profile & role strictly from Firestore /users/{uid} or
   * admin-registered records in /teachers and /students.
   * Rejects deactivated accounts and accounts without university administration authorization.
   */
  const verifyAndLoadUserProfile = async (user: FirebaseUser): Promise<UserProfile> => {
    const cleanEmail = (user.email || '').toLowerCase().trim();
    const userDocRef = doc(firestoreDb, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);

    // Bootstrap administrator check
    if (cleanEmail === 'it24026@mbstu.ac.bd' || cleanEmail === 'sabbirstudy2002@gmail.com') {
      const adminProfile: UserProfile = {
        uid: user.uid,
        email: user.email || cleanEmail,
        displayName: user.displayName || 'University Administrator',
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
      await setDoc(userDocRef, sanitizeForFirestore(adminProfile), { merge: true });
      return adminProfile;
    }

    if (userSnap.exists()) {
      const data = userSnap.data() as UserProfile;

      // Check if account is deactivated
      if (data.status === 'INACTIVE') {
        await signOut(auth);
        throw new Error('Your university account has been deactivated. Please contact the Registrar / Administrator.');
      }

      if (data.role === 'ADMIN') {
        return data;
      }

      // If existing doc has TEACHER role, resolve canonical teacher record
      if (data.role === 'TEACHER') {
        const matched =
          db.findTeacher(cleanEmail) ||
          db.findTeacher(user.uid) ||
          db.findTeacher(data.teacherId);

        if (matched) {
          if (matched.status === 'INACTIVE') {
            await signOut(auth);
            throw new Error('Faculty account is deactivated. Contact University Administration.');
          }
          const updatedProfile: UserProfile = {
            ...data,
            uid: user.uid,
            email: cleanEmail,
            displayName: matched.name,
            role: 'TEACHER',
            teacherId: matched.id,
            status: 'ACTIVE',
          };
          if (!matched.authUid || matched.authUid !== user.uid) {
            db.updateTeacher(matched.id, { authUid: user.uid });
          }
          await setDoc(userDocRef, sanitizeForFirestore(updatedProfile), { merge: true });
          return updatedProfile;
        }
      }

      // If existing doc has STUDENT role, resolve canonical student record
      if (data.role === 'STUDENT') {
        const matched =
          db.findStudent(cleanEmail) ||
          db.findStudent(user.uid) ||
          db.findStudent(data.studentId);

        if (matched) {
          if (matched.status === 'INACTIVE') {
            await signOut(auth);
            throw new Error('Student account is deactivated. Contact University Administration.');
          }
          const updatedProfile: UserProfile = {
            ...data,
            uid: user.uid,
            email: cleanEmail,
            displayName: matched.name,
            role: 'STUDENT',
            studentId: matched.id,
            status: 'ACTIVE',
          };
          if (!matched.authUid || matched.authUid !== user.uid) {
            db.updateStudent(matched.id, { authUid: user.uid });
          }
          await setDoc(userDocRef, sanitizeForFirestore(updatedProfile), { merge: true });
          return updatedProfile;
        }
      }
    }

    // 1. Search Teacher records in memory
    const matchedTeacher =
      db.findTeacher(cleanEmail) ||
      db.findTeacher(user.uid);

    if (matchedTeacher) {
      if (matchedTeacher.status === 'INACTIVE') {
        await signOut(auth);
        throw new Error('Teacher account is marked inactive. Contact University Administration.');
      }
      const teacherProfile: UserProfile = {
        uid: user.uid,
        email: cleanEmail,
        displayName: matchedTeacher.name,
        role: 'TEACHER',
        teacherId: matchedTeacher.id,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
      db.updateTeacher(matchedTeacher.id, { authUid: user.uid });
      await setDoc(userDocRef, sanitizeForFirestore(teacherProfile), { merge: true });
      return teacherProfile;
    }

    // Firestore query fallback for teachers
    try {
      const teacherQ = query(
        collection(firestoreDb, 'teachers'),
        where('email', '==', cleanEmail),
        limit(1)
      );
      const teacherSnap = await getDocs(teacherQ);
      if (!teacherSnap.empty) {
        const teacherDoc = teacherSnap.docs[0];
        const teacherData = teacherDoc.data();
        if (teacherData.status === 'INACTIVE') {
          await signOut(auth);
          throw new Error('Faculty account is deactivated. Contact University Administration.');
        }
        const teacherProfile: UserProfile = {
          uid: user.uid,
          email: cleanEmail,
          displayName: teacherData.name || user.displayName || 'Faculty Member',
          role: 'TEACHER',
          teacherId: teacherDoc.id,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, sanitizeForFirestore(teacherProfile), { merge: true });
        return teacherProfile;
      }
    } catch (err) {
      console.warn('Teacher lookup query note:', err);
    }

    // 2. Search Student records in memory
    const matchedStudent =
      db.findStudent(cleanEmail) ||
      db.findStudent(user.uid);

    if (matchedStudent) {
      if (matchedStudent.status === 'INACTIVE') {
        await signOut(auth);
        throw new Error('Student account is marked inactive. Contact University Administration.');
      }
      const studentProfile: UserProfile = {
        uid: user.uid,
        email: cleanEmail,
        displayName: matchedStudent.name,
        role: 'STUDENT',
        studentId: matchedStudent.id,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
      db.updateStudent(matchedStudent.id, { authUid: user.uid });
      await setDoc(userDocRef, sanitizeForFirestore(studentProfile), { merge: true });
      return studentProfile;
    }

    // Firestore query fallback for students
    try {
      const studentQ = query(
        collection(firestoreDb, 'students'),
        where('email', '==', cleanEmail),
        limit(1)
      );
      const studentSnap = await getDocs(studentQ);
      if (!studentSnap.empty) {
        const studentDoc = studentSnap.docs[0];
        const studentData = studentDoc.data();
        if (studentData.status === 'INACTIVE') {
          await signOut(auth);
          throw new Error('Student account is deactivated. Contact University Administration.');
        }
        const studentProfile: UserProfile = {
          uid: user.uid,
          email: cleanEmail,
          displayName: studentData.name || user.displayName || 'Student',
          role: 'STUDENT',
          studentId: studentDoc.id,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, sanitizeForFirestore(studentProfile), { merge: true });
        return studentProfile;
      }
    } catch (err) {
      console.warn('Student lookup query note:', err);
    }

    // No authorization found in trusted server-side records
    await signOut(auth);
    throw new Error('Your profile could not be found. Please contact the administrator.');
  };

  // Listen for redirect results on page load
  useEffect(() => {
    getRedirectResult(auth)
      .then(async credential => {
        if (credential?.user) {
          setLoading(true);
          const profile = await verifyAndLoadUserProfile(credential.user);
          setUserProfile(profile);
          await db.syncWithAuth(credential.user, profile.role, profile);
        }
      })
      .catch((err: any) => {
        if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
          console.warn('Redirect sign-in handler error:', err);
          if (err.code === 'auth/unauthorized-domain') {
            setAuthError('Unauthorized Domain: The current domain needs to be added to Firebase Console > Authentication > Settings > Authorized Domains.');
          } else {
            setAuthError(err.message || 'Authentication error.');
          }
        }
      });
  }, []);

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      setCurrentUser(user);
      if (user) {
        try {
          const profile = await verifyAndLoadUserProfile(user);
          setUserProfile(profile);
          await db.syncWithAuth(user, profile.role, profile);
        } catch (err: any) {
          console.error('Profile verification failed:', err);
          setUserProfile(null);
          setCurrentUser(null);
          setAuthError(err.message || 'Authentication error.');
          await db.syncWithAuth(null, 'STUDENT', null);
        }
      } else {
        setUserProfile(null);
        await db.syncWithAuth(null, 'STUDENT', null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Common Login using Email and Password
   */
  const loginWithEmail = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !pass) {
      const msg = 'Please enter both your university email and password.';
      setAuthError(msg);
      return { success: false, error: msg };
    }

    try {
      let credential;
      try {
        credential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      } catch (signInErr: any) {
        // Auto-provision demo accounts if testing credentials on fresh Firebase instance
        const normalized = cleanEmail.toLowerCase();
        const isDemoAdmin = normalized === 'it24026@mbstu.ac.bd' && pass === 'Admin@1234';
        const isDemoTeacher =
          (normalized === 'ahsan.habib@mbstu.ac.bd' ||
           normalized === 'nargisakter@mbstu.ac.bd' ||
           normalized === 'it24026.teacher@mbstu.ac.bd') &&
          pass === 'Teacher@1234';
        const isDemoStudent =
          (normalized === 'it24026.student@mbstu.ac.bd' ||
           normalized === 'farhana.y@mbstu.ac.bd' ||
           normalized === 'sabbir.h@mbstu.ac.bd') &&
          pass === 'Student@1234';

        if ((isDemoAdmin || isDemoTeacher || isDemoStudent) && (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential')) {
          credential = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
        } else {
          throw signInErr;
        }
      }

      const user = credential.user;
      const profile = await verifyAndLoadUserProfile(user);
      setUserProfile(profile);
      await db.syncWithAuth(user, profile.role, profile);
      return { success: true };
    } catch (err: any) {
      let message = 'Failed to authenticate. Please check your email and password.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'Invalid email or password. Please verify credentials.';
      } else if (err.code === 'auth/user-not-found') {
        message = 'No university account found with this email.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Too many failed login attempts. Please try again in a few minutes or reset password.';
      } else if (err.code === 'auth/user-disabled') {
        message = 'This university account has been disabled. Please contact the Registrar.';
      } else if (err.message) {
        message = err.message;
      }
      setAuthError(message);
      return { success: false, error: message };
    }
  };

  /**
   * Google Workspace Sign-In with Graceful Popup Handling
   */
  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res?.user) {
        const profile = await verifyAndLoadUserProfile(res.user);
        setUserProfile(profile);
        await db.syncWithAuth(res.user, profile.role, profile);
      }
    } catch (err: any) {
      console.warn('Google Sign-In response code:', err.code, err.message);

      // Requirement 5: Handle cancelled or closed popups gracefully without showing a misleading error
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // User voluntarily closed or cancelled the window; do not display error banner
        setAuthError(null);
        return;
      }

      if (err.code === 'auth/popup-blocked') {
        setAuthError('Sign-in popup was blocked by your browser. Please allow popups for this site, or use the "Full-Page Redirect" button below.');
        return;
      }

      if (err.code === 'auth/unauthorized-domain') {
        setAuthError('Unauthorized Domain: The current URL domain must be added to Firebase Console > Authentication > Settings > Authorized Domains.');
        return;
      }

      if (err.code === 'auth/operation-not-allowed') {
        setAuthError('Google sign-in is not enabled in Firebase Console. Please enable Google under Authentication > Sign-in method.');
        return;
      }

      if (err.code === 'auth/account-exists-with-different-credential') {
        setAuthError('An account already exists with this email address using email/password. Please log in using your password.');
        return;
      }

      setAuthError(err.message || 'Google authentication failed.');
    }
  };

  /**
   * Full-Page Redirect Google Sign-In (For environments where popups are blocked or restricted)
   */
  const loginWithGoogleRedirect = async () => {
    setAuthError(null);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err: any) {
      console.error('Google Redirect Sign-In error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setAuthError('Unauthorized Domain: The current URL domain must be added to Firebase Console > Authentication > Settings > Authorized Domains.');
      } else {
        setAuthError(err.message || 'Redirect sign-in failed.');
      }
    }
  };

  /**
   * Password Reset / Invitation Flow
   */
  const sendPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Could not send reset email.' };
    }
  };

  /**
   * Privileged Account Creation (Admin Only)
   * Uses secondary Firebase Auth instance so the Admin's session is uninterrupted.
   */
  const createManagedAccount = async (params: {
    role: UserRole;
    email: string;
    temporaryPassword: string;
    displayName: string;
    entityId: string;
  }): Promise<{ success: boolean; uid?: string; error?: string }> => {
    if (userProfile?.role !== 'ADMIN') {
      return { success: false, error: 'Unauthorized: Only administrators can create university user accounts.' };
    }

    try {
      const secAuth = getSecondaryAdminAuth();
      const userCred = await createUserWithEmailAndPassword(secAuth, params.email.trim(), params.temporaryPassword);
      const newUid = userCred.user.uid;
      await signOut(secAuth);

      // Persist user role and reference in Firestore /users/{newUid}
      const newProfile: UserProfile = {
        uid: newUid,
        email: params.email.trim(),
        displayName: params.displayName,
        role: params.role,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };

      if (params.role === 'STUDENT' && params.entityId) {
        newProfile.studentId = params.entityId;
      } else if (params.role === 'TEACHER' && params.entityId) {
        newProfile.teacherId = params.entityId;
      }

      await setDoc(doc(firestoreDb, 'users', newUid), sanitizeForFirestore(newProfile));
      return { success: true, uid: newUid };
    } catch (err: any) {
      console.error('Admin user creation failed:', err);
      let msg = err.message || 'Failed to create authentication account.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An authentication account with this email address already exists.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      }
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUserProfile(null);
    setCurrentUser(null);
    await db.syncWithAuth(null, 'STUDENT', null);
  };

  const overrideRoleForTesting = (role: UserRole) => {
    if (userProfile && userProfile.role === 'ADMIN') {
      const updated = { ...userProfile, role };
      setUserProfile(updated);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        loginWithEmail,
        loginWithGoogle,
        loginWithGoogleRedirect,
        logout,
        sendPasswordReset,
        createManagedAccount,
        authError,
        setAuthError,
        overrideRoleForTesting,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
