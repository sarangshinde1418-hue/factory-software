import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as fbSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, UserRole } from '../types/erp';

export interface WorkerInfo {
  id: string;
  name: string;
  phone: string;
  role: string;
}

export const PRESET_WORKERS: WorkerInfo[] = [
  { id: 'w1', name: 'Ramesh Kumar', phone: '+91 98220 11223', role: 'Mixing & Granulation' },
  { id: 'w2', name: 'Suresh Yadav', phone: '+91 98220 11224', role: 'Packing & Sealing' },
  { id: 'w3', name: 'Dinesh Patel', phone: '+91 98220 11225', role: 'Bottle Filling' },
  { id: 'w4', name: 'Anil Sharma', phone: '+91 98220 11226', role: 'Bagging & Loading' },
  { id: 'w5', name: 'Vijay Verma', phone: '+91 98220 11227', role: 'Drum & Bulk Packing' },
  { id: 'w6', name: 'Mukesh Singh', phone: '+91 98220 11228', role: 'Material Handling' },
  { id: 'w7', name: 'Santosh Kale', phone: '+91 98220 11229', role: 'Maintenance & Motors' },
  { id: 'w8', name: 'Raju Shinde', phone: '+91 98220 11230', role: 'Machine Operator' },
  { id: 'w9', name: 'Sunil Pawar', phone: '+91 98220 11231', role: 'Labeling & Boxing' },
  { id: 'w10', name: 'Ajay Jadhav', phone: '+91 98220 11232', role: 'Loading & Dispatch' },
];

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  role: UserRole;
  activeWorker: WorkerInfo;
  setActiveWorker: (worker: WorkerInfo) => void;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (newRole: UserRole) => void;
  isOwner: boolean;
  isManager: boolean;
  isWorker: boolean;
  canEditFormulas: boolean;
  canAssignTasks: boolean;
  canAddStock: boolean;
  canViewReports: boolean;
  canMakeProductionEntry: boolean;
  canMakeOutgoingEntry: boolean;
  canManageSettings: boolean;
  canApproveBatch: boolean;
  canIssueStock: boolean;
  canPerformQA: boolean;
}

const BOOTSTRAP_OWNER_EMAIL = 'sarangshinde1418@gmail.com';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('owner');
  const [activeWorker, setActiveWorker] = useState<WorkerInfo>(PRESET_WORKERS[0]);
  const [loading, setLoading] = useState<boolean>(true);

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userDocRef);

          let profile: UserProfile;
          if (snap.exists()) {
            profile = snap.data() as UserProfile;
          } else {
            // New user registration
            const isOwnerEmail = user.email?.toLowerCase() === BOOTSTRAP_OWNER_EMAIL.toLowerCase();
            profile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || (isOwnerEmail ? 'Manoj Patel (Owner)' : 'Rajesh Sharma (Manager)'),
              role: isOwnerEmail ? 'owner' : 'manager',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, profile);
          }
          setUserProfile(profile);
          setActiveRole(profile.role);
        } catch (err) {
          console.error('Error fetching/setting user profile:', err);
          const fallback: UserProfile = {
            uid: user.uid,
            email: user.email || BOOTSTRAP_OWNER_EMAIL,
            displayName: user.displayName || 'Manoj Patel (Owner)',
            role: 'owner',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setUserProfile(fallback);
          setActiveRole('owner');
        }
      } else {
        // Fallback default persona for preview & rapid role switching
        const demoUser: UserProfile = {
          uid: 'demo-owner-id',
          email: BOOTSTRAP_OWNER_EMAIL,
          displayName: activeRole === 'owner' ? 'Manoj Patel (Owner)' : activeRole === 'manager' ? 'Rajesh Sharma (Manager)' : `${activeWorker.name} (Worker)`,
          role: activeRole,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setUserProfile(demoUser);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeRole, activeWorker]);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Google Sign In failed:', err);
      handleFirestoreError(err, OperationType.GET, 'auth/google');
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
      setUserProfile({
        uid: 'demo-owner-id',
        email: BOOTSTRAP_OWNER_EMAIL,
        displayName: 'Manoj Patel (Owner)',
        role: 'owner',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setActiveRole('owner');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const switchRole = (newRole: UserRole) => {
    setActiveRole(newRole);
    if (userProfile) {
      setUserProfile({
        ...userProfile,
        role: newRole,
        displayName: newRole === 'owner' ? 'Manoj Patel (Owner)' : newRole === 'manager' ? 'Rajesh Sharma (Manager)' : `${activeWorker.name} (Worker)`,
      });
    }
  };

  const isOwner = activeRole === 'owner';
  const isManager = activeRole === 'manager';
  const isWorker = activeRole === 'worker';

  // Role permissions
  const canEditFormulas = isOwner;
  const canAssignTasks = isOwner || isManager;
  const canAddStock = isOwner || isManager;
  const canViewReports = isOwner || isManager;
  const canMakeProductionEntry = isOwner || isManager || isWorker;
  const canMakeOutgoingEntry = isOwner || isManager || isWorker;
  const canManageSettings = isOwner;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        role: activeRole,
        activeWorker,
        setActiveWorker,
        loading,
        signInWithGoogle,
        logout,
        switchRole,
        isOwner,
        isManager,
        isWorker,
        canEditFormulas,
        canAssignTasks,
        canAddStock,
        canViewReports,
        canMakeProductionEntry,
        canMakeOutgoingEntry,
        canManageSettings,
        canApproveBatch: isOwner || isManager,
        canIssueStock: isOwner || isManager,
        canPerformQA: isOwner || isManager,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
