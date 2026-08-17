import { Component, OnInit } from '@angular/core';
import { CertificateService, AppointmentRequest } from '../../../../services/certificate.service';
import { AdminReminderService } from '../../../../services/admin-reminder.service';

@Component({
  selector: 'app-appointment-management',
  templateUrl: './appointment-management.component.html',
  styleUrls: ['./appointment-management.component.scss']
})
export class AppointmentManagementComponent implements OnInit {
  appointmentRequests: AppointmentRequest[] = [];
  filteredRequests: AppointmentRequest[] = [];
  searchTerm = '';
  statusFilter = '';
  selectedStatus = 'all';
  error = '';

  constructor(
    private certificateService: CertificateService,
    private reminderService: AdminReminderService
  ) {}

  ngOnInit(): void {
    this.loadAppointments();
  }

  loadAppointments() {
    this.certificateService.getAppointmentRequests().subscribe({
      next: (requests) => {
        this.appointmentRequests = requests;
        this.filterAppointments();
        this.reminderService.refresh().subscribe();
      },
      error: (err) => {
        this.error = err?.message || 'Failed to load appointments from Supabase.';
      }
    });
  }

  filterAppointments() {
    this.filteredRequests = this.appointmentRequests.filter((request) => {
      const term = this.searchTerm.toLowerCase();
      const cert = (request.certificateName || request.certificateType || '').toLowerCase();
      const matchesSearch =
        !this.searchTerm ||
        (request.userName?.toLowerCase().includes(term) ?? false) ||
        (request.userEmail?.toLowerCase().includes(term) ?? false) ||
        cert.includes(term);

      const status = String(request.status || '').toLowerCase();
      const selected = (this.selectedStatus || this.statusFilter || 'all').toLowerCase();
      const matchesStatus = selected === 'all' || !selected || status === selected;
      return matchesSearch && matchesStatus;
    });
  }

  onStatusFilterChange() {
    this.statusFilter = this.selectedStatus === 'all' ? '' : this.selectedStatus;
    this.filterAppointments();
  }

  onSearchChange() {
    this.filterAppointments();
  }

  getStatusText(status: string): string {
    if (!status) return 'Pending';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  updateAppointmentStatus(id: string | number, status: 'approved' | 'rejected' | 'completed') {
    this.certificateService.updateAppointmentStatus(id, status).subscribe(() => {
      this.loadAppointments();
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (String(status || '').toLowerCase()) {
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  formatDateTime(date: string | Date | undefined, time: string | undefined): string {
    if (!date) return 'N/A';
    const d = this.formatDate(date);
    return time ? `${d} at ${time}` : d;
  }
}