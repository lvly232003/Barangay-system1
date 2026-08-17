import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CertificateService, AppointmentRequest, Certificate } from '../../../../services/certificate.service';
import { AdminReminderService } from '../../../../services/admin-reminder.service';
import { openCertificateForAppointment } from '../../../shared/certificate-view.util';

@Component({
  selector: 'app-document-management',
  templateUrl: './document-management.component.html',
  styleUrls: ['./document-management.component.scss']
})
export class DocumentManagementComponent implements OnInit {
  appointmentRequests: AppointmentRequest[] = [];
  filteredRequests: AppointmentRequest[] = [];
  certificates: Certificate[] = [];
  searchTerm = '';
  statusFilter = 'all';
  loading = false;
  error = '';

  constructor(
    private certificateService: CertificateService,
    private reminderService: AdminReminderService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = '';
    forkJoin({
      appointments: this.certificateService.getAppointmentRequests(),
      certificates: this.certificateService.getAllCertificates()
    }).subscribe({
      next: ({ appointments, certificates }) => {
        this.appointmentRequests = appointments;
        this.certificates = certificates;
        this.filterRequests();
        this.loading = false;
        this.reminderService.refresh().subscribe();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.message || 'Failed to load document requests from Supabase.';
      }
    });
  }

  filterByStatus(status: string): void {
    this.statusFilter = status || 'all';
    this.filterRequests();
  }

  filterRequests(): void {
    this.filteredRequests = this.appointmentRequests.filter((request) => {
      const term = this.searchTerm.toLowerCase();
      const certLabel = this.certificateLabel(request).toLowerCase();
      const matchesSearch =
        !this.searchTerm ||
        (request.userName?.toLowerCase().includes(term) ?? false) ||
        (request.userEmail?.toLowerCase().includes(term) ?? false) ||
        certLabel.includes(term);

      const status = String(request.status || '').toLowerCase();
      const matchesStatus = this.statusFilter === 'all' || !this.statusFilter || status === this.statusFilter;
      return matchesSearch && matchesStatus;
    });
  }

  certificateLabel(request: AppointmentRequest): string {
    return request.certificateName || request.certificateType || request.type || 'Certificate';
  }

  appointmentWhen(request: AppointmentRequest): { date?: string | Date; time?: string } {
    return {
      date: request.appointmentDate || request.requestedDate || request.date,
      time: request.appointmentTime || request.requestedTime || request.time
    };
  }

  updateAppointmentStatus(id: string | number, status: 'approved' | 'rejected' | 'completed'): void {
    this.certificateService.updateAppointmentStatus(id, status).subscribe({
      next: () => this.loadData(),
      error: (err) => {
        this.error = err?.message || 'Failed to update status in Supabase.';
      }
    });
  }

  getCertificateForAppointment(appointmentId: string | number): Certificate | undefined {
    return this.certificates.find((c) => String(c.appointmentId) === String(appointmentId));
  }

  canShowCertificate(request: AppointmentRequest): boolean {
    const status = String(request.status || '').toLowerCase();
    return status === 'completed' || status === 'issued';
  }

  showCertificate(certificate: Certificate): void {
    if (certificate) {
      openCertificateForAppointment(
        { id: certificate.appointmentId || certificate.id, certificateType: certificate.certificateType },
        certificate
      );
    }
  }

  showCertificateForRequest(request: AppointmentRequest): void {
    openCertificateForAppointment(request, this.getCertificateForAppointment(request.id));
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleDateString('en-US', {
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

  getStatusColor(status: string): string {
    return this.getStatusBadgeClass(status);
  }

  getStatusBadgeClass(status: string): string {
    switch (String(status || '').toLowerCase()) {
      case 'approved':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
      case 'completed':
      case 'issued':
        return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-emerald-950/40 dark:text-emerald-200';
    }
  }
}
