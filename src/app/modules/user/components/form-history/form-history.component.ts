import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AuthService, User } from '../../../../services/auth.service';
import { CertificateService, AppointmentRequest, Certificate } from '../../../../services/certificate.service';
import { openCertificateForAppointment, openCertificateView } from '../../../shared/certificate-view.util';

@Component({
  selector: 'app-form-history',
  templateUrl: './form-history.component.html',
  styleUrls: ['./form-history.component.scss']
})
export class FormHistoryComponent implements OnInit {
  currentUser: User | null = null;
  appointmentRequests: AppointmentRequest[] = [];
  certificates: Certificate[] = [];
  isLoading = false;
  selectedTab: 'appointments' | 'certificates' = 'appointments';

  constructor(
    private authService: AuthService,
    private certificateService: CertificateService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      if (this.currentUser) {
        this.loadHistory();
      }
    });
  }

  selectTab(tab: 'appointments' | 'certificates'): void {
    this.selectedTab = tab;
  }

  loadHistory() {
    if (!this.currentUser) return;

    this.isLoading = true;
    const userId = this.currentUser.id;

    forkJoin({
      appointments: this.certificateService.getUserAppointmentRequests(userId),
      certificates: this.certificateService.getUserCertificates(userId)
    }).subscribe({
      next: (result) => {
        this.appointmentRequests = result.appointments;
        this.certificates = result.certificates;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading history:', err);
        this.isLoading = false;
      }
    });
  }

  getCertificateForAppointment(appointmentId: string | number): Certificate | undefined {
    return this.certificates.find((c) => String(c.appointmentId) === String(appointmentId));
  }

  getCertificateDetails(appointmentId: string | number): Certificate | undefined {
    return this.getCertificateForAppointment(appointmentId);
  }

  canShowCertificate(request: AppointmentRequest): boolean {
    const status = String(request.status || '').toLowerCase();
    return status === 'completed' || status === 'issued';
  }

  showCertificate(certificate: Certificate): void {
    if (certificate) {
      openCertificateView(certificate);
    }
  }

  showCertificateForRequest(request: AppointmentRequest): void {
    openCertificateForAppointment(request, this.getCertificateForAppointment(request.id));
  }

  getStatusText(status: string): string {
    if (!status) return 'Pending';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  getStatusBadgeClass(status: string): string {
    switch (String(status || '').toLowerCase()) {
      case 'approved':
      case 'completed':
      case 'issued':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatDateTime(date: string | Date | undefined, time: string | undefined): string {
    if (!date) return 'N/A';
    const d = this.formatDate(date);
    return time ? `${d} at ${time}` : d;
  }

  viewCertificate(certificateId: string | number) {
    const cert = this.certificates.find((c) => String(c.id) === String(certificateId));
    if (cert) {
      openCertificateView(cert);
    }
  }
}
