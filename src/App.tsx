import React, { useState, useEffect, useRef } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithPopup,
  GithubAuthProvider
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
import { createUserProfile, getAllHospitals, getSystemSettings, updateHospitalOnlineStatus } from './services/dbService';
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
  Github
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [hospitalInfo, setHospitalInfo] = useState<Hospital | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [isSuspended, setIsSuspended] = useState(false);

  // Branding states
  const [systemLogo, setSystemLogo] = useState<string>('/logo.svg');
  const [systemName, setSystemName] = useState<string>('RAPHA JOY MEDICAL CLINICS');
  const [systemPrimaryColor, setSystemPrimaryColor] = useState<string>('#0f172a');

  // Dynamic Hospitals List state
  const [loadedHospitals, setLoadedHospitals] = useState<Hospital[]>([]);

  const isCreatingProfile = useRef(false);

  // Manual Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [manualRole, setManualRole] = useState<UserProfile['role']>('Hospital Admin');
  const [manualHospitalId, setManualHospitalId] = useState('hospital_a');
  const [showManualForm, setShowManualForm] = useState(false);

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

  // Handle manual login
  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    if (!email || !password) return;

    setLoading(true);
    try {
      isCreatingProfile.current = true;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      
      isCreatingProfile.current = false;
      setLoading(false);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        // Check if there is a pre-registered Firestore user profile with this email
        try {
          const mockUid = `uid_${email.replace(/[^a-zA-Z0-9]/g, '')}`;
          const userDocSnap = await getDoc(doc(db, 'users', mockUid));
          if (userDocSnap.exists()) {
            const profileData = userDocSnap.data() as UserProfile;
            const oldDocId = userDocSnap.id;

            // Create standard Auth user with the default password or whatever was typed
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const newUid = userCredential.user.uid;

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

  // Handle Sign in with GitHub
  async function handleGithubSignIn() {
    setLoginError('');
    setLoading(true);
    try {
      const provider = new GithubAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const uid = result.user.uid;
      const userDocSnap = await getDoc(doc(db, 'users', uid));
      if (!userDocSnap.exists()) {
        const defaultProfile = {
          id: uid,
          email: result.user.email || 'github-user@example.com',
          name: result.user.displayName || 'GitHub Professional',
          role: 'Hospital Admin' as const,
          hospitalId: 'hospital_a',
          createdAt: new Date().toISOString()
        };
        await createUserProfile(uid, defaultProfile);
        setUser(defaultProfile);
        const hospDocSnap = await getDoc(doc(db, 'hospitals', 'hospital_a'));
        if (hospDocSnap.exists()) {
          setHospitalInfo(hospDocSnap.data() as Hospital);
        }
      } else {
        const profile = userDocSnap.data() as UserProfile;
        setUser(profile);
        if (profile.role !== 'Super Admin' && profile.hospitalId) {
          const hospDocSnap = await getDoc(doc(db, 'hospitals', profile.hospitalId));
          if (hospDocSnap.exists()) {
            setHospitalInfo(hospDocSnap.data() as Hospital);
            setIsSuspended(hospDocSnap.data().status === 'suspended');
          }
        }
      }
    } catch (err: any) {
      console.error('GitHub authentication error:', err);
      if (err.code === 'auth/popup-blocked') {
        setLoginError('GitHub sign-in popup was blocked by your browser. Please try opening the app in a new tab (click the top-right arrow button) or allow popups.');
      } else if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        setLoginError('Sign-in cancelled.');
      } else {
        setLoginError(`GitHub sign-in failed: ${err.message}. Make sure GitHub login is enabled in your Firebase Auth console, and you are running the app in a new tab if iframe redirects fail.`);
      }
    } finally {
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
      setLoginError('Access Denied: Only breakthroughcollege03@gmail.com can log in as Super Admin.');
      return;
    }
    setLoading(true);
    setLoginError('');
    setIsSuspended(false);

    try {
      // 1. Mark as creating profile so onAuthStateChanged doesn't auto-logout or interfere
      isCreatingProfile.current = true;

      // 2. Try standard sign-in
      const userCredential = await signInWithEmailAndPassword(auth, targetEmail, "Password123!");
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
          const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, "Password123!");
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
          <h2 className="text-xl font-extrabold text-slate-800">Hospital Tenancy Suspended</h2>
          <p className="text-sm text-slate-500">
            Access to <strong>{hospitalInfo?.name}</strong> has been suspended by the system Super Administrator. 
            All patient records and clinical databases for this tenant are securely locked.
          </p>
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs font-mono text-red-700">
            Tenant Code: {hospitalInfo?.code}
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
      if (user.email !== 'breakthroughcollege03@gmail.com') {
        return (
          <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-6">
            <div className="bg-white max-w-md w-full border border-red-200 rounded-xl p-8 text-center space-y-4 shadow-sm animate-fade-in">
              <AlertOctagon className="w-16 h-16 text-red-600 mx-auto animate-pulse" />
              <h2 className="text-xl font-extrabold text-slate-800">Super Admin Access Denied</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                You do not have permission to access the Super Admin control panel. Only the authorized system owner (<strong>breakthroughcollege03@gmail.com</strong>) is permitted.
              </p>
              <button 
                onClick={handleLogout}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 rounded-lg text-sm flex items-center justify-center space-x-1 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Return to Login</span>
              </button>
            </div>
          </div>
        );
      }
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
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col lg:flex-row items-center justify-center gap-12 my-auto">
        
        {/* Left column: Descriptive */}
        <div className="flex-1 space-y-6 max-w-xl text-center lg:text-left">
          <div className="space-y-3">
            <span className="text-xs font-bold brand-text tracking-widest uppercase">Multi-Tenant Platform</span>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-800 tracking-tight leading-none">
              One Secure HMS Core, <br />
              <span className="brand-text">{loadedHospitals.length} Distinct Tenant Hospitals.</span>
            </h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              This system hosts {loadedHospitals.length === 5 ? 'five' : loadedHospitals.length} independent medical networks under one server architecture, completely isolated by security policies. Sign in as different clinical roles to experience live data separation.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto lg:mx-0">
            <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-2.5">
              <Building2 className="w-5 h-5 brand-text" />
              <span className="text-xs text-slate-700 font-semibold">{loadedHospitals.length} Hospitals Separated</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-2.5">
              <Shield className="w-5 h-5 brand-text" />
              <span className="text-xs text-slate-700 font-semibold">Strict hospitalId Filters</span>
            </div>
          </div>
        </div>

        {/* Right column: Login / Tenant Switcher */}
        <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base">Select User Persona (Tenant Simulation)</h3>
            <p className="text-xs text-slate-400 mt-1">Experience how data records dynamically change depending on the authenticated tenant credentials.</p>
          </div>

          {loginError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold border border-red-200">
              {loginError}
            </div>
          )}

          {/* Quick Login Grid */}
          <div className="space-y-4">
            
             {/* Global Super Admin Selector */}
            <div className="border-b border-slate-100 pb-3 space-y-2">
              {!showSuperPinInput ? (
                <button 
                  id="login-super"
                  onClick={() => setShowSuperPinInput(true)}
                  className="w-full brand-bg brand-bg-hover text-white p-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all shadow-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-red-400" />
                    <div className="text-left">
                      <span className="block font-bold">System Super Administrator</span>
                      <span className="block text-[10px] text-slate-400 font-normal">Manage subscriptions, revenue, and suspend/activate tenants</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="bg-slate-900 text-white p-3.5 rounded-xl space-y-2.5 border border-slate-700/50 shadow-inner">
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
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSuperPinSubmit();
                        }
                      }}
                    />
                    <button 
                      type="button"
                      onClick={handleSuperPinSubmit}
                      className="brand-bg brand-bg-hover text-white font-bold text-xs px-4 py-1.5 rounded-lg transition-colors"
                    >
                      Verify
                    </button>
                  </div>
                  {superPinError ? (
                    <p className="text-[10px] text-red-400 font-bold">{superPinError}</p>
                  ) : (
                    <p className="text-[9px] text-slate-400 font-medium">Please enter your Super Admin security credentials to access the console.</p>
                  )}
                </div>
              )}
            </div>

            {/* Individual Hospitals Selection */}
            <div className="space-y-3">
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Hospital Tenants Roles</span>
              
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                {loadedHospitals.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs italic">
                    No hospital tenants found. Please log in as Super Admin to add one.
                  </div>
                ) : (
                  loadedHospitals.map((h, idx) => {
                    const isSuspendedHosp = h.status === 'suspended';
                    const planColorMap: Record<string, string> = {
                      Premium: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                      Standard: 'bg-indigo-100 text-indigo-800 border-indigo-200',
                      Basic: 'bg-slate-100 text-slate-700 border-slate-200'
                    };
                    const planBadgeClass = planColorMap[h.subscription] || 'bg-slate-100 text-slate-700';
                    const roles = getRolesForHospital(h);

                    return (
                      <div 
                        key={h.id} 
                        className={`p-3 rounded-xl border space-y-2 transition-all ${
                          isSuspendedHosp 
                            ? 'bg-red-50/50 border-red-200/60' 
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="text-left space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-bold ${isSuspendedHosp ? 'text-red-900' : 'text-slate-800'}`}>
                                {idx + 1}. {h.name}
                              </span>
                              {h.isOnline ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider">
                                  <span className="relative flex h-1 w-1">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1 w-1 bg-emerald-500"></span>
                                  </span>
                                  Online
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider">
                                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                                  Offline
                                </span>
                              )}
                              {isSuspendedHosp && (
                                <span className="ml-1.5 text-[9px] bg-red-100 text-red-800 px-1 py-0.2 rounded font-extrabold uppercase">
                                  SUSPENDED!
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${isSuspendedHosp ? 'bg-red-100 text-red-800' : planBadgeClass}`}>
                            {h.subscription}
                          </span>
                        </div>

                        {/* Patient Snapshot Badge */}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-white border border-slate-100/70 rounded-lg p-1.5 w-fit">
                          <Users className="w-3.5 h-3.5 text-indigo-500" />
                          <span className="font-semibold text-slate-600">Patient Snapshot:</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-extrabold ${
                            (h.admittedPatientsCount || 0) > 0 
                              ? 'bg-indigo-100 text-indigo-800' 
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {h.admittedPatientsCount || 0} Admitted
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {roles.map((r) => (
                            <button 
                              key={r.role}
                              id={`login-${r.role.toLowerCase().replace(/\s+/g, '-')}-${h.id}`}
                              onClick={() => handleQuickLogin(r.email, r.role as any, h.id, h.name)}
                              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                                isSuspendedHosp
                                  ? 'bg-white hover:bg-red-50 text-red-800 border-red-200'
                                  : h.subscription === 'Premium'
                                  ? 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-200'
                                  : h.subscription === 'Standard'
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
                  })
                )}
              </div>
            </div>

          </div>

          {/* Form manual trigger */}
          <div className="text-center">
            <button 
              onClick={() => setShowManualForm(!showManualForm)}
              className="text-xs font-semibold text-slate-500 hover:brand-text hover:underline"
            >
              {showManualForm ? 'Hide credentials sign-in' : 'Sign in manually with custom login'}
            </button>
          </div>

          {showManualForm && (
            showForgotPassword ? (
              <form onSubmit={handlePasswordReset} className="space-y-4 border-t border-slate-100 pt-4 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 uppercase text-xs">Reset Password</h4>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetSuccess('');
                      setResetError('');
                    }}
                    className="text-[10px] text-slate-500 hover:brand-text underline font-semibold"
                  >
                    Back to manual sign-in
                  </button>
                </div>
                
                {resetSuccess && (
                  <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg text-[11px] font-semibold border border-emerald-200">
                    {resetSuccess}
                  </div>
                )}
                {resetError && (
                  <div className="p-2.5 bg-red-50 text-red-800 rounded-lg text-[11px] font-semibold border border-red-200">
                    {resetError}
                  </div>
                )}

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
                  disabled={resetLoading}
                  className="w-full brand-bg brand-bg-hover disabled:bg-slate-400 text-white font-semibold py-2 rounded-lg flex justify-center items-center gap-1.5"
                >
                  {resetLoading ? 'Sending link...' : 'Send Password Reset Link'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-4 border-t border-slate-100 pt-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 uppercase">Email Address</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg mt-1 focus:outline-none focus:ring-2 brand-ring"
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
                        setResetEmail(email); // Autofill reset with whatever they typed
                        setResetSuccess('');
                        setResetError('');
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
                    required
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full brand-bg brand-bg-hover text-white font-semibold py-2 rounded-lg"
                >
                  Sign In Manual
                </button>

                <div className="relative my-3 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <span className="relative bg-white px-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">or continue with</span>
                </div>

                <button 
                  type="button"
                  onClick={handleGithubSignIn}
                  className="w-full border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Github className="w-4 h-4 text-slate-800" />
                  <span>Sign In with GitHub</span>
                </button>
              </form>
            )
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

