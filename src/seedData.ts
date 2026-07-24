import { collection, doc, getDocs, writeBatch, setDoc, query, limit } from 'firebase/firestore';
import { db } from './firebase';

export interface Hospital {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'suspended';
  subscription: 'Basic' | 'Standard' | 'Premium';
  createdAt: string;
}

export const INITIAL_HOSPITALS: Hospital[] = [
  {
    id: 'hospital_a',
    name: 'Nairobi National Hospital',
    code: 'NNH',
    status: 'active',
    subscription: 'Premium',
    createdAt: '2026-01-10T08:00:00Z'
  },
  {
    id: 'hospital_b',
    name: 'Kisumu Medical Centre',
    code: 'KMC',
    status: 'active',
    subscription: 'Premium',
    createdAt: '2026-02-15T09:00:00Z'
  },
  {
    id: 'hospital_c',
    name: 'Mombasa Coast General',
    code: 'MCG',
    status: 'active',
    subscription: 'Premium',
    createdAt: '2026-03-20T10:30:00Z'
  },
  {
    id: 'hospital_d',
    name: 'Eldoret Referral Hospital',
    code: 'ERH',
    status: 'active',
    subscription: 'Premium',
    createdAt: '2026-04-05T14:15:00Z'
  },
  {
    id: 'hospital_e',
    name: 'Nakuru Health Clinic',
    code: 'NHC',
    status: 'suspended',
    subscription: 'Premium',
    createdAt: '2026-05-12T11:00:00Z'
  }
];

export async function seedHospitalsAndData() {
  try {
    // Check if hospitals already exist
    const hospitalsRef = collection(db, 'hospitals');
    const snapshot = await getDocs(hospitalsRef);
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (!snapshot.empty) {
      console.log('Hospitals already exist. Checking if plan or payment field migration is needed...');
      const batch = writeBatch(db);
      let needsMigration = false;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const updates: any = {};
        if (data.subscription !== 'Premium') {
          updates.subscription = 'Premium';
          needsMigration = true;
        }
        if (!data.lastPaymentMonth) {
          updates.lastPaymentMonth = currentMonthStr;
          updates.paymentStatus = 'Paid';
          updates.lastPaymentDate = now.toISOString();
          updates.monthlyFee = 150000;
          updates.paymentOverride = false;
          needsMigration = true;
        }
        if (Object.keys(updates).length > 0) {
          batch.update(docSnap.ref, updates);
        }
      });
      if (needsMigration) {
        await batch.commit();
        console.log('Existing hospitals migrated to Premium subscription and payment fields updated successfully!');
      } else {
        console.log('All existing hospitals are up-to-date.');
      }
      return;
    }

    console.log('Seeding initial hospitals...');
    const batch = writeBatch(db);
    for (const h of INITIAL_HOSPITALS) {
      batch.set(doc(db, 'hospitals', h.id), h);
    }
    await batch.commit();

    // Now seed other sample data for each active hospital so they are immediately fully functional!
    // Note: To avoid permission errors when unauthenticated on startup, we now seed hospital-specific
    // data dynamically when a user of that tenant logs in.
    console.log('Base hospitals seeded. Specific hospital data will be seeded dynamically upon branch login.');
  } catch (error) {
    console.error('Error during database seeding:', error);
  }
}

export async function seedHospitalSpecificData(hospitalId: string) {
  try {
    const batch = writeBatch(db);

    // Patients
    const patients = [
      { id: `${hospitalId}_p1`, hospitalId, name: 'John Mwangi', age: 34, gender: 'Male', contact: '+254 712 345678', email: 'john.mwangi@gmail.com', address: 'Nairobi, Westlands', insuranceType: 'SHIF', insuranceId: 'SHIF-992384', status: 'Active', createdAt: new Date().toISOString() },
      { id: `${hospitalId}_p2`, hospitalId, name: 'Mary Wanjiku', age: 28, gender: 'Female', contact: '+254 722 876543', email: 'mary.wanjiku@yahoo.com', address: 'Nairobi, Kilimani', insuranceType: 'NHIF', insuranceId: 'NHIF-883748', status: 'Admitted', createdAt: new Date().toISOString() },
      { id: `${hospitalId}_p3`, hospitalId, name: 'David Omondi', age: 45, gender: 'Male', contact: '+254 733 111222', email: 'david.omondi@outlook.com', address: 'Kisumu, Milimani', insuranceType: 'None', insuranceId: '', status: 'Active', createdAt: new Date().toISOString() },
      { id: `${hospitalId}_p4`, hospitalId, name: 'Sarah Cherono', age: 22, gender: 'Female', contact: '+254 701 444555', email: 'sarah.cherono@gmail.com', address: 'Eldoret, Kapsoya', insuranceType: 'Private', insuranceId: 'AAR-33928', status: 'Active', createdAt: new Date().toISOString() }
    ];

    for (const p of patients) {
      batch.set(doc(db, 'patients', p.id), p);
    }

    // Ward Beds
    const beds = [
      { id: `${hospitalId}_bed1`, hospitalId, wardType: 'General', bedNumber: 'G-101', status: 'Occupied', occupiedBy: `${hospitalId}_p2`, occupiedByName: 'Mary Wanjiku' },
      { id: `${hospitalId}_bed2`, hospitalId, wardType: 'General', bedNumber: 'G-102', status: 'Available' },
      { id: `${hospitalId}_bed3`, hospitalId, wardType: 'Maternity', bedNumber: 'M-201', status: 'Available' },
      { id: `${hospitalId}_bed4`, hospitalId, wardType: 'ICU', bedNumber: 'ICU-01', status: 'Available' },
      { id: `${hospitalId}_bed5`, hospitalId, wardType: 'Pediatric', bedNumber: 'P-301', status: 'Available' }
    ];

    for (const b of beds) {
      batch.set(doc(db, 'wardBeds', b.id), b);
    }

    // Pharmacy Stock
    const drugs = [
      { id: `${hospitalId}_d1`, hospitalId, drugName: 'Paracetamol 500mg', quantity: 2400, minQuantity: 500, unitPrice: 5, expiryDate: '2027-12-01' },
      { id: `${hospitalId}_d2`, hospitalId, drugName: 'Amoxicillin 250mg', quantity: 1200, minQuantity: 300, unitPrice: 15, expiryDate: '2027-06-15' },
      { id: `${hospitalId}_d3`, hospitalId, drugName: 'Metformin 500mg', quantity: 800, minQuantity: 200, unitPrice: 10, expiryDate: '2028-01-20' },
      { id: `${hospitalId}_d4`, hospitalId, drugName: 'Ibuprofen 400mg', quantity: 1500, minQuantity: 400, unitPrice: 8, expiryDate: '2027-08-30' },
      { id: `${hospitalId}_d5`, hospitalId, drugName: 'Omeprazole 20mg', quantity: 180, minQuantity: 200, unitPrice: 12, expiryDate: '2027-04-10' } // Low stock example
    ];

    for (const d of drugs) {
      batch.set(doc(db, 'pharmacyStock', d.id), d);
    }

    // Appointments
    const appointments = [
      {
        id: `${hospitalId}_a1`,
        hospitalId,
        patientId: `${hospitalId}_p1`,
        patientName: 'John Mwangi',
        doctorId: `doctor_${hospitalId}`,
        doctorName: 'Dr. Arthur Kamau',
        appointmentDate: new Date().toISOString().split('T')[0],
        timeSlot: '09:00 AM - 09:30 AM',
        status: 'Scheduled',
        symptoms: 'Persistent headache and occasional fever for 3 days',
        queueNumber: 1,
        consultationFee: 1500,
        createdAt: new Date().toISOString()
      },
      {
        id: `${hospitalId}_a2`,
        hospitalId,
        patientId: `${hospitalId}_p3`,
        patientName: 'David Omondi',
        doctorId: `doctor_${hospitalId}`,
        doctorName: 'Dr. Arthur Kamau',
        appointmentDate: new Date().toISOString().split('T')[0],
        timeSlot: '10:30 AM - 11:00 AM',
        status: 'Scheduled',
        symptoms: 'Routine diabetes check-up and drug renewal',
        queueNumber: 2,
        consultationFee: 1500,
        createdAt: new Date().toISOString()
      }
    ];

    for (const app of appointments) {
      batch.set(doc(db, 'appointments', app.id), app);
    }

    // Medical Records
    const records = [
      {
        id: `${hospitalId}_m1`,
        hospitalId,
        patientId: `${hospitalId}_p2`,
        patientName: 'Mary Wanjiku',
        doctorId: `doctor_${hospitalId}`,
        doctorName: 'Dr. Arthur Kamau',
        date: new Date().toISOString().split('T')[0],
        symptoms: 'Severe lower abdominal pain, pregnancy at 38 weeks',
        diagnosis: 'Active Labor',
        notes: 'Patient admitted to maternity ward Bed M-201. Fetal heart rate normal at 140 bpm. Contractions 3 in 10 mins.',
        prescriptions: [
          { drugName: 'Paracetamol 500mg', dosage: '1g', frequency: 'TDS (Three times a day)', duration: '5 days', status: 'Dispensed' }
        ],
        laboratoryRequests: [
          { testName: 'Full Blood Count (FBC)', result: 'Hb: 12.1 g/dL, WBC: 8.5 x10^9/L', status: 'Completed', requestedAt: new Date().toISOString(), completedAt: new Date().toISOString() }
        ],
        radiologyRequests: [
          { type: 'Ultrasound', notes: 'Obstetric scan to check fetal presentation', result: 'Single live fetus, cephalic presentation, adequate liquor.', status: 'Completed' }
        ],
        wardAdmission: { wardType: 'Maternity', bedNumber: 'M-201', admittedAt: new Date().toISOString() },
        createdAt: new Date().toISOString()
      }
    ];

    for (const r of records) {
      batch.set(doc(db, 'medicalRecords', r.id), r);
    }

    // Billing
    const billings = [
      {
        id: `${hospitalId}_b1`,
        hospitalId,
        patientId: `${hospitalId}_p1`,
        patientName: 'John Mwangi',
        items: [
          { description: 'Consultation Fee', amount: 1500, quantity: 1 },
          { description: 'Lab Test: Malaria Blood Slide', amount: 500, quantity: 1 },
          { description: 'Pharmacy: Coartem', amount: 600, quantity: 1 }
        ],
        totalAmount: 2600,
        insuranceClaimed: 2000,
        patientPaid: 600,
        status: 'Paid',
        paymentMethod: 'M-Pesa',
        invoiceDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      },
      {
        id: `${hospitalId}_b2`,
        hospitalId,
        patientId: `${hospitalId}_p2`,
        patientName: 'Mary Wanjiku',
        items: [
          { description: 'Maternity Admission Pack', amount: 12000, quantity: 1 },
          { description: 'Obstetric Ultrasound', amount: 2500, quantity: 1 },
          { description: 'Ward Bed Charge (Per Day)', amount: 3000, quantity: 2 }
        ],
        totalAmount: 20500,
        insuranceClaimed: 0,
        patientPaid: 0,
        status: 'Unpaid',
        paymentMethod: 'None',
        invoiceDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      }
    ];

    for (const b of billings) {
      batch.set(doc(db, 'billing', b.id), b);
    }

    // Set initial admittedPatientsCount to 1 since Mary Wanjiku is seeded as 'Admitted'
    batch.update(doc(db, 'hospitals', hospitalId), { admittedPatientsCount: 1 });

    await batch.commit();
    console.log(`Successfully seeded database records for hospital ${hospitalId}`);
  } catch (error) {
    console.error(`Error seeding records for hospital ${hospitalId}:`, error);
  }
}
