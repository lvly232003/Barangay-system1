import { Component, OnInit } from '@angular/core';
import { CertificateService, Certificate } from '../../../../services/certificate.service';
import { openCertificateView } from '../../../shared/certificate-view.util';

@Component({
  selector: 'app-certificate-management',
  templateUrl: './certificate-management.component.html',
  styleUrls: ['./certificate-management.component.scss']
})
export class CertificateManagementComponent implements OnInit {
  certificates: Certificate[] = [];

  constructor(private certificateService: CertificateService) { }

  ngOnInit(): void {
    this.loadCertificates();
  }

  loadCertificates() {
    this.certificateService.certificates$.subscribe(certificates => {
      this.certificates = certificates;
    });
  }

  showCertificate(certificate: Certificate): void {
    openCertificateView(certificate);
  }

  // ✅ FIX: Updated to accept string | undefined to match the interface
  formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (String(status || '').toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'issued':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }
}