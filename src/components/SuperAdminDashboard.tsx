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
  SystemSettings
} from '../services/dbService';

interface SuperAdminDashboardProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onBrandingUpdate?: (name: string, logo: string) => void;
}

export default function SuperAdminDashboard({ currentUser, onLogout, onBrandingUpdate }: SuperAdminDashboardProps) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [stats, setStats] = useState<Record<string, { patients: number, appointments: number, billings: number, totalRevenue: number }>>({});
  const [loading, setLoading] = useState(true);
  
  // Modals / Form states
  const [showAddHospital, setShowAddHospital] = useState(false);
  const [newHospitalName, setNewHospitalName] = useState('');
  const [newHospitalCode, setNewHospitalCode] = useState('');
  const [newHospitalSub, setNewHospitalSub] = useState<'Basic' | 'Standard' | 'Premium'>('Basic');

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
  const [adminStatusMsg, setAdminStatusMsg] = useState('');
  const [adminModalError, setAdminModalError] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const [backingUp, setBackingUp] = useState(false);

  // Branding states
  const [systemLogo, setSystemLogo] = useState<string>('/logo.svg');
  const [systemName, setSystemName] = useState<string>('RAPHA JOY MEDICAL CLINICS');
  const [showBrandingModal, setShowBrandingModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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

    return () => unsubscribe();
  }, []);

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
        logo: systemLogo
      });
      if (onBrandingUpdate) {
        onBrandingUpdate(systemName, systemLogo);
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
    if (!adminEmail || !adminName || !adminHospitalId) {
      setAdminModalError('Please fill in all fields.');
      return;
    }

    setCreatingAdmin(true);
    setAdminModalError('');

    try {
      // Create pre-registered user profile document in Firestore
      const mockUid = `uid_${adminEmail.replace(/[^a-zA-Z0-9]/g, '')}`;
      await createUserProfile(mockUid, {
        hospitalId: adminHospitalId,
        name: adminName,
        email: adminEmail,
        role: 'Hospital Admin',
        createdAt: new Date().toISOString()
      });

      // Show banner of success on the main screen
      setAdminStatusMsg(`Admin user "${adminName}" successfully registered for hospital! Email: ${adminEmail}. They can now login manually or via simulation. Default password is 'Password123!'.`);
      
      // Clear forms
      setAdminEmail('');
      setAdminName('');
      setAdminHospitalId('');
      
      // Close Modal and notify
      setShowAddAdmin(false);
      showToast('success', `Hospital administrator registered successfully!`);
      
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
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">KES {totalRevenue.toLocaleString()}</h3>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              {/* Basic Tier */}
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800 text-sm">Basic Plan</span>
                    <span className="font-mono font-extrabold text-slate-900 text-sm">$499 <span className="text-[10px] font-normal text-slate-500">/mo</span></span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Designed for clinics and localized health centers. All core actions (Doctor, Receptionist, Pharmacist, Cashier) can be completed by a single operator/person.
                  </p>
                </div>
                <div className="text-[10px] text-slate-500 border-t border-slate-200 pt-2 font-semibold">
                  Includes: Doctors, Receptionists, Pharmacists, Cashiers (Operable by one person)
                </div>
              </div>

              {/* Standard Tier */}
              <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/20 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-indigo-800 text-sm">Standard Plan</span>
                    <span className="font-mono font-extrabold text-indigo-900 text-sm">$999 <span className="text-[10px] font-normal text-slate-500">/mo</span></span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Ideal for regional medical facilities. Activates advanced clinical roles including Nurses, Laboratory Units, and Radiology Scan workflows, as well as digital NHIF/SHIF insurance tracking.
                  </p>
                </div>
                <div className="text-[10px] text-indigo-500 border-t border-indigo-100 pt-2 font-medium">
                  Includes Basic + Nurses, Laboratory, Radiology, Insurance logs
                </div>
              </div>

              {/* Premium Tier */}
              <div className="border border-purple-200 rounded-lg p-4 bg-purple-50/20 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-purple-800 text-sm">Premium Plan</span>
                    <span className="font-mono font-extrabold text-purple-900 text-sm">$1,999 <span className="text-[10px] font-normal text-slate-500">/mo</span></span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Built for high-volume networks. Grants unlimited user onboarding, comprehensive clinical department workflows, real-time diagnostic imaging, Ward Bed manager, and Priority SLA support.
                  </p>
                </div>
                <div className="text-[10px] text-purple-500 border-t border-purple-100 pt-2 font-medium">
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
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Subscription Tier</label>
                  <select 
                    value={newHospitalSub}
                    onChange={e => setNewHospitalSub(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-slate-800 bg-white"
                  >
                    <option value="Basic">Basic ($499/mo)</option>
                    <option value="Standard">Standard ($999/mo)</option>
                    <option value="Premium">Premium ($1999/mo)</option>
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
                <h3 className="font-bold text-lg text-slate-800">Create Hospital Administrator</h3>
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
                            {h.isOnline ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider">
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
                              h.subscription === 'Premium' ? 'text-purple-600' :
                              h.subscription === 'Standard' ? 'text-indigo-600' :
                              'text-slate-600'
                            }`}>{h.subscription}</span>
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
                        <td className="py-4 px-6 text-right space-x-2">
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
      </main>

      {/* Footer copyright */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-400 font-medium space-y-1">
        <div>Raphajoy Medical Clinics</div>
        <div className="font-bold text-slate-500">© 2026 Davetech Solutions. All rights reserved.</div>
      </footer>
    </div>
  );
}
