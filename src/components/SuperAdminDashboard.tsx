import React, { useState, useEffect } from 'react';
import { onSnapshot, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Building, 
  Plus, 
  Shield, 
  Play, 
  Pause, 
  CreditCard, 
  Download, 
  Users, 
  TrendingUp, 
  Database, 
  CheckCircle, 
  AlertCircle, 
  Activity, 
  DollarSign, 
  UserPlus,
  RefreshCw,
  Edit2,
  Trash2,
  HelpCircle,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { 
  Hospital, 
  UserProfile 
} from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  getAllHospitals, 
  createHospital, 
  updateHospitalStatus, 
  updateHospitalSubscription, 
  getSystemStats, 
  downloadAllSystemDataBackup,
  createUserProfile,
  updateHospitalDetails,
  deleteHospital,
  getSystemSettings,
  updateSystemSettings,
  SystemSettings,
  getAllUsers,
  deleteUserProfile,
  updateUserProfile,
  updateHospitalOnlineStatus
} from '../services/dbService';
import HospitalDashboard from './HospitalDashboard';

interface SuperAdminDashboardProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onBrandingUpdate?: (name: string, logo: string, primaryColor?: string) => void;
}

export default function SuperAdminDashboard({ currentUser, onLogout, onBrandingUpdate }: SuperAdminDashboardProps) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [stats, setStats] = useState<Record<string, { patients: number, appointments: number, billings: number, totalRevenue: number }>>({});
  const [loading, setLoading] = useState(true);

  // Tick for local state re-render to reflect self-healing branch offline status
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const isBranchOnline = (h: Hospital) => {
    if (!h.isOnline) return false;
    if (!h.lastActiveAt) return true;
    // 10 minutes in milliseconds to handle extreme clock drift between devices gracefully.
    // If h.isOnline is true and lastActiveAt is within 10 minutes, the branch is online.
    return (Date.now() - h.lastActiveAt) < 600000;
  };
  
  // Modals / Form states
  const [showAddHospital, setShowAddHospital] = useState(false);
  const [newHospitalName, setNewHospitalName] = useState('');
  const [newHospitalCode, setNewHospitalCode] = useState('');
  const [newHospitalSub, setNewHospitalSub] = useState<'Basic' | 'Standard' | 'Premium'>('Premium');

  // Edit / Delete Hospital States
  const [showEditHospital, setShowEditHospital] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [editHospitalName, setEditHospitalName] = useState('');
  const [editHospitalCode, setEditHospitalCode] = useState('');
  const [editHospitalAddress, setEditHospitalAddress] = useState('');
  const [editHospitalPhone, setEditHospitalPhone] = useState('');
  const [editHospitalEmail, setEditHospitalEmail] = useState('');
  const [editHospitalWebsite, setEditHospitalWebsite] = useState('');
  const [editHospitalTaxNumber, setEditHospitalTaxNumber] = useState('');
  const [editHospitalNotes, setEditHospitalNotes] = useState('');

  // Custom Confirmation Dialog States
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingHospitalId, setDeletingHospitalId] = useState<string | null>(null);
  const [deletingHospitalName, setDeletingHospitalName] = useState('');

  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [suspendingHospitalId, setSuspendingHospitalId] = useState<string | null>(null);
  const [suspendingHospitalName, setSuspendingHospitalName] = useState('');
  const [suspendingCurrentStatus, setSuspendingCurrentStatus] = useState<'active' | 'suspended'>('active');

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Subscription Plan Explanation State
  const [showPricingGuide, setShowPricingGuide] = useState(true);

  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminHospitalId, setAdminHospitalId] = useState('');
  const [adminRole, setAdminRole] = useState<'Hospital Admin' | 'Super Admin'>('Hospital Admin');
  const [adminStatusMsg, setAdminStatusMsg] = useState('');
  const [adminModalError, setAdminModalError] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Loaded users and user CRUD states
  const [allUsersList, setAllUsersList] = useState<UserProfile[]>([]);
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserRole, setEditUserRole] = useState<UserProfile['role']>('Hospital Admin');
  const [editUserHospitalId, setEditUserHospitalId] = useState('');

  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingUserName, setDeletingUserName] = useState('');

  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userHospitalFilter, setUserHospitalFilter] = useState('');

  const [backingUp, setBackingUp] = useState(false);

  // Branding states
  const [systemLogo, setSystemLogo] = useState<string>('/logo.svg');
  const [systemName, setSystemName] = useState<string>('RAPHA JOY MEDICAL CLINICS');
  const [systemPrimaryColor, setSystemPrimaryColor] = useState<string>('#0f172a');
  const [showBrandingModal, setShowBrandingModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Tenant workspace simulation state
  const [simulatingHospitalId, setSimulatingHospitalId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();

    const unsubscribe = onSnapshot(collection(db, 'hospitals'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hospital));
      const sorted = list.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setHospitals(sorted);
    }, (err) => {
      console.error('Error listening to hospitals in SuperAdminDashboard:', err);
    });

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      const sortedUsers = list.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setAllUsersList(sortedUsers);
    }, (err) => {
      console.error('Error listening to users in SuperAdminDashboard:', err);
    });

    const unsubscribeRolePerms = onSnapshot(collection(db, 'rolePermissions'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRolePermissions(list);
    }, (err) => {
      console.error('Error listening to rolePermissions in SuperAdminDashboard:', err);
    });

    return () => {
      unsubscribe();
      unsubscribeUsers();
      unsubscribeRolePerms();
    };
  }, []);

  useEffect(() => {
    if (simulatingHospitalId) {
      updateHospitalOnlineStatus(simulatingHospitalId, true).catch(() => {});
    }
  }, [simulatingHospitalId]);

  async function fetchData() {
    setLoading(true);
    try {
      const hospList = await getAllHospitals();
      setHospitals(hospList);
      
      const usageStats = await getSystemStats();
      setStats(usageStats);

      const settings = await getSystemSettings();
      if (settings) {
        if (settings.logo) setSystemLogo(settings.logo);
        if (settings.name) setSystemName(settings.name);
        if (settings.primaryColor) setSystemPrimaryColor(settings.primaryColor);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateHospital(e: React.FormEvent) {
    e.preventDefault();
    if (!newHospitalName || !newHospitalCode) return;

    const trimmedCode = newHospitalCode.trim().toUpperCase();
    const trimmedName = newHospitalName.trim();

    // Check for duplicate name or code
    const isCodeDuplicate = hospitals.some(h => h.code.toUpperCase() === trimmedCode);
    const isNameDuplicate = hospitals.some(h => h.name.toLowerCase() === trimmedName.toLowerCase());

    if (isCodeDuplicate) {
      showToast('error', `A hospital tenant with isolation code "${trimmedCode}" already exists.`);
      return;
    }

    if (isNameDuplicate) {
      showToast('error', `A hospital tenant with name "${trimmedName}" already exists.`);
      return;
    }
    
    try {
      const newId = `hospital_${trimmedCode.toLowerCase().replace(/\s+/g, '_')}`;
      const newHosp: Hospital = {
        id: newId,
        name: trimmedName,
        code: trimmedCode,
        status: 'active',
        subscription: newHospitalSub,
        createdAt: new Date().toISOString()
      };

      await createHospital(newHosp);
      setShowAddHospital(false);
      setNewHospitalName('');
      setNewHospitalCode('');
      await fetchData();
      showToast('success', `Hospital tenant "${trimmedName}" created successfully!`);
    } catch (err: any) {
      showToast('error', 'Error creating hospital: ' + (err.message || err));
    }
  }

  function handleStartEdit(hosp: Hospital) {
    setEditingHospital(hosp);
    setEditHospitalName(hosp.name);
    setEditHospitalCode(hosp.code);
    setEditHospitalAddress(hosp.address || '');
    setEditHospitalPhone(hosp.phone || '');
    setEditHospitalEmail(hosp.email || '');
    setEditHospitalWebsite(hosp.website || '');
    setEditHospitalTaxNumber(hosp.taxNumber || '');
    setEditHospitalNotes(hosp.notes || '');
    setShowEditHospital(true);
  }

  function showToast(type: 'success' | 'error', text: string) {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(prev => prev?.text === text ? null : prev);
    }, 5000);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingHospital || !editHospitalName || !editHospitalCode) return;
    try {
      await updateHospitalDetails(editingHospital.id, editHospitalName, editHospitalCode, {
        address: editHospitalAddress,
        phone: editHospitalPhone,
        email: editHospitalEmail,
        website: editHospitalWebsite,
        taxNumber: editHospitalTaxNumber,
        notes: editHospitalNotes
      });
      setShowEditHospital(false);
      setEditingHospital(null);
      await fetchData();
      showToast('success', 'Hospital tenant details updated successfully.');
    } catch (err: any) {
      showToast('error', 'Error updating hospital details: ' + err.message);
    }
  }

  function handleStartDelete(hospitalId: string, hospitalName: string) {
    setDeletingHospitalId(hospitalId);
    setDeletingHospitalName(hospitalName);
    setShowDeleteConfirm(true);
  }

  async function handleConfirmDelete() {
    if (!deletingHospitalId) return;
    try {
      await deleteHospital(deletingHospitalId);
      setShowDeleteConfirm(false);
      setDeletingHospitalId(null);
      setDeletingHospitalName('');
      await fetchData();
      showToast('success', 'Hospital tenant deleted successfully.');
    } catch (err: any) {
      showToast('error', 'Error deleting hospital: ' + err.message);
    }
  }

  function handleStartToggleStatus(hospitalId: string, hospitalName: string, currentStatus: 'active' | 'suspended') {
    setSuspendingHospitalId(hospitalId);
    setSuspendingHospitalName(hospitalName);
    setSuspendingCurrentStatus(currentStatus);
    setShowSuspendConfirm(true);
  }

  async function handleConfirmToggleStatus() {
    if (!suspendingHospitalId) return;
    const newStatus = suspendingCurrentStatus === 'active' ? 'suspended' : 'active';
    try {
      await updateHospitalStatus(suspendingHospitalId, newStatus);
      setShowSuspendConfirm(false);
      setSuspendingHospitalId(null);
      setSuspendingHospitalName('');
      await fetchData();
      showToast('success', `Hospital tenant is now ${newStatus}.`);
    } catch (e: any) {
      showToast('error', 'Error updating status: ' + e.message);
    }
  }

  // User Administration Handlers
  function handleStartDeleteUser(userId: string, userName: string) {
    setDeletingUserId(userId);
    setDeletingUserName(userName);
    setShowDeleteUserConfirm(true);
  }

  async function handleConfirmDeleteUser() {
    if (!deletingUserId) return;
    try {
      await deleteUserProfile(deletingUserId);
      setShowDeleteUserConfirm(false);
      setDeletingUserId(null);
      setDeletingUserName('');
      showToast('success', 'Administrator account deleted successfully.');
    } catch (err: any) {
      showToast('error', 'Failed to delete administrator account: ' + err.message);
    }
  }

  function handleStartEditUser(user: UserProfile) {
    setEditingUser(user);
    setEditUserName(user.name);
    setEditUserEmail(user.email);
    setEditUserRole(user.role);
    setEditUserHospitalId(user.hospitalId || '');
    setShowEditUser(true);
  }

  async function handleConfirmEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await updateUserProfile(editingUser.id, {
        name: editUserName,
        email: editUserEmail,
        role: editUserRole,
        hospitalId: editUserHospitalId || null
      } as any);
      setShowEditUser(false);
      setEditingUser(null);
      showToast('success', 'Administrator account updated successfully.');
    } catch (err: any) {
      showToast('error', 'Failed to update administrator account: ' + err.message);
    }
  }

  function handleFileSelect(file: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Please upload an image file (PNG, JPG, SVG).');
      return;
    }
    if (file.size > 800 * 1024) {
      showToast('error', 'Image size is too large. Please upload an image under 800KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setSystemLogo(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  async function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateSystemSettings({
        name: systemName,
        logo: systemLogo,
        primaryColor: systemPrimaryColor
      });
      if (onBrandingUpdate) {
        onBrandingUpdate(systemName, systemLogo, systemPrimaryColor);
      }
      setShowBrandingModal(false);
      showToast('success', 'Branding settings updated successfully!');
    } catch (err: any) {
      showToast('error', 'Error saving branding settings: ' + err.message);
    }
  }

  async function handleChangeSubscription(hospitalId: string, currentSub: Hospital['subscription']) {
    const tiers: Hospital['subscription'][] = ['Basic', 'Standard', 'Premium'];
    const nextSub = tiers[(tiers.indexOf(currentSub) + 1) % tiers.length];
    try {
      await updateHospitalSubscription(hospitalId, nextSub);
      await fetchData();
      showToast('success', `Hospital plan shifted to ${nextSub}.`);
    } catch (e: any) {
      showToast('error', 'Error updating subscription: ' + e.message);
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!adminEmail || !adminName || (adminRole !== 'Super Admin' && !adminHospitalId)) {
      setAdminModalError('Please fill in all fields.');
      return;
    }

    setCreatingAdmin(true);
    setAdminModalError('');

    try {
      // Create pre-registered user profile document in Firestore
      const mockUid = `uid_${adminEmail.replace(/[^a-zA-Z0-9]/g, '')}`;
      await createUserProfile(mockUid, {
        hospitalId: adminRole === 'Super Admin' ? 'Global' : adminHospitalId,
        name: adminName,
        email: adminEmail,
        role: adminRole,
        createdAt: new Date().toISOString()
      });

      // Show banner of success on the main screen
      setAdminStatusMsg(`${adminRole === 'Super Admin' ? 'Super Admin' : 'Admin'} user "${adminName}" successfully registered! Email: ${adminEmail}. They can now login manually. Default password/PIN is '2026' or 'Password123!'.`);
      
      // Clear forms
      setAdminEmail('');
      setAdminName('');
      setAdminHospitalId('');
      setAdminRole('Hospital Admin');
      
      // Close Modal and notify
      setShowAddAdmin(false);
      showToast('success', `${adminRole === 'Super Admin' ? 'Super Admin' : 'Hospital administrator'} registered successfully!`);
      
      setTimeout(() => setAdminStatusMsg(''), 15000);
    } catch (err: any) {
      setAdminModalError('Error: ' + err.message);
    } finally {
      setCreatingAdmin(false);
    }
  }

  async function handleBackup() {
    setBackingUp(true);
    try {
      const backupJson = await downloadAllSystemDataBackup();
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hms_tenant_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert('Backup failed: ' + e);
    } finally {
      setBackingUp(false);
    }
  }

  // Calculate totals
  const totalHospitals = hospitals.length;
  const activeHospitals = hospitals.filter(h => h.status === 'active').length;
  const suspendedHospitals = hospitals.filter(h => h.status === 'suspended').length;
  const statsList = Object.values(stats) as { patients: number; appointments: number; billings: number; totalRevenue: number }[];
  const totalRevenue = statsList.reduce((sum, current) => sum + current.totalRevenue, 0);
  const totalPatientsServed = statsList.reduce((sum, current) => sum + current.patients, 0);

  const activeSubscriptionRevenue = hospitals
    .filter(h => h.status === 'active')
    .reduce((sum, h) => {
      const plan = h.subscription || 'Basic';
      if (plan === 'Basic') return sum + 499;
      if (plan === 'Standard') return sum + 999;
      if (plan === 'Premium') return sum + 1999;
      return sum;
    }, 0);

  const suspendedSubscriptionRevenue = hospitals
    .filter(h => h.status === 'suspended')
    .reduce((sum, h) => {
      const plan = h.subscription || 'Basic';
      if (plan === 'Basic') return sum + 499;
      if (plan === 'Standard') return sum + 999;
      if (plan === 'Premium') return sum + 1999;
      return sum;
    }, 0);

  const totalSubscriptionRevenue = activeSubscriptionRevenue + suspendedSubscriptionRevenue;

  const summaryChartData = [
    {
      name: 'Active',
      'Tenants': activeHospitals,
      'Revenue ($)': activeSubscriptionRevenue,
      color: '#10b981'
    },
    {
      name: 'Suspended',
      'Tenants': suspendedHospitals,
      'Revenue ($)': suspendedSubscriptionRevenue,
      color: '#f59e0b'
    }
  ];

  if (simulatingHospitalId) {
    const activeSimHosp = hospitals.find(h => h.id === simulatingHospitalId);
    
    // Create simulated user with Super Admin role so they have full administrative privileges
    const simulatedUser: UserProfile = {
      id: `simulated_admin_${simulatingHospitalId}`,
      hospitalId: simulatingHospitalId,
      name: `Super Admin Sim`,
      email: currentUser.email,
      role: 'Super Admin',
      createdAt: new Date().toISOString()
    };

    return (
      <div className="min-h-screen flex flex-col bg-slate-900">
        {/* Toast Notification HUD */}
        {toastMessage && (
          <div id="toast-sa-sim" className={`fixed top-4 right-4 z-[9999] p-4 rounded-xl shadow-lg border text-xs font-bold flex items-center space-x-2.5 transition-all transform duration-300 animate-slide-in ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Sticky Simulation Control Bar */}
        <div className="bg-slate-950 text-white border-b border-indigo-500/30 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50 shadow-lg">
          <div className="flex items-center space-x-3.5">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-md animate-pulse">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">Multi-Tenant Simulator Panel</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase">Active</span>
              </div>
              <h2 className="text-sm font-extrabold text-white">
                Workspace: <span className="text-indigo-300 font-black">{activeSimHosp?.name || 'Clinic'}</span> ({activeSimHosp?.code})
              </h2>
            </div>
          </div>

          {/* Quick Toggle Buttons for 5 Pre-Seeded Tenants */}
          <div className="flex items-center space-x-2.5">
            <span className="text-xs font-semibold text-slate-400 hidden lg:inline">Quick Switch:</span>
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 space-x-1">
              {hospitals.slice(0, 5).map((h, idx) => {
                const isActive = h.id === simulatingHospitalId;
                return (
                  <button
                    key={h.id}
                    onClick={async () => {
                      try {
                        // Restore online status upon switching
                        await updateHospitalOnlineStatus(h.id, true);
                        setSimulatingHospitalId(h.id);
                        showToast('success', `Switched to Tenant ${idx + 1}: ${h.name}. Online status restored.`);
                      } catch (err) {
                        setSimulatingHospitalId(h.id);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-md font-black border border-indigo-400/20' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isBranchOnline(h) ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    <span>Tenant {idx + 1}</span>
                  </button>
                );
              })}
            </div>

            {/* General Dropdown for other custom tenants if any */}
            {hospitals.length > 5 && (
              <select
                value={simulatingHospitalId}
                onChange={async (e) => {
                  const val = e.target.value;
                  const selectedH = hospitals.find(h => h.id === val);
                  if (val && selectedH) {
                    try {
                      await updateHospitalOnlineStatus(val, true);
                      setSimulatingHospitalId(val);
                      showToast('success', `Switched to ${selectedH.name}. Online status restored.`);
                    } catch (err) {
                      setSimulatingHospitalId(val);
                    }
                  }
                }}
                className="bg-slate-900 text-slate-200 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {hospitals.slice(5).map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Online Status Coordination */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-semibold text-slate-400">Online Coordination:</span>
              <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border border-emerald-500/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                Online
              </span>
            </div>

            <button
              onClick={() => setSimulatingHospitalId(null)}
              className="bg-slate-800 hover:bg-rose-950 hover:text-rose-200 border border-slate-700 hover:border-rose-900 text-slate-300 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              Exit Simulation
            </button>
          </div>
        </div>

        {/* Live Interconnected Tenant Dashboard Component */}
        <div className="flex-1 bg-slate-50">
          <HospitalDashboard 
            currentUser={simulatedUser} 
            hospitalName={activeSimHosp?.name || 'Simulated Clinic'} 
            onLogout={() => setSimulatingHospitalId(null)} 
          />
        </div>
      </div>
    );
  }

  return (
    <div id="super-admin-dashboard" className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header id="sa-header" className="bg-white border-b border-slate-200 shadow-xs py-2 px-6 flex justify-between items-center">
        <div className="flex items-center space-x-3.5">
          <div className={`flex items-center justify-center w-16 h-16 overflow-hidden shrink-0 ${systemLogo ? 'bg-slate-50 p-2 rounded-xl border border-slate-200' : 'bg-red-500 p-2 rounded-xl text-white'}`}>
            {systemLogo ? (
              <img 
                src={systemLogo} 
                alt="System Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Shield className="w-8 h-8 text-white" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-800">{systemName}</h1>
              <button 
                id="btn-trigger-branding-edit"
                type="button"
                onClick={() => setShowBrandingModal(true)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                title="Customize Logo & Name"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 font-medium">Super Admin Control Center</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <span className="block text-sm font-bold text-slate-800">{currentUser.name}</span>
            <span className="block text-xs font-bold text-red-600">System Super Administrator</span>
          </div>
          <button 
            id="btn-sa-logout" 
            onClick={onLogout}
            className="bg-slate-100 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-slate-200"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Metric Cards Grid */}
        <div id="sa-metrics" className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Tenants</span>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{totalHospitals}</h3>
              <div className="flex items-center space-x-2 mt-1 text-xs">
                <span className="text-emerald-600 font-semibold">{activeHospitals} Active</span>
                <span className="text-slate-300">|</span>
                <span className="text-amber-600 font-semibold">{suspendedHospitals} Suspended</span>
              </div>
            </div>
            <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600">
              <Building className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estimated Combined Revenue</span>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">KSh {totalRevenue.toLocaleString()}</h3>
              <span className="block text-xs text-emerald-600 mt-1 font-medium">All billing paid across 5+ tenants</span>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Patients Served</span>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{totalPatientsServed}</h3>
              <span className="block text-xs text-indigo-600 mt-1 font-medium">Unique registered patients</span>
            </div>
            <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Status</span>
              <h3 className="text-lg font-bold text-emerald-600 mt-1 flex items-center gap-1">
                <CheckCircle className="w-5 h-5 text-emerald-500" /> Secure & Isolated
              </h3>
              <span className="block text-xs text-slate-400 mt-1">Firestore rules verified</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg text-slate-500">
              <Database className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Tenant Summary & Subscription Revenue Recharts Bar */}
        <div id="sa-recharts-summary-bar" className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-100 pb-3 gap-3">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" /> Subscription & Tenancy Analytics
              </h3>
              <p className="text-xs text-slate-500">Breakdown of active vs suspended tenants and their collective recurring subscription revenue.</p>
            </div>
            <div className="text-left sm:text-right bg-indigo-50 px-3.5 py-1.5 rounded-lg border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Total Monthly ARR</span>
              <span className="text-sm font-black text-indigo-800">${totalSubscriptionRevenue.toLocaleString()} <span className="text-[10px] font-semibold text-indigo-400">/mo</span></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Chart: Tenants Count */}
            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Tenant Distribution</span>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {activeHospitals} Active / {suspendedHospitals} Suspended
                </span>
              </div>
              <div className="h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summaryChartData} layout="vertical" margin={{ top: 5, right: 30, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} stroke="#94a3b8" fontSize={10} />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} fontWeight="bold" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Bar dataKey="Tenants" radius={[0, 4, 4, 0]} barSize={16}>
                      {summaryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right Chart: Subscription Revenue */}
            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Collective ARR Breakdown</span>
                <span className="text-xs font-mono font-bold text-indigo-600">
                  ARR: ${totalSubscriptionRevenue.toLocaleString()}
                </span>
              </div>
              <div className="h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summaryChartData} layout="vertical" margin={{ top: 5, right: 30, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `$${v}`} />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} fontWeight="bold" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                      formatter={(value: any) => [value !== undefined && value !== null ? `$${value.toLocaleString()}` : '$0', 'Revenue']}
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Bar dataKey="Revenue ($)" radius={[0, 4, 4, 0]} barSize={16}>
                      {summaryChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.name === 'Active' ? '#6366f1' : '#cbd5e1'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Admitted Patients Bar Chart Visualization */}
        <div id="sa-recharts-patients-bar" className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-100 pb-3 gap-3">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2 uppercase tracking-wider">
                <Users className="w-5 h-5 text-indigo-500" /> Admitted Patients Analytics
              </h3>
              <p className="text-xs text-slate-500">Real-time breakdown of active admitted patients currently checked in across each branch.</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-indigo-600 inline-block" />
                <span className="text-slate-600">Active Branches</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />
                <span className="text-slate-600">Suspended Branches</span>
              </div>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            {hospitals.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-slate-400 italic">
                No hospitals loaded. Add a tenant to view analytics.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hospitals.map(h => ({
                  name: h.name,
                  code: h.code || h.id,
                  'Admitted Patients': h.admittedPatientsCount || 0,
                  status: h.status || 'active'
                }))} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="code" 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    fontWeight="bold"
                    tickLine={false} 
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    fontWeight="bold"
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderRadius: '8px', 
                      border: '1px solid #1e293b', 
                      fontSize: '11px',
                      color: '#fff'
                    }}
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(value: any) => [`${value} Patients`, 'Admitted Patients']}
                    labelFormatter={(label) => {
                      const hosp = hospitals.find(h => h.code === label);
                      return hosp ? hosp.name : label;
                    }}
                  />
                  <Bar dataKey="Admitted Patients" radius={[4, 4, 0, 0]} barSize={36}>
                    {hospitals.map((h, idx) => (
                      <Cell 
                        key={`cell-${idx}`} 
                        fill={h.status === 'suspended' ? '#f59e0b' : '#6366f1'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* System Health & Status Overview Widget */}
        <div id="sa-system-health-widget" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div className="flex items-center space-x-2">
              <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">System Tenancy Health Overview</h3>
                <p className="text-xs text-slate-500">Real-time health evaluation and distribution of independent medical networks.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Status:</span>
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                suspendedHospitals === 0 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${suspendedHospitals === 0 ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'}`} />
                {suspendedHospitals === 0 ? 'All Systems Operational' : `${suspendedHospitals} suspended tenants`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {/* Visual Health Progress Meter */}
            <div className="md:col-span-2 space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold flex items-center gap-1">
                  Active Tenancy Ratio
                </span>
                <span className="font-mono font-bold text-slate-700">
                  {totalHospitals > 0 ? Math.round((activeHospitals / totalHospitals) * 100) : 0}% Active
                </span>
              </div>
              
              {/* Stacked Progress Bar */}
              <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${totalHospitals > 0 ? (activeHospitals / totalHospitals) * 100 : 0}%` }}
                  title={`${activeHospitals} Active Hospitals`}
                />
                <div 
                  className="bg-amber-500 h-full transition-all duration-500"
                  style={{ width: `${totalHospitals > 0 ? (suspendedHospitals / totalHospitals) * 100 : 0}%` }}
                  title={`${suspendedHospitals} Suspended Hospitals`}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                  <span>{activeHospitals} Active ({totalHospitals > 0 ? Math.round((activeHospitals / totalHospitals) * 100) : 0}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />
                  <span>{suspendedHospitals} Suspended ({totalHospitals > 0 ? Math.round((suspendedHospitals / totalHospitals) * 100) : 0}%)</span>
                </div>
              </div>
            </div>

            {/* Quick Health KPI Panel */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50/40 p-3 rounded-xl border border-emerald-100 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Active Licenses</span>
                <div className="mt-2">
                  <span className="text-2xl font-black text-emerald-700">{activeHospitals}</span>
                  <span className="text-xs text-slate-400 font-semibold block mt-0.5">Online clinics</span>
                </div>
              </div>
              
              <div className="bg-amber-50/40 p-3 rounded-xl border border-amber-100 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Suspended</span>
                <div className="mt-2">
                  <span className="text-2xl font-black text-amber-700">{suspendedHospitals}</span>
                  <span className="text-xs text-slate-400 font-semibold block mt-0.5">Locked tenants</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Plans Guide Panel */}
        {showPricingGuide && (
          <div id="pricing-plans-guide" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-bl-lg">
              Active Tier Framework
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Subscription Plan Directory</h3>
                  <p className="text-xs text-slate-500">Overview of the administrative, clinical features, and billing structure activated per tenant tier.</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowPricingGuide(false)}
                className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
              >
                Dismiss Guide
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 mt-2">
              {/* solo(All in One) Premium Plan Tier */}
              <div className="border border-emerald-300 rounded-xl p-5 bg-emerald-50/20 flex flex-col justify-between space-y-3 shadow-xs">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-emerald-800 text-base">solo(All in One) Premium Plan</span>
                    <span className="font-mono font-extrabold text-emerald-900 text-lg">$1,999 <span className="text-xs font-normal text-slate-500">/mo</span></span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Built for high-volume networks. Grants unlimited user onboarding, comprehensive clinical department workflows, real-time diagnostic imaging, Ward Bed manager, and Priority SLA support.
                  </p>
                </div>
                <div className="text-[11px] text-emerald-700 border-t border-emerald-100 pt-3 font-semibold">
                  Includes All Standard + Ward Beds, Advanced Metrics, Premium SLA
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Toolbar */}
        <div id="sa-toolbar" className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-2">
            <button 
              id="btn-trigger-add-hospital"
              onClick={() => setShowAddHospital(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Hospital Tenant</span>
            </button>
            <button 
              id="btn-trigger-add-admin"
              onClick={() => setShowAddAdmin(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-sm px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Hospital Admin</span>
            </button>
            {!showPricingGuide && (
              <button 
                id="btn-restore-pricing-guide"
                type="button"
                onClick={() => setShowPricingGuide(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-sm px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-all"
                title="Explain plan levels"
              >
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                <span>Explain Plans</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button 
              id="btn-refresh" 
              onClick={fetchData}
              className="bg-slate-50 hover:bg-slate-100 text-slate-600 p-2 rounded-lg border border-slate-200 transition-colors"
              title="Refresh Stats"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button 
              id="btn-download-backup"
              onClick={handleBackup}
              disabled={backingUp}
              className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-semibold text-sm px-4 py-2 rounded-lg flex items-center space-x-2 transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>{backingUp ? 'Creating Backup...' : 'Full System Backup (JSON)'}</span>
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {adminStatusMsg && (
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-3 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">{adminStatusMsg}</p>
          </div>
        )}

        {/* Add Hospital Modal Overlay */}
        {showAddHospital && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <form onSubmit={handleCreateHospital} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-lg text-slate-800">Add New Hospital Tenant</h3>
                <button type="button" onClick={() => setShowAddHospital(false)} className="text-slate-400 hover:text-slate-600">
                  <Pause className="w-5 h-5 rotate-45" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Hospital Name</label>
                  <input 
                    type="text" 
                    value={newHospitalName} 
                    onChange={e => setNewHospitalName(e.target.value)}
                    placeholder="e.g. Eldoret Referral Hospital"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Hospital Code</label>
                  <input 
                    type="text" 
                    value={newHospitalCode} 
                    onChange={e => setNewHospitalCode(e.target.value)}
                    placeholder="e.g. ERH"
                    maxLength={5}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Subscription Plan</label>
                  <select 
                    value={newHospitalSub}
                    onChange={e => setNewHospitalSub(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white"
                  >
                    <option value="Premium">solo(All in One) Premium Plan ($1,999/mo)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowAddHospital(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                >
                  Create Tenant
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit Hospital Modal Overlay */}
        {showEditHospital && editingHospital && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <form onSubmit={handleSaveEdit} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-lg text-slate-800">Edit Hospital Tenant</h3>
                <button type="button" onClick={() => { setShowEditHospital(false); setEditingHospital(null); }} className="text-slate-400 hover:text-slate-600">
                  <Pause className="w-5 h-5 rotate-45" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Hospital Name</label>
                  <input 
                    type="text" 
                    value={editHospitalName} 
                    onChange={e => setEditHospitalName(e.target.value)}
                    placeholder="e.g. Eldoret Referral Hospital"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Hospital Code</label>
                  <input 
                    type="text" 
                    value={editHospitalCode} 
                    onChange={e => setEditHospitalCode(e.target.value)}
                    placeholder="e.g. ERH"
                    maxLength={5}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Tax ID / PIN</label>
                  <input 
                    type="text" 
                    value={editHospitalTaxNumber} 
                    onChange={e => setEditHospitalTaxNumber(e.target.value)}
                    placeholder="e.g. PIN A001234567X"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Phone Number</label>
                  <input 
                    type="text" 
                    value={editHospitalPhone} 
                    onChange={e => setEditHospitalPhone(e.target.value)}
                    placeholder="e.g. +254 700 800 900"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Email Address</label>
                  <input 
                    type="email" 
                    value={editHospitalEmail} 
                    onChange={e => setEditHospitalEmail(e.target.value)}
                    placeholder="e.g. support@clinic.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Website URL</label>
                  <input 
                    type="text" 
                    value={editHospitalWebsite} 
                    onChange={e => setEditHospitalWebsite(e.target.value)}
                    placeholder="e.g. www.clinic.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Physical & Postal Address</label>
                  <input 
                    type="text" 
                    value={editHospitalAddress} 
                    onChange={e => setEditHospitalAddress(e.target.value)}
                    placeholder="e.g. P.O. Box 4501-00100, Nairobi, Kenya"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Receipt Footer / Slogan Notes</label>
                  <textarea 
                    rows={2}
                    value={editHospitalNotes} 
                    onChange={e => setEditHospitalNotes(e.target.value)}
                    placeholder="e.g. Get well soon • Under compassionate care"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-800 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => { setShowEditHospital(false); setEditingHospital(null); }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg animate-fade-in"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Branding & Logo Customization Modal */}
        {showBrandingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <form onSubmit={handleSaveBranding} className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-lg text-slate-800">Customize Clinical Branding</h3>
                <button 
                  type="button" 
                  onClick={() => setShowBrandingModal(false)} 
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">System / Clinic Name</label>
                  <input 
                    type="text" 
                    value={systemName} 
                    onChange={e => setSystemName(e.target.value)}
                    placeholder="e.g. RAPHA JOY MEDICAL CLINICS"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-800 font-semibold text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Clinic Logo Image</label>
                  
                  {/* Drag and Drop Zone */}
                  <div 
                    id="logo-drag-drop-zone"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('logo-file-input')?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                      isDragging 
                        ? 'border-emerald-500 bg-emerald-50/50' 
                        : 'border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <input 
                      type="file" 
                      id="logo-file-input"
                      className="hidden" 
                      accept="image/*"
                      onChange={e => e.target.files && handleFileSelect(e.target.files[0])}
                    />

                    {systemLogo ? (
                      <div className="relative group shrink-0">
                        <img 
                          src={systemLogo} 
                          alt="Branding Preview" 
                          className="max-h-24 max-w-full object-contain rounded-lg shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSystemLogo('');
                          }}
                          className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 text-[10px] shadow-md hover:bg-rose-600 transition-colors w-5 h-5 flex items-center justify-center font-bold"
                          title="Remove Logo"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-2">
                        <div className="p-3 bg-white rounded-full shadow-sm text-slate-400">
                          <Upload className="w-6 h-6 text-slate-500" />
                        </div>
                        <div className="text-xs">
                          <span className="text-slate-800 font-bold hover:underline">Click to upload</span> or drag and drop
                        </div>
                        <p className="text-[10px] text-slate-400">PNG, JPG, or SVG up to 800KB</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Primary Brand Color</label>
                  <div className="flex items-center space-x-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <input 
                      type="color" 
                      value={systemPrimaryColor} 
                      onChange={e => setSystemPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-slate-300"
                    />
                    <div className="flex-1">
                      <input 
                        type="text" 
                        value={systemPrimaryColor} 
                        onChange={e => setSystemPrimaryColor(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800 bg-white font-mono"
                        placeholder="#0f172a"
                      />
                    </div>
                  </div>
                  {/* Preset Colors */}
                  <div className="flex gap-2 mt-2">
                    {[
                      { value: '#0f172a', label: 'Dark Slate' },
                      { value: '#059669', label: 'Emerald' },
                      { value: '#4f46e5', label: 'Indigo' },
                      { value: '#0284c7', label: 'Ocean' },
                      { value: '#0d9488', label: 'Teal' },
                      { value: '#dc2626', label: 'Crimson' }
                    ].map(preset => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setSystemPrimaryColor(preset.value)}
                        className={`w-5 h-5 rounded-full border border-slate-300 relative ${systemPrimaryColor === preset.value ? 'ring-2 ring-slate-800 ring-offset-1' : ''}`}
                        style={{ backgroundColor: preset.value }}
                        title={preset.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowBrandingModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center space-x-1.5"
                >
                  <span>Save Branding</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Custom Toast Message */}
        {toastMessage && (
          <div className={`fixed bottom-5 right-5 z-50 flex items-center space-x-2 px-4 py-3 rounded-xl border shadow-lg ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            {toastMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-sm font-semibold">{toastMessage.text}</span>
          </div>
        )}

        {/* Custom Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
              <div className="flex items-center space-x-3 text-rose-600">
                <AlertCircle className="w-8 h-8 shrink-0" />
                <h3 className="font-bold text-lg">Permanently Delete Tenant?</h3>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-600 leading-relaxed">
                  Are you absolutely sure you want to permanently delete the hospital tenant 
                  <strong className="text-slate-900 block mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono">
                    "{deletingHospitalName}"
                  </strong>
                </p>
                <p className="text-xs text-rose-500 font-medium">
                  ⚠️ This action cannot be undone. All clinical isolation keys and database records for this hospital container registration will be permanently unlinked.
                </p>
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => { setShowDeleteConfirm(false); setDeletingHospitalId(null); setDeletingHospitalName(''); }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
                >
                  Delete Tenant
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Suspend / Activate Confirmation Modal */}
        {showSuspendConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
              <div className="flex items-center space-x-3 text-amber-600">
                <AlertCircle className="w-8 h-8 shrink-0" />
                <h3 className="font-bold text-lg">
                  {suspendingCurrentStatus === 'active' ? 'Suspend' : 'Activate'} Hospital Tenant?
                </h3>
              </div>
              <div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Are you sure you want to {suspendingCurrentStatus === 'active' ? 'suspend' : 'activate'} the hospital tenant 
                  <strong className="text-slate-900 block mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono">
                    "{suspendingHospitalName}"
                  </strong>
                </p>
                {suspendingCurrentStatus === 'active' && (
                  <p className="text-xs text-slate-400 mt-2">
                    Note: Suspended hospital tenants cannot login or process clinical workflows until re-activated by a super-administrator.
                  </p>
                )}
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => { setShowSuspendConfirm(false); setSuspendingHospitalId(null); setSuspendingHospitalName(''); }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmToggleStatus}
                  className={`px-4 py-2 text-sm font-semibold text-white rounded-lg ${
                    suspendingCurrentStatus === 'active' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {suspendingCurrentStatus === 'active' ? 'Suspend Tenant' : 'Activate Tenant'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Admin User Modal Overlay */}
        {showAddAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <form onSubmit={handleCreateAdmin} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-lg text-slate-800">
                  {adminRole === 'Super Admin' ? 'Create Super Administrator' : 'Create Hospital Administrator'}
                </h3>
                <button type="button" onClick={() => setShowAddAdmin(false)} className="text-slate-400 hover:text-slate-600">
                  <Pause className="w-5 h-5 rotate-45" />
                </button>
              </div>

              {adminModalError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{adminModalError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Administrator Name</label>
                  <input 
                    type="text" 
                    value={adminName} 
                    onChange={e => setAdminName(e.target.value)}
                    placeholder="e.g. Dr. Arthur Kamau"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    required
                    disabled={creatingAdmin}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Email Address</label>
                  <input 
                    type="email" 
                    value={adminEmail} 
                    onChange={e => setAdminEmail(e.target.value)}
                    placeholder="e.g. admin@hospitala.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    required
                    disabled={creatingAdmin}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Account Role</label>
                  <select 
                    value={adminRole}
                    onChange={e => setAdminRole(e.target.value as 'Hospital Admin' | 'Super Admin')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
                    required
                    disabled={creatingAdmin}
                  >
                    <option value="Hospital Admin">Hospital Administrator</option>
                    <option value="Super Admin">Super Administrator (Global)</option>
                  </select>
                </div>
                {adminRole !== 'Super Admin' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase">Select Target Hospital</label>
                    <select 
                      value={adminHospitalId}
                      onChange={e => setAdminHospitalId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
                      required
                      disabled={creatingAdmin}
                    >
                      <option value="">-- Choose Hospital --</option>
                      {hospitals.map(h => (
                        <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase">Target Scope</label>
                    <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm mt-1 text-slate-500 font-medium">
                      Global (System-Wide Access)
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowAddAdmin(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  disabled={creatingAdmin}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:bg-slate-400 flex items-center space-x-1.5"
                  disabled={creatingAdmin}
                >
                  {creatingAdmin && <Activity className="w-4 h-4 animate-spin" />}
                  <span>{creatingAdmin ? 'Creating...' : 'Create Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit User Modal Overlay */}
        {showEditUser && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <form onSubmit={handleConfirmEditUser} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-lg text-slate-800">Edit Administrator Account</h3>
                <button type="button" onClick={() => { setShowEditUser(false); setEditingUser(null); }} className="text-slate-400 hover:text-slate-600">
                  <Pause className="w-5 h-5 rotate-45" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Full Name</label>
                  <input 
                    type="text" 
                    value={editUserName} 
                    onChange={e => setEditUserName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Email Address</label>
                  <input 
                    type="email" 
                    value={editUserEmail} 
                    onChange={e => setEditUserEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Role</label>
                  <select 
                    value={editUserRole}
                    onChange={e => setEditUserRole(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
                    required
                  >
                    <option value="Hospital Admin">Hospital Admin</option>
                    <option value="Doctor">Doctor</option>
                    <option value="Nurse">Nurse</option>
                    <option value="Receptionist">Receptionist</option>
                    <option value="Pharmacist">Pharmacist</option>
                    <option value="Laboratory">Laboratory</option>
                    <option value="Radiology">Radiology</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Records Officer">Records Officer</option>
                    <option value="Solo Practitioner">Solo Practitioner</option>
                    {Array.from(new Set(rolePermissions.map(rp => rp.roleName))).filter(rName => {
                      const standardRoles = [
                        "Hospital Admin", "Doctor", "Nurse", "Receptionist", "Pharmacist", 
                        "Laboratory", "Radiology", "Accountant", "Cashier", "Records Officer", "Solo Practitioner"
                      ];
                      return !standardRoles.includes(rName);
                    }).map(customRole => (
                      <option key={customRole} value={customRole}>{customRole}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Assigned Hospital</label>
                  <select 
                    value={editUserHospitalId}
                    onChange={e => setEditUserHospitalId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
                    required
                  >
                    <option value="">-- Choose Hospital --</option>
                    {hospitals.map(h => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => { setShowEditUser(false); setEditingUser(null); }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Custom Delete User Confirmation Modal */}
        {showDeleteUserConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center space-x-3 text-rose-600">
                <div className="p-2 bg-rose-50 rounded-full">
                  <Trash2 className="w-6 h-6 animate-bounce" />
                </div>
                <h3 className="font-bold text-lg">Permanently Delete Account?</h3>
              </div>
              <p className="text-sm text-slate-600">
                Are you absolutely sure you want to permanently delete the account 
                <span className="font-extrabold text-slate-800"> "{deletingUserName}"</span>? This user will lose access to the clinical workflows.
              </p>
              <div className="flex justify-end space-x-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setShowDeleteUserConfirm(false); setDeletingUserId(null); setDeletingUserName(''); }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmDeleteUser}
                  className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hospitals Table Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-800 text-lg">Hospital Tenant Isolation Monitor</h2>
              <p className="text-xs text-slate-500">Every single tenant operates in complete separation. Active subscription, usage metrics, and statuses.</p>
            </div>
            <div className="bg-indigo-100 px-3 py-1 rounded-full text-xs font-bold text-indigo-700">
              5 Active Tenancies Max
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <Activity className="w-8 h-8 animate-spin mx-auto mb-3 text-slate-400" />
              <span>Fetching secure statistics across multi-tenant indices...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-xs font-bold uppercase border-b border-slate-200">
                    <th className="py-4 px-6">Hospital Detail</th>
                    <th className="py-4 px-6 text-center">Isolation Code</th>
                    <th className="py-4 px-6">Subscription Level</th>
                    <th className="py-4 px-6 text-center">Patients</th>
                    <th className="py-4 px-6 text-center">Appointments</th>
                    <th className="py-4 px-6 text-center">Billing Invoices</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Administrative Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {hospitals.map(h => {
                    const hStats = stats[h.id] || { patients: 0, appointments: 0, billings: 0, totalRevenue: 0 };
                    return (
                      <tr key={h.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800">{h.name}</span>
                            {isBranchOnline(h) ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                Offline
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">Created: {new Date(h.createdAt).toLocaleDateString()}</div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="font-mono bg-slate-100 px-2.5 py-1 rounded-md text-xs font-bold text-slate-700 border border-slate-200">
                            {h.code}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-1.5">
                            <CreditCard className="w-4 h-4 text-slate-400" />
                            <span className={`font-semibold ${
                              h.subscription === 'Premium' ? 'text-emerald-600' :
                              h.subscription === 'Standard' ? 'text-indigo-600' :
                              'text-slate-600'
                            }`}>
                              {h.subscription === 'Premium' ? 'solo(All in One)' : h.subscription}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">
                            {h.subscription === 'Premium' ? '$1,999/mo' :
                             h.subscription === 'Standard' ? '$999/mo' :
                             '$499/mo'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center font-medium text-slate-700">
                          {hStats.patients}
                        </td>
                        <td className="py-4 px-6 text-center font-medium text-slate-700">
                          {hStats.appointments}
                        </td>
                        <td className="py-4 px-6 text-center font-medium text-slate-700">
                          {hStats.billings}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            h.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${h.status === 'active' ? 'bg-emerald-600' : 'bg-red-600'}`} />
                            <span className="capitalize">{h.status}</span>
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right space-y-1.5 sm:space-y-0 sm:space-x-2">
                          <button 
                            id={`btn-simulate-${h.id}`}
                            onClick={async () => {
                              try {
                                await updateHospitalOnlineStatus(h.id, true);
                                setSimulatingHospitalId(h.id);
                                showToast('success', `Entering Simulated Workspace for "${h.name}". Online status restored.`);
                              } catch (err) {
                                setSimulatingHospitalId(h.id);
                              }
                            }}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-md font-bold transition-colors inline-flex items-center space-x-1 shadow-sm cursor-pointer border border-emerald-500"
                            title="Open Tenant Workspace & Restore Online Status"
                          >
                            <Play className="w-3 h-3 text-emerald-100 fill-emerald-100" />
                            <span>Enter Workspace</span>
                          </button>

                          <button 
                            id={`btn-edit-${h.id}`}
                            onClick={() => handleStartEdit(h)}
                            className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-2.5 py-1.5 rounded-md font-medium transition-colors inline-flex items-center space-x-1"
                            title="Edit Tenant"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          <button 
                            id={`btn-delete-${h.id}`}
                            onClick={() => handleStartDelete(h.id, h.name)}
                            className="text-xs bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-2.5 py-1.5 rounded-md font-medium transition-colors inline-flex items-center space-x-1"
                            title="Delete Tenant"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>

                          <button 
                            id={`btn-toggle-sub-${h.id}`}
                            onClick={() => handleChangeSubscription(h.id, h.subscription)}
                            className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-md font-medium transition-colors"
                            title="Upgrade / Downgrade Plan"
                          >
                            Tier Shift
                          </button>
                          
                          <button 
                            id={`btn-toggle-status-${h.id}`}
                            onClick={() => handleStartToggleStatus(h.id, h.name, h.status)}
                            className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors border ${
                              h.status === 'active' 
                                ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700'
                                : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                            }`}
                          >
                            {h.status === 'active' ? 'Suspend' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Hospital Administrators & Users Directory Card */}
        <div id="sa-users-directory" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" /> Hospital Administrators & Staff Directory
              </h2>
              <p className="text-xs text-slate-500">Manage, edit, and delete Hospital Administrators or medical staff accounts across all tenants.</p>
            </div>
            <button
              onClick={() => {
                setAdminEmail('');
                setAdminName('');
                setAdminHospitalId('');
                setAdminRole('Hospital Admin');
                setAdminModalError('');
                setShowAddAdmin(true);
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 self-start sm:self-center transition-colors shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Administrator</span>
            </button>
          </div>

          {/* Search and Filters Bar */}
          <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={userSearchQuery}
                onChange={e => setUserSearchQuery(e.target.value)}
                placeholder="Search by name, email, or role..."
                className="w-full pl-3 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <div className="w-full sm:w-64">
              <select
                value={userHospitalFilter}
                onChange={e => setUserHospitalFilter(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
              >
                <option value="">All Hospitals</option>
                {hospitals.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">
              <Activity className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
              <span className="text-xs">Loading user registry database...</span>
            </div>
          ) : allUsersList.filter(u => (userSearchQuery ? (u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) || u.role.toLowerCase().includes(userSearchQuery.toLowerCase())) : true) && (userHospitalFilter ? u.hospitalId === userHospitalFilter : true)).length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold">No registered administrators found</p>
              <p className="text-xs mt-1">Try resetting your search query or create a new administrator above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-[11px] font-bold uppercase border-b border-slate-200">
                    <th className="py-3 px-6">Administrator / Staff Detail</th>
                    <th className="py-3 px-6">Assigned Hospital</th>
                    <th className="py-3 px-6">Role Type</th>
                    <th className="py-3 px-6">Created On</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {allUsersList
                    .filter(u => {
                      const matchesSearch = userSearchQuery ? (
                        u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                        u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                        u.role.toLowerCase().includes(userSearchQuery.toLowerCase())
                      ) : true;
                      const matchesHospital = userHospitalFilter ? u.hospitalId === userHospitalFilter : true;
                      return matchesSearch && matchesHospital;
                    })
                    .map(u => {
                      const hospital = hospitals.find(h => h.id === u.hospitalId);
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-6">
                            <div className="font-bold text-slate-800">{u.name}</div>
                            <div className="text-slate-400 text-[11px] font-mono">{u.email}</div>
                          </td>
                          <td className="py-3.5 px-6">
                            {u.role === 'Super Admin' ? (
                              <span className="inline-flex items-center gap-1 bg-red-50 border border-red-100 px-2 py-0.5 rounded text-xs font-semibold text-red-700">
                                <Shield className="w-3 h-3 text-red-500" />
                                Global System Scope
                              </span>
                            ) : hospital ? (
                              <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs font-semibold text-slate-700">
                                <Building className="w-3 h-3 text-slate-500" />
                                {hospital.name}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">No assigned hospital</span>
                            )}
                          </td>
                          <td className="py-3.5 px-6">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              u.role === 'Super Admin'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : u.role === 'Hospital Admin'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : u.role === 'Doctor'
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : 'bg-slate-50 text-slate-700 border border-slate-200'
                            }`}>
                              <Shield className="w-3 h-3 animate-pulse" />
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-slate-500">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Unknown'}
                          </td>
                          <td className="py-3.5 px-6 text-right space-x-2">
                            <button
                              id={`btn-edit-user-${u.id}`}
                              onClick={() => handleStartEditUser(u)}
                              className="text-[11px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-2.5 py-1.5 rounded-md font-medium transition-colors inline-flex items-center space-x-1 cursor-pointer"
                              title="Edit User"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>

                            <button
                              id={`btn-delete-user-${u.id}`}
                              onClick={() => handleStartDeleteUser(u.id, u.name)}
                              disabled={u.id === currentUser.id}
                              className={`text-[11px] border px-2.5 py-1.5 rounded-md font-medium transition-colors inline-flex items-center space-x-1 cursor-pointer ${
                                u.id === currentUser.id 
                                  ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                                  : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                              }`}
                              title="Delete User"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-400 font-medium space-y-1">
        <div>Raphajoy Medical Clinics</div>
        <div className="font-bold text-slate-500">© 2026 Davetech Solutions. All rights reserved.</div>
      </footer>
    </div>
  );
}
