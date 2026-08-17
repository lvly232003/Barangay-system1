import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  Certificate,
  CertificateForm,
  CertificateService
} from '../../../../services/certificate.service';
import { openCertificateView } from '../../../shared/certificate-view.util';

export interface CertificateFormatInfo {
  key: string;
  name: string;
  type: string;
  description: string;
  coverage: string[];
  layout: 'generic' | 'indigency' | 'business';
  sampleRoute: string;
  fee?: number;
  processingTime?: string;
  requirements: string[];
}

@Component({
  selector: 'app-admin-certificate-management',
  templateUrl: './admin-certificate-management.component.html',
  styleUrls: ['./admin-certificate-management.component.scss']
})
export class AdminCertificateManagementComponent implements OnInit {
  certificates: Certificate[] = [];
  filteredCertificates: Certificate[] = [];
  forms: CertificateForm[] = [];
  formats: CertificateFormatInfo[] = [];
  searchTerm = '';
  selectedType = '';
  activeTab: 'formats' | 'archive' | 'coverage' = 'formats';

  /** Official barangay fee schedule fallbacks */
  readonly fallbackFormats: CertificateFormatInfo[] = [
    {
      key: 'clearance',
      name: 'Barangay Clearance',
      type: 'Clearance',
      description: 'Standard clearance for employment, travel, and legal requirements.',
      coverage: ['Employment', 'Travel / LTO', 'Police clearance prerequisite'],
      layout: 'generic',
      sampleRoute: '/shared/certificate/sample-clearance',
      fee: 50,
      processingTime: '1 day',
      requirements: ['Valid ID', 'Proof of Residency']
    },
    {
      key: 'residency',
      name: 'Barangay Residency',
      type: 'Certificate',
      description: 'Proof of residency within the barangay for schools and agencies.',
      coverage: ['School enrollment', 'Voter assistance', 'Bank KYC', 'Government ID applications'],
      layout: 'generic',
      sampleRoute: '/shared/certificate/sample-residency',
      fee: 50,
      processingTime: '1 day',
      requirements: ['Valid ID']
    },
    {
      key: 'certification',
      name: 'Barangay Certification',
      type: 'Certificate',
      description: 'General certifications (e.g. Living Together, Guardianship).',
      coverage: ['Living Together', 'Guardianship', 'Other civil certifications'],
      layout: 'generic',
      sampleRoute: '/shared/certificate/sample-certification',
      fee: 50,
      processingTime: '1 day',
      requirements: ['Valid ID', 'Supporting Documents']
    },
    {
      key: 'vehicle',
      name: 'Vehicle Inspection / Renewal',
      type: 'Certificate',
      description: 'Vehicle inspection and renewal certification.',
      coverage: ['Vehicle inspection', 'Renewal'],
      layout: 'generic',
      sampleRoute: '/shared/certificate/sample-vehicle',
      fee: 50,
      processingTime: '1 day',
      requirements: ['Valid ID', 'Vehicle Documents']
    },
    {
      key: 'indigency',
      name: 'Indigency',
      type: 'Certificate',
      description: 'Supports medical, educational, and livelihood assistance applications.',
      coverage: ['Hospital / PhilHealth aid', 'Scholarship', 'DSWD assistance', 'Burial aid'],
      layout: 'indigency',
      sampleRoute: '/shared/indigency/sample-indigency',
      fee: 0,
      processingTime: '1 day',
      requirements: ['Valid ID', 'Barangay Endorsement']
    },
    {
      key: 'low-income',
      name: 'Low Income',
      type: 'Certificate',
      description: 'Low income certification for assistance programs.',
      coverage: ['Assistance programs', 'Social services'],
      layout: 'indigency',
      sampleRoute: '/shared/indigency/sample-low-income',
      fee: 0,
      processingTime: '1 day',
      requirements: ['Valid ID']
    },
    {
      key: 'jobseeker',
      name: 'First Time Jobseeker',
      type: 'Certificate',
      description: 'First time jobseeker certification.',
      coverage: ['Employment applications', 'Job placement'],
      layout: 'generic',
      sampleRoute: '/shared/certificate/sample-jobseeker',
      fee: 0,
      processingTime: '1 day',
      requirements: ['Valid ID']
    },
    {
      key: 'business',
      name: 'Business Endorsement',
      type: 'Business Endorsement',
      description: 'Barangay endorsement for business permit processing.',
      coverage: ['Sari-sari / retail', 'Services', 'Home-based business', 'Renewals'],
      layout: 'business',
      sampleRoute: '/shared/business-clearance/sample-business',
      fee: 0,
      processingTime: '1 day',
      requirements: ['DTI Registration', 'Valid ID', 'Business Address Proof']
    },
    {
      key: 'other',
      name: 'Other Certifications',
      type: 'Certificate',
      description: 'Other barangay certifications as applicable.',
      coverage: ['Miscellaneous certifications'],
      layout: 'generic',
      sampleRoute: '/shared/certificate/sample-other',
      fee: 50,
      processingTime: '1 day',
      requirements: ['Valid ID', 'Supporting Documents']
    }
  ];

  constructor(private certificateService: CertificateService) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    forkJoin({
      certificates: this.certificateService.getAllCertificates(),
      forms: this.certificateService.getAllCertificateForms()
    }).subscribe({
      next: ({ certificates, forms }) => {
        this.forms = forms || [];
        this.formats = this.mergeFormats(this.forms);
        this.certificates = (certificates || []).filter((cert) => this.isMuseumSample(cert));
        this.filteredCertificates = this.certificates;
      },
      error: () => {
        this.formats = [...this.fallbackFormats];
        this.certificates = [];
        this.filteredCertificates = [];
      }
    });
  }

  private mergeFormats(forms: CertificateForm[]): CertificateFormatInfo[] {
    if (!forms.length) return [...this.fallbackFormats];

    return forms.map((form) => {
      const fallback =
        this.fallbackFormats.find(
          (f) =>
            f.name.toLowerCase() === form.name.toLowerCase() ||
            form.name.toLowerCase().includes(f.key) ||
            f.name.toLowerCase().includes(form.type?.toLowerCase() || '___')
        ) || this.fallbackFormats[0];

      return {
        ...fallback,
        name: form.name,
        type: form.type || fallback.type,
        description: form.description || fallback.description,
        fee: form.fee ?? form.price ?? fallback.fee,
        processingTime: form.processingTime || fallback.processingTime,
        requirements: form.requirements?.length ? form.requirements : fallback.requirements
      };
    });
  }

  private isMuseumSample(cert: Certificate): boolean {
    const notes = (cert.notes || '').toLowerCase();
    const purpose = (cert.purpose || '').toLowerCase();
    return (
      notes.includes('[museum-sample]') ||
      notes.includes('museum sample') ||
      purpose.includes('museum sample') ||
      (cert.certificateNumber || '').toUpperCase().includes('SAMPLE')
    );
  }

  filterCertificates(): void {
    this.filteredCertificates = this.certificates.filter((certificate) => {
      const term = this.searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        certificate.userName?.toLowerCase().includes(term) ||
        certificate.certificateType?.toLowerCase().includes(term) ||
        certificate.certificateNumber?.toLowerCase().includes(term);
      const matchesType =
        !this.selectedType || certificate.certificateType === this.selectedType;
      return matchesSearch && matchesType;
    });
  }

  getUniqueTypes(): string[] {
    return [...new Set(this.certificates.map((c) => c.certificateType).filter(Boolean) as string[])];
  }

  getCoverageCount(): number {
    return this.formats.reduce((sum, f) => sum + f.coverage.length, 0);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedType = '';
    this.filteredCertificates = this.certificates;
  }

  previewFormat(format: CertificateFormatInfo): void {
    window.open(format.sampleRoute, '_blank');
  }

  showCertificate(certificate: Certificate): void {
    openCertificateView(certificate);
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'ready':
      case 'valid':
      case 'issued':
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200';
      case 'expired':
      case 'revoked':
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  }

  formatFee(fee?: number): string {
    if (fee == null || Number(fee) === 0) return 'FREE';
    return `₱${Number(fee).toFixed(2)}`;
  }
}
