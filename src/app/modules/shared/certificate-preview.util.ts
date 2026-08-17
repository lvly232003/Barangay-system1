import type { Certificate } from '../../services/certificate.service';

const SAMPLE_CERTS: Record<string, Certificate> = {
  'sample-clearance': {
    id: 'sample-clearance',
    userId: 'sample',
    userName: 'Juan Dela Cruz',
    certificateType: 'Barangay Clearance',
    certificateNumber: 'BMS-CLR-SAMPLE-001',
    status: 'issued',
    requestDate: new Date().toISOString().slice(0, 10),
    issuedDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    purpose: 'Employment requirement',
    notes: 'Museum format preview — Barangay Clearance'
  },
  'sample-residency': {
    id: 'sample-residency',
    userId: 'sample',
    userName: 'Ana Lopez',
    certificateType: 'Barangay Residency',
    certificateNumber: 'BMS-RES-SAMPLE-001',
    status: 'issued',
    requestDate: new Date().toISOString().slice(0, 10),
    issuedDate: new Date().toISOString().slice(0, 10),
    purpose: 'School enrollment',
    notes: 'Museum format preview — Barangay Residency'
  },
  'sample-indigency': {
    id: 'sample-indigency',
    userId: 'sample',
    userName: 'Maria Santos',
    certificateType: 'Indigency',
    certificateNumber: 'BMS-IND-SAMPLE-001',
    status: 'issued',
    requestDate: new Date().toISOString().slice(0, 10),
    issuedDate: new Date().toISOString().slice(0, 10),
    purpose: 'Medical assistance',
    notes: 'Museum format preview — Indigency'
  },
  'sample-business': {
    id: 'sample-business',
    userId: 'sample',
    userName: 'Pedro Reyes Trading',
    certificateType: 'Business Endorsement',
    certificateNumber: 'BMS-BUS-SAMPLE-001',
    status: 'issued',
    requestDate: new Date().toISOString().slice(0, 10),
    issuedDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    purpose: 'Business permit processing',
    notes: 'Museum format preview — Business Endorsement'
  },
  'sample-certification': {
    id: 'sample-certification',
    userId: 'sample',
    userName: 'Rosa Mendoza',
    certificateType: 'Barangay Certification',
    certificateNumber: 'BMS-CERT-SAMPLE-001',
    status: 'issued',
    requestDate: new Date().toISOString().slice(0, 10),
    issuedDate: new Date().toISOString().slice(0, 10),
    purpose: 'Living Together / Guardianship',
    notes: 'Museum format preview — Barangay Certification'
  },
  'sample-vehicle': {
    id: 'sample-vehicle',
    userId: 'sample',
    userName: 'Carlo Diaz',
    certificateType: 'Vehicle Inspection / Renewal',
    certificateNumber: 'BMS-VEH-SAMPLE-001',
    status: 'issued',
    requestDate: new Date().toISOString().slice(0, 10),
    issuedDate: new Date().toISOString().slice(0, 10),
    purpose: 'Vehicle inspection / renewal',
    notes: 'Museum format preview — Vehicle Inspection / Renewal'
  },
  'sample-low-income': {
    id: 'sample-low-income',
    userId: 'sample',
    userName: 'Elena Cruz',
    certificateType: 'Low Income',
    certificateNumber: 'BMS-LOW-SAMPLE-001',
    status: 'issued',
    requestDate: new Date().toISOString().slice(0, 10),
    issuedDate: new Date().toISOString().slice(0, 10),
    purpose: 'Assistance program requirement',
    notes: 'Museum format preview — Low Income'
  },
  'sample-jobseeker': {
    id: 'sample-jobseeker',
    userId: 'sample',
    userName: 'Mark Villanueva',
    certificateType: 'First Time Jobseeker',
    certificateNumber: 'BMS-JOB-SAMPLE-001',
    status: 'issued',
    requestDate: new Date().toISOString().slice(0, 10),
    issuedDate: new Date().toISOString().slice(0, 10),
    purpose: 'First time jobseeker certification',
    notes: 'Museum format preview — First Time Jobseeker'
  },
  'sample-other': {
    id: 'sample-other',
    userId: 'sample',
    userName: 'Grace Ramos',
    certificateType: 'Other Certifications',
    certificateNumber: 'BMS-OTH-SAMPLE-001',
    status: 'issued',
    requestDate: new Date().toISOString().slice(0, 10),
    issuedDate: new Date().toISOString().slice(0, 10),
    purpose: 'Other official barangay certification',
    notes: 'Museum format preview — Other Certifications'
  }
};

export function getSampleCertificate(id: string): Certificate | null {
  return SAMPLE_CERTS[id] || null;
}

export function findCertificateById(
  certificates: Certificate[],
  id: string
): Certificate | null {
  const sample = getSampleCertificate(id);
  if (sample) return sample;
  return certificates.find((c) => String(c.id) === String(id)) || null;
}
