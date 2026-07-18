export interface Hospital {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'suspended';
  subscription: 'Basic' | 'Standard' | 'Premium';
  createdAt: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  notes?: string;
  taxNumber?: string;
  isOnline?: boolean;
  admittedPatientsCount?: number;
}

export interface UserProfile {
  id: string;
  hospitalId: string;
  name: string;
  email: string;
  role: string; // e.g. 'Super Admin', 'Hospital Admin', 'Doctor', etc. or custom roles
  department?: string;
  createdAt: string;
}

export interface Patient {
  id: string;
  hospitalId: string;
  name: string;
  age: number;
  gender: string;
  contact: string;
  email: string;
  address: string;
  insuranceType: 'NHIF' | 'SHIF' | 'None' | 'Private';
  insuranceId?: string;
  status: 'Active' | 'Admitted' | 'Discharged';
  createdAt: string;
}

export interface Appointment {
  id: string;
  hospitalId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  timeSlot: string;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  symptoms: string;
  queueNumber: number;
  consultationFee?: number;
  createdAt: string;
}

export interface DrugPrescription {
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  status: 'Pending' | 'Dispensed';
}

export interface LabRequest {
  testName: string;
  result?: string;
  status: 'Pending' | 'Completed';
  requestedAt: string;
  completedAt?: string;
}

export interface RadiologyRequest {
  type: 'X-ray' | 'CT Scan' | 'MRI' | 'Ultrasound';
  notes?: string;
  result?: string;
  status: 'Pending' | 'Completed';
}

export interface WardAdmission {
  wardType: 'Maternity' | 'General' | 'ICU' | 'Pediatric';
  bedNumber: string;
  admittedAt: string;
  dischargedAt?: string;
  notes?: string;
}

export interface TheatreNotes {
  procedureName: string;
  surgeon: string;
  findings: string;
  status: 'Scheduled' | 'Completed';
}

export interface MaternityNotes {
  type: 'ANC' | 'Delivery' | 'PNC';
  notes: string;
}

export interface MedicalRecord {
  id: string;
  hospitalId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  diagnosis: string;
  symptoms: string;
  notes: string;
  prescriptions?: DrugPrescription[];
  laboratoryRequests?: LabRequest[];
  radiologyRequests?: RadiologyRequest[];
  wardAdmission?: WardAdmission;
  theatreNotes?: TheatreNotes;
  maternityNotes?: MaternityNotes;
  createdAt: string;
}

export interface BillingItem {
  description: string;
  amount: number;
  quantity: number;
}

export interface Billing {
  id: string;
  hospitalId: string;
  patientId: string;
  patientName: string;
  items: BillingItem[];
  totalAmount: number;
  insuranceClaimed: number;
  patientPaid: number;
  status: 'Unpaid' | 'Partial' | 'Paid';
  paymentMethod?: 'Cash' | 'M-Pesa' | 'Insurance';
  invoiceDate: string;
  createdAt: string;
}

export interface PharmacyStock {
  id: string;
  hospitalId: string;
  drugName: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  expiryDate: string;
}

export interface WardBed {
  id: string;
  hospitalId: string;
  wardType: 'Maternity' | 'General' | 'ICU' | 'Pediatric';
  bedNumber: string;
  status: 'Available' | 'Occupied';
  occupiedBy?: string;
  occupiedByName?: string;
}

export interface RolePermission {
  id: string; // `${hospitalId}_${roleName}`
  hospitalId: string;
  roleName: string;
  allowedTabs: string[]; // List of tab IDs like 'reception', 'consultation', etc.
  createdAt: string;
}
