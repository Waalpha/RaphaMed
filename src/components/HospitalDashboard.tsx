import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Users, 
  Calendar, 
  FileText, 
  FlaskConical, 
  Pill, 
  DollarSign, 
  Bed, 
  Scissors, 
  Baby, 
  BarChart2, 
  Plus, 
  Check, 
  AlertCircle, 
  Eye, 
  MapPin, 
  User, 
  Heart, 
  Camera, 
  LogOut, 
  TrendingUp, 
  Clock, 
  ShieldAlert,
  Shield,
  Archive,
  RefreshCw,
  Printer,
  Settings,
  ShoppingCart,
  Trash2,
  PlusCircle
} from 'lucide-react';
import { 
  Hospital,
  UserProfile, 
  Patient, 
  Appointment, 
  MedicalRecord, 
  PharmacyStock, 
  WardBed, 
  Billing,
  DrugPrescription,
  LabRequest,
  RadiologyRequest,
  RolePermission
} from '../types';
import { 
  getPatients, 
  createPatient, 
  getAppointments, 
  createAppointment, 
  updateAppointmentStatus, 
  getMedicalRecords, 
  createMedicalRecord, 
  getPharmacyStock, 
  updatePharmacyStockQty, 
  createPharmacyStockItem, 
  deletePharmacyStockItem,
  getWardBeds, 
  updateWardBedStatus, 
  getBillingRecords, 
  createBillingRecord, 
  updateBillingPayment,
  updateMedicalRecord,
  getSystemSettings,
  getHospital,
  updateHospitalDetails,
  updatePatient,
  getRolePermissions,
  saveRolePermission,
  deleteRolePermission
} from '../services/dbService';
import { seedHospitalSpecificData } from '../seedData';

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  'Super Admin': ['dashboard', 'reception', 'consultation', 'laboratory', 'radiology', 'pharmacy', 'billing', 'wards', 'specialized', 'reports', 'settings'],
  'Hospital Admin': ['dashboard', 'reception', 'consultation', 'laboratory', 'radiology', 'pharmacy', 'billing', 'wards', 'specialized', 'reports', 'settings'],
  'Doctor': ['dashboard', 'consultation', 'wards', 'specialized', 'reports', 'settings'],
  'Nurse': ['dashboard', 'wards', 'specialized', 'reports'],
  'Receptionist': ['dashboard', 'reception', 'reports'],
  'Pharmacist': ['dashboard', 'pharmacy', 'reports'],
  'Laboratory': ['dashboard', 'laboratory', 'reports'],
  'Radiology': ['dashboard', 'radiology', 'reports'],
  'Accountant': ['dashboard', 'billing', 'reports'],
  'Cashier': ['dashboard', 'billing', 'reports'],
  'Records Officer': ['dashboard', 'reception', 'reports'],
  'Solo Practitioner': ['dashboard', 'reception', 'consultation', 'laboratory', 'radiology', 'pharmacy', 'billing', 'wards', 'specialized', 'reports', 'settings'],
};

interface HospitalDashboardProps {
  currentUser: UserProfile;
  hospitalName: string;
  onLogout: () => void;
}

export default function HospitalDashboard({ currentUser, hospitalName, onLogout }: HospitalDashboardProps) {
  const hospitalId = currentUser.hospitalId;

  // Global Tenant Data
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [stock, setStock] = useState<PharmacyStock[]>([]);
  const [beds, setBeds] = useState<WardBed[]>([]);
  const [billings, setBillings] = useState<Billing[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemLogo, setSystemLogo] = useState<string>('/logo.svg');
  const [hospitalDetails, setHospitalDetails] = useState<Hospital | null>(null);

  const displayedHospitalName = hospitalDetails?.name || hospitalName;
  const displayedAddress = hospitalDetails?.address || 'P.O. Box 4501-00100, Nairobi, Kenya';
  const displayedEmail = hospitalDetails?.email || 'health@raphajoymedical.com';
  const displayedPhone = hospitalDetails?.phone || '+254 700 800 900';
  const displayedWebsite = hospitalDetails?.website || 'www.raphajoymedical.com';
  const displayedLogoUrl = hospitalDetails?.logoUrl || '';
  const displayedNotes = hospitalDetails?.notes || '';
  const displayedTaxNumber = hospitalDetails?.taxNumber || '';

  // Active module tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Role & Permissions states
  const [rolePermissionsList, setRolePermissionsList] = useState<RolePermission[]>([]);
  const [editingRoleName, setEditingRoleName] = useState<string | null>(null);
  const [editingAllowedTabs, setEditingAllowedTabs] = useState<string[]>([]);
  const [newCustomRoleName, setNewCustomRoleName] = useState<string>('');

  // Forms / Intermediary States
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [patName, setPatName] = useState('');
  const [patAge, setPatAge] = useState('');
  const [patGender, setPatGender] = useState('Male');
  const [patContact, setPatContact] = useState('');
  const [patEmail, setPatEmail] = useState('');
  const [patAddress, setPatAddress] = useState('');
  const [patInsurance, setPatInsurance] = useState<'NHIF' | 'SHIF' | 'None' | 'Private'>('None');
  const [patInsuranceId, setPatInsuranceId] = useState('');

  // Appointment Form
  const [showAddApp, setShowAddApp] = useState(false);
  const [appPatientId, setAppPatientId] = useState('');
  const [appDocName, setAppDocName] = useState('Dr. Arthur Kamau');
  const [appDate, setAppDate] = useState('');
  const [appTime, setAppTime] = useState('09:00 AM - 09:30 AM');
  const [appSymptoms, setAppSymptoms] = useState('');
  const [appConsultationFee, setAppConsultationFee] = useState('1500');

  // Drug stock form
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [drugName, setDrugName] = useState('');
  const [drugQty, setDrugQty] = useState('');
  const [drugMinQty, setDrugMinQty] = useState('');
  const [drugPrice, setDrugPrice] = useState('');
  const [drugExpiry, setDrugExpiry] = useState('');
  const [isConfirmingEmptyStock, setIsConfirmingEmptyStock] = useState(false);

  // Doctor Consultation Form
  const [selectedConsultation, setSelectedConsultation] = useState<Appointment | null>(null);
  const [docDiagnosis, setDocDiagnosis] = useState('');
  const [docSymptoms, setDocSymptoms] = useState('');
  const [docNotes, setDocNotes] = useState('');
  
  // Doctor requests (accumulative in consultation)
  const [prescriptionsList, setPrescriptionsList] = useState<DrugPrescription[]>([]);
  const [pDrug, setPDrug] = useState('');
  const [pDosage, setPDosage] = useState('');
  const [pFrequency, setPFrequency] = useState('OD (Once daily)');
  const [pDuration, setPDuration] = useState('5 days');

  const [labTestsList, setLabTestsList] = useState<string[]>([]);
  const [selectedLabTest, setSelectedLabTest] = useState('');

  const [radioList, setRadioList] = useState<string[]>([]);
  const [selectedRadio, setSelectedRadio] = useState('');

  // Admissions and surgical items
  const [requireAdmission, setRequireAdmission] = useState(false);
  const [admWardType, setAdmWardType] = useState<'Maternity' | 'General' | 'ICU' | 'Pediatric'>('General');
  const [admBedNumber, setAdmBedNumber] = useState('');
  
  const [requireSurgery, setRequireSurgery] = useState(false);
  const [surgProcedure, setSurgProcedure] = useState('');
  const [surgNotes, setSurgNotes] = useState('');

  const [maternityNotes, setMaternityNotes] = useState('');
  const [maternityType, setMaternityType] = useState<'ANC' | 'Delivery' | 'PNC'>('ANC');

  // Billing modal
  const [selectedBilling, setSelectedBilling] = useState<Billing | null>(null);
  const [payMethod, setPayMethod] = useState<'Cash' | 'M-Pesa' | 'Insurance'>('M-Pesa');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [showReceipt, setShowReceipt] = useState<Billing | null>(null);
  const [receiptFormat, setReceiptFormat] = useState<'a4' | 'thermal'>('a4');

  const handleLaunchPrintWindow = (formatOverride?: 'a4' | 'thermal') => {
    const currentFormat = formatOverride || receiptFormat;
    if (!showReceipt) return;

    // Create a new browser tab with clean HTML that prints automatically.
    // This successfully bypasses the iframe sandboxing that blocks standard window.print().
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Print Window Blocked! Please allow popups for this site, or open the application in a new tab using the icon in the top right to print.");
      return;
    }

    const receipt = showReceipt;
    const itemsHTML = receipt.items && receipt.items.length > 0
      ? receipt.items.map(item => `
          <tr>
            <td style="padding: 6px 0; border-bottom: 1px dashed #e2e8f0;">${item.description}</td>
            <td style="padding: 6px 0; border-bottom: 1px dashed #e2e8f0;" class="text-right">KSh ${item.amount.toLocaleString()}</td>
            <td style="padding: 6px 0; border-bottom: 1px dashed #e2e8f0; text-align: center;">${item.quantity}</td>
            <td style="padding: 6px 0; border-bottom: 1px dashed #e2e8f0;" class="text-right font-bold">KSh ${(item.amount * item.quantity).toLocaleString()}</td>
          </tr>
        `).join('')
      : `
          <tr>
            <td style="padding: 6px 0; border-bottom: 1px dashed #e2e8f0;">Standard Consultation Fee</td>
            <td style="padding: 6px 0; border-bottom: 1px dashed #e2e8f0;" class="text-right">KSh ${receipt.totalAmount.toLocaleString()}</td>
            <td style="padding: 6px 0; border-bottom: 1px dashed #e2e8f0; text-align: center;">1</td>
            <td style="padding: 6px 0; border-bottom: 1px dashed #e2e8f0;" class="text-right font-bold">KSh ${receipt.totalAmount.toLocaleString()}</td>
          </tr>
        `;

    const insuranceClaimedHTML = receipt.insuranceClaimed > 0
      ? `
        <div class="total-row" style="color: #4f46e5; font-weight: 600;">
          <span>SHIF / NHIF Cover:</span>
          <span>- KSh ${receipt.insuranceClaimed.toLocaleString()}</span>
        </div>
      `
      : '';

    const outstandingBalance = Math.max(0, receipt.totalAmount - receipt.insuranceClaimed - receipt.patientPaid);

    const logoHTML = systemLogo
      ? `<img src="${systemLogo}" alt="Logo" class="logo-img" />`
      : `<div class="logo-fallback" style="background-color: #10b981; width: 48px; height: 48px; border-radius: 12px; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; margin: 0 auto;">✚</div>`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - ${receipt.id}</title>
  <style>
    /* Clean Print Stylesheet */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      background: #f1f5f9;
      padding: 30px 15px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .receipt-card {
      max-width: 550px;
      margin: 0 auto;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      padding: 35px;
      background: #ffffff;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
    }

    /* 80mm Thermal POS Receipt Layout Override */
    body.thermal {
      padding: 0;
      width: 76mm;
      background: #ffffff;
    }
    body.thermal .receipt-card {
      border: none;
      border-radius: 0;
      padding: 5mm 2mm;
      max-width: 100%;
      box-shadow: none;
    }
    body.thermal .logo-img {
      max-height: 40px !important;
      max-width: 40px !important;
    }
    body.thermal .dashed-line {
      border-top: 1px dashed #000000 !important;
      margin: 10px 0;
    }
    body.thermal .info-grid {
      grid-template-columns: 1fr;
      background: none;
      border: none;
      padding: 0;
      gap: 3px;
      font-size: 11px;
    }
    body.thermal .table {
      font-size: 11px;
    }
    body.thermal .table td {
      border-bottom: 1px dashed #000000 !important;
      padding: 4px 0;
    }
    body.thermal .totals-box {
      max-width: 100%;
      font-size: 11px;
    }
    body.thermal .grand-total {
      font-size: 12px;
      border-top: 1px dashed #000000 !important;
    }
    body.thermal .signatures {
      margin-top: 15px;
    }
    body.thermal .footer-stamp {
      font-size: 9px;
      padding: 2px 6px;
    }

    /* Typography & Utilities */
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-extrabold { font-weight: 800; }
    
    .logo-container {
      margin-bottom: 10px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .logo-img {
      max-height: 64px;
      max-width: 64px;
      object-fit: contain;
    }
    
    .title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 4px;
      letter-spacing: -0.02em;
    }
    .subtitle {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #059669;
      margin-top: 2px;
    }
    .header-details {
      font-size: 10px;
      color: #64748b;
      margin-top: 4px;
      line-height: 1.4;
    }
    
    .dashed-line {
      border-top: 1px dashed #cbd5e1;
      margin: 15px 0;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      font-size: 11.5px;
      color: #475569;
      background-color: #f8fafc;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      margin-bottom: 15px;
    }
    
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 11.5px;
    }
    .table th {
      border-bottom: 1px solid #cbd5e1;
      padding: 6px 0;
      color: #64748b;
      font-weight: 700;
      font-size: 9.5px;
      text-transform: uppercase;
      text-align: left;
    }
    .table td {
      padding: 8px 0;
    }
    
    .totals-box {
      margin-top: 15px;
      margin-left: auto;
      max-width: 260px;
      font-size: 11.5px;
      color: #475569;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
    }
    .grand-total {
      border-top: 1px solid #cbd5e1;
      padding-top: 6px;
      color: #047857;
      font-size: 13px;
      font-weight: 800;
      margin-top: 6px;
    }

    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 9999px;
      font-size: 9px;
      font-weight: bold;
      border: 1px solid #a7f3d0;
      background-color: #ecfdf5;
      color: #065f46;
    }
    
    .footer-stamp {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid #34d399;
      background-color: #f0fdf4;
      color: #065f46;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 3px 10px;
      border-radius: 6px;
      margin: 15px auto;
    }
    
    .signatures {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #94a3b8;
      margin-top: 30px;
    }
    .sig-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .sig-line {
      width: 100px;
      border-bottom: 1px solid #cbd5e1;
      margin-bottom: 3px;
    }

    /* Print Specific Tweaks */
    @media print {
      body {
        padding: 0;
        background: #ffffff;
      }
      .receipt-card {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      @page {
        margin: 10mm;
      }
      body.thermal @page {
        size: 80mm auto;
        margin: 0;
      }
    }
  </style>
</head>
<body class="${currentFormat === 'thermal' ? 'thermal' : ''}">
  <div class="receipt-card">
    <!-- Header -->
    <div class="text-center">
      <div class="logo-container">
        ${logoHTML}
      </div>
      <h2 class="title">${displayedHospitalName}</h2>
      <p class="subtitle">Official Patient Receipt</p>
      <div class="header-details">
        <p>${displayedAddress}</p>
        <p>Email: ${displayedEmail} | Phone: ${displayedPhone}${displayedWebsite ? ` | Web: ${displayedWebsite}` : ''}</p>
        ${displayedTaxNumber ? `<p style="margin-top: 2px; font-size: 8px;">Tax ID: ${displayedTaxNumber}</p>` : ''}
      </div>
    </div>

    <div class="dashed-line"></div>

    <!-- Info Grid -->
    <div class="info-grid">
      <div>
        <p style="margin-bottom: 3px;"><span style="color: #94a3b8;">Receipt Ref:</span> <strong class="font-mono" style="color: #334155; text-transform: uppercase;">${receipt.id}</strong></p>
        <p style="margin-bottom: 3px;"><span style="color: #94a3b8;">Date Issued:</span> <strong style="color: #334155;">${receipt.invoiceDate || new Date(receipt.createdAt).toLocaleDateString()}</strong></p>
        <p><span style="color: #94a3b8;">Payment Mode:</span> <strong style="color: #334155;">${receipt.paymentMethod || 'M-Pesa'}</strong></p>
      </div>
      <div style="text-align: right;">
        <p style="margin-bottom: 3px;"><span style="color: #94a3b8;">Patient:</span> <strong style="color: #0f172a;">${receipt.patientName}</strong></p>
        <p style="margin-bottom: 3px;"><span style="color: #94a3b8;">Patient EMR:</span> <span class="font-mono" style="color: #334155;">${receipt.patientId}</span></p>
        <p><span style="color: #94a3b8;">Status:</span> <span class="badge">${receipt.status}</span></p>
      </div>
    </div>

    <!-- Items -->
    <table class="table">
      <thead>
        <tr>
          <th style="width: 50%;">Description</th>
          <th class="text-right" style="width: 20%;">Price</th>
          <th style="text-align: center; width: 10%;">Qty</th>
          <th class="text-right" style="width: 20%;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals-box">
      <div class="total-row">
        <span style="color: #94a3b8;">Total Invoice:</span>
        <span class="font-semibold" style="color: #334155;">KSh ${receipt.totalAmount.toLocaleString()}</span>
      </div>
      ${insuranceClaimedHTML}
      <div class="total-row grand-total">
        <span>Amount Paid:</span>
        <span>KSh ${receipt.patientPaid.toLocaleString()}</span>
      </div>
      <div class="total-row" style="margin-top: 5px; border-top: 1px dashed #cbd5e1; padding-top: 5px; color: #64748b; font-size: 10px;">
        <span>Outstanding:</span>
        <span class="font-mono">KSh ${outstandingBalance.toLocaleString()}</span>
      </div>
    </div>

    <div class="dashed-line"></div>

    <!-- Footer -->
    <div class="text-center" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div class="footer-stamp">
        ✓ Paid & Cleared
      </div>
      <p style="font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 2px;">Thank you for your visit!</p>
      <p style="font-size: 9.5px; color: #94a3b8; font-style: italic;">Get well soon • Compassionate Care</p>
    </div>

    <!-- Signatures -->
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line"></div>
        <span>Patient Signature</span>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <span>Cashier Stamp</span>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      window.focus();
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Lab testing results form
  const [selectedLabRecord, setSelectedLabRecord] = useState<MedicalRecord | null>(null);
  const [selectedLabIndex, setSelectedLabIndex] = useState<number>(-1);
  const [labResultText, setLabResultText] = useState('');

  // Radiology imaging result form
  const [selectedRadioRecord, setSelectedRadioRecord] = useState<MedicalRecord | null>(null);
  const [selectedRadioIndex, setSelectedRadioIndex] = useState<number>(-1);
  const [radioResultText, setRadioResultText] = useState('');

  // Hospital Profile & Settings States
  const [settingsName, setSettingsName] = useState('');
  const [settingsAddress, setSettingsAddress] = useState('');
  const [settingsPhone, setSettingsPhone] = useState('');
  const [settingsEmail, setSettingsEmail] = useState('');
  const [settingsWebsite, setSettingsWebsite] = useState('');
  const [settingsTaxNumber, setSettingsTaxNumber] = useState('');
  const [settingsNotes, setSettingsNotes] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState('');

  // Direct Order Desk States
  const [showDirectOrderModal, setShowDirectOrderModal] = useState(false);
  const [orderPatientId, setOrderPatientId] = useState('');
  const [orderItems, setOrderItems] = useState<{
    id: string;
    description: string;
    amount: number;
    quantity: number;
    category: 'Consultation' | 'Medicine' | 'Lab' | 'Radiology' | 'Ward' | 'Theatre & Maternity' | 'Other';
    detailName?: string;
    dosage?: string;
    frequency?: string;
  }[]>([]);

  // Item form states inside modal
  const [selectedItemCategory, setSelectedItemCategory] = useState<'Consultation' | 'Medicine' | 'Lab' | 'Radiology' | 'Ward' | 'Theatre & Maternity' | 'Other'>('Medicine');
  const [selectedConsultationType, setSelectedConsultationType] = useState('');
  const [selectedStockDrugId, setSelectedStockDrugId] = useState('');
  const [selectedCommonLabTest, setSelectedCommonLabTest] = useState('');
  const [selectedCommonRadioScan, setSelectedCommonRadioScan] = useState('');
  const [selectedWardType, setSelectedWardType] = useState('');
  const [selectedTheatreProcedure, setSelectedTheatreProcedure] = useState('');
  const [customItemDesc, setCustomItemDesc] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [editablePrice, setEditablePrice] = useState('');
  const [orderItemQty, setOrderItemQty] = useState('1');
  const [orderDrugDosage, setOrderDrugDosage] = useState('500mg');
  const [orderDrugFrequency, setOrderDrugFrequency] = useState('BD (Twice daily)');

  // Automate price sync on item selection to let user edit it
  useEffect(() => {
    if (selectedItemCategory === 'Consultation') {
      if (selectedConsultationType === 'General Practitioner Consultation') setEditablePrice('1000');
      else if (selectedConsultationType === 'Specialist Consultation') setEditablePrice('3000');
      else if (selectedConsultationType === 'Pediatric Consultation') setEditablePrice('1500');
      else if (selectedConsultationType === 'Dental Consultation') setEditablePrice('1500');
      else if (selectedConsultationType === 'Other Consultation Fee') setEditablePrice('1000');
      else setEditablePrice('');
    } else if (selectedItemCategory === 'Medicine') {
      const dObj = stock.find(d => d.id === selectedStockDrugId);
      if (dObj) {
        setEditablePrice((dObj.unitPrice * 10).toString());
      } else {
        setEditablePrice('');
      }
    } else if (selectedItemCategory === 'Lab') {
      if (selectedCommonLabTest === 'Malaria Blood Smear') setEditablePrice('500');
      else if (selectedCommonLabTest === 'Full Blood Count') setEditablePrice('800');
      else if (selectedCommonLabTest === 'Urinalysis') setEditablePrice('400');
      else if (selectedCommonLabTest === 'Blood Glucose') setEditablePrice('300');
      else if (selectedCommonLabTest === 'Lipid Profile') setEditablePrice('1200');
      else if (selectedCommonLabTest === 'Renal Function Test') setEditablePrice('1500');
      else if (selectedCommonLabTest === 'Other Laboratory Test') setEditablePrice('500');
      else setEditablePrice('');
    } else if (selectedItemCategory === 'Radiology') {
      if (selectedCommonRadioScan === 'Chest X-Ray') setEditablePrice('1500');
      else if (selectedCommonRadioScan === 'Abdominal Ultrasound') setEditablePrice('2000');
      else if (selectedCommonRadioScan === 'Pelvic Scan') setEditablePrice('1800');
      else if (selectedCommonRadioScan === 'CT Brain Scan') setEditablePrice('6500');
      else if (selectedCommonRadioScan === 'MRI Scan') setEditablePrice('12000');
      else if (selectedCommonRadioScan === 'Other Scan / Imaging') setEditablePrice('2000');
      else setEditablePrice('');
    } else if (selectedItemCategory === 'Ward') {
      if (selectedWardType === 'General Ward') setEditablePrice('1000');
      else if (selectedWardType === 'Maternity Ward') setEditablePrice('1500');
      else if (selectedWardType === 'ICU Ward') setEditablePrice('3000');
      else if (selectedWardType === 'Pediatric Ward') setEditablePrice('1000');
      else setEditablePrice('');
    } else if (selectedItemCategory === 'Theatre & Maternity') {
      if (selectedTheatreProcedure === 'Normal Delivery') setEditablePrice('15000');
      else if (selectedTheatreProcedure === 'C-Section Delivery') setEditablePrice('50000');
      else if (selectedTheatreProcedure === 'Minor Surgery') setEditablePrice('10000');
      else if (selectedTheatreProcedure === 'Major Surgery') setEditablePrice('45000');
      else if (selectedTheatreProcedure === 'Maternity Package') setEditablePrice('25000');
      else setEditablePrice('');
    } else {
      setEditablePrice('');
    }
  }, [
    selectedItemCategory,
    selectedConsultationType,
    selectedStockDrugId,
    selectedCommonLabTest,
    selectedCommonRadioScan,
    selectedWardType,
    selectedTheatreProcedure,
    stock
  ]);

  // Patient Clinical Discharge States
  const [dischargeConfirmBed, setDischargeConfirmBed] = useState<WardBed | null>(null);
  const [isDischarging, setIsDischarging] = useState(false);

  useEffect(() => {
    if (hospitalDetails) {
      setSettingsName(hospitalDetails.name || '');
      setSettingsAddress(hospitalDetails.address || '');
      setSettingsPhone(hospitalDetails.phone || '');
      setSettingsEmail(hospitalDetails.email || '');
      setSettingsWebsite(hospitalDetails.website || '');
      setSettingsTaxNumber(hospitalDetails.taxNumber || '');
      setSettingsNotes(hospitalDetails.notes || '');
    }
  }, [hospitalDetails]);

  useEffect(() => {
    fetchTenantData();
  }, [hospitalId]);

  async function fetchTenantData() {
    setLoading(true);
    try {
      const [pList, aList, mList, sList, bList, billList, settings, hospInfo, rPerms] = await Promise.all([
        getPatients(hospitalId),
        getAppointments(hospitalId),
        getMedicalRecords(hospitalId),
        getPharmacyStock(hospitalId),
        getWardBeds(hospitalId),
        getBillingRecords(hospitalId),
        getSystemSettings().catch(() => null),
        getHospital(hospitalId).catch(() => null),
        getRolePermissions(hospitalId).catch(() => [])
      ]);

      if (hospInfo) {
        setHospitalDetails(hospInfo);
      }

      if (rPerms) {
        setRolePermissionsList(rPerms);
      }

      if (pList.length === 0) {
        console.log(`Self-healing: Seeding hospital-specific dataset dynamically for hospital tenant: ${hospitalId}`);
        await seedHospitalSpecificData(hospitalId);
        
        // Re-fetch all seeded collections
        const [newPList, newAList, newMList, newSList, newBList, newBillList, newRPerms] = await Promise.all([
          getPatients(hospitalId),
          getAppointments(hospitalId),
          getMedicalRecords(hospitalId),
          getPharmacyStock(hospitalId),
          getWardBeds(hospitalId),
          getBillingRecords(hospitalId),
          getRolePermissions(hospitalId).catch(() => [])
        ]);

        setPatients(newPList);
        setAppointments(newAList);
        setRecords(newMList);
        setStock(newSList);
        setBeds(newBList);
        setBillings(newBillList);
        if (newRPerms) {
          setRolePermissionsList(newRPerms);
        }
      } else {
        setPatients(pList);
        setAppointments(aList);
        setRecords(mList);
        setStock(sList);
        setBeds(bList);
        setBillings(billList);
      }

      if (settings && settings.logo) {
        setSystemLogo(settings.logo);
      } else {
        setSystemLogo('/logo.svg');
      }
    } catch (e) {
      console.error("Error during clinical workspace fetching or seeding:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settingsName) return;
    setIsSavingSettings(true);
    setSettingsSuccessMsg('');
    try {
      const code = hospitalDetails?.code || 'RJMC';
      await updateHospitalDetails(hospitalId, settingsName, code, {
        address: settingsAddress,
        phone: settingsPhone,
        email: settingsEmail,
        website: settingsWebsite,
        taxNumber: settingsTaxNumber,
        notes: settingsNotes
      });
      setHospitalDetails(prev => {
        if (!prev) return null;
        return {
          ...prev,
          name: settingsName,
          address: settingsAddress,
          phone: settingsPhone,
          email: settingsEmail,
          website: settingsWebsite,
          taxNumber: settingsTaxNumber,
          notes: settingsNotes
        };
      });
      setSettingsSuccessMsg('Clinic settings updated successfully! Receipt profiles and header nodes are synchronized.');
      setTimeout(() => setSettingsSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  }

  // Permissions gate
  const isAllowed = (allowedRoles: UserProfile['role'][]) => {
    // Super Admins have absolute master privileges
    if (currentUser.role === 'Super Admin') return true;

    // Resolve which tab/feature this check represents
    let tabId = '';
    if (allowedRoles.includes('Receptionist')) tabId = 'reception';
    else if (allowedRoles.includes('Pharmacist')) tabId = 'pharmacy';
    else if (allowedRoles.includes('Laboratory')) tabId = 'laboratory';
    else if (allowedRoles.includes('Radiology')) tabId = 'radiology';
    else if (allowedRoles.includes('Accountant') || allowedRoles.includes('Cashier')) tabId = 'billing';
    else if (allowedRoles.includes('Doctor') && allowedRoles.includes('Nurse')) tabId = 'specialized';
    else if (allowedRoles.includes('Nurse')) tabId = 'wards';
    else if (allowedRoles.includes('Doctor')) tabId = 'consultation';

    // If there is a custom or modified role permission in the Firestore database
    const userRolePermission = rolePermissionsList.find(rp => rp.roleName === currentUser.role);
    if (userRolePermission && tabId) {
      return userRolePermission.allowedTabs.includes(tabId);
    }

    // Default hardcoded fallback
    if (currentUser.role === 'Solo Practitioner') {
      const soloRoles: UserProfile['role'][] = ['Doctor', 'Receptionist', 'Pharmacist', 'Cashier', 'Accountant', 'Records Officer'];
      if (allowedRoles.some(r => soloRoles.includes(r))) {
        return true;
      }
    }
    return currentUser.role === 'Hospital Admin' || allowedRoles.includes(currentUser.role);
  };

  // ----------------------------------------------------
  // SUB-MODULE ACTIONS
  // ----------------------------------------------------

  async function handleRegisterPatient(e: React.FormEvent) {
    e.preventDefault();
    if (!patName || !patAge || !patGender) return;

    try {
      await createPatient({
        hospitalId,
        name: patName,
        age: parseInt(patAge),
        gender: patGender,
        contact: patContact,
        email: patEmail,
        address: patAddress,
        insuranceType: patInsurance,
        insuranceId: patInsuranceId,
        status: 'Active'
      });

      setShowAddPatient(false);
      setPatName('');
      setPatAge('');
      setPatContact('');
      setPatEmail('');
      setPatAddress('');
      setPatInsuranceId('');
      setPatInsurance('None');
      await fetchTenantData();
    } catch (err) {
      alert('Error registering patient: ' + err);
    }
  }

  async function handleBookAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!appPatientId || !appDate) return;

    const patientObj = patients.find(p => p.id === appPatientId);
    if (!patientObj) return;

    try {
      // Calculate queue number
      const dayApps = appointments.filter(a => a.appointmentDate === appDate);
      const queueNo = dayApps.length + 1;

      await createAppointment({
        hospitalId,
        patientId: appPatientId,
        patientName: patientObj.name,
        doctorId: `doctor_${hospitalId}`,
        doctorName: appDocName,
        appointmentDate: appDate,
        timeSlot: appTime,
        status: 'Scheduled',
        symptoms: appSymptoms,
        queueNumber: queueNo,
        consultationFee: parseFloat(appConsultationFee) || 1500
      });

      setShowAddApp(false);
      setAppPatientId('');
      setAppSymptoms('');
      setAppConsultationFee('1500');
      await fetchTenantData();
    } catch (err) {
      alert('Error booking appointment: ' + err);
    }
  }

  function handleAddPrescription() {
    if (!pDrug) return;
    setPrescriptionsList([...prescriptionsList, {
      drugName: pDrug,
      dosage: pDosage,
      frequency: pFrequency,
      duration: pDuration,
      status: 'Pending'
    }]);
    setPDrug('');
    setPDosage('');
  }

  function handleAddLabRequest() {
    if (!selectedLabTest) return;
    if (!labTestsList.includes(selectedLabTest)) {
      setLabTestsList([...labTestsList, selectedLabTest]);
    }
    setSelectedLabTest('');
  }

  function handleAddRadioRequest() {
    if (!selectedRadio) return;
    if (!radioList.includes(selectedRadio)) {
      setRadioList([...radioList, selectedRadio]);
    }
    setSelectedRadio('');
  }

  async function handleConsultationSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConsultation) return;

    try {
      // 1. Create medical record
      const clinicalRecord = await createMedicalRecord({
        hospitalId,
        patientId: selectedConsultation.patientId,
        patientName: selectedConsultation.patientName,
        doctorId: selectedConsultation.doctorId,
        doctorName: selectedConsultation.doctorName,
        date: new Date().toISOString().split('T')[0],
        diagnosis: docDiagnosis,
        symptoms: docSymptoms || selectedConsultation.symptoms,
        notes: docNotes,
        prescriptions: prescriptionsList,
        laboratoryRequests: labTestsList.map(t => ({ testName: t, status: 'Pending', requestedAt: new Date().toISOString() })),
        radiologyRequests: radioList.map(r => ({ type: r as any, status: 'Pending' })),
        wardAdmission: requireAdmission ? {
          wardType: admWardType,
          bedNumber: admBedNumber,
          admittedAt: new Date().toISOString()
        } : undefined,
        theatreNotes: requireSurgery ? {
          procedureName: surgProcedure,
          surgeon: selectedConsultation.doctorName,
          findings: surgNotes,
          status: 'Scheduled'
        } : undefined,
        maternityNotes: (maternityNotes.trim().length > 0) ? {
          type: maternityType,
          notes: maternityNotes
        } : undefined
      });

      // 2. Set Bed occupied if admitted
      if (requireAdmission && admBedNumber) {
        const bedObj = beds.find(b => b.bedNumber === admBedNumber && b.wardType === admWardType);
        if (bedObj) {
          await updateWardBedStatus(bedObj.id, 'Occupied', selectedConsultation.patientId, selectedConsultation.patientName);
        }
      }

      // 3. Mark appointment complete
      await updateAppointmentStatus(selectedConsultation.id, 'Completed');

      // 4. Create Billing record automatically
      const consultFee = selectedConsultation.consultationFee !== undefined ? selectedConsultation.consultationFee : 1500;
      let totalAmount = consultFee;
      const billingItems = [{ description: 'Consultation Fee', amount: consultFee, quantity: 1 }];

      // Add medication costs
      prescriptionsList.forEach(p => {
        const dObj = stock.find(d => d.drugName.toLowerCase() === p.drugName.toLowerCase());
        const cost = dObj ? dObj.unitPrice * 10 : 250; // generic medication calculation
        totalAmount += cost;
        billingItems.push({ description: `Medication: ${p.drugName}`, amount: cost, quantity: 1 });
      });

      // Add lab costs
      labTestsList.forEach(t => {
        totalAmount += 500;
        billingItems.push({ description: `Laboratory Test: ${t}`, amount: 500, quantity: 1 });
      });

      // Add scan costs
      radioList.forEach(r => {
        totalAmount += 2000;
        billingItems.push({ description: `Imaging Scan: ${r}`, amount: 2000, quantity: 1 });
      });

      // Add Ward costs if admitted
      if (requireAdmission) {
        totalAmount += 3000;
        billingItems.push({ description: `${admWardType} Ward Admission Fee`, amount: 3000, quantity: 1 });
      }

      // Determine insurance coverage
      const patientObj = patients.find(p => p.id === selectedConsultation.patientId);
      let claimedInsurance = 0;
      if (patientObj && (patientObj.insuranceType === 'NHIF' || patientObj.insuranceType === 'SHIF')) {
        claimedInsurance = Math.min(totalAmount, 3000); // KSh 3,000 national health subsidy capping
      } else if (patientObj && patientObj.insuranceType === 'Private') {
        claimedInsurance = Math.round(totalAmount * 0.8); // 80% private insurance coverage
      }

      await createBillingRecord({
        hospitalId,
        patientId: selectedConsultation.patientId,
        patientName: selectedConsultation.patientName,
        items: billingItems,
        totalAmount,
        insuranceClaimed: claimedInsurance,
        patientPaid: 0,
        status: claimedInsurance >= totalAmount ? 'Paid' : 'Unpaid',
        invoiceDate: new Date().toISOString().split('T')[0]
      });

      // Reset consultation state
      setSelectedConsultation(null);
      setDocDiagnosis('');
      setDocSymptoms('');
      setDocNotes('');
      setPrescriptionsList([]);
      setLabTestsList([]);
      setRadioList([]);
      setRequireAdmission(false);
      setRequireSurgery(false);
      setMaternityNotes('');
      await fetchTenantData();
      alert('Consultation saved successfully! Clinical record filed, and invoice sent to billing.');
    } catch (err) {
      console.error(err);
      alert('Error finalizing consultation: ' + err);
    }
  }

  function handleAddOrderItem() {
    if (selectedItemCategory === 'Consultation') {
      if (!selectedConsultationType) {
        alert("Please select a consultation type.");
        return;
      }
      const qty = parseInt(orderItemQty) || 1;
      const amount = parseFloat(editablePrice) || 0;
      setOrderItems([...orderItems, {
        id: `item_${Date.now()}`,
        description: `Consultation: ${selectedConsultationType}`,
        amount: amount,
        quantity: qty,
        category: 'Consultation',
        detailName: selectedConsultationType
      }]);
      setSelectedConsultationType('');
    } else if (selectedItemCategory === 'Medicine') {
      const dObj = stock.find(d => d.id === selectedStockDrugId);
      if (!dObj) {
        alert("Please select a medicine.");
        return;
      }
      const qty = parseInt(orderItemQty) || 1;
      const amount = parseFloat(editablePrice) || 0;
      
      setOrderItems([...orderItems, {
        id: `item_${Date.now()}`,
        description: `Medication: ${dObj.drugName} (${orderDrugDosage}, ${orderDrugFrequency})`,
        amount: amount,
        quantity: qty,
        category: 'Medicine',
        detailName: dObj.drugName,
        dosage: orderDrugDosage,
        frequency: orderDrugFrequency
      }]);
      setSelectedStockDrugId('');
    } else if (selectedItemCategory === 'Lab') {
      if (!selectedCommonLabTest) {
        alert("Please select a laboratory test.");
        return;
      }
      const qty = parseInt(orderItemQty) || 1;
      const amount = parseFloat(editablePrice) || 0;
      
      setOrderItems([...orderItems, {
        id: `item_${Date.now()}`,
        description: `Laboratory Test: ${selectedCommonLabTest}`,
        amount: amount,
        quantity: qty,
        category: 'Lab',
        detailName: selectedCommonLabTest
      }]);
      setSelectedCommonLabTest('');
    } else if (selectedItemCategory === 'Radiology') {
      if (!selectedCommonRadioScan) {
        alert("Please select a radiology scan.");
        return;
      }
      const qty = parseInt(orderItemQty) || 1;
      const amount = parseFloat(editablePrice) || 0;
      
      setOrderItems([...orderItems, {
        id: `item_${Date.now()}`,
        description: `Imaging Scan: ${selectedCommonRadioScan}`,
        amount: amount,
        quantity: qty,
        category: 'Radiology',
        detailName: selectedCommonRadioScan
      }]);
      setSelectedCommonRadioScan('');
    } else if (selectedItemCategory === 'Ward') {
      if (!selectedWardType) {
        alert("Please select a ward type.");
        return;
      }
      const qty = parseInt(orderItemQty) || 1;
      const amount = parseFloat(editablePrice) || 0;
      
      setOrderItems([...orderItems, {
        id: `item_${Date.now()}`,
        description: `Ward Bed Allocation: ${selectedWardType} (${qty} days)`,
        amount: amount,
        quantity: qty,
        category: 'Ward',
        detailName: selectedWardType
      }]);
      setSelectedWardType('');
    } else if (selectedItemCategory === 'Theatre & Maternity') {
      if (!selectedTheatreProcedure) {
        alert("Please select a procedure.");
        return;
      }
      const qty = parseInt(orderItemQty) || 1;
      const amount = parseFloat(editablePrice) || 0;
      
      setOrderItems([...orderItems, {
        id: `item_${Date.now()}`,
        description: `Theatre & Maternity: ${selectedTheatreProcedure}`,
        amount: amount,
        quantity: qty,
        category: 'Theatre & Maternity',
        detailName: selectedTheatreProcedure
      }]);
      setSelectedTheatreProcedure('');
    } else {
      // Other
      if (!customItemDesc || !customItemPrice) {
        alert("Please enter custom item description and price.");
        return;
      }
      const qty = parseInt(orderItemQty) || 1;
      const amount = parseFloat(customItemPrice) || 0;
      setOrderItems([...orderItems, {
        id: `item_${Date.now()}`,
        description: customItemDesc,
        amount: amount,
        quantity: qty,
        category: 'Other'
      }]);
      setCustomItemDesc('');
      setCustomItemPrice('');
    }
    setOrderItemQty('1');
    setEditablePrice('');
  }

  function handleRemoveOrderItem(id: string) {
    setOrderItems(orderItems.filter(item => item.id !== id));
  }

  async function handleSubmitDirectOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!orderPatientId) {
      alert("Please select a patient.");
      return;
    }
    if (orderItems.length === 0) {
      alert("Please add at least one item to the order.");
      return;
    }

    try {
      const patientObj = patients.find(p => p.id === orderPatientId);
      if (!patientObj) {
        alert("Patient not found.");
        return;
      }

      // 1. Calculate total amount
      let totalAmount = 0;
      const billingItems = orderItems.map(item => {
        totalAmount += item.amount * item.quantity;
        return {
          description: item.description,
          amount: item.amount,
          quantity: item.quantity
        };
      });

      // 2. Determine insurance coverage
      let claimedInsurance = 0;
      if (patientObj.insuranceType === 'NHIF' || patientObj.insuranceType === 'SHIF') {
        claimedInsurance = Math.min(totalAmount, 3000); // KSh 3,000 national health subsidy capping
      } else if (patientObj.insuranceType === 'Private') {
        claimedInsurance = Math.round(totalAmount * 0.8); // 80% private insurance coverage
      }

      // 3. Create Billing Record (Goes straight to Cashier!)
      await createBillingRecord({
        hospitalId,
        patientId: orderPatientId,
        patientName: patientObj.name,
        items: billingItems,
        totalAmount,
        insuranceClaimed: claimedInsurance,
        patientPaid: 0,
        status: claimedInsurance >= totalAmount ? 'Paid' : 'Unpaid',
        invoiceDate: new Date().toISOString().split('T')[0]
      });

      // 4. Create Medical Record to dispatch clinical requests to Pharmacy/Lab/Radiology if any
      const rxItems = orderItems.filter(item => item.category === 'Medicine');
      const labItems = orderItems.filter(item => item.category === 'Lab');
      const radItems = orderItems.filter(item => item.category === 'Radiology');

      if (rxItems.length > 0 || labItems.length > 0 || radItems.length > 0) {
        await createMedicalRecord({
          hospitalId,
          patientId: orderPatientId,
          patientName: patientObj.name,
          doctorId: currentUser.id,
          doctorName: currentUser.name || 'Direct Order Desk',
          date: new Date().toISOString().split('T')[0],
          diagnosis: 'Direct Outpatient Order',
          symptoms: 'Outpatient walk-in / order request',
          notes: 'Filed via Clinical Order & Billings Hub.',
          prescriptions: rxItems.map(item => ({
            drugName: item.detailName || '',
            dosage: item.dosage || '500mg',
            frequency: item.frequency || 'BD (Twice daily)',
            duration: '5 days',
            status: 'Pending'
          })),
          laboratoryRequests: labItems.map(item => ({
            testName: item.detailName || '',
            status: 'Pending',
            requestedAt: new Date().toISOString()
          })),
          radiologyRequests: radItems.map(item => ({
            type: item.detailName as any,
            status: 'Pending'
          }))
        });
      }

      // Reset state
      setShowDirectOrderModal(false);
      setOrderPatientId('');
      setOrderItems([]);
      await fetchTenantData();
      alert(`Order successfully processed! Bill routed to Cashier under patient ${patientObj.name}. Clinical work orders dispatched to laboratory and pharmacy.`);
    } catch (err) {
      console.error(err);
      alert('Error processing order: ' + err);
    }
  }

  async function handleDispenseDrug(record: MedicalRecord, prescriptionIndex: number) {
    const rx = record.prescriptions?.[prescriptionIndex];
    if (!rx) return;

    try {
      const drugInStock = stock.find(d => d.drugName.toLowerCase() === rx.drugName.toLowerCase());
      if (drugInStock && drugInStock.quantity <= 0) {
        alert(`Medicine '${rx.drugName}' is currently OUT OF STOCK.`);
        return;
      }

      // Decrement stock in DB
      if (drugInStock) {
        await updatePharmacyStockQty(drugInStock.id, -15); // Dispense standard count
      }

      // Update prescription state in medicalRecord
      const updatedPrescriptions = [...(record.prescriptions || [])];
      updatedPrescriptions[prescriptionIndex].status = 'Dispensed';

      await updateMedicalRecord(record.id, { prescriptions: updatedPrescriptions });
      await fetchTenantData();
      alert(`Successfully dispensed ${rx.drugName}!`);
    } catch (e) {
      alert('Dispense failed: ' + e);
    }
  }

  async function handleAddStockItem(e: React.FormEvent) {
    e.preventDefault();
    if (!drugName || !drugQty || !drugPrice) return;

    try {
      await createPharmacyStockItem({
        hospitalId,
        drugName,
        quantity: parseInt(drugQty),
        minQuantity: parseInt(drugMinQty) || 50,
        unitPrice: parseFloat(drugPrice),
        expiryDate: drugExpiry || '2028-12-01'
      });

      setShowAddDrug(false);
      setDrugName('');
      setDrugQty('');
      setDrugMinQty('');
      setDrugPrice('');
      setDrugExpiry('');
      await fetchTenantData();
    } catch (e) {
      alert('Error: ' + e);
    }
  }

  async function handleEmptyPharmacyStock() {
    try {
      setLoading(true);
      for (const item of stock) {
        await deletePharmacyStockItem(item.id);
      }
      await fetchTenantData();
      setIsConfirmingEmptyStock(false);
      alert("Pharmacy stock emptied successfully! You can now add your custom stock.");
    } catch (e) {
      alert("Failed to empty pharmacy stock: " + e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteStockItem(stockId: string, name: string) {
    const confirmDelete = window.confirm(`Are you sure you want to delete '${name}' from stock?`);
    if (!confirmDelete) return;

    try {
      await deletePharmacyStockItem(stockId);
      await fetchTenantData();
    } catch (e) {
      alert("Failed to delete stock item: " + e);
    }
  }

  async function handleFinalizeLabTest(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLabRecord || selectedLabIndex === -1) return;

    try {
      const updatedLabs = [...(selectedLabRecord.laboratoryRequests || [])];
      updatedLabs[selectedLabIndex].result = labResultText;
      updatedLabs[selectedLabIndex].status = 'Completed';
      updatedLabs[selectedLabIndex].completedAt = new Date().toISOString();

      await updateMedicalRecord(selectedLabRecord.id, { laboratoryRequests: updatedLabs });
      setSelectedLabRecord(null);
      setLabResultText('');
      await fetchTenantData();
      alert('Laboratory results successfully filed.');
    } catch (e) {
      alert('Error: ' + e);
    }
  }

  async function handleFinalizeRadioScan(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRadioRecord || selectedRadioIndex === -1) return;

    try {
      const updatedRadios = [...(selectedRadioRecord.radiologyRequests || [])];
      updatedRadios[selectedRadioIndex].result = radioResultText;
      updatedRadios[selectedRadioIndex].status = 'Completed';

      await updateMedicalRecord(selectedRadioRecord.id, { radiologyRequests: updatedRadios });
      setSelectedRadioRecord(null);
      setRadioResultText('');
      await fetchTenantData();
      alert('Radiology findings successfully cataloged.');
    } catch (e) {
      alert('Error: ' + e);
    }
  }

  function handleDischargePatient(bed: WardBed) {
    if (!bed.occupiedBy) return;
    setDischargeConfirmBed(bed);
  }

  async function executeClinicalDischarge() {
    if (!dischargeConfirmBed) return;
    setIsDischarging(true);
    try {
      await updateWardBedStatus(dischargeConfirmBed.id, 'Available');
      
      // Find matching patient and update status to Active (Discharged from bed)
      const patientObj = patients.find(p => p.id === dischargeConfirmBed.occupiedBy);
      if (patientObj) {
        await updatePatient(patientObj.id, { status: 'Active' });
      }
      
      await fetchTenantData();
      setDischargeConfirmBed(null);
      alert('Clinical discharge successful. The bed is now available.');
    } catch (e) {
      alert('Error discharging patient: ' + e);
    } finally {
      setIsDischarging(false);
    }
  }

  async function handleSettlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBilling) return;

    const currentPaid = selectedBilling.patientPaid;
    const additionalPaid = parseFloat(paidAmountInput) || 0;
    const nextTotalPaid = currentPaid + additionalPaid;
    const balance = selectedBilling.totalAmount - selectedBilling.insuranceClaimed - nextTotalPaid;

    let finalStatus: Billing['status'] = 'Unpaid';
    if (balance <= 0) {
      finalStatus = 'Paid';
    } else if (nextTotalPaid > 0) {
      finalStatus = 'Partial';
    }

    try {
      await updateBillingPayment(selectedBilling.id, nextTotalPaid, finalStatus, payMethod);
      const receiptData: Billing = {
        ...selectedBilling,
        patientPaid: nextTotalPaid,
        status: finalStatus,
        paymentMethod: payMethod,
      };
      setSelectedBilling(null);
      setPaidAmountInput('');
      await fetchTenantData();
      setShowReceipt(receiptData);
    } catch (e) {
      alert('Error: ' + e);
    }
  }

  // ----------------------------------------------------
  // REPORT AGGREGATORS
  // ----------------------------------------------------
  const dailyPaidRevenue = billings.reduce((sum, item) => sum + item.patientPaid, 0);
  const dailyInsuranceRevenue = billings.reduce((sum, item) => sum + item.insuranceClaimed, 0);
  const totalFinancialYield = dailyPaidRevenue + dailyInsuranceRevenue;

  const lowStockDrugs = stock.filter(item => item.quantity <= item.minQuantity);
  const scheduledAppointments = appointments.filter(a => a.status === 'Scheduled');
  const activeAdmittedCount = beds.filter(b => b.status === 'Occupied').length;

  return (
    <div id="hospital-workspace" className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      
      {/* Side Control Rail */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-100 flex-shrink-0 flex flex-col border-r border-slate-800">
        <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
          <div className={`flex items-center justify-center w-16 h-16 overflow-hidden shrink-0 ${systemLogo ? 'bg-white p-2 rounded-xl shadow-inner' : 'bg-emerald-500 p-2 rounded-xl text-white'}`}>
            {systemLogo ? (
              <img 
                src={systemLogo} 
                alt="System Logo" 
                className="w-full h-full object-contain animate-fade-in"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Activity className="w-8 h-8" />
            )}
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-slate-100 leading-tight truncate max-w-[150px]">{displayedHospitalName}</h2>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest block mt-0.5">HMS Node</span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <button 
            id="tab-dashboard" 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2.5 transition-colors ${
              activeTab === 'dashboard' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Clinical Hub</span>
          </button>

          {isAllowed(['Receptionist']) && (
            <button 
              id="tab-reception" 
              onClick={() => setActiveTab('reception')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2.5 transition-colors ${
                activeTab === 'reception' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Reception & Queue</span>
            </button>
          )}

          {isAllowed(['Doctor']) && (
            <button 
              id="tab-consultation" 
              onClick={() => setActiveTab('consultation')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2.5 transition-colors ${
                activeTab === 'consultation' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Consultations</span>
            </button>
          )}

          {isAllowed(['Laboratory']) && (
            <button 
              id="tab-laboratory" 
              onClick={() => setActiveTab('laboratory')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2.5 transition-colors ${
                activeTab === 'laboratory' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              <span>Lab Workspace</span>
            </button>
          )}

          {isAllowed(['Radiology']) && (
            <button 
              id="tab-radiology" 
              onClick={() => setActiveTab('radiology')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2.5 transition-colors ${
                activeTab === 'radiology' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Radiology Unit</span>
            </button>
          )}

          {isAllowed(['Pharmacist']) && (
            <button 
              id="tab-pharmacy" 
              onClick={() => setActiveTab('pharmacy')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2.5 transition-colors ${
                activeTab === 'pharmacy' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Pill className="w-4 h-4" />
              <span>Pharmacy</span>
            </button>
          )}

          {isAllowed(['Accountant', 'Cashier']) && (
            <button 
              id="tab-billing" 
              onClick={() => setActiveTab('billing')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2.5 transition-colors ${
                activeTab === 'billing' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Billing & NHIF/SHIF</span>
            </button>
          )}

          {isAllowed(['Nurse', 'Doctor']) && (
            <button 
              id="tab-wards" 
              onClick={() => setActiveTab('wards')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2.5 transition-colors ${
                activeTab === 'wards' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Bed className="w-4 h-4" />
              <span>Ward Allocation</span>
            </button>
          )}

          {isAllowed(['Doctor', 'Nurse']) && (
            <button 
              id="tab-specialized" 
              onClick={() => setActiveTab('specialized')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2.5 transition-colors ${
                activeTab === 'specialized' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Scissors className="w-4 h-4" />
              <span>Theatre & Maternity</span>
            </button>
          )}

          <button 
            id="tab-reports" 
            onClick={() => setActiveTab('reports')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2.5 transition-colors ${
              activeTab === 'reports' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>Reports & Yields</span>
          </button>

          <button 
            id="tab-settings" 
            onClick={() => setActiveTab('settings')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2.5 transition-colors ${
              activeTab === 'settings' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Clinic Profile & Settings</span>
          </button>

          {(currentUser.role === 'Super Admin' || currentUser.role === 'Hospital Admin' || currentUser.role === 'Solo Practitioner') && (
            <button 
              id="tab-permissions" 
              onClick={() => setActiveTab('permissions')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center space-x-2.5 transition-colors ${
                activeTab === 'permissions' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Roles & Permissions</span>
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-950/40">
          <div className="flex items-center space-x-2 text-xs">
            <User className="w-4.5 h-4.5 text-slate-400" />
            <div className="overflow-hidden">
              <span className="block font-semibold text-slate-200 truncate">{currentUser.name}</span>
              <span className="block text-slate-500 font-semibold">{currentUser.role}</span>
            </div>
          </div>
          <button 
            id="btn-workspace-logout" 
            onClick={onLogout}
            className="w-full bg-slate-800 hover:bg-red-900 hover:text-white text-slate-400 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout Session</span>
          </button>
          <div className="pt-2 text-[10px] text-slate-600 text-center font-bold border-t border-slate-900">
            © 2026 Davetech Solutions
          </div>
        </div>
      </aside>

      {/* Main clinical content panel */}
      <main className="flex-1 p-6 space-y-6 overflow-y-auto">
        
        {/* Dynamic header */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Secure Tenant: {hospitalId.toUpperCase()}</span>
            <h1 className="text-xl font-extrabold text-slate-800 mt-1">{displayedHospitalName}</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <button 
              id="btn-direct-order"
              onClick={() => {
                setOrderItems([]);
                setOrderPatientId('');
                setShowDirectOrderModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg flex items-center space-x-1.5 text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4 text-emerald-200" />
              <span>🛒 New Order / Bill</span>
            </button>

            <button 
              id="btn-workspace-refresh"
              onClick={fetchTenantData}
              className="bg-slate-50 hover:bg-slate-100 p-2.5 rounded-lg border border-slate-200 flex items-center space-x-1 text-xs font-semibold text-slate-600 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync Clinic</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-20 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
            <Activity className="w-10 h-10 animate-spin mx-auto mb-3 text-emerald-500" />
            <span className="font-semibold text-sm">Validating Tenant Isolation Keys & Fetching Electronic Medical Records...</span>
          </div>
        ) : (
          <div className="space-y-6">
            
            {currentUser.role === 'Solo Practitioner' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 shadow-xs">
                <span className="text-xl">🧑‍⚕️</span>
                <div>
                  <h4 className="font-bold text-emerald-900 text-sm">Solo Practitioner Mode Enabled</h4>
                  <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                    Designed for clinics and localized health centers under the <strong>Basic Plan ($499/mo)</strong>. You have unified access to register patients, perform clinical consultations, dispense prescriptions, and process billing payments as a single operator.
                  </p>
                </div>
              </div>
            )}
            
            {/* 1. CLINICAL DASHBOARD HOME */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                
                {/* Stats cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Patients</span>
                      <h4 className="text-2xl font-black text-slate-800 mt-1">{patients.length}</h4>
                      <span className="text-xs text-emerald-600 font-medium">Safe in local tenant index</span>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Visits</span>
                      <h4 className="text-2xl font-black text-slate-800 mt-1">{scheduledAppointments.length}</h4>
                      <span className="text-xs text-indigo-600 font-medium">In consulting queue</span>
                    </div>
                    <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600">
                      <Calendar className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ward Bed Status</span>
                      <h4 className="text-2xl font-black text-slate-800 mt-1">{activeAdmittedCount} Admitted</h4>
                      <span className="text-xs text-amber-600 font-medium">{beds.filter(b => b.status === 'Available').length} available beds</span>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-lg text-amber-600">
                      <Bed className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tenant Revenue Yield</span>
                      <h4 className="text-2xl font-black text-slate-800 mt-1">KSh {totalFinancialYield.toLocaleString()}</h4>
                      <span className="text-xs text-emerald-600 font-medium">M-Pesa, Cash, SHIF claims</span>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600">
                      <DollarSign className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Dashboard layout blocks */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left block: Current Queue */}
                  <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <h3 className="font-extrabold text-slate-800 text-base">Active Daily Clinical Queue</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100 text-xs text-slate-400 font-bold uppercase">
                            <th className="pb-3">Queue #</th>
                            <th className="pb-3">Patient</th>
                            <th className="pb-3">Assigned Doctor</th>
                            <th className="pb-3">Time Slot</th>
                            <th className="pb-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-50">
                          {appointments.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-slate-400">No scheduled visits in queue today.</td>
                            </tr>
                          ) : (
                            appointments.map(a => (
                              <tr key={a.id} className="hover:bg-slate-50/50">
                                <td className="py-3 font-mono font-bold text-slate-700">Q-{a.queueNumber}</td>
                                <td className="py-3 font-bold text-slate-800">{a.patientName}</td>
                                <td className="py-3 text-slate-600">{a.doctorName}</td>
                                <td className="py-3 text-slate-500 text-xs font-semibold">{a.timeSlot}</td>
                                <td className="py-3">
                                  <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                    a.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                                    a.status === 'In Progress' ? 'bg-indigo-50 text-indigo-700' :
                                    'bg-amber-50 text-amber-700'
                                  }`}>
                                    {a.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right block: Alerts and Stocks */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-amber-500" />
                      <span>Security & Stock Alerts</span>
                    </h3>
                    
                    <div className="space-y-3">
                      {/* Tenant verification badge */}
                      <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex gap-2.5">
                        <Check className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-bold text-xs text-emerald-800">Database Guard ACTIVE</h4>
                          <p className="text-[10px] text-emerald-700 mt-0.5">Firestore query limits strictly bounded to hospitalId '{hospitalId}'. Cross-tenant query execution is forbidden.</p>
                        </div>
                      </div>

                      {/* Low stock alerts */}
                      <div className="space-y-2">
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Pharmacy Replenishments</span>
                        {lowStockDrugs.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400 border border-dashed rounded-lg">All pharmacy stocks are within optimal margins.</div>
                        ) : (
                          lowStockDrugs.map(drug => (
                            <div key={drug.id} className="p-2.5 bg-red-50 border border-red-100 rounded-lg flex items-center justify-between">
                              <div>
                                <span className="block font-bold text-xs text-red-800">{drug.drugName}</span>
                                <span className="block text-[10px] text-red-600">Stock count: {drug.quantity} items (Min: {drug.minQuantity})</span>
                              </div>
                              <span className="text-[10px] font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded-full">Low Stock</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. RECEPTION / REGISTRATION / PATIENT MANAGEMENT */}
            {activeTab === 'reception' && (
              <div className="space-y-6">
                
                {/* Header toolbar */}
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-extrabold text-slate-800">Reception & Patient Registration</h2>
                  <div className="flex space-x-2">
                    <button 
                      id="btn-trigger-register-patient"
                      onClick={() => setShowAddPatient(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-all shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Register New Patient</span>
                    </button>
                    <button 
                      id="btn-trigger-book-app"
                      onClick={() => setShowAddApp(true)}
                      className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center space-x-1.5 transition-all"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Book Appointment</span>
                    </button>
                  </div>
                </div>

                {/* Add Patient Modal Overlay */}
                {showAddPatient && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                    <form onSubmit={handleRegisterPatient} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h3 className="font-bold text-base text-slate-800">Register Electronic Medical Record (EMR)</h3>
                        <button type="button" onClick={() => setShowAddPatient(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase">Patient Full Name</label>
                          <input 
                            type="text" 
                            value={patName} 
                            onChange={e => setPatName(e.target.value)}
                            placeholder="e.g. John Mwangi"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase">Age</label>
                          <input 
                            type="number" 
                            value={patAge} 
                            onChange={e => setPatAge(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase">Gender</label>
                          <select 
                            value={patGender} 
                            onChange={e => setPatGender(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                          >
                            <option>Male</option>
                            <option>Female</option>
                            <option>Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase">Contact Phone</label>
                          <input 
                            type="text" 
                            value={patContact} 
                            onChange={e => setPatContact(e.target.value)}
                            placeholder="+254..."
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase">Email Address</label>
                          <input 
                            type="email" 
                            value={patEmail} 
                            onChange={e => setPatEmail(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase">Residential Address</label>
                          <input 
                            type="text" 
                            value={patAddress} 
                            onChange={e => setPatAddress(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase">Insurance Provider</label>
                          <select 
                            value={patInsurance} 
                            onChange={e => setPatInsurance(e.target.value as any)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                          >
                            <option value="None">None (Self-Pay)</option>
                            <option value="NHIF">NHIF National</option>
                            <option value="SHIF">SHIF Universal</option>
                            <option value="Private">Private Corporate</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase">Policy / Claim ID</label>
                          <input 
                            type="text" 
                            value={patInsuranceId} 
                            onChange={e => setPatInsuranceId(e.target.value)}
                            disabled={patInsurance === 'None'}
                            placeholder="e.g. SHIF-883"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                        <button type="button" onClick={() => setShowAddPatient(false)} className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold">Register EMR</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Book Appointment Modal Overlay */}
                {showAddApp && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                    <form onSubmit={handleBookAppointment} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h3 className="font-bold text-base text-slate-800">Book Patient Consult Visit</h3>
                        <button type="button" onClick={() => setShowAddApp(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase">Select Registered Patient</label>
                          <select 
                            value={appPatientId}
                            onChange={e => setAppPatientId(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            required
                          >
                            <option value="">-- Choose Patient --</option>
                            {patients.map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.gender}, {p.age} yrs)</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase">Assigned Doctor</label>
                          <select 
                            value={appDocName}
                            onChange={e => setAppDocName(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                          >
                            <option>Dr. Arthur Kamau</option>
                            <option>Dr. Beatrice Atieno</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase">Appointment Date</label>
                          <input 
                            type="date" 
                            value={appDate}
                            onChange={e => setAppDate(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase">Time Slot</label>
                          <select 
                            value={appTime}
                            onChange={e => setAppTime(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                          >
                            <option>09:00 AM - 09:30 AM</option>
                            <option>10:00 AM - 10:30 AM</option>
                            <option>11:00 AM - 11:30 AM</option>
                            <option>02:00 PM - 02:30 PM</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase">Consultation Fee (KSh)</label>
                          <input 
                            type="number" 
                            value={appConsultationFee}
                            onChange={e => setAppConsultationFee(e.target.value)}
                            placeholder="e.g. 1500"
                            min="0"
                            step="100"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase">Chief Complaint / Symptoms</label>
                          <textarea 
                            value={appSymptoms}
                            onChange={e => setAppSymptoms(e.target.value)}
                            placeholder="e.g. Coughing, fever, chest tightness"
                            rows={3}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                        <button type="button" onClick={() => setShowAddApp(false)} className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold">Assign Queue Position</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Patient Database Listing */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-slate-800 text-sm">Tenant Electronic Medical Directory</h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-400 font-bold uppercase">
                          <th className="py-3 px-4">Patient ID</th>
                          <th className="py-3 px-4">Name</th>
                          <th className="py-3 px-4">Demographics</th>
                          <th className="py-3 px-4">Contact</th>
                          <th className="py-3 px-4">Insurance Info</th>
                          <th className="py-3 px-4">Date/Time Registered</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm divide-y divide-slate-100">
                        {patients.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-500">{p.id}</td>
                            <td className="py-3.5 px-4 font-bold text-slate-800">{p.name}</td>
                            <td className="py-3.5 px-4 text-slate-600">{p.gender}, {p.age} years</td>
                            <td className="py-3.5 px-4">
                              <span className="block text-slate-700">{p.contact}</span>
                              <span className="block text-xs text-slate-400">{p.email}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                                p.insuranceType === 'None' ? 'bg-slate-100 text-slate-600' :
                                p.insuranceType === 'SHIF' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                                p.insuranceType === 'NHIF' ? 'bg-sky-50 text-sky-700 border border-sky-100' :
                                'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}>
                                {p.insuranceType}
                              </span>
                              {p.insuranceId && <span className="block text-[10px] font-mono text-slate-400 mt-0.5">{p.insuranceId}</span>}
                            </td>
                            <td className="py-3.5 px-4">
                              {p.createdAt ? (
                                <>
                                  <div className="font-bold text-slate-700 text-xs">
                                    {new Date(p.createdAt).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                    {new Date(p.createdAt).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true
                                    })}
                                  </div>
                                </>
                              ) : (
                                <span className="text-slate-400 text-xs">N/A</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
                              <span className="text-xs text-slate-600 font-semibold">{p.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 3. DOCTOR CONSULTATIONS */}
            {activeTab === 'consultation' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left panel: Active appointments waiting */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                  <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-2 flex items-center justify-between">
                    <span>Clinical Waiting Queue</span>
                    <span className="bg-slate-100 text-slate-600 font-mono text-xs px-2 py-0.5 rounded-full">{scheduledAppointments.length} Waiting</span>
                  </h3>

                  <div className="space-y-3">
                    {scheduledAppointments.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">All queue positions have been consulted.</p>
                    ) : (
                      scheduledAppointments.map(app => (
                        <div 
                          key={app.id} 
                          onClick={() => {
                            setSelectedConsultation(app);
                            setDocSymptoms(app.symptoms);
                          }}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            selectedConsultation?.id === app.id 
                              ? 'bg-emerald-50 border-emerald-300 shadow-xs' 
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-[10px] font-bold text-slate-400">POS {app.queueNumber} {app.consultationFee !== undefined && `• KSh ${app.consultationFee}`}</span>
                            <span className="text-[10px] font-bold text-indigo-600">{app.timeSlot}</span>
                          </div>
                          <h4 className="font-extrabold text-sm text-slate-800 mt-1">{app.patientName}</h4>
                          <p className="text-xs text-slate-500 truncate mt-1">Complaint: {app.symptoms}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Panel: Consultation Workbench */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  {!selectedConsultation ? (
                    <div className="p-20 text-center text-slate-400 space-y-3">
                      <Heart className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-sm font-semibold">Select a patient from the waiting queue to begin clinical consultation.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleConsultationSubmit} className="space-y-5">
                      
                      {/* Patient metadata header */}
                      <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">Active Electronic Encounter</span>
                          <h3 className="text-lg font-extrabold">{selectedConsultation.patientName}</h3>
                          <p className="text-xs text-slate-300 mt-0.5">Assigned Clinician: {selectedConsultation.doctorName}</p>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setSelectedConsultation(null)}
                          className="bg-slate-800 hover:bg-slate-700 text-white p-1 rounded-full text-xs"
                        >
                          Cancel Encounter
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase">Chief Complaint & Subjective Symptoms</label>
                          <input 
                            type="text" 
                            value={docSymptoms}
                            onChange={e => setDocSymptoms(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase">Primary Diagnosis (ICD-11 mapping)</label>
                          <input 
                            type="text" 
                            value={docDiagnosis}
                            onChange={e => setDocDiagnosis(e.target.value)}
                            placeholder="e.g. Acute Malaria Infection"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase">Objective / Plan Notes</label>
                          <input 
                            type="text" 
                            value={docNotes}
                            onChange={e => setDocNotes(e.target.value)}
                            placeholder="e.g. Recommend bed rest, repeat Hb in 3 days."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      {/* CLINICAL ACTIONS SUB-SECTIONS (Accretive) */}
                      <div className="border-t border-slate-100 pt-4 space-y-4">
                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Accretive Clinical Orders</h4>
                        
                        {/* 1. Prescriptions */}
                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                          <span className="block text-xs font-bold text-slate-700">Formulate Prescription Plan</span>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                            <div className="md:col-span-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase">Medicine</label>
                              <select 
                                value={pDrug}
                                onChange={e => setPDrug(e.target.value)}
                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs mt-1 bg-white"
                              >
                                <option value="">-- Choose --</option>
                                {stock.map(s => (
                                  <option key={s.id} value={s.drugName}>{s.drugName} ({s.quantity} avail)</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase">Dosage</label>
                              <input 
                                type="text" 
                                value={pDosage} 
                                onChange={e => setPDosage(e.target.value)}
                                placeholder="e.g. 500mg"
                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs mt-1"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase">Frequency</label>
                              <select 
                                value={pFrequency} 
                                onChange={e => setPFrequency(e.target.value)}
                                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs mt-1 bg-white"
                              >
                                <option>OD (Once daily)</option>
                                <option>BD (Twice daily)</option>
                                <option>TDS (Three times daily)</option>
                                <option>QDS (Four times daily)</option>
                              </select>
                            </div>
                            <div className="flex space-x-1.5">
                              <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Duration</label>
                                <input 
                                  type="text" 
                                  value={pDuration} 
                                  onChange={e => setPDuration(e.target.value)}
                                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs mt-1"
                                />
                              </div>
                              <button 
                                type="button" 
                                onClick={handleAddPrescription}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-md h-8 self-end font-bold text-xs"
                              >
                                Add
                              </button>
                            </div>
                          </div>

                          {prescriptionsList.length > 0 && (
                            <div className="bg-white p-2.5 rounded border text-xs divide-y">
                              {prescriptionsList.map((p, idx) => (
                                <div key={idx} className="py-1.5 flex justify-between">
                                  <span><strong>{p.drugName}</strong> - {p.dosage} ({p.frequency}) for {p.duration}</span>
                                  <button type="button" onClick={() => setPrescriptionsList(prescriptionsList.filter((_, i) => i !== idx))} className="text-red-500 hover:underline">Remove</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 2. Lab & Imaging requests */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          
                          {/* Lab test select */}
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                            <span className="block text-xs font-bold text-slate-700">Order Laboratory Tests</span>
                            <div className="flex space-x-1.5">
                              <select 
                                value={selectedLabTest}
                                onChange={e => setSelectedLabTest(e.target.value)}
                                className="flex-1 px-2 py-1 border border-slate-300 rounded-md text-xs bg-white"
                              >
                                <option value="">-- Choose test --</option>
                                <option>Full Blood Count (FBC)</option>
                                <option>Malaria Blood Slide</option>
                                <option>Urinalysis</option>
                                <option>HbA1c Diabetes</option>
                                <option>Covid-19 PCR</option>
                              </select>
                              <button type="button" onClick={handleAddLabRequest} className="bg-slate-700 text-white text-xs px-2.5 py-1 rounded-md">Order</button>
                            </div>
                            {labTestsList.length > 0 && (
                              <div className="text-xs flex flex-wrap gap-1 mt-1">
                                {labTestsList.map((l, idx) => (
                                  <span key={idx} className="bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    {l}
                                    <button type="button" onClick={() => setLabTestsList(labTestsList.filter((_, i) => i !== idx))} className="text-red-500 font-bold">✕</button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Radiology select */}
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                            <span className="block text-xs font-bold text-slate-700">Order Medical Imaging Scans</span>
                            <div className="flex space-x-1.5">
                              <select 
                                value={selectedRadio}
                                onChange={e => setSelectedRadio(e.target.value)}
                                className="flex-1 px-2 py-1 border border-slate-300 rounded-md text-xs bg-white"
                              >
                                <option value="">-- Choose scan --</option>
                                <option>X-ray</option>
                                <option>CT Scan</option>
                                <option>MRI</option>
                                <option>Ultrasound</option>
                              </select>
                              <button type="button" onClick={handleAddRadioRequest} className="bg-slate-700 text-white text-xs px-2.5 py-1 rounded-md">Order</button>
                            </div>
                            {radioList.length > 0 && (
                              <div className="text-xs flex flex-wrap gap-1 mt-1">
                                {radioList.map((r, idx) => (
                                  <span key={idx} className="bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    {r}
                                    <button type="button" onClick={() => setRadioList(radioList.filter((_, i) => i !== idx))} className="text-red-500 font-bold">✕</button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 3. Specialized Maternity Care */}
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                          <span className="block text-xs font-bold text-slate-700">Maternity Care Tracking</span>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase">Encounter Category</label>
                              <select 
                                value={maternityType}
                                onChange={e => setMaternityType(e.target.value as any)}
                                className="w-full px-2 py-1 border border-slate-300 rounded-md text-xs mt-1 bg-white"
                              >
                                <option value="ANC">Antenatal Care (ANC)</option>
                                <option value="Delivery">Active Delivery / Birth</option>
                                <option value="PNC">Postnatal Care (PNC)</option>
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase">Pregnancy / Delivery Clinical Notes</label>
                              <input 
                                type="text" 
                                value={maternityNotes}
                                onChange={e => setMaternityNotes(e.target.value)}
                                placeholder="Fetal heart tones, gestational age, contractions etc..."
                                className="w-full px-2 py-1 border border-slate-300 rounded-md text-xs mt-1"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 4. Ward Admissions & Surgical Operations */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          
                          {/* Ward Admission Checkbox */}
                          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                            <label className="flex items-center space-x-2 cursor-pointer font-bold text-xs text-slate-700">
                              <input 
                                type="checkbox" 
                                checked={requireAdmission} 
                                onChange={e => setRequireAdmission(e.target.checked)}
                                className="rounded"
                              />
                              <span>Requires Inpatient Ward Admission</span>
                            </label>

                            {requireAdmission && (
                              <div className="space-y-2 pt-1 border-t border-slate-100">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500">Ward Ward</label>
                                    <select 
                                      value={admWardType}
                                      onChange={e => setAdmWardType(e.target.value as any)}
                                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                                    >
                                      <option>General</option>
                                      <option>Maternity</option>
                                      <option>ICU</option>
                                      <option>Pediatric</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500">Select Bed</label>
                                    <select 
                                      value={admBedNumber}
                                      onChange={e => setAdmBedNumber(e.target.value)}
                                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                                      required
                                    >
                                      <option value="">-- Choose --</option>
                                      {beds
                                        .filter(b => b.wardType === admWardType && b.status === 'Available')
                                        .map(b => (
                                          <option key={b.id} value={b.bedNumber}>Bed {b.bedNumber}</option>
                                        ))}
                                    </select>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Theatre Surgery Checkbox */}
                          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                            <label className="flex items-center space-x-2 cursor-pointer font-bold text-xs text-slate-700">
                              <input 
                                type="checkbox" 
                                checked={requireSurgery} 
                                onChange={e => setRequireSurgery(e.target.checked)}
                                className="rounded"
                              />
                              <span>Requires Operating Theatre Surgery</span>
                            </label>

                            {requireSurgery && (
                              <div className="space-y-2 pt-1 border-t border-slate-100">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500">Procedure Name</label>
                                  <input 
                                    type="text" 
                                    value={surgProcedure}
                                    onChange={e => setSurgProcedure(e.target.value)}
                                    placeholder="e.g. Caesarean Section, Appendectomy"
                                    className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500">Intraoperative Findings</label>
                                  <input 
                                    type="text" 
                                    value={surgNotes}
                                    onChange={e => setSurgNotes(e.target.value)}
                                    placeholder="Brief plan notes"
                                    className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                        </div>

                      </div>

                      <div className="flex justify-end pt-3 border-t border-slate-100">
                        <button 
                          type="submit"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center space-x-1.5 transition-all shadow-sm"
                        >
                          <Check className="w-4 h-4" />
                          <span>Finalize Consultation Encounter</span>
                        </button>
                      </div>

                    </form>
                  )}
                </div>

              </div>
            )}

            {/* 4. LABORATORY WORKSPACE */}
            {activeTab === 'laboratory' && (
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3">
                    <h3 className="font-extrabold text-slate-800 text-base">Electronic Laboratory Work Orders</h3>
                    <button 
                      id="btn-lab-direct-order"
                      onClick={() => {
                        setOrderItems([]);
                        setOrderPatientId('');
                        setSelectedItemCategory('Lab');
                        setShowDirectOrderModal(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Order Direct Lab Test</span>
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-400 font-bold uppercase">
                          <th className="py-3 px-4">Patient</th>
                          <th className="py-3 px-4">Ordered Test</th>
                          <th className="py-3 px-4">Order Date</th>
                          <th className="py-3 px-4">Lab Findings / Result</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Laboratory Entry</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm divide-y divide-slate-100">
                        {records.filter(r => r.laboratoryRequests && r.laboratoryRequests.length > 0).flatMap((record, rIdx) => {
                          return (record.laboratoryRequests || []).map((lab, labIdx) => (
                            <tr key={`${record.id}_lab_${labIdx}`} className="hover:bg-slate-50/50">
                              <td className="py-3.5 px-4 font-bold text-slate-800">{record.patientName}</td>
                              <td className="py-3.5 px-4 text-slate-700">{lab.testName}</td>
                              <td className="py-3.5 px-4 text-xs text-slate-500">{new Date(lab.requestedAt).toLocaleDateString()}</td>
                              <td className="py-3.5 px-4 font-mono text-xs text-indigo-700">
                                {lab.result || 'No clinical outcomes filed yet.'}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  lab.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}>
                                  {lab.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {lab.status === 'Pending' ? (
                                  <button 
                                    id={`btn-result-entry-${record.id}-${labIdx}`}
                                    onClick={() => {
                                      setSelectedLabRecord(record);
                                      setSelectedLabIndex(labIdx);
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-md"
                                  >
                                    Result Entry
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400 font-semibold flex items-center justify-end gap-1">
                                    <Check className="w-4 h-4 text-emerald-500" /> Completed
                                  </span>
                                )}
                              </td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Lab Result Entry modal */}
                {selectedLabRecord && selectedLabIndex !== -1 && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                    <form onSubmit={handleFinalizeLabTest} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h3 className="font-bold text-base text-slate-800">Laboratory Findings Entry</h3>
                        <button type="button" onClick={() => setSelectedLabRecord(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border">
                        <span className="block text-xs font-semibold text-slate-400">Patient EMR</span>
                        <span className="block font-bold text-sm text-slate-800 mt-0.5">{selectedLabRecord.patientName}</span>
                        <span className="block text-xs text-slate-600 mt-1">Ordered Test: {selectedLabRecord.laboratoryRequests?.[selectedLabIndex].testName}</span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase">Hematology / Quantitative Findings Outcome</label>
                        <textarea 
                          value={labResultText} 
                          onChange={e => setLabResultText(e.target.value)}
                          placeholder="e.g. Malaria blood smear: Positive (Plasmodium falciparum, high parasitemia) or Hb: 11.2 g/dL"
                          rows={4}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                          required
                        />
                      </div>

                      <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                        <button type="button" onClick={() => setSelectedLabRecord(null)} className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold">Transmit Lab Findings</button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* 5. PHARMACY OUTLET */}
            {activeTab === 'pharmacy' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Pending prescriptions dispensing */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h3 className="font-extrabold text-slate-800 text-sm">Medicine Dispensing Desk</h3>
                    <button 
                      id="btn-pharmacy-direct-order"
                      onClick={() => {
                        setOrderItems([]);
                        setOrderPatientId('');
                        setSelectedItemCategory('Medicine');
                        setShowDirectOrderModal(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center space-x-1 transition-all shadow-xs active:scale-95 cursor-pointer"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Direct Rx & Medicine Sale</span>
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {records.filter(r => r.prescriptions && r.prescriptions.length > 0).length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No prescriptions registered in tenant system.</p>
                    ) : (
                      records.filter(r => r.prescriptions && r.prescriptions.length > 0).map((rec) => {
                        return (rec.prescriptions || []).map((rx, rxIdx) => (
                          <div key={`${rec.id}_rx_${rxIdx}`} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-bold text-slate-800">{rec.patientName}</span>
                                <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-mono">{rec.date}</span>
                              </div>
                              <p className="text-xs text-indigo-700 font-semibold mt-1">Prescribed: {rx.drugName} - {rx.dosage} ({rx.frequency})</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">Encounter ID: {rec.id}</p>
                            </div>

                            <div>
                              {rx.status === 'Pending' ? (
                                <button 
                                  id={`btn-dispense-${rec.id}-${rxIdx}`}
                                  onClick={() => handleDispenseDrug(rec, rxIdx)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-md"
                                >
                                  Dispense RX
                                </button>
                              ) : (
                                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                                  <Check className="w-4 h-4" /> Dispensed
                                </span>
                              )}
                            </div>
                          </div>
                        ));
                      })
                    )}
                  </div>
                </div>

                {/* Stock inventory management */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-sm">Pharmacy Stock Control</h3>
                      <p className="text-[10px] text-slate-400 font-medium">Manage drug catalog & inventory</p>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {stock.length > 0 && (
                        <>
                          {isConfirmingEmptyStock ? (
                            <div className="flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={handleEmptyPharmacyStock}
                                className="bg-red-600 text-white font-bold text-[10px] px-2 py-1 rounded-md hover:bg-red-700 transition-all cursor-pointer"
                              >
                                Confirm Clear All?
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsConfirmingEmptyStock(false)}
                                className="bg-slate-200 text-slate-700 text-[10px] px-2 py-1 rounded-md hover:bg-slate-300 transition-all cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsConfirmingEmptyStock(true)}
                              className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition-all text-xs flex items-center space-x-1 font-semibold cursor-pointer"
                              title="Clear all pharmacy stock"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="text-[10px]">Empty Stock</span>
                            </button>
                          )}
                        </>
                      )}
                      <button 
                        id="btn-trigger-add-drug"
                        onClick={() => setShowAddDrug(true)}
                        className="bg-slate-900 hover:bg-slate-800 text-white p-1.5 rounded-md text-xs flex items-center space-x-1 font-bold cursor-pointer transition-all active:scale-95 shadow-xs"
                        title="Add Stock Medicine"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Add Item</span>
                      </button>
                    </div>
                  </div>

                  {/* Add stock modal overlay */}
                  {showAddDrug && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                      <form onSubmit={handleAddStockItem} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                          <h3 className="font-bold text-base text-slate-800">Add Pharmacy Stock Item</h3>
                          <button type="button" onClick={() => setShowAddDrug(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase">Chemical / Brand Name</label>
                            <input 
                              type="text" 
                              value={drugName} 
                              onChange={e => setDrugName(e.target.value)}
                              placeholder="e.g. Paracetamol 500mg"
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1"
                              required
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase">Initial Qty</label>
                              <input 
                                type="number" 
                                value={drugQty} 
                                onChange={e => setDrugQty(e.target.value)}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase">Min Safety Alert Qty</label>
                              <input 
                                type="number" 
                                value={drugMinQty} 
                                onChange={e => setDrugMinQty(e.target.value)}
                                placeholder="50"
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase">Unit Price (KSh)</label>
                              <input 
                                type="number" 
                                value={drugPrice} 
                                onChange={e => setDrugPrice(e.target.value)}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase">Expiry Date</label>
                              <input 
                                type="date" 
                                value={drugExpiry} 
                                onChange={e => setDrugExpiry(e.target.value)}
                                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs mt-1"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                          <button type="button" onClick={() => setShowAddDrug(false)} className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                          <button type="submit" className="px-4 py-1.5 text-xs text-white bg-slate-900 hover:bg-slate-800 rounded-lg font-bold">Add to Pharmacy</button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {stock.length === 0 ? (
                      <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        <Pill className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-600">No Pharmacy Stock</p>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] mx-auto">Your pharmacy stock is currently empty. Click "Add Item" to catalog your own drugs.</p>
                      </div>
                    ) : (
                      stock.map(drug => (
                        <div key={drug.id} className="p-2.5 rounded-lg border border-slate-100 text-xs flex justify-between items-center bg-slate-50 hover:bg-white hover:border-slate-200 hover:shadow-xs transition-all group">
                          <div>
                            <span className="block font-bold text-slate-800">{drug.drugName}</span>
                            <span className="block text-slate-500 mt-0.5">Unit Price: KSh {drug.unitPrice}</span>
                          </div>
                          <div className="flex items-center space-x-2.5">
                            <div className="text-right">
                              <span className={`block font-bold ${drug.quantity <= drug.minQuantity ? 'text-red-600 animate-pulse' : 'text-slate-700'}`}>
                                {drug.quantity} units
                              </span>
                              <span className="block text-[9px] text-slate-400 mt-0.5">Min: {drug.minQuantity}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteStockItem(drug.id, drug.drugName)}
                              className="text-slate-300 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                              title={`Delete ${drug.drugName}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* 6. BILLING AND INSURANCE */}
            {activeTab === 'billing' && (
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3">
                    <h3 className="font-extrabold text-slate-800 text-base">Electronic Invoicing & Insurance Clearing Desk (NHIF/SHIF Support)</h3>
                    <button 
                      id="btn-billing-direct-order"
                      onClick={() => {
                        setOrderItems([]);
                        setOrderPatientId('');
                        setShowDirectOrderModal(true);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Create Direct Order / Bill</span>
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-400 font-bold uppercase">
                          <th className="py-3 px-4">Invoice #</th>
                          <th className="py-3 px-4">Patient Name</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Total Fee</th>
                          <th className="py-3 px-4">SHIF/NHIF subsidy</th>
                          <th className="py-3 px-4">Patient Paid</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Accounting Action</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm divide-y divide-slate-100">
                        {billings.map(bill => {
                          const outstanding = bill.totalAmount - bill.insuranceClaimed - bill.patientPaid;
                          return (
                            <tr key={bill.id} className="hover:bg-slate-50/50">
                              <td className="py-3.5 px-4 font-mono text-xs text-slate-500">{bill.id}</td>
                              <td className="py-3.5 px-4 font-bold text-slate-800">{bill.patientName}</td>
                              <td className="py-3.5 px-4 text-xs text-slate-500">{bill.invoiceDate}</td>
                              <td className="py-3.5 px-4 font-bold">KSh {bill.totalAmount.toLocaleString()}</td>
                              <td className="py-3.5 px-4 text-indigo-700 font-semibold">
                                {bill.insuranceClaimed > 0 ? `KSh ${bill.insuranceClaimed.toLocaleString()}` : '-'}
                              </td>
                              <td className="py-3.5 px-4 font-medium text-emerald-700">
                                KSh {bill.patientPaid.toLocaleString()}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  bill.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                  bill.status === 'Partial' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                                  'bg-red-50 text-red-700 border border-red-100'
                                }`}>
                                  {bill.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex justify-end items-center gap-2">
                                  {bill.status !== 'Paid' && (
                                    <button 
                                      id={`btn-collect-payment-${bill.id}`}
                                      onClick={() => setSelectedBilling(bill)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-md transition-all active:scale-95"
                                    >
                                      Collect Payment
                                    </button>
                                  )}
                                  {bill.status === 'Paid' && (
                                    <button 
                                      id={`btn-view-receipt-${bill.id}`}
                                      onClick={() => setShowReceipt(bill)}
                                      className="border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all active:scale-95"
                                      type="button"
                                    >
                                      <Printer className="w-3.5 h-3.5" />
                                      Print Receipt
                                    </button>
                                  )}
                                  {bill.status === 'Partial' && (
                                    <button 
                                      id={`btn-view-receipt-${bill.id}`}
                                      onClick={() => setShowReceipt(bill)}
                                      className="border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 font-semibold text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1 transition-all"
                                      type="button"
                                      title="Print partial receipt"
                                    >
                                      <Printer className="w-3 h-3" /> Receipt
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Settle Payment Modal */}
                {selectedBilling && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                    <form onSubmit={handleSettlePayment} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h3 className="font-bold text-base text-slate-800">Collect Patient Settlement</h3>
                        <button type="button" onClick={() => setSelectedBilling(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-lg border space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Invoice Reference</span>
                          <span className="font-mono font-bold text-slate-700">{selectedBilling.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Patient EMR</span>
                          <span className="font-bold text-slate-800">{selectedBilling.patientName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Total Invoice Charge</span>
                          <span className="font-black text-slate-800">KSh {selectedBilling.totalAmount.toLocaleString()}</span>
                        </div>
                        {selectedBilling.insuranceClaimed > 0 && (
                          <div className="flex justify-between text-indigo-700 font-semibold">
                            <span>NHIF / SHIF Subsidy Covered</span>
                            <span>- KSh {selectedBilling.insuranceClaimed.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-emerald-700 font-bold border-t pt-1.5">
                          <span>Balance Outstanding</span>
                          <span>KSh {(selectedBilling.totalAmount - selectedBilling.insuranceClaimed - selectedBilling.patientPaid).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="block font-bold text-slate-500 uppercase">Payment Channel</label>
                          <select 
                            value={payMethod} 
                            onChange={e => setPayMethod(e.target.value as any)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg mt-1 bg-white"
                          >
                            <option value="M-Pesa">Lipa Na M-Pesa Merchant</option>
                            <option value="Cash">Cash Currency</option>
                            <option value="Insurance">Additional Corporate Guarantee</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-500 uppercase">Payment Amount Collect (KSh)</label>
                          <input 
                            type="number" 
                            value={paidAmountInput} 
                            onChange={e => setPaidAmountInput(e.target.value)}
                            placeholder="e.g. 1500"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg mt-1"
                            required
                          />
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                        <button type="button" onClick={() => setSelectedBilling(null)} className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold">Log Transaction</button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* 7. RADIOLOGY UNIT */}
            {activeTab === 'radiology' && (
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-slate-800 text-base">Radiology Imaging Work Orders</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-400 font-bold uppercase">
                          <th className="py-3 px-4">Patient</th>
                          <th className="py-3 px-4">Scan Type</th>
                          <th className="py-3 px-4">Radiology Findings Outcome</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Radiology Entry</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm divide-y divide-slate-100">
                        {records.filter(r => r.radiologyRequests && r.radiologyRequests.length > 0).flatMap((record) => {
                          return (record.radiologyRequests || []).map((rad, radIdx) => (
                            <tr key={`${record.id}_rad_${radIdx}`} className="hover:bg-slate-50/50">
                              <td className="py-3.5 px-4 font-bold text-slate-800">{record.patientName}</td>
                              <td className="py-3.5 px-4 text-slate-700 font-semibold">{rad.type}</td>
                              <td className="py-3.5 px-4 font-mono text-xs text-purple-700">
                                {rad.result || 'No imaging findings uploaded.'}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  rad.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}>
                                  {rad.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                {rad.status === 'Pending' ? (
                                  <button 
                                    id={`btn-rad-entry-${record.id}-${radIdx}`}
                                    onClick={() => {
                                      setSelectedRadioRecord(record);
                                      setSelectedRadioIndex(radIdx);
                                    }}
                                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-md"
                                  >
                                    Result Entry
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400 font-semibold flex items-center justify-end gap-1">
                                    <Check className="w-4 h-4 text-emerald-500" /> Completed
                                  </span>
                                )}
                              </td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Radiology Entry Modal */}
                {selectedRadioRecord && selectedRadioIndex !== -1 && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                    <form onSubmit={handleFinalizeRadioScan} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h3 className="font-bold text-base text-slate-800">Radiology Diagnostic Findings</h3>
                        <button type="button" onClick={() => setSelectedRadioRecord(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border">
                        <span className="block text-xs font-semibold text-slate-400">Patient EMR</span>
                        <span className="block font-bold text-sm text-slate-800 mt-0.5">{selectedRadioRecord.patientName}</span>
                        <span className="block text-xs text-slate-600 mt-1">Scan Type: {selectedRadioRecord.radiologyRequests?.[selectedRadioIndex].type}</span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase">Diagnostic Clinical Description Findings</label>
                        <textarea 
                          value={radioResultText} 
                          onChange={e => setRadioResultText(e.target.value)}
                          placeholder="e.g. Chest X-Ray shows clean lung fields, normal cardiothoracic ratio, no active consolidation."
                          rows={4}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs mt-1 focus:outline-none focus:ring-2 focus:ring-purple-600"
                          required
                        />
                      </div>

                      <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                        <button type="button" onClick={() => setSelectedRadioRecord(null)} className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-1.5 text-xs text-white bg-purple-600 hover:bg-purple-700 rounded-lg font-bold">Record Findings</button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* 8. WARD AND BED MANAGEMENT */}
            {activeTab === 'wards' && (
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base">Inpatient Ward Bed Allocations</h3>
                    <p className="text-xs text-slate-500 mt-1">Real-time status tracking of multi-ward inpatient beds inside hospital tenant.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {beds.map(bed => (
                      <div key={bed.id} className="p-4 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3 bg-white hover:shadow-xs transition-shadow">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{bed.wardType} Ward</span>
                            <h4 className="font-extrabold text-slate-800 text-lg mt-0.5">Bed {bed.bedNumber}</h4>
                          </div>
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${bed.status === 'Available' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                        </div>

                        {bed.status === 'Occupied' ? (
                          <div className="bg-red-50 p-2.5 rounded-lg border border-red-100 space-y-1.5">
                            <div className="text-[10px] text-red-800">
                              <span className="block font-bold">Occupant: {bed.occupiedByName}</span>
                              <span className="block text-[9px] font-mono mt-0.5">EMR ID: {bed.occupiedBy}</span>
                            </div>
                            <button 
                              id={`btn-discharge-${bed.id}`}
                              onClick={() => handleDischargePatient(bed)}
                              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] py-1 rounded transition-colors"
                            >
                              Clinical Discharge
                            </button>
                          </div>
                        ) : (
                          <div className="bg-emerald-50 text-emerald-800 text-xs py-2 rounded font-semibold text-center border border-emerald-100">
                            Bed Available
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 9. SPECIALIZED CLINICS (THEATRE AND MATERNITY) */}
            {activeTab === 'specialized' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Theatre Surgical Operations logs */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-slate-800 text-base">Operating Theatre Surgery Logs</h3>
                  
                  <div className="space-y-3">
                    {records.filter(r => r.theatreNotes).length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No surgical cases registered in tenant logs.</p>
                    ) : (
                      records.filter(r => r.theatreNotes).map((record) => (
                        <div key={record.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                          <div className="flex justify-between">
                            <span className="font-bold text-xs text-slate-800">{record.patientName}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{record.theatreNotes?.status}</span>
                          </div>
                          <p className="text-xs text-indigo-700 font-semibold">Procedure: {record.theatreNotes?.procedureName}</p>
                          <p className="text-[10px] text-slate-500">Surgeon: {record.theatreNotes?.surgeon}</p>
                          <p className="text-xs text-slate-600 mt-1 border-t pt-1 border-slate-200/50">Findings: {record.theatreNotes?.findings}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Maternal Health Logs */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-slate-800 text-base">Maternity Care (ANC/PNC/Delivery) Logs</h3>
                  
                  <div className="space-y-3">
                    {records.filter(r => r.maternityNotes).length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No maternal records logged in tenant file.</p>
                    ) : (
                      records.filter(r => r.maternityNotes).map((record) => (
                        <div key={record.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-xs text-slate-800">{record.patientName}</span>
                            <span className="bg-pink-50 text-pink-700 font-bold text-[9px] px-2 py-0.5 rounded-full border border-pink-100">
                              {record.maternityNotes?.type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{record.maternityNotes?.notes}</p>
                          <p className="text-[9px] text-slate-400 font-mono">Date logged: {record.date}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* 10. CLINICAL & FINANCIAL REPORTS */}
            {activeTab === 'reports' && (
              <div className="space-y-6">
                
                {/* Aggregated charts / SVGs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Financial SVG chart */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="font-extrabold text-slate-800 text-base">Daily Paid Revenue Breakdown</h3>
                    
                    <div className="h-44 flex items-end justify-center space-x-12 border-b border-slate-100 pb-2">
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-slate-700">KSh {dailyPaidRevenue.toLocaleString()}</span>
                        <div className="w-16 bg-emerald-500 rounded-t-lg mt-2" style={{ height: dailyPaidRevenue > 0 ? '80px' : '4px' }} />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">Patient Cash / M-Pesa</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-indigo-700">KSh {dailyInsuranceRevenue.toLocaleString()}</span>
                        <div className="w-16 bg-indigo-500 rounded-t-lg mt-2" style={{ height: dailyInsuranceRevenue > 0 ? '50px' : '4px' }} />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">Insurance NHIF/SHIF</span>
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-xs text-slate-500">Aggregate Yield: <strong className="text-slate-800 text-sm">KSh {totalFinancialYield.toLocaleString()}</strong></p>
                    </div>
                  </div>

                  {/* Disease analytics bar chart */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="font-extrabold text-slate-800 text-base">Top Diagnosis Case Distribution</h3>
                    
                    <div className="space-y-3.5">
                      {records.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6">No disease cases filed in clinical records yet.</p>
                      ) : (
                        Object.entries(
                          records.reduce((acc, current) => {
                            acc[current.diagnosis] = (acc[current.diagnosis] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>)
                        ).map(([disease, count], idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-700">
                              <span className="font-bold">{disease}</span>
                              <span className="font-semibold">{Number(count)} case(s)</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(Number(count) * 20, 100)}%` }} />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* 11. ROLES & PERMISSIONS MATRIX */}
            {activeTab === 'permissions' && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="bg-indigo-100 text-indigo-800 p-2.5 rounded-xl">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="font-extrabold text-slate-900 text-lg">Hospital Roles & Access Control Matrix</h2>
                        <p className="text-xs text-slate-500 font-medium">Create custom roles and control which staff roles can access clinical, administrative, or billing workspaces.</p>
                      </div>
                    </div>
                  </div>

                  {/* Create Custom Role form */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Add Custom Hospital Role</h3>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={newCustomRoleName}
                          onChange={e => setNewCustomRoleName(e.target.value)}
                          placeholder="e.g. Chief Nurse, Clinical Intern..."
                          className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500 transition-colors"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!newCustomRoleName.trim()) return;
                          const name = newCustomRoleName.trim();
                          try {
                            // Default custom roles get dashboard by default
                            await saveRolePermission(hospitalId, name, ['dashboard']);
                            setNewCustomRoleName('');
                            // Re-fetch role permissions
                            const rPerms = await getRolePermissions(hospitalId);
                            setRolePermissionsList(rPerms);
                          } catch (err: any) {
                            console.error('Failed to save role:', err);
                          }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-colors shrink-0 shadow-sm cursor-pointer"
                      >
                        Create Role
                      </button>
                    </div>
                  </div>

                  {/* Roles and Permissions Matrix */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse bg-white">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 text-[10px] font-bold uppercase border-b border-slate-200">
                          <th className="py-3 px-4">Role / Designation</th>
                          <th className="py-3 px-4">Workspace & Module Authorizations</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                        {/* List all roles */}
                        {Object.keys(DEFAULT_ROLE_PERMISSIONS)
                          .filter(role => role !== 'Super Admin') // Super Admin always gets everything, cannot be changed
                          .concat(
                            rolePermissionsList
                              .map(p => p.roleName)
                              .filter(role => !Object.keys(DEFAULT_ROLE_PERMISSIONS).includes(role))
                          )
                          .map(role => {
                            const customPerm = rolePermissionsList.find(p => p.roleName === role);
                            const activeTabs = customPerm ? customPerm.allowedTabs : (DEFAULT_ROLE_PERMISSIONS[role] || ['dashboard']);
                            const isEditing = editingRoleName === role;

                            const allWorkspaces = [
                              { id: 'dashboard', label: 'Clinical Hub' },
                              { id: 'reception', label: 'Reception & Queue' },
                              { id: 'consultation', label: 'Consultation Room' },
                              { id: 'laboratory', label: 'Lab Workspace' },
                              { id: 'radiology', label: 'Radiology Unit' },
                              { id: 'pharmacy', label: 'Pharmacy Workspace' },
                              { id: 'billing', label: 'Billing & Invoice' },
                              { id: 'wards', label: 'Ward Allocations' },
                              { id: 'specialized', label: 'Theatre & Maternity' },
                              { id: 'reports', label: 'Reports & Analytics' },
                              { id: 'settings', label: 'Clinic Settings' }
                            ];

                            return (
                              <tr key={role} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-4 px-4 font-bold text-slate-800">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                    <span>{role}</span>
                                  </div>
                                  {customPerm ? (
                                    <span className="text-[10px] text-indigo-600 bg-indigo-50 font-semibold px-2 py-0.5 rounded border border-indigo-100 mt-1 inline-block">
                                      Custom Role / Override
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-semibold mt-1 inline-block">
                                      Standard Design System Default
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 px-4">
                                  {isEditing ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                      {allWorkspaces.map(ws => (
                                        <label key={ws.id} className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer hover:text-indigo-600 transition-colors">
                                          <input
                                            type="checkbox"
                                            checked={editingAllowedTabs.includes(ws.id)}
                                            onChange={e => {
                                              if (e.target.checked) {
                                                setEditingAllowedTabs([...editingAllowedTabs, ws.id]);
                                              } else {
                                                setEditingAllowedTabs(editingAllowedTabs.filter(id => id !== ws.id));
                                              }
                                            }}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                          />
                                          <span>{ws.label}</span>
                                        </label>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {activeTabs.map(tab => {
                                        const label = allWorkspaces.find(w => w.id === tab)?.label || tab;
                                        return (
                                          <span key={tab} className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                            {label}
                                          </span>
                                        );
                                      })}
                                      {activeTabs.length === 0 && (
                                        <span className="text-[10px] italic text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                          Restricted (No access)
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="py-4 px-4 text-right">
                                  {isEditing ? (
                                    <div className="space-x-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingRoleName(null);
                                          setEditingAllowedTabs([]);
                                        }}
                                        className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-2.5 py-1.5 rounded-md font-bold transition-colors cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await saveRolePermission(hospitalId, role, editingAllowedTabs);
                                            setEditingRoleName(null);
                                            setEditingAllowedTabs([]);
                                            const rPerms = await getRolePermissions(hospitalId);
                                            setRolePermissionsList(rPerms);
                                          } catch (err) {
                                            console.error('Failed to save permissions:', err);
                                          }
                                        }}
                                        className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-md font-bold transition-colors cursor-pointer shadow-xs"
                                      >
                                        Save Matrix
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="space-x-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingRoleName(role);
                                          setEditingAllowedTabs(activeTabs);
                                        }}
                                        className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-2.5 py-1.5 rounded-md font-bold transition-colors cursor-pointer"
                                      >
                                        Modify
                                      </button>
                                      {customPerm && (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              await deleteRolePermission(customPerm.id);
                                              const rPerms = await getRolePermissions(hospitalId);
                                              setRolePermissionsList(rPerms);
                                            } catch (err) {
                                              console.error('Failed to delete role custom permission:', err);
                                            }
                                          }}
                                          className="text-[10px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-2.5 py-1.5 rounded-md font-bold transition-colors cursor-pointer"
                                        >
                                          Reset Default
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>
            )}

            {activeTab === 'settings' && (() => {
              const canEditSettings = isAllowed(['Hospital Admin', 'Doctor', 'Solo Practitioner']);
              return (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center space-x-3 mb-6">
                      <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-xl">
                        <Settings className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="font-extrabold text-slate-900 text-lg">Clinic Profile & Metadata</h2>
                        <p className="text-xs text-slate-500 font-medium">Update the clinic name, contacts, tax parameters, and print receipt profiles.</p>
                      </div>
                    </div>

                    {!canEditSettings && (
                      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold rounded-xl flex items-start space-x-2.5 animate-fade-in">
                        <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-extrabold text-amber-950">ℹ️ View-Only Mode Enabled</p>
                          <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                            You are logged in as a simulated <strong className="font-extrabold text-slate-800">{currentUser.role}</strong>. Editing clinic profiles, PIN registries, and custom slogans is restricted to <strong>Hospital Admins</strong>, <strong>Doctors</strong>, and <strong>Solo Practitioners</strong>.
                          </p>
                          <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                            To customize these values, please logout and select an authorized user persona (e.g., Hospital Admin) on the sign-in selector.
                          </p>
                        </div>
                      </div>
                    )}

                    {settingsSuccessMsg && (
                      <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-xl flex items-center space-x-2 animate-fade-in">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{settingsSuccessMsg}</span>
                      </div>
                    )}

                    <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      
                      {/* Input Columns */}
                      <div className="lg:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          
                          {/* Name */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Clinic / Facility Name *</label>
                            <input 
                              type="text"
                              required
                              disabled={!canEditSettings}
                              value={settingsName}
                              onChange={(e) => setSettingsName(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              placeholder="e.g. RaphaJoy Medical Center"
                            />
                          </div>

                          {/* Tax/PIN Number */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Tax Registration No. / PIN</label>
                            <input 
                              type="text"
                              disabled={!canEditSettings}
                              value={settingsTaxNumber}
                              onChange={(e) => setSettingsTaxNumber(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              placeholder="e.g. PIN A001234567X"
                            />
                          </div>

                          {/* Phone */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Contact Phone Number</label>
                            <input 
                              type="text"
                              disabled={!canEditSettings}
                              value={settingsPhone}
                              onChange={(e) => setSettingsPhone(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              placeholder="e.g. +254 700 800 900"
                            />
                          </div>

                          {/* Email */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Support Email Address</label>
                            <input 
                              type="email"
                              disabled={!canEditSettings}
                              value={settingsEmail}
                              onChange={(e) => setSettingsEmail(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              placeholder="e.g. contact@yourclinic.com"
                            />
                          </div>

                          {/* Website */}
                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Website URL</label>
                            <input 
                              type="text"
                              disabled={!canEditSettings}
                              value={settingsWebsite}
                              onChange={(e) => setSettingsWebsite(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              placeholder="e.g. www.yourclinic.com"
                            />
                          </div>

                          {/* Address */}
                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Physical & Postal Address</label>
                            <input 
                              type="text"
                              disabled={!canEditSettings}
                              value={settingsAddress}
                              onChange={(e) => setSettingsAddress(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              placeholder="e.g. P.O. Box 4501-00100, Nairobi, Kenya"
                            />
                          </div>

                          {/* Custom Footer Notes */}
                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Receipt Footer / Slogan Notes</label>
                            <textarea 
                              rows={3}
                              disabled={!canEditSettings}
                              value={settingsNotes}
                              onChange={(e) => setSettingsNotes(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-emerald-500 transition-colors resize-none disabled:opacity-60 disabled:cursor-not-allowed"
                              placeholder="e.g. Thank you for visiting us! Get well soon • Under compassionate care"
                            />
                          </div>

                        </div>

                        <div className="pt-2">
                          {canEditSettings ? (
                            <button
                              type="submit"
                              disabled={isSavingSettings}
                              className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-xs px-6 py-3 rounded-xl cursor-pointer text-center transition-all shadow-md active:scale-95 flex items-center justify-center space-x-2 animate-fade-in"
                            >
                              {isSavingSettings ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  <span>Saving Settings...</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-4 h-4" />
                                  <span>Save Clinic Profile</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="text-xs text-slate-400 font-bold italic bg-slate-100 px-4 py-2.5 rounded-lg border border-slate-200 inline-block">
                              ⚠️ Saving Disabled (Requires Admin / Doctor Role)
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Receipt Preview on the Right */}
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                          <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Live Receipt Preview</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full">Synchronized</span>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-xs space-y-3.5">
                          <div className="text-center space-y-1 border-b border-dashed border-slate-200 pb-3">
                            <h4 className="font-extrabold text-xs text-slate-800">{settingsName || 'Your Clinic Name'}</h4>
                            <p className="text-[9px] text-slate-400">{settingsAddress || 'Address details here'}</p>
                            <p className="text-[9px] text-slate-400 font-medium">Email: {settingsEmail || 'support@clinic.com'}</p>
                            <p className="text-[9px] text-slate-400 font-medium">Phone: {settingsPhone || '+254 xxx xxx xxx'}</p>
                            {settingsWebsite && <p className="text-[9px] text-slate-400 font-medium">Web: {settingsWebsite}</p>}
                            {settingsTaxNumber && <p className="text-[8px] font-mono text-slate-400 mt-1">Tax ID: {settingsTaxNumber}</p>}
                          </div>

                          <div className="space-y-1.5 text-[9px] text-slate-400">
                            <p><span className="font-semibold text-slate-600">Receipt Ref:</span> <span className="font-mono">REC-998273</span></p>
                            <p><span className="font-semibold text-slate-600">Patient:</span> <span className="text-slate-700 font-medium">John Doe (Demo)</span></p>
                            <p><span className="font-semibold text-slate-600">Total Charged:</span> <span className="text-slate-800 font-bold text-xs">KSh 3,500</span></p>
                          </div>

                          <div className="border-t border-dashed border-slate-200 pt-3 text-center">
                            <p className="text-[9px] font-bold text-slate-600">{settingsNotes || 'Thank you for visiting us! Get well soon'}</p>
                          </div>
                        </div>

                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-slate-600 text-[11px] leading-relaxed">
                          <p className="font-bold text-indigo-900 mb-0.5">💡 Design Note</p>
                          This live preview displays how your clinical receipt print outputs and billing document headings will appear in real time for patients.
                        </div>
                      </div>

                    </form>
                  </div>
                </div>
              );
            })()}

          </div>
        )}

      </main>

      {/* Printable / Viewable Receipt Dialog */}
      {showReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Toolbar (hidden when printing) */}
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 justify-between sm:items-center no-print">
              <div className="flex items-center gap-2 text-slate-700">
                <Printer className="w-5 h-5 text-emerald-600 animate-pulse" />
                <div>
                  <span className="font-extrabold text-sm block">Official Patient Receipt</span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Ref: {showReceipt.id.substring(0, 12)}...</span>
                </div>
              </div>
              
              {/* Format Toggle and Print triggers */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {/* Print Format Switcher */}
                <div className="flex items-center bg-slate-200/80 p-1 rounded-xl border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setReceiptFormat('a4')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      receiptFormat === 'a4'
                        ? 'bg-white text-slate-800 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Standard (A4)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptFormat('thermal')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      receiptFormat === 'thermal'
                        ? 'bg-white text-slate-800 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Thermal (80mm)
                  </button>
                </div>

                {/* Print Button */}
                <button
                  type="button"
                  onClick={() => handleLaunchPrintWindow()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                  title="Opens a clean printable window to bypass iframe restriction"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowReceipt(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold p-1.5 hover:bg-slate-150 rounded-full transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Sandbox Notice (Highly helpful for iframe previews) */}
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-[11px] text-amber-800 flex items-start gap-2 no-print">
              <span className="text-base leading-none">💡</span>
              <p className="font-semibold leading-relaxed">
                If printing is blocked inside this preview, the <strong>"Print"</strong> button will launch a dedicated, clean browser tab which triggers your printer immediately.
              </p>
            </div>

            {/* Receipt Preview Area - Adaptive Styling based on choice */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex items-center justify-center">
              
              <div 
                className={`bg-white transition-all duration-300 shadow-md ${
                  receiptFormat === 'thermal' 
                    ? 'w-[78mm] p-4 font-mono text-[11px] border border-slate-300' 
                    : 'w-full max-w-md p-8 rounded-xl border border-slate-200'
                }`}
                id="print-receipt-container"
              >
                {/* Custom styles for printing from browser directly */}
                <style>{`
                  @media print {
                    body * { visibility: hidden !important; }
                    .no-print, .no-print * { display: none !important; visibility: hidden !important; }
                    #print-receipt-container, #print-receipt-container * { visibility: visible !important; }
                    #print-receipt-container {
                      position: absolute !important;
                      left: 0 !important;
                      top: 0 !important;
                      width: 100% !important;
                      margin: 0 !important;
                      padding: 20px !important;
                      background: white !important;
                      color: black !important;
                      box-shadow: none !important;
                      border: none !important;
                    }
                    ${receiptFormat === 'thermal' ? `
                      #print-receipt-container {
                        width: 76mm !important;
                        font-size: 11px !important;
                        font-family: monospace !important;
                      }
                      @page { size: 80mm auto; margin: 0; }
                    ` : `
                      @page { size: auto; margin: 15mm; }
                    `}
                  }
                `}</style>

                {/* Receipt Header */}
                <div className="text-center space-y-2">
                  <div className="flex flex-col items-center justify-center space-y-1">
                    {systemLogo ? (
                      <div className={`bg-white p-1 rounded-xl shadow-xs border border-slate-150 flex items-center justify-center overflow-hidden mb-1 ${
                        receiptFormat === 'thermal' ? 'w-12 h-12' : 'w-16 h-16'
                      }`}>
                        <img 
                          src={systemLogo} 
                          alt="Clinic Logo" 
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className={`bg-emerald-500 rounded-xl flex items-center justify-center text-white font-bold mb-1 ${
                        receiptFormat === 'thermal' ? 'w-10 h-10' : 'w-12 h-12'
                      }`}>
                        <Activity className={receiptFormat === 'thermal' ? 'w-5 h-5' : 'w-6 h-6'} />
                      </div>
                    )}
                    <h2 className={`font-black text-slate-800 tracking-tight leading-tight ${
                      receiptFormat === 'thermal' ? 'text-sm' : 'text-lg'
                    }`}>{displayedHospitalName}</h2>
                    <p className={`uppercase font-extrabold tracking-widest text-emerald-600 ${
                      receiptFormat === 'thermal' ? 'text-[9px]' : 'text-[10px]'
                    }`}>Official Patient Receipt</p>
                  </div>
                  
                  <div className={`text-slate-400 space-y-0.5 leading-relaxed ${
                    receiptFormat === 'thermal' ? 'text-[9px]' : 'text-[10px]'
                  }`}>
                    <p>{displayedAddress}</p>
                    <p>Email: {displayedEmail} | Phone: {displayedPhone}</p>
                    {displayedWebsite && <p>Website: {displayedWebsite}</p>}
                    {displayedTaxNumber && <p className="text-[8px] opacity-75 font-mono">Tax ID: {displayedTaxNumber}</p>}
                  </div>
                </div>

                <div className={`border-t my-3 ${receiptFormat === 'thermal' ? 'border-dashed border-slate-400' : 'border-slate-200'}`}></div>

                {/* Receipt Info Section */}
                <div className={`text-slate-600 leading-relaxed ${
                  receiptFormat === 'thermal' 
                    ? 'space-y-1 text-[10px]' 
                    : 'grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-150'
                }`}>
                  <div className="space-y-1">
                    <p><span className="text-slate-400 font-medium">Receipt Ref:</span> <strong className="font-mono text-slate-700 uppercase break-all">{showReceipt.id}</strong></p>
                    <p><span className="text-slate-400 font-medium">Date Issued:</span> <span className="font-semibold text-slate-700">{showReceipt.invoiceDate || new Date(showReceipt.createdAt).toLocaleDateString()}</span></p>
                    <p><span className="text-slate-400 font-medium">Payment Mode:</span> <strong className="text-slate-700">{showReceipt.paymentMethod || 'M-Pesa'}</strong></p>
                  </div>
                  <div className={`space-y-1 ${receiptFormat === 'thermal' ? 'pt-1 border-t border-dashed border-slate-200' : 'text-right'}`}>
                    <p><span className="text-slate-400 font-medium">Patient:</span> <strong className="text-slate-800">{showReceipt.patientName}</strong></p>
                    <p><span className="text-slate-400 font-medium">Patient EMR:</span> <span className="font-mono text-slate-700">{showReceipt.patientId}</span></p>
                    <p>
                      <span className="text-slate-400 font-medium">Status:</span>{' '}
                      <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {showReceipt.status}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Itemized Table */}
                <div className="mt-4">
                  <table className="w-full text-left text-[11px] sm:text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-1.5">Description</th>
                        <th className="py-1.5 text-right">Unit Price</th>
                        <th className="py-1.5 text-center">Qty</th>
                        <th className="py-1.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {showReceipt.items && showReceipt.items.length > 0 ? (
                        showReceipt.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-1.5 pr-1">{item.description}</td>
                            <td className="py-1.5 text-right">KSh {item.amount.toLocaleString()}</td>
                            <td className="py-1.5 text-center font-mono">{item.quantity}</td>
                            <td className="py-1.5 text-right font-bold text-slate-900">KSh {(item.amount * item.quantity).toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-1.5 font-medium">Standard Consultation Fee</td>
                          <td className="py-1.5 text-right">KSh {showReceipt.totalAmount.toLocaleString()}</td>
                          <td className="py-1.5 text-center">1</td>
                          <td className="py-1.5 text-right font-bold text-slate-900">KSh {showReceipt.totalAmount.toLocaleString()}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className={`border-t my-3 ${receiptFormat === 'thermal' ? 'border-dashed border-slate-400' : 'border-slate-200'}`}></div>

                {/* Financial Totals */}
                <div className={`space-y-1.5 text-slate-600 ml-auto ${
                  receiptFormat === 'thermal' ? 'w-full text-[10px]' : 'text-xs max-w-xs'
                }`}>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Total Invoice Amount:</span>
                    <span className="font-semibold text-slate-800">KSh {showReceipt.totalAmount.toLocaleString()}</span>
                  </div>
                  {showReceipt.insuranceClaimed > 0 && (
                    <div className="flex justify-between text-indigo-700 font-semibold">
                      <span>SHIF / NHIF Cover Subsidy:</span>
                      <span>- KSh {showReceipt.insuranceClaimed.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1.5 text-emerald-700">
                    <strong className="text-slate-800">Total Amount Paid:</strong>
                    <strong className={`font-black text-slate-900 ${
                      receiptFormat === 'thermal' ? 'text-xs' : 'text-base'
                    }`}>KSh {showReceipt.patientPaid.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between border-t border-dashed pt-1 text-slate-500 text-[10px]">
                    <span>Outstanding Balance:</span>
                    <span className="font-mono font-bold">
                      KSh {Math.max(0, showReceipt.totalAmount - showReceipt.insuranceClaimed - showReceipt.patientPaid).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className={`border-t my-4 ${receiptFormat === 'thermal' ? 'border-dashed border-slate-400' : 'border-slate-200'}`}></div>

                {/* Stamp / Clearance Block & Footer */}
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="border border-emerald-400 bg-emerald-50 text-emerald-800 text-[9px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-md flex items-center gap-1 shadow-xs">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Verified & Paid
                  </div>

                  <div className="space-y-0.5">
                    <p className={`font-bold text-slate-700 ${receiptFormat === 'thermal' ? 'text-[10px]' : 'text-xs'}`}>Thank you for visiting us!</p>
                    <p className="text-[9px] text-slate-400 italic">Get well soon • Under compassionate care</p>
                  </div>

                  {/* Signature Block */}
                  <div className={`pt-3 w-full flex justify-between text-[8px] text-slate-400 font-semibold px-2 ${
                    receiptFormat === 'thermal' ? 'hidden' : 'flex'
                  }`}>
                    <div className="flex flex-col items-center">
                      <div className="w-20 border-b border-slate-200 mb-1"></div>
                      <span>Patient Signature</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-20 border-b border-slate-200 mb-1"></div>
                      <span>Authorized Cashier</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Bottom Close bar (hidden when printing) */}
            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-150 flex justify-between items-center no-print">
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Format: {receiptFormat === 'thermal' ? 'Thermal 80mm' : 'Standard A4'}</span>
              <button
                type="button"
                onClick={() => setShowReceipt(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer text-center transition-all shadow-xs active:scale-95"
              >
                Close Preview
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🛒 Direct Clinical Order & Billings Hub Modal */}
      {showDirectOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
                <div>
                  <h2 className="font-extrabold text-base">Clinical Order & Billings Hub</h2>
                  <p className="text-[11px] text-slate-300">Submit medicine, lab tests, scans, or general bills directly to the Cashier.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDirectOrderModal(false);
                  setOrderItems([]);
                  setOrderPatientId('');
                }}
                className="text-slate-400 hover:text-white font-bold p-1 hover:bg-slate-800 rounded-full transition-all cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitDirectOrder} className="flex-1 overflow-y-auto p-6 space-y-5 flex flex-col">
              
              {/* Patient Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">
                  Select Patient <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={orderPatientId}
                  onChange={(e) => setOrderPatientId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.age}y {p.gender}) - Insurance: {p.insuranceType}
                    </option>
                  ))}
                </select>
              </div>

              {/* Add New Item Section */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <span className="block text-xs font-bold text-slate-800 uppercase tracking-widest border-b pb-1">
                  Add Item / Clinical Request
                </span>

                {/* Category selector tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 bg-slate-200/80 p-1 rounded-lg text-[11px] font-bold gap-1">
                  {(['Consultation', 'Medicine', 'Lab', 'Radiology', 'Ward', 'Theatre & Maternity', 'Other'] as const).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedItemCategory(cat)}
                      className={`py-1.5 px-0.5 rounded-md text-center transition-all cursor-pointer text-[10px] md:text-[11px] whitespace-nowrap overflow-hidden text-ellipsis ${
                        selectedItemCategory === cat
                          ? 'bg-white text-slate-800 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {cat === 'Consultation' ? '🩺 Consult' : 
                       cat === 'Medicine' ? '💊 Meds' : 
                       cat === 'Lab' ? '🔬 Lab' : 
                       cat === 'Radiology' ? '📷 Scan' : 
                       cat === 'Ward' ? '🛌 Ward' : 
                       cat === 'Theatre & Maternity' ? '✂️ Theatre' : 
                       '⚙️ Custom'}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  
                  {/* Option fields depending on category */}
                  <div className="md:col-span-6 space-y-1.5">
                    {selectedItemCategory === 'Consultation' && (
                      <>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Consultation Type</label>
                        <select
                          value={selectedConsultationType}
                          onChange={(e) => setSelectedConsultationType(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-medium"
                        >
                          <option value="">-- Choose Consultation Type --</option>
                          <option value="General Practitioner Consultation">GP Consultation (Default: KSh 1,000)</option>
                          <option value="Specialist Consultation">Specialist Consultation (Default: KSh 3,000)</option>
                          <option value="Pediatric Consultation">Pediatric Consultation (Default: KSh 1,500)</option>
                          <option value="Dental Consultation">Dental Consultation (Default: KSh 1,500)</option>
                          <option value="Other Consultation Fee">Other Consultation Fee (Default: KSh 1,000)</option>
                        </select>
                      </>
                    )}

                    {selectedItemCategory === 'Medicine' && (
                      <>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Medicine</label>
                        <select
                          value={selectedStockDrugId}
                          onChange={(e) => setSelectedStockDrugId(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-medium"
                        >
                          <option value="">-- Choose Medicine from Stock --</option>
                          {stock.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.drugName} (Qty: {d.quantity} units remaining) - KSh {(d.unitPrice * 10).toLocaleString()}/pack
                            </option>
                          ))}
                        </select>

                        {/* Dosage / Frequency for Pharmacy dispatch */}
                        <div className="grid grid-cols-2 gap-2 pt-1.5">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Dosage</label>
                            <input 
                              type="text" 
                              value={orderDrugDosage}
                              onChange={(e) => setOrderDrugDosage(e.target.value)}
                              placeholder="e.g. 500mg"
                              className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Frequency</label>
                            <select
                              value={orderDrugFrequency}
                              onChange={(e) => setOrderDrugFrequency(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800"
                            >
                              <option value="OD (Once daily)">OD (Once daily)</option>
                              <option value="BD (Twice daily)">BD (Twice daily)</option>
                              <option value="TDS (Thrice daily)">TDS (Thrice daily)</option>
                              <option value="QDS (Four times daily)">QDS (Four times daily)</option>
                              <option value="PRN (As required)">PRN (As required)</option>
                            </select>
                          </div>
                        </div>
                      </>
                    )}

                    {selectedItemCategory === 'Lab' && (
                      <>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Laboratory Test</label>
                        <select
                          value={selectedCommonLabTest}
                          onChange={(e) => setSelectedCommonLabTest(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-medium"
                        >
                          <option value="">-- Choose Common Laboratory Test --</option>
                          <option value="Malaria Blood Smear">Malaria Blood Smear (KSh 500)</option>
                          <option value="Full Blood Count">Full Blood Count (KSh 800)</option>
                          <option value="Urinalysis">Urinalysis (KSh 400)</option>
                          <option value="Blood Glucose">Blood Glucose (KSh 300)</option>
                          <option value="Lipid Profile">Lipid Profile (KSh 1,200)</option>
                          <option value="Renal Function Test">Renal Function Test (KSh 1,500)</option>
                          <option value="Other Laboratory Test">Other Laboratory Test (KSh 500)</option>
                        </select>
                      </>
                    )}

                    {selectedItemCategory === 'Radiology' && (
                      <>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Radiology Scan</label>
                        <select
                          value={selectedCommonRadioScan}
                          onChange={(e) => setSelectedCommonRadioScan(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-medium"
                        >
                          <option value="">-- Choose Radiology Scan --</option>
                          <option value="Chest X-Ray">Chest X-Ray (KSh 1,500)</option>
                          <option value="Abdominal Ultrasound">Abdominal Ultrasound (KSh 2,000)</option>
                          <option value="Pelvic Scan">Pelvic Scan (KSh 1,800)</option>
                          <option value="CT Brain Scan">CT Brain Scan (KSh 6,500)</option>
                          <option value="MRI Scan">MRI Scan (KSh 12,000)</option>
                          <option value="Other Scan / Imaging">Other Scan / Imaging (KSh 2,000)</option>
                        </select>
                      </>
                    )}

                    {selectedItemCategory === 'Ward' && (
                      <>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Ward Type</label>
                        <select
                          value={selectedWardType}
                          onChange={(e) => setSelectedWardType(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-medium"
                        >
                          <option value="">-- Choose Ward Bed Category --</option>
                          <option value="General Ward">General Ward (Default: KSh 1,000/day)</option>
                          <option value="Maternity Ward">Maternity Ward (Default: KSh 1,500/day)</option>
                          <option value="ICU Ward">ICU Ward (Default: KSh 3,000/day)</option>
                          <option value="Pediatric Ward">Pediatric Ward (Default: KSh 1,000/day)</option>
                        </select>
                      </>
                    )}

                    {selectedItemCategory === 'Theatre & Maternity' && (
                      <>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Procedure / Service</label>
                        <select
                          value={selectedTheatreProcedure}
                          onChange={(e) => setSelectedTheatreProcedure(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-medium"
                        >
                          <option value="">-- Choose Theatre / Maternity Package --</option>
                          <option value="Normal Delivery">Normal Delivery (Default: KSh 15,000)</option>
                          <option value="C-Section Delivery">C-Section Delivery (Default: KSh 50,000)</option>
                          <option value="Minor Surgery">Minor Surgery (Default: KSh 10,000)</option>
                          <option value="Major Surgery">Major Surgery (Default: KSh 45,000)</option>
                          <option value="Maternity Package">Maternity Package (Default: KSh 25,000)</option>
                        </select>
                      </>
                    )}

                    {selectedItemCategory === 'Other' && (
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</label>
                        <input
                          type="text"
                          value={customItemDesc}
                          onChange={(e) => setCustomItemDesc(e.target.value)}
                          placeholder="e.g. Wound Dressing"
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-medium"
                        />
                      </div>
                    )}
                  </div>

                  {/* Pricing / Payment Override Input */}
                  <div className="md:col-span-3 space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {selectedItemCategory === 'Ward' ? 'Rate per Day (KSh)' : 'Payment / Unit (KSh)'}
                    </label>
                    {selectedItemCategory === 'Other' ? (
                      <input
                        type="number"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(e.target.value)}
                        placeholder="e.g. 1200"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    ) : (
                      <input
                        type="number"
                        value={editablePrice}
                        onChange={(e) => setEditablePrice(e.target.value)}
                        placeholder="0"
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    )}
                  </div>

                  {/* Quantity input */}
                  <div className="md:col-span-3 space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {selectedItemCategory === 'Ward' ? 'Days' : 'Qty'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={orderItemQty}
                      onChange={(e) => setOrderItemQty(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-medium text-center focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Add button */}
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddOrderItem}
                      className="w-full bg-slate-800 hover:bg-slate-950 text-white font-bold text-xs p-2.5 rounded-lg text-center transition-all cursor-pointer"
                    >
                      Add
                    </button>
                  </div>

                </div>
              </div>

              {/* Basket list */}
              <div className="flex-1 flex flex-col min-h-[150px]">
                <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Basket Items ({orderItems.length})
                </span>

                <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 bg-slate-50 flex flex-col">
                  {orderItems.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-400 text-center">
                      <ShoppingCart className="w-8 h-8 opacity-40 mb-2" />
                      <p className="text-xs font-semibold">Your direct order basket is currently empty.</p>
                      <p className="text-[10px]">Select a category and add medicine, labs, or scans above.</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[220px]">
                      {orderItems.map(item => (
                        <div key={item.id} className="p-3 bg-white hover:bg-slate-50/50 flex items-center justify-between transition-all">
                          <div className="space-y-0.5 pr-2">
                            <span className="block font-bold text-xs text-slate-800">{item.description}</span>
                            <div className="flex items-center space-x-1.5 text-[10px] text-slate-500">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">{item.category}</span>
                              <span>•</span>
                              <span>KSh {item.amount.toLocaleString()} × {item.quantity}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3 flex-shrink-0">
                            <span className="text-xs font-bold text-slate-900 font-mono">KSh {(item.amount * item.quantity).toLocaleString()}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveOrderItem(item.id)}
                              className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary Footer */}
                  {orderItems.length > 0 && (
                    <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Estimated Total Cost</span>
                        <strong className="text-lg font-black text-emerald-400 font-mono">
                          KSh {orderItems.reduce((acc, curr) => acc + (curr.amount * curr.quantity), 0).toLocaleString()}
                        </strong>
                      </div>
                      <div className="text-right text-[10px] text-slate-300 font-medium">
                        {(() => {
                          const patientObj = patients.find(p => p.id === orderPatientId);
                          if (!patientObj) return "Choose a patient to calculate insurance coverage.";
                          const total = orderItems.reduce((acc, curr) => acc + (curr.amount * curr.quantity), 0);
                          if (patientObj.insuranceType === 'NHIF' || patientObj.insuranceType === 'SHIF') {
                            const cov = Math.min(total, 3000);
                            return `Insurance Status: ${patientObj.insuranceType} • Cover: KSh ${cov.toLocaleString()} • Pay: KSh ${(total - cov).toLocaleString()}`;
                          } else if (patientObj.insuranceType === 'Private') {
                            const cov = Math.round(total * 0.8);
                            return `Insurance Status: Private (80%) • Cover: KSh ${cov.toLocaleString()} • Pay: KSh ${(total - cov).toLocaleString()}`;
                          } else {
                            return "Insurance Status: Out-of-pocket (Full Self-Pay)";
                          }
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 border-t pt-4 mt-auto">
                <button
                  type="button"
                  onClick={() => {
                    setShowDirectOrderModal(false);
                    setOrderItems([]);
                    setOrderPatientId('');
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs px-5 py-3 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!orderPatientId || orderItems.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white font-black text-xs px-6 py-3 rounded-xl flex items-center space-x-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Send Order & Invoice to Cashier</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 🏥 Clinical Discharge Confirmation Modal */}
      {dischargeConfirmBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-red-600 text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Bed className="w-5 h-5 text-red-200" />
                <h2 className="font-extrabold text-base">Clinical Discharge Authorization</h2>
              </div>
              <button
                type="button"
                onClick={() => setDischargeConfirmBed(null)}
                className="text-red-200 hover:text-white font-bold p-1 hover:bg-red-700 rounded-full transition-all cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="flex flex-col items-center justify-center text-center space-y-2 mb-2">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                  <Bed className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-slate-800 text-sm">Discharge Patient & Free Bed</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  You are about to authorize the clinical discharge of <strong className="text-slate-800">{dischargeConfirmBed.occupiedByName}</strong> from <strong className="text-slate-800">{dischargeConfirmBed.wardType} Ward Bed {dischargeConfirmBed.bedNumber}</strong>.
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Patient EMR ID:</span>
                  <span className="text-slate-800 font-mono font-bold">{dischargeConfirmBed.occupiedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Ward Station:</span>
                  <span className="text-slate-800 font-bold">{dischargeConfirmBed.wardType} Ward</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Bed Location:</span>
                  <span className="text-slate-800 font-bold">{dischargeConfirmBed.bedNumber}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 text-center italic">
                Note: This will mark the patient as discharged from active admission, update their clinic file, and release this bed resource immediately.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="bg-slate-50 px-6 py-4 flex justify-end space-x-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isDischarging}
                onClick={() => setDischargeConfirmBed(null)}
                className="bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-lg transition-all cursor-pointer"
              >
                Keep Admitted
              </button>
              <button
                type="button"
                disabled={isDischarging}
                onClick={executeClinicalDischarge}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs px-5 py-2.5 rounded-lg flex items-center space-x-1 transition-all shadow-md cursor-pointer active:scale-95"
              >
                {isDischarging ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                    <span>Discharging...</span>
                  </>
                ) : (
                  <span>Authorize Discharge</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
