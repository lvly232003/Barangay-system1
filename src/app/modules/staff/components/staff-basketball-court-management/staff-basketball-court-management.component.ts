import { Component, OnInit } from '@angular/core';
import { BasketballCourtService, BasketballCourtReservation } from '../../../../services/basketball-court.service';

@Component({
  selector: 'app-staff-basketball-court-management',
  templateUrl: './staff-basketball-court-management.component.html',
  styleUrls: ['./staff-basketball-court-management.component.scss']
})
export class StaffBasketballCourtManagementComponent implements OnInit {
  reservations: BasketballCourtReservation[] = [];
  filteredReservations: BasketballCourtReservation[] = [];
  selectedStatus = 'all';
  searchTerm = '';
  showReservationDetails = false;
  selectedReservation: BasketballCourtReservation | null = null;
  
  // Statistics
  stats = {
    totalReservations: 0,
    pendingReservations: 0,
    approvedReservations: 0,
    completedReservations: 0,
    rejectedReservations: 0,
    cancelledReservations: 0
  };

  constructor(private basketballCourtService: BasketballCourtService) {}

  ngOnInit(): void {
    this.loadReservations();
  }

  loadReservations() {
    this.reservations = this.basketballCourtService.getReservations();
    this.filterReservations();
    this.calculateStats();
  }

  calculateStats() {
    const reservationStats = this.basketballCourtService.getReservationStats();
    this.stats = {
      totalReservations: reservationStats.total,
      pendingReservations: reservationStats.pending,
      approvedReservations: reservationStats.approved,
      completedReservations: reservationStats.completed,
      rejectedReservations: reservationStats.rejected,
      cancelledReservations: reservationStats.cancelled
    };
  }

  filterReservations() {
    let filtered = [...this.reservations];

    // Filter by status
    if (this.selectedStatus !== 'all') {
      filtered = filtered.filter(reservation => reservation.status === this.selectedStatus);
    }

    // Filter by search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(reservation => 
        reservation.userName.toLowerCase().includes(term) ||
        reservation.userEmail.toLowerCase().includes(term) ||
        reservation.purpose.toLowerCase().includes(term) ||
        reservation.courtNumber.toString().includes(term) ||
        this.formatQueueNumber(reservation.queueNumber).toLowerCase().includes(term) ||
        String(reservation.queueNumber).includes(term)
      );
    }

    filtered.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0));

    this.filteredReservations = filtered;
  }

  onStatusFilterChange() {
    this.filterReservations();
  }

  onSearchChange() {
    this.filterReservations();
  }

  updateReservationStatusFromSelect(reservationId: number | string, event: Event) {
    const target = event.target as HTMLSelectElement;
    const status = target.value as BasketballCourtReservation['status'];
    if (status) {
      this.updateReservationStatus(reservationId, status);
    }
  }

  updateReservationStatus(reservationId: number | string, status: BasketballCourtReservation['status']) {
    const notes = prompt('Add notes (optional):');
    const result = this.basketballCourtService.updateReservationStatus(
      reservationId, 
      status, 
      notes || undefined,
      'Staff User'
    );
    
    if (result.success) {
      this.loadReservations();
      alert('Reservation status updated successfully');
    } else {
      alert(result.message || 'Failed to update reservation status');
    }
  }

  viewReservationDetails(reservation: BasketballCourtReservation) {
    this.selectedReservation = reservation;
    this.showReservationDetails = true;
  }

  closeReservationDetails() {
    this.showReservationDetails = false;
    this.selectedReservation = null;
  }

  // Helper methods
  getStatusBadgeClass(status: string): string {
    return this.basketballCourtService.getStatusBadgeClass(status);
  }

  getStatusText(status: string): string {
    return this.basketballCourtService.getStatusText(status);
  }

  formatDate(date: Date): string {
    return this.basketballCourtService.formatDate(date);
  }

  formatDateTime(date: Date, time: string): string {
    return this.basketballCourtService.formatDateTime(date, time);
  }

  formatQueueNumber(queueNumber?: number | null): string {
    return this.basketballCourtService.formatQueueNumber(queueNumber);
  }

  getCourtName(courtNumber: number): string {
    const courts = this.basketballCourtService.getAllCourts();
    const court = courts.find((c: any) => c.courtNumber === courtNumber);
    return court ? court.name : `Court ${courtNumber}`;
  }

  getReservationCost(reservation: BasketballCourtReservation): number {
    const courts = this.basketballCourtService.getAllCourts();
    const court = courts.find((c: any) => c.courtNumber === reservation.courtNumber);
    return court ? reservation.duration * court.hourlyRate : 0;
  }

  getTodaysReservations(): BasketballCourtReservation[] {
    const today = new Date();
    return this.reservations.filter(reservation => 
      reservation.reservationDate.toDateString() === today.toDateString() &&
      (reservation.status === 'approved' || reservation.status === 'completed')
    );
  }

  getUpcomingReservations(): BasketballCourtReservation[] {
    const today = new Date();
    return this.reservations.filter(reservation => 
      reservation.reservationDate > today &&
      reservation.status === 'approved'
    ).slice(0, 5); // Show only next 5 upcoming reservations
  }

  getPendingReservations(): BasketballCourtReservation[] {
    return this.reservations
      .filter((reservation) => reservation.status === 'pending')
      .slice()
      .sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0));
  }

  canUpdateStatus(reservation: BasketballCourtReservation): boolean {
    return reservation.status === 'pending' || reservation.status === 'approved';
  }

  getStatusOptions(reservation: BasketballCourtReservation): string[] {
    switch (reservation.status) {
      case 'pending':
        return ['approved', 'rejected'];
      case 'approved':
        return ['completed', 'rejected'];
      default:
        return [];
    }
  }

  getStatusOptionText(status: string): string {
    switch (status) {
      case 'approved':
        return 'Approve';
      case 'rejected':
        return 'Reject';
      case 'completed':
        return 'Mark Complete';
      default:
        return status;
    }
  }
}
