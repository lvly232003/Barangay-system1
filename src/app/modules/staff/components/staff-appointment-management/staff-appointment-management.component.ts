import { Component, OnInit } from '@angular/core';
import { CertificateService, AppointmentRequest } from '../../../../services/certificate.service';
import { ReminderService } from '../../../../services/reminder.service';

@Component({
  selector: 'app-staff-appointment-management',
  templateUrl: './staff-appointment-management.component.html',
  styleUrls: ['./staff-appointment-management.component.scss']
})
export class StaffAppointmentManagementComponent implements OnInit {
  appointmentRequests: AppointmentRequest[] = [];
  filteredRequests: AppointmentRequest[] = [];
  
  // Search and Filter properties
  selectedStatus = 'all';
  searchTerm = '';
  // Helper for template binding if needed, though usually bound directly
  statusFilter = ''; 

  constructor(
    private certificateService: CertificateService,
    private reminderService: ReminderService
  ) {}

  ngOnInit(): void {
    this.loadAppointmentRequests();
  }

  loadAppointmentRequests() {
    this.certificateService.getAppointmentRequests().subscribe({
      next: (data) => {
        this.appointmentRequests = data;
        this.filterRequests();
      },
      error: (err) => console.error('Error loading appointments:', err)
    });
  }

  filterRequests() {
    let filtered = [...this.appointmentRequests];

    // Filter by status (using selectedStatus matches template variable naming conventions if bound via ngModel)
    if (this.selectedStatus && this.selectedStatus !== 'all') {
      filtered = filtered.filter(request => request.status === this.selectedStatus);
    }

    // Filter by search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(request =>
        (request.userName || '').toLowerCase().includes(term) ||
        (request.certificateType || '').toLowerCase().includes(term) || 
        (request.certificateName || '').toLowerCase().includes(term)
      );
    }

    this.filteredRequests = filtered;
  }

  onStatusFilterChange() {
    this.filterRequests();
  }

  onSearchChange() {
    this.filterRequests();
  }

  updateAppointmentStatus(appointmentId: string | number, status: string) {
    this.certificateService.updateAppointmentStatus(appointmentId, status).subscribe({
      next: () => {
        this.loadAppointmentRequests();
        this.reminderService.refresh().subscribe();
        alert(`Appointment marked as ${status}.`);
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to update appointment status');
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800'; // Changed to blue to match admin dash usually
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusText(status: string): string {
    if (!status) return '';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short', // Changed to short for cleaner table view
      day: 'numeric'
    });
  }

  formatDateTime(date: string | Date | undefined, time: string | undefined): string {
    if (!date) return 'N/A';
    const dateStr = this.formatDate(date);
    return time ? `${dateStr} at ${time}` : dateStr;
  }
}