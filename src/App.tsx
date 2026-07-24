import React, { useState, useEffect, useRef } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  doc, 
  getDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { seedHospitalsAndData, seedHospitalSpecificData } from './seedData';
import { UserProfile, Hospital } from './types';
import { createUserProfile, getAllHospitals, getSystemSettings, updateHospitalOnlineStatus, updateHospitalActiveHeartbeat } from './services/dbService';
import { checkHospitalPaymentStatus, formatMonthString } from './utils/paymentUtils';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import HospitalDashboard from './components/HospitalDashboard';
import { 
  Activity, 
  Shield, 
  Lock, 
  Building2, 
  AlertOctagon, 
  LogOut, 
  ExternalLink,
  ChevronRight,
  Users,
  MapPin,
  ShieldAlert,
  RefreshCw,
  Mail,
  AlertTriangle,
  Clock
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [hospitalInfo, setHospitalInfo] = useState<Hospital | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [isSuspended, setIsSuspended] = useState(false);
  const [showContactSuperAdmin, setShowContactSuperAdmin] = useState(false);

  // Branding states
  const [systemLogo, setSystemLogo] = useState<string>('/logo.svg');
  const [systemName, setSystemName] = useState<string>('RAPHA JOY MEDICAL CLINICS');
  const [systemPrimaryColor, setSystemPrimaryColor] = useState<string>('#0f172a');

  // Dynamic Hospitals List state
  const [loadedHospitals, setLoadedHospitals] = useState<Hospital[]>([]);

  // Selected Branch state for Landing Page branch directory
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  // Demo simulation mode state (disabled)
  const [isDemoMode, setIsDemoMode] = useState(false);

  const isCreatingProfile = useRef(false);

  // Tick for local state re-render to reflect self-healing branch offline status
  const [tick, setTick] = useState(0);

  const isBranchOnline = (h: Hospital) => {
    if (!h.isOnline) return false;
    if (!h.lastActiveAt) return true;
    // 10 minutes in milliseconds to handle extreme clock drift between devices gracefully.
    // If h.isOnline is true and lastActiveAt is within 10 minutes, the branch is online.
    return (Date.now() - h.lastActiveAt) < 600000;
  };

  // Manual Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [manualRole, setManualRole] = useState<UserProfile['role']>('Hospital Admin');
  const [manualHospitalId, setManualHospitalId] = useState('hospital_a');
  const [showManualForm, setShowManualForm] = useState(true);

  // Super Admin security check states
  const [showSuperPinInput, setShowSuperPinInput] = useState(false);
  const [superPin, setSuperPin] = useState('');
  const [superPinError, setSuperPinError] = useState('');

  // Forgot Password / Reset states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [autoSuperResetSent, setAutoSuperResetSent] = useState(false);

  const handleAutoSuperReset = async () => {
    try {
      await sendPasswordResetEmail(auth, 'breakthroughcollege03@gmail.com');
      setAutoSuperResetSent(true);
    } catch (e: any) {
      console.error(e);
    }
  };

  // Load hospitals & Seed data
  useEffect(() => {
    let unsubscribeHospitals: (() => void) | null = null;
    let unsubscribeAuth: (() => void) | null = null;

    async function init() {
      // 1. Seed base hospitals & samples if Firestore is empty
      await seedHospitalsAndData();



      // Load branding settings
      try {
        const settings = await getSystemSettings();
        if (settings) {
          if (settings.logo) setSystemLogo(settings.logo);
          if (settings.name) setSystemName(settings.name);
          if (settings.primaryColor) setSystemPrimaryColor(settings.primaryColor);
        }
      } catch (err) {
        console.error('Error loading branding settings:', err);
      }

      // Set up real-time listener on the 'hospitals' collection
      unsubscribeHospitals = onSnapshot(collection(db, 'hospitals'), (snapshot) => {
        const hosps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hospital));
        setLoadedHospitals(hosps);
        setSelectedBranchId(prev => prev || (hosps[0]?.id || null));
      }, (err) => {
        console.error('Error loading hospitals via snapshot:', err);
      });
      
      // 2. Listen to Auth State
      unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          if (isCreatingProfile.current) {
            // Actively creating or logging in with quick login right now, let it handle the states manually
            return;
          }
          try {
            // Load profile from Firestore users/uid
            const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDocSnap.exists()) {
              const profile = { id: firebaseUser.uid, ...userDocSnap.data() } as UserProfile;
              setUser(profile);
              
              // If not Super Admin, load their hospital details and verify status
              if (profile.role !== 'Super Admin') {
                const hospDocSnap = await getDoc(doc(db, 'hospitals', profile.hospitalId));
                if (hospDocSnap.exists()) {
                  const hospData = hospDocSnap.data() as Hospital;
                  setHospitalInfo(hospData);
                  if (hospData.status === 'suspended') {
                    setIsSuspended(true);
                  } else {
                    setIsSuspended(false);
                    // Update hospital online status
                    await updateHospitalOnlineStatus(profile.hospitalId, true).catch(() => {});
                    // Check if specific hospital data has been seeded; seed dynamically under authenticated user context if empty
                    try {
                      const patientsRef = collection(db, 'patients');
                      const q = query(patientsRef, where('hospitalId', '==', profile.hospitalId), limit(1));
                      const patientsSnap = await getDocs(q);
                      if (patientsSnap.empty) {
                        console.log(`Dynamic seeding triggered for hospital: ${profile.hospitalId}`);
                        await seedHospitalSpecificData(profile.hospitalId);
                      }
                    } catch (seedErr) {
                      console.error(`Dynamic seeding failed for hospital ${profile.hospitalId}:`, seedErr);
                    }
                  }
                }
              } else {
                setHospitalInfo(null);
                setIsSuspended(false);
              }
            } else {
              // Wait a brief moment to see if profile is being created asynchronously (quick login)
              await new Promise(resolve => setTimeout(resolve, 2000));
              if (isCreatingProfile.current) return;

              const secondDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
              if (secondDocSnap.exists()) {
                const profile = { id: firebaseUser.uid, ...secondDocSnap.data() } as UserProfile;
                setUser(profile);
                if (profile.role !== 'Super Admin') {
                  const hospDocSnap = await getDoc(doc(db, 'hospitals', profile.hospitalId));
                  if (hospDocSnap.exists()) {
                    const hospData = hospDocSnap.data() as Hospital;
                    setHospitalInfo(hospData);
                    setIsSuspended(hospData.status === 'suspended');
                  }
                } else {
                  setHospitalInfo(null);
                  setIsSuspended(false);
                }
              } else {
                // If the profile does not exist yet and isCreatingProfile is false,
                // do NOT aggressively call signOut to avoid infinite redirection loops.
                // Just clear user state to show the main login UI.
                setUser(null);
              }
            }
          } catch (e) {
            console.error('Error fetching user profile:', e);
            setUser(null);
          }
        } else {
          setUser(null);
          setHospitalInfo(null);
          setIsSuspended(false);
        }
        setLoading(false);
      });
    }
    init();

    return () => {
      if (unsubscribeHospitals) {
        unsubscribeHospitals();
      }
      if (unsubscribeAuth) {
        unsubscribeAuth();
      }
    };
  }, []);

  // Force-refresh local UI every 5 seconds to accurately reflect offline status transition when lastActiveAt expires
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Self-healing online active heartbeat for current logged-in branch
  useEffect(() => {
    if (!user || user.role === 'Super Admin' || !user.hospitalId) return;

    const hospId = user.hospitalId;

    // Send immediate heartbeat on login/mount
    updateHospitalActiveHeartbeat(hospId);

    // Update heartbeat every 10 seconds
    const interval = setInterval(() => {
      updateHospitalActiveHeartbeat(hospId);
    }, 10000);

    const handleUnload = () => {
      updateHospitalOnlineStatus(hospId, false).catch(() => {});
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      // Automatically go offline on logout/unmount
      updateHospitalOnlineStatus(hospId, false).catch(() => {});
    };
  }, [user]);

  // Real-time listener for current logged-in branch details (payment/suspension updates)
  useEffect(() => {
    if (!user || user.role === 'Super Admin' || !user.hospitalId) return;

    const unsubHosp = onSnapshot(doc(db, 'hospitals', user.hospitalId), (docSnap) => {
      if (docSnap.exists()) {
        const hospData = { id: docSnap.id, ...docSnap.data() } as Hospital;
        setHospitalInfo(hospData);
        setIsSuspended(hospData.status === 'suspended');
      }
    }, (err) => {
      console.error('Error listening to branch doc updates:', err);
    });

    return () => unsubHosp();
  }, [user?.hospitalId, user?.role]);

  // Handle manual login
  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    if (!email || !password) return;

    setLoading(true);
    let signedIn = false;
    let userCredential: any = null;
    let lastError: any = null;

    // Support both '2026' and 'Password123!' for any Super Admin email
    let isSuper = email.trim().toLowerCase() === 'breakthroughcollege03@gmail.com';
    if (!isSuper) {
      try {
        const mockUid = `uid_${email.replace(/[^a-zA-Z0-9]/g, '')}`;
        const userDocSnap = await getDoc(doc(db, 'users', mockUid));
        if (userDocSnap.exists() && userDocSnap.data()?.role === 'Super Admin') {
          isSuper = true;
        } else {
          const q = query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase()), where('role', '==', 'Super Admin'));
          const snap = await getDocs(q);
          if (!snap.empty) {
            isSuper = true;
          }
        }
      } catch (errCheck) {
        console.error('Error checking super admin role:', errCheck);
      }
    }

    const tryPasswords = isSuper
      ? [password, '2026', 'Password123!']
      : [password];

    for (const pw of tryPasswords) {
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, pw);
        signedIn = true;
        break;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (signedIn) {
      setLoading(false);
      return;
    }

    const err = lastError;
    if (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        // Check if there is a pre-registered Firestore user profile with this email
        try {
          const mockUid = `uid_${email.replace(/[^a-zA-Z0-9]/g, '')}`;
          const userDocSnap = await getDoc(doc(db, 'users', mockUid));
          if (userDocSnap.exists()) {
            const profileData = userDocSnap.data() as UserProfile;
            const oldDocId = userDocSnap.id;

            // Set isCreatingProfile.current = true since we are manually handling state during user creation/migration
            isCreatingProfile.current = true;

            // Create standard Auth user with the default password or whatever was typed
            const createPassword = email.trim().toLowerCase() === 'breakthroughcollege03@gmail.com' ? '2026' : password;
            let newUserCredential;
            try {
              newUserCredential = await createUserWithEmailAndPassword(auth, email, createPassword);
            } catch (createErr) {
              newUserCredential = await createUserWithEmailAndPassword(auth, email, 'Password123!');
            }
            const newUid = newUserCredential.user.uid;

            // Rewrite Firestore document to use the real Firebase Auth UID
            const updatedProfile = {
              ...profileData,
              id: newUid
            };
            
            await createUserProfile(newUid, updatedProfile);
            
            // Delete the old mock document if the ID is different
            if (oldDocId !== newUid) {
              await deleteDoc(doc(db, 'users', oldDocId));
            }

            // Set states manually for instant transition
            setUser(updatedProfile);
            if (updatedProfile.role !== 'Super Admin') {
              const hospDocSnap = await getDoc(doc(db, 'hospitals', updatedProfile.hospitalId));
              if (hospDocSnap.exists()) {
                const hospData = hospDocSnap.data() as Hospital;
                setHospitalInfo(hospData);
                setIsSuspended(hospData.status === 'suspended');
              }
            } else {
              setHospitalInfo(null);
              setIsSuspended(false);
            }

            setTimeout(() => {
              isCreatingProfile.current = false;
            }, 1500);

            setLoading(false);
            return;
          }
        } catch (dbErr: any) {
          console.error("Error matching pre-registered profile:", dbErr);
        }
      }
      
      isCreatingProfile.current = false;
      setLoginError(err.message || 'Login failed.');
      setLoading(false);
    }
  }



  // Verify Super Admin access PIN
  function handleSuperPinSubmit() {
    if (superPin === '2026') {
      setShowSuperPinInput(false);
      setSuperPin('');
      setSuperPinError('');
      handleQuickLogin('breakthroughcollege03@gmail.com', 'Super Admin', '', 'Global');
    } else {
      setSuperPinError('Invalid PIN code. Access Denied.');
    }
  }

  // Handle manual password reset email submission
  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail) {
      setResetError('Please enter your email address.');
      return;
    }
    setResetLoading(true);
    setResetSuccess('');
    setResetError('');
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSuccess('Password reset link has been successfully sent to your email. Please check your inbox!');
    } catch (err: any) {
      console.error('Password reset error:', err);
      let errorMsg = 'Failed to send password reset email. Please try again.';
      if (err.code === 'auth/invalid-email') {
        errorMsg = 'Invalid email address format.';
      } else if (err.code === 'auth/user-not-found') {
        errorMsg = 'No user account found with this email.';
      }
      setResetError(errorMsg);
    } finally {
      setResetLoading(false);
    }
  }

  // Handle Quick Login Seeding & Signing in
  async function handleQuickLogin(targetEmail: string, role: UserProfile['role'], hospitalId: string, hospitalName: string) {
    if (role === 'Super Admin' && targetEmail !== 'breakthroughcollege03@gmail.com') {
      try {
        const mockUid = `uid_${targetEmail.replace(/[^a-zA-Z0-9]/g, '')}`;
        const userDocSnap = await getDoc(doc(db, 'users', mockUid));
        if (!userDocSnap.exists() || userDocSnap.data()?.role !== 'Super Admin') {
          const q = query(collection(db, 'users'), where('email', '==', targetEmail.trim().toLowerCase()), where('role', '==', 'Super Admin'));
          const snap = await getDocs(q);
          if (snap.empty) {
            setLoginError('Access Denied: Only authorized Super Admins can log in.');
            return;
          }
        }
      } catch (errCheck) {
        setLoginError('Access Denied during authorization check.');
        return;
      }
    }
    setLoading(true);
    setLoginError('');
    setIsSuspended(false);

    try {
      // 1. Mark as creating profile so onAuthStateChanged doesn't auto-logout or interfere
      isCreatingProfile.current = true;

      // 2. Try standard sign-in (supporting both '2026' and 'Password123!' for the Super Admin)
      let signedIn = false;
      let userCredential: any = null;
      let lastError: any = null;

      const tryPasswords = (targetEmail.trim().toLowerCase() === 'breakthroughcollege03@gmail.com' || role === 'Super Admin')
        ? ['2026', 'Password123!']
        : ['Password123!'];

      for (const pw of tryPasswords) {
        try {
          userCredential = await signInWithEmailAndPassword(auth, targetEmail, pw);
          signedIn = true;
          break;
        } catch (err: any) {
          lastError = err;
        }
      }

      if (!signedIn) {
        throw lastError || new Error("Sign in failed");
      }

      const uid = userCredential.user.uid;

      // 3. Verify/create user profile in Firestore
      const userDocSnap = await getDoc(doc(db, 'users', uid));
      let profileData: UserProfile;

      if (!userDocSnap.exists()) {
        profileData = await createUserProfile(uid, {
          hospitalId,
          name: `${role} (${hospitalName})`,
          email: targetEmail,
          role,
          createdAt: new Date().toISOString()
        });
      } else {
        profileData = { id: uid, ...userDocSnap.data() } as UserProfile;
      }

      // 4. Set states manually to ensure instant transition
      if (role !== 'Super Admin') {
        const hospDocSnap = await getDoc(doc(db, 'hospitals', hospitalId));
        if (hospDocSnap.exists()) {
          const hospData = hospDocSnap.data() as Hospital;
          setHospitalInfo(hospData);
          setIsSuspended(hospData.status === 'suspended');
          if (hospData.status !== 'suspended') {
            await updateHospitalOnlineStatus(hospitalId, true).catch(() => {});
          }
        } else {
          setHospitalInfo(null);
        }
      } else {
        setHospitalInfo(null);
        setIsSuspended(false);
      }

      setUser(profileData);
      
      // Delay releasing isCreatingProfile flag to let any lingering auth listeners settle
      setTimeout(() => {
        isCreatingProfile.current = false;
      }, 1500);

      setLoading(false);

    } catch (error: any) {
      // 2. If user does not exist yet or there's an invalid credential because they don't exist in auth, create them!
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
          isCreatingProfile.current = true;
          const createPassword = targetEmail.trim().toLowerCase() === 'breakthroughcollege03@gmail.com' ? '2026' : 'Password123!';
          let userCredential;
          try {
            userCredential = await createUserWithEmailAndPassword(auth, targetEmail, createPassword);
          } catch (createErr) {
            userCredential = await createUserWithEmailAndPassword(auth, targetEmail, 'Password123!');
          }
          const uid = userCredential.user.uid;
          
          // Write profile document to Firestore users collection
          const newProfile = await createUserProfile(uid, {
            hospitalId,
            name: `${role} (${hospitalName})`,
            email: targetEmail,
            role,
            createdAt: new Date().toISOString()
          });

          // Set user state manually to ensure render matches
          setUser(newProfile);
          if (role !== 'Super Admin') {
            const hospDocSnap = await getDoc(doc(db, 'hospitals', hospitalId));
            if (hospDocSnap.exists()) {
              const hospData = hospDocSnap.data() as Hospital;
              setHospitalInfo(hospData);
              if (hospData.status !== 'suspended') {
                await updateHospitalOnlineStatus(hospitalId, true).catch(() => {});
              }
            }
          } else {
            setHospitalInfo(null);
            setIsSuspended(false);
          }
          
          // Delay releasing isCreatingProfile flag to let any lingering auth listeners settle
          setTimeout(() => {
            isCreatingProfile.current = false;
          }, 1500);

          setLoading(false);
        } catch (createErr: any) {
          isCreatingProfile.current = false;
          setLoginError(`Seeding failed: ${createErr.message}`);
          setLoading(false);
        }
      } else {
        isCreatingProfile.current = false;
        setLoginError(`Quick login failed: ${error.message}`);
        setLoading(false);
      }
    }
  }

  async function handleLogout() {
    setLoading(true);
    if (user && user.role !== 'Super Admin' && user.hospitalId) {
      await updateHospitalOnlineStatus(user.hospitalId, false).catch(() => {});
    }
    await signOut(auth);
    setUser(null);
    setHospitalInfo(null);
    setIsSuspended(false);
    
    // Reload hospitals and branding settings
    try {
      const [settings, hosps] = await Promise.all([
        getSystemSettings().catch(() => null),
        getAllHospitals().catch(() => [])
      ]);
      if (settings) {
        setSystemLogo(settings.logo || '/logo.svg');
        setSystemName(settings.name || 'RAPHA JOY MEDICAL CLINICS');
        setSystemPrimaryColor(settings.primaryColor || '#0f172a');
      }
      setLoadedHospitals(hosps);
    } catch (e) {
      console.error('Error reloading on logout:', e);
    }
    
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center">
        <Activity className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Loading Hospital Environment...</h2>
      </div>
    );
  }

  // 1. BLOCKED IF HOSPITAL IS SUSPENDED BY SUPER ADMIN
  if (user && isSuspended) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-6">
        <div className="bg-white max-w-md w-full border border-red-200 rounded-xl p-8 text-center space-y-4 shadow-sm">
          <AlertOctagon className="w-16 h-16 text-red-600 mx-auto" />
          <h2 className="text-xl font-extrabold text-slate-800">Hospital Branch Suspended</h2>
          <p className="text-sm text-slate-500">
            Access to <strong>{hospitalInfo?.name}</strong> has been suspended by the system Super Administrator. 
            All patient records and clinical databases for this branch are securely locked.
          </p>
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs font-mono text-red-700">
            Branch Code: {hospitalInfo?.code}
          </div>
          <button 
            onClick={handleLogout}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 rounded-lg text-sm flex items-center justify-center space-x-1"
          >
            <LogOut className="w-4 h-4" />
            <span>Return to Login</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. DASHBOARD VIEW BASED ON ACCOUNT TYPE
  if (user) {
    if (user.role === 'Super Admin') {
      return (
        <SuperAdminDashboard 
          currentUser={user} 
          onLogout={handleLogout} 
          onBrandingUpdate={(name: string, logo: string, primaryColor?: string) => {
            setSystemName(name);
            setSystemLogo(logo);
            if (primaryColor) setSystemPrimaryColor(primaryColor);
          }}
        />
      );
    } else if (hospitalInfo) {
      const paymentCheck = checkHospitalPaymentStatus(hospitalInfo);
      if (paymentCheck.isPaused) {
        return (
          <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 text-white relative overflow-hidden">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="bg-slate-800/90 backdrop-blur-md max-w-lg w-full border border-rose-500/30 rounded-2xl p-8 text-center space-y-6 shadow-2xl relative z-10">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-rose-500/10 border border-rose-500/30 rounded-full text-rose-400 mb-2 shadow-inner">
                <Lock className="w-10 h-10 animate-pulse" />
              </div>

              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 inline-block mb-2">
                  Project Access Paused
                </span>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Monthly Subscription Payment Overdue
                </h2>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Project access for <strong className="text-slate-200">{hospitalInfo.name}</strong> has been automatically paused because monthly subscription payment due on the <strong className="text-amber-400">5th of the month</strong> was not recorded for <strong className="text-slate-200">{formatMonthString(paymentCheck.currentMonthStr)}</strong>.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4 text-left text-xs space-y-2.5 font-sans">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="text-slate-400 font-medium">Branch Identity:</span>
                  <span className="font-bold text-white font-mono bg-slate-800 px-2 py-0.5 rounded">{hospitalInfo.code}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Payment Schedule Rule:</span>
                  <span className="font-bold text-amber-400">5th of Every Month</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Subscription Tier:</span>
                  <span className="font-bold text-slate-200">{hospitalInfo.subscription || 'Standard'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Monthly Fee:</span>
                  <span className="font-bold text-emerald-400">KSh {(hospitalInfo.monthlyFee || 150000).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                  <span className="text-slate-400 font-medium">Current Access Status:</span>
                  <span className="font-bold text-rose-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    PAUSED (Unpaid after 5th)
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left flex items-start space-x-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200/90 leading-normal">
                  <strong>Super Admin Authorization Required:</strong> Only the Super Administrator can record payment or enable a continuation override to unpause this project application.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  onClick={async () => {
                    try {
                      const snap = await getDoc(doc(db, 'hospitals', hospitalInfo.id));
                      if (snap.exists()) {
                        setHospitalInfo({ id: snap.id, ...snap.data() } as Hospital);
                      }
                    } catch (e) {
                      console.error('Error refreshing hospital payment status:', e);
                    }
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-900/30 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Check & Refresh Payment Status</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowContactSuperAdmin(true)}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2 rounded-xl text-xs flex items-center justify-center space-x-1 transition-colors cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Contact Super Admin</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 rounded-xl text-xs flex items-center justify-center space-x-1 transition-colors cursor-pointer border border-slate-700"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Return to Login</span>
                  </button>
                </div>
              </div>
            </div>

            {showContactSuperAdmin && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full text-left space-y-4 shadow-2xl">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <Shield className="w-4 h-4 text-indigo-400" /> Super Admin Contact
                    </h3>
                    <button onClick={() => setShowContactSuperAdmin(false)} className="text-slate-400 hover:text-white">✕</button>
                  </div>
                  <div className="space-y-3 text-xs text-slate-300">
                    <p className="text-slate-400 leading-relaxed">
                      Please provide payment confirmation or request a continuation override from the Super Administrator:
                    </p>
                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 space-y-2 font-mono">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">Email:</span>
                        <span className="text-indigo-300 font-bold">breakthroughcollege03@gmail.com</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase">System:</span>
                        <span className="text-emerald-400 font-bold">RAPHA JOY MEDICAL CLINICS</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowContactSuperAdmin(false)}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded-xl text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      }

      return (
        <HospitalDashboard 
          currentUser={user} 
          hospitalName={hospitalInfo.name} 
          onLogout={handleLogout} 
        />
      );
    }
  }

  // 3. SECURE LANDING & QUICK LOGIN PANEL (MULTI-TENANCY SELECTOR)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <style>{`
        .brand-bg {
          background-color: ${systemPrimaryColor} !important;
        }
        .brand-text {
          color: ${systemPrimaryColor} !important;
        }
        .brand-border {
          border-color: ${systemPrimaryColor} !important;
        }
        .brand-ring:focus {
          --tw-ring-color: ${systemPrimaryColor} !important;
          border-color: ${systemPrimaryColor} !important;
        }
        .brand-bg-hover:hover {
          filter: brightness(0.9) !important;
          opacity: 0.95 !important;
        }
      `}</style>
      
      {/* Top navbar */}
      <header className="bg-white border-b border-slate-200 py-2 px-6">
        <div className="max-w-7xl w-full mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3.5">
            <div className={`flex items-center justify-center w-16 h-16 overflow-hidden shrink-0 ${systemLogo ? '' : 'brand-bg p-2 rounded-xl text-white'}`}>
              {systemLogo ? (
                <img 
                  src={systemLogo} 
                  alt="System Logo" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Activity className="w-8 h-8" />
              )}
            </div>
            <span className="font-extrabold text-slate-800 text-lg tracking-tight uppercase">{systemName}</span>
          </div>
          <span className="text-xs font-semibold brand-text bg-slate-100 px-2.5 py-1 rounded-full flex items-center gap-1 border brand-border">
            <Shield className="w-3.5 h-3.5" /> Isolated Database Environment
          </span>
        </div>
      </header>

      {/* Main split sections */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col lg:flex-row items-start justify-center gap-12 my-auto">
        
        {/* Left column: Descriptive & Branches Directory */}
        <div className="flex-1 w-full space-y-6 max-w-xl text-center lg:text-left">
          <div className="space-y-2">
            <span className="text-xs font-bold brand-text tracking-widest uppercase">
              HMS CORE MULTI-BRANCH DIRECTORY
            </span>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-800 tracking-tight leading-none">
              Clinics & Hospital Branches <br />
              <span className="brand-text">Active Network Directory</span>
            </h1>
            <p className="text-slate-500 text-xs leading-relaxed">
              Welcome to the secure HIPAA-compliant multi-branch dashboard. Monitor active branch networks, check online availability, and select a branch to launch your dedicated clinical workspace.
            </p>
          </div>

          {/* Real-time Branch Directory HUD */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3.5 shadow-xs text-left">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-500" /> Hospital Branches Directory
              </h3>
              <span className="text-[10px] text-slate-400 font-semibold italic">Real-Time Sync Active</span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
              {loadedHospitals.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs italic">
                  No hospital branches found. Please log in as Super Admin to add one.
                </div>
              ) : (
                loadedHospitals.map((h, idx) => {
                  const isSelected = h.id === selectedBranchId;
                  const isSuspendedHosp = h.status === 'suspended';
                  const planColorMap: Record<string, string> = {
                    Premium: 'bg-emerald-50 text-emerald-800 border-emerald-100',
                    Standard: 'bg-indigo-50 text-indigo-800 border-indigo-100',
                    Basic: 'bg-slate-50 text-slate-700 border-slate-200'
                  };
                  const planBadgeClass = planColorMap[h.subscription] || 'bg-slate-50 text-slate-700';

                  return (
                    <div 
                      key={h.id} 
                      id={`branch-card-${h.id}`}
                      onClick={() => {
                        setSelectedBranchId(h.id);
                        const domain = h.id.replace(/_/g, '-');
                        setEmail(`admin@${domain}.com`);
                        setPassword("Password123!");
                      }}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-300 hover:scale-[1.018] hover:shadow-xs active:scale-[0.995] flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSelected 
                          ? 'bg-indigo-50/40 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs' 
                          : isSuspendedHosp 
                          ? 'bg-red-50/30 border-red-200/50 hover:bg-red-50/50' 
                          : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold ${isSuspendedHosp ? 'text-red-900 line-through' : 'text-slate-800'}`}>
                            Branch {idx + 1}: {h.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">({h.code})</span>
                          
                          {/* Map Pin Icon with Hover Tooltip */}
                          <div className="relative group inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                            <span 
                              className="p-1 rounded-full bg-slate-200/60 hover:bg-indigo-100 hover:text-indigo-600 text-slate-500 transition-all cursor-help"
                              title={getBranchAddress(h)}
                            >
                              <MapPin className="w-3 h-3" />
                            </span>
                            {/* Custom CSS Hover Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-[100] w-48 text-center pointer-events-none transition-all duration-200">
                              <div className="bg-slate-900/95 text-white text-[10px] leading-relaxed font-semibold px-2 py-1.5 rounded-lg shadow-lg border border-slate-700/50 backdrop-blur-xs">
                                <span className="block text-indigo-300 font-bold uppercase text-[8px] tracking-wider mb-0.5">Location</span>
                                {getBranchAddress(h)}
                              </div>
                              <div className="w-1.5 h-1.5 bg-slate-900/95 transform rotate-45 mx-auto -mt-1 border-r border-b border-slate-700/50"></div>
                            </div>
                          </div>

                          {isBranchOnline(h) ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border border-emerald-100 animate-pulse">
                              <span className="relative flex h-1 w-1">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1 w-1 bg-emerald-500"></span>
                              </span>
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border border-slate-200">
                              <span className="w-1 h-1 rounded-full bg-slate-300" />
                              Offline
                            </span>
                          )}
                          {isSuspendedHosp && (
                            <span className="text-[9px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider border border-red-200">
                              Suspended
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span className={`px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${planBadgeClass}`}>
                            {h.subscription === 'Premium' ? 'solo(All in One)' : h.subscription}
                          </span>
                          <span>•</span>
                          <span>{h.admittedPatientsCount || 0} Admitted Patients</span>
                        </div>
                      </div>

                      {/* Selected state indicator */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0" onClick={e => e.stopPropagation()}>
                        {isSelected && (
                          <span className="text-[9px] bg-indigo-600 text-white px-2 py-1 rounded font-bold uppercase tracking-wider shadow-xs">
                            Selected
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right column: Login / Tenant Switcher */}
        <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          {/* Header depending on selection */}
          {(() => {
            const selectedHosp = loadedHospitals.find(h => h.id === selectedBranchId);
            return (
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">
                  {selectedHosp ? `Sign In to Branch: ${selectedHosp.name}` : "Sign In to Your Workspace"}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedHosp 
                    ? `Use the quick role portal below or type your registered credentials for ${selectedHosp.name}.`
                    : "Please select a branch from the list on the left to initialize sign in."}
                </p>
              </div>
            );
          })()}

          {loginError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold border border-red-200">
              {loginError}
            </div>
          )}

          {resetSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200">
              {resetSuccess}
            </div>
          )}

          {resetError && (
            <div className="p-3 bg-red-50 text-red-800 rounded-lg text-xs font-semibold border border-red-200">
              {resetError}
            </div>
          )}

          {/* Quick Role Portal for Selected Branch */}
          {(() => {
            const selectedHosp = loadedHospitals.find(h => h.id === selectedBranchId);
            if (!selectedHosp) return (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs text-slate-400 italic">
                Choose a branch from the list on the left to unlock instant quick role portal simulation keys.
              </div>
            );
            const roles = getRolesForHospital(selectedHosp);
            const isSuspendedHosp = selectedHosp.status === 'suspended';

            return (
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/60 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                    Quick Role Entry for {selectedHosp.name}
                  </span>
                  {!isBranchOnline(selectedHosp) && (
                    <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-bold border border-amber-100">
                      Offline Mode (Restores on Login)
                    </span>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-1.5">
                  {roles.map((r) => (
                    <button 
                      key={r.role}
                      id={`login-${r.role.toLowerCase().replace(/\s+/g, '-')}-${selectedHosp.id}`}
                      onClick={() => handleQuickLogin(r.email, r.role as any, selectedHosp.id, selectedHosp.name)}
                      className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        isSuspendedHosp
                          ? 'bg-white hover:bg-red-50 text-red-800 border-red-200'
                          : selectedHosp.subscription === 'Premium'
                          ? 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-200'
                          : selectedHosp.subscription === 'Standard'
                          ? 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border-slate-200'
                          : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-800 border-slate-200'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Manual / custom credentials form */}
          <div className="border-t border-slate-100 pt-4">
            {showForgotPassword ? (
              <form onSubmit={handlePasswordReset} className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 uppercase text-xs">Reset Password</h4>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowForgotPassword(false);
                    }}
                    className="text-[10px] text-slate-500 hover:brand-text underline font-semibold"
                  >
                    Back to sign-in
                  </button>
                </div>

                <div>
                  <label className="block font-bold text-slate-500 uppercase">Email Address</label>
                  <input 
                    type="email" 
                    value={resetEmail} 
                    onChange={e => setResetEmail(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg mt-1 focus:outline-none focus:ring-2 brand-ring"
                    placeholder="Enter your registered email"
                    required
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full brand-bg brand-bg-hover text-white font-semibold py-2 rounded-lg flex justify-center items-center gap-1.5 cursor-pointer animate-pulse"
                >
                  Send Password Reset Link
                </button>
              </form>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 uppercase">Email Address</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg mt-1 focus:outline-none focus:ring-2 brand-ring"
                    placeholder="e.g. admin@branch.com"
                    required
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center">
                    <label className="block font-bold text-slate-500 uppercase">Password</label>
                    <button 
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setResetEmail(email);
                      }}
                      className="text-[10px] text-slate-500 hover:brand-text underline font-semibold"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg mt-1 focus:outline-none focus:ring-2 brand-ring"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full brand-bg brand-bg-hover text-white font-semibold py-2 rounded-lg flex justify-center items-center gap-2 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Sign In Securely</span>
                </button>
              </form>
            )}
          </div>

          {/* Secure super admin entry option */}
          <div className="flex justify-center items-center border-t border-slate-100 pt-3 text-[11px] text-slate-400 gap-4">
            <button 
              onClick={() => setShowSuperPinInput(!showSuperPinInput)}
              className="hover:text-slate-600 transition-colors font-medium flex items-center gap-1 cursor-pointer"
            >
              <Shield className="w-3 h-3 text-red-400" />
              <span>Super Admin Portal</span>
            </button>
          </div>

          {/* Super admin verification pin layout */}
          {showSuperPinInput && (
            <div className="bg-slate-900 text-white p-3.5 rounded-xl space-y-2.5 border border-slate-700/50 shadow-inner mt-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-red-400 animate-pulse" /> Super Admin Verification
                </span>
                <button 
                  type="button"
                  onClick={() => {
                    setShowSuperPinInput(false);
                    setSuperPin('');
                    setSuperPinError('');
                  }}
                  className="text-[10px] font-bold text-slate-400 hover:text-white underline"
                >
                  Cancel
                </button>
              </div>
              <div className="flex gap-2">
                <input 
                  type="password"
                  placeholder="Enter Access PIN"
                  value={superPin}
                  onChange={(e) => {
                    setSuperPin(e.target.value);
                    setSuperPinError('');
                  }}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSuperPinSubmit();
                    }
                  }}
                />
                <button 
                  type="button"
                  onClick={handleSuperPinSubmit}
                  className="brand-bg brand-bg-hover text-white font-bold text-xs px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Verify
                </button>
              </div>
              {superPinError ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-red-400 font-bold">{superPinError}</p>
                  <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60 space-y-1.5">
                    <p className="text-[10px] text-slate-300 leading-relaxed">
                      If the password/PIN is not working due to an existing Firebase Auth record, click below to instantly send a standard reset email to <strong>breakthroughcollege03@gmail.com</strong> to reset the password to <strong>2026</strong>:
                    </p>
                    {autoSuperResetSent ? (
                      <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">✓ Reset link sent successfully! Please check your inbox.</p>
                    ) : (
                      <button 
                        type="button"
                        onClick={handleAutoSuperReset}
                        className="text-[10px] bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded font-bold transition-all cursor-pointer"
                      >
                        Send Password Reset Link
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[9px] text-slate-400 font-medium">Please enter your Super Admin security credentials to access the console.</p>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-400 font-medium space-y-1">
        <div>Rapha-Joy Medical Clinics</div>
        <div className="font-bold text-slate-500">© 2026 Davetech Solutions. All rights reserved.</div>
      </footer>

    </div>
  );
}

// Helper to determine simulation roles based on database tenant configuration
function getRolesForHospital(h: Hospital) {
  const domain = h.id.replace(/_/g, '-');
  const adminRole = { label: 'Hospital Admin', role: 'Hospital Admin' as const, email: `admin@${domain}.com` };
  if (h.status === 'suspended') {
    return [adminRole];
  }
  if (h.subscription === 'Premium') {
    return [
      adminRole,
      { label: 'Doctor', role: 'Doctor' as const, email: `doctor@${domain}.com` },
      { label: 'Receptionist', role: 'Receptionist' as const, email: `receptionist@${domain}.com` },
      { label: 'Pharmacist', role: 'Pharmacist' as const, email: `pharmacist@${domain}.com` },
      { label: 'Lab Unit', role: 'Laboratory' as const, email: `lab@${domain}.com` },
      { label: 'Cashier', role: 'Cashier' as const, email: `cashier@${domain}.com` }
    ];
  } else if (h.subscription === 'Standard') {
    return [
      adminRole,
      { label: 'Doctor', role: 'Doctor' as const, email: `doctor@${domain}.com` },
      { label: 'Nurse', role: 'Nurse' as const, email: `nurse@${domain}.com` },
      { label: 'Radiology Scan', role: 'Radiology' as const, email: `radiology@${domain}.com` }
    ];
  } else {
    // Basic
    return [
      adminRole,
      { label: 'Doctor', role: 'Doctor' as const, email: `doctor@${domain}.com` },
      { label: 'Receptionist', role: 'Receptionist' as const, email: `receptionist@${domain}.com` },
      { label: 'Pharmacist', role: 'Pharmacist' as const, email: `pharmacist@${domain}.com` },
      { label: 'Cashier', role: 'Cashier' as const, email: `cashier@${domain}.com` },
      { label: 'Solo Practitioner (All-in-One)', role: 'Solo Practitioner' as const, email: `solo@${domain}.com` }
    ];
  }
}

// Helper to determine the physical address or region location of a branch
function getBranchAddress(h: Hospital): string {
  if (h.address && h.address.trim() !== '') {
    return h.address;
  }
  // Detailed realistic geographic locations for pre-seeded branches
  const fallbacks: Record<string, string> = {
    hospital_a: "Hospital Road, Upper Hill, Nairobi, Kenya",
    hospital_b: "Gadi Street, Kisumu Central, Kisumu, Kenya",
    hospital_c: "Coast General Rd, Kisauni, Mombasa, Kenya",
    hospital_d: "Nandi Road, Eldoret CBD, Eldoret, Kenya",
    hospital_e: "Government Road, Nakuru Plaza, Nakuru, Kenya"
  };
  return fallbacks[h.id] || "Main Clinical Avenue, Medical District";
}

