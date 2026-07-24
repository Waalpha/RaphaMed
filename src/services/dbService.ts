import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  increment 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Hospital, 
  UserProfile, 
  Patient, 
  Appointment, 
  MedicalRecord, 
  Billing, 
  PharmacyStock, 
  WardBed,
  RolePermission
} from '../types';

// ==========================================
// HOSPITALS & SYSTEM GENERAL
// ==========================================

export async function getAllHospitals(): Promise<Hospital[]> {
  const querySnapshot = await getDocs(collection(db, 'hospitals'));
  const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hospital));
  return list.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });
}

export interface SystemSettings {
  logo?: string;
  name?: string;
  primaryColor?: string;
}

export async function getSystemSettings(): Promise<SystemSettings | null> {
  const docSnap = await getDoc(doc(db, 'settings', 'system'));
  if (docSnap.exists()) {
    return docSnap.data() as SystemSettings;
  }
  return null;
}

export async function updateSystemSettings(data: SystemSettings): Promise<void> {
  await setDoc(doc(db, 'settings', 'system'), data, { merge: true });
}

export async function createHospital(hospital: Hospital): Promise<void> {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const hospitalData: Hospital = {
    paymentStatus: 'Paid',
    lastPaymentMonth: currentMonthStr,
    lastPaymentDate: now.toISOString(),
    monthlyFee: hospital.subscription === 'Premium' ? 150000 : hospital.subscription === 'Standard' ? 95000 : 50000,
    paymentOverride: false,
    ...hospital
  };
  await setDoc(doc(db, 'hospitals', hospital.id), hospitalData);
}

export async function updateHospitalPaymentDetails(
  hospitalId: string,
  details: {
    monthlyFee?: number;
    paymentStatus?: 'Paid' | 'Unpaid';
    lastPaymentMonth?: string;
    lastPaymentDate?: string;
    paymentOverride?: boolean;
    paymentOverrideNote?: string;
  }
): Promise<void> {
  await updateDoc(doc(db, 'hospitals', hospitalId), details);
}

export async function updateHospitalDetails(
  hospitalId: string, 
  name: string, 
  code: string,
  extraDetails?: {
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    logoUrl?: string;
    notes?: string;
    taxNumber?: string;
  }
): Promise<void> {
  await updateDoc(doc(db, 'hospitals', hospitalId), { 
    name, 
    code: code.toUpperCase(),
    ...extraDetails 
  });
}

export async function getHospital(hospitalId: string): Promise<Hospital | null> {
  const docSnap = await getDoc(doc(db, 'hospitals', hospitalId));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Hospital;
  }
  return null;
}

export async function deleteHospital(hospitalId: string): Promise<void> {
  await deleteDoc(doc(db, 'hospitals', hospitalId));
}

export async function updateHospitalStatus(hospitalId: string, status: 'active' | 'suspended'): Promise<void> {
  await updateDoc(doc(db, 'hospitals', hospitalId), { status });
}

export async function updateHospitalSubscription(hospitalId: string, subscription: 'Basic' | 'Standard' | 'Premium'): Promise<void> {
  await updateDoc(doc(db, 'hospitals', hospitalId), { subscription });
}

export async function updateHospitalOnlineStatus(hospitalId: string, isOnline: boolean): Promise<void> {
  await updateDoc(doc(db, 'hospitals', hospitalId), { isOnline, lastActiveAt: isOnline ? Date.now() : 0 });
}

export async function updateHospitalActiveHeartbeat(hospitalId: string): Promise<void> {
  if (!hospitalId) return;
  await updateDoc(doc(db, 'hospitals', hospitalId), { 
    isOnline: true, 
    lastActiveAt: Date.now() 
  }).catch(() => {});
}

// ==========================================
// USER PROFILES
// ==========================================

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as UserProfile;
  }
  return null;
}

export async function createUserProfile(uid: string, profile: Omit<UserProfile, 'id'>): Promise<UserProfile> {
  const profileWithId = { id: uid, ...profile };
  await setDoc(doc(db, 'users', uid), profileWithId);
  return profileWithId;
}

export async function getHospitalUsers(hospitalId: string): Promise<UserProfile[]> {
  const q = query(collection(db, 'users'), where('hospitalId', '==', hospitalId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
}

export async function deleteUserProfile(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid));
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), data);
}

// ==========================================
// PATIENTS (Multi-Branch)
// ==========================================

export async function updateAdmittedPatientsCount(hospitalId: string): Promise<number> {
  const q = query(
    collection(db, 'patients'),
    where('hospitalId', '==', hospitalId),
    where('status', '==', 'Admitted')
  );
  const snapshot = await getDocs(q);
  const count = snapshot.size;
  await updateDoc(doc(db, 'hospitals', hospitalId), { admittedPatientsCount: count });
  return count;
}

export async function getPatients(hospitalId: string): Promise<Patient[]> {
  const q = query(collection(db, 'patients'), where('hospitalId', '==', hospitalId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
}

export async function createPatient(patient: Omit<Patient, 'id' | 'createdAt'>): Promise<Patient> {
  const id = `pat_${Date.now()}`;
  const record: Patient = {
    id,
    ...patient,
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'patients', id), record);
  await updateAdmittedPatientsCount(patient.hospitalId).catch(err => {
    console.error('Error updating admitted patients count:', err);
  });
  return record;
}

export async function updatePatient(patientId: string, data: Partial<Patient>): Promise<void> {
  await updateDoc(doc(db, 'patients', patientId), data);
  if (data.hospitalId) {
    await updateAdmittedPatientsCount(data.hospitalId).catch(() => {});
  } else {
    const docSnap = await getDoc(doc(db, 'patients', patientId));
    if (docSnap.exists()) {
      const p = docSnap.data();
      if (p.hospitalId) {
        await updateAdmittedPatientsCount(p.hospitalId).catch(() => {});
      }
    }
  }
}

// ==========================================
// APPOINTMENTS (Multi-Branch)
// ==========================================

export async function getAppointments(hospitalId: string): Promise<Appointment[]> {
  const q = query(collection(db, 'appointments'), where('hospitalId', '==', hospitalId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
}

export async function createAppointment(appointment: Omit<Appointment, 'id' | 'createdAt'>): Promise<Appointment> {
  const id = `app_${Date.now()}`;
  const record: Appointment = {
    id,
    ...appointment,
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'appointments', id), record);
  return record;
}

export async function updateAppointmentStatus(appointmentId: string, status: Appointment['status']): Promise<void> {
  await updateDoc(doc(db, 'appointments', appointmentId), { status });
}

// ==========================================
// MEDICAL RECORDS (Multi-Branch)
// ==========================================

export async function getMedicalRecords(hospitalId: string): Promise<MedicalRecord[]> {
  const q = query(collection(db, 'medicalRecords'), where('hospitalId', '==', hospitalId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MedicalRecord));
}

export async function createMedicalRecord(record: Omit<MedicalRecord, 'id' | 'createdAt'>): Promise<MedicalRecord> {
  const id = `med_${Date.now()}`;
  const newRecord: MedicalRecord = {
    id,
    ...record,
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'medicalRecords', id), newRecord);
  return newRecord;
}

export async function updateMedicalRecord(recordId: string, data: Partial<MedicalRecord>): Promise<void> {
  await updateDoc(doc(db, 'medicalRecords', recordId), data);
}

// ==========================================
// PHARMACY STOCK (Multi-Branch)
// ==========================================

export async function getPharmacyStock(hospitalId: string): Promise<PharmacyStock[]> {
  const q = query(collection(db, 'pharmacyStock'), where('hospitalId', '==', hospitalId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PharmacyStock));
}

export async function updatePharmacyStockQty(stockId: string, qtyDelta: number): Promise<void> {
  await updateDoc(doc(db, 'pharmacyStock', stockId), {
    quantity: increment(qtyDelta)
  });
}

export async function createPharmacyStockItem(item: Omit<PharmacyStock, 'id'>): Promise<PharmacyStock> {
  const id = `drug_${Date.now()}`;
  const record: PharmacyStock = { id, ...item };
  await setDoc(doc(db, 'pharmacyStock', id), record);
  return record;
}

export async function deletePharmacyStockItem(stockId: string): Promise<void> {
  await deleteDoc(doc(db, 'pharmacyStock', stockId));
}

// ==========================================
// WARD BEDS (Multi-Branch)
// ==========================================

export async function getWardBeds(hospitalId: string): Promise<WardBed[]> {
  const q = query(collection(db, 'wardBeds'), where('hospitalId', '==', hospitalId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WardBed));
}

export async function updateWardBedStatus(bedId: string, status: 'Available' | 'Occupied', occupiedBy?: string, occupiedByName?: string): Promise<void> {
  await updateDoc(doc(db, 'wardBeds', bedId), {
    status,
    occupiedBy: occupiedBy || '',
    occupiedByName: occupiedByName || ''
  });
}

// ==========================================
// BILLING (Multi-Branch)
// ==========================================

export async function getBillingRecords(hospitalId: string): Promise<Billing[]> {
  const q = query(collection(db, 'billing'), where('hospitalId', '==', hospitalId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Billing));
}

export async function createBillingRecord(billing: Omit<Billing, 'id' | 'createdAt'>): Promise<Billing> {
  const id = `bill_${Date.now()}`;
  const record: Billing = {
    id,
    ...billing,
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'billing', id), record);
  return record;
}

export async function updateBillingPayment(
  billingId: string, 
  patientPaid: number, 
  status: Billing['status'], 
  paymentMethod: Billing['paymentMethod']
): Promise<void> {
  await updateDoc(doc(db, 'billing', billingId), {
    patientPaid,
    status,
    paymentMethod
  });
}

// ==========================================
// DYNAMIC USAGE MONITOR FOR SUPER ADMIN
// ==========================================

export async function getSystemStats() {
  const hospitals = await getAllHospitals();
  
  // To avoid heavy loads or client limits, we query summaries dynamically.
  const stats: Record<string, { patients: number, appointments: number, billings: number, totalRevenue: number }> = {};
  
  for (const h of hospitals) {
    const pSnap = await getDocs(query(collection(db, 'patients'), where('hospitalId', '==', h.id)));
    const aSnap = await getDocs(query(collection(db, 'appointments'), where('hospitalId', '==', h.id)));
    const bSnap = await getDocs(query(collection(db, 'billing'), where('hospitalId', '==', h.id)));
    
    let totalRev = 0;
    bSnap.docs.forEach(doc => {
      const data = doc.data();
      totalRev += (data.patientPaid || 0) + (data.insuranceClaimed || 0);
    });

    stats[h.id] = {
      patients: pSnap.size,
      appointments: aSnap.size,
      billings: bSnap.size,
      totalRevenue: totalRev
    };
  }

  return stats;
}

// ==========================================
// BACKUP ALL DATA (Super Admin Feature)
// ==========================================

export async function downloadAllSystemDataBackup(): Promise<string> {
  const collections = ['hospitals', 'users', 'patients', 'appointments', 'medicalRecords', 'billing', 'pharmacyStock', 'wardBeds', 'rolePermissions'];
  const backupData: Record<string, any[]> = {};

  for (const colName of collections) {
    const snapshot = await getDocs(collection(db, colName));
    backupData[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  return JSON.stringify(backupData, null, 2);
}

// ==========================================
// ROLE & PERMISSIONS (Multi-Branch)
// ==========================================

export async function getRolePermissions(hospitalId: string): Promise<RolePermission[]> {
  const q = query(collection(db, 'rolePermissions'), where('hospitalId', '==', hospitalId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RolePermission));
}

export async function saveRolePermission(hospitalId: string, roleName: string, allowedTabs: string[]): Promise<void> {
  const docId = `${hospitalId}_${roleName.replace(/\s+/g, '_')}`;
  await setDoc(doc(db, 'rolePermissions', docId), {
    hospitalId,
    roleName,
    allowedTabs,
    createdAt: new Date().toISOString()
  });
}

export async function deleteRolePermission(id: string): Promise<void> {
  await deleteDoc(doc(db, 'rolePermissions', id));
}
