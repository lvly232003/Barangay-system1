import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BasketballCourtService, BasketballCourt, BasketballCourtReservation } from '../../../../services/basketball-court.service';

@Component({
  selector: 'app-admin-basketball-court-management',
  templateUrl: './admin-basketball-court-management.component.html',
  styleUrls: ['./admin-basketball-court-management.component.scss']
})
export class AdminBasketballCourtManagementComponent implements OnInit {
  reservations: BasketballCourtReservation[] = [];
  filteredReservations: BasketballCourtReservation[] = [];
  courts: BasketballCourt[] = [];
  selectedStatus = 'all';
  searchTerm = '';
  showCourtForm = false;
  showReservationDetails = false;
  selectedReservation: BasketballCourtReservation | null = null;
  
  // Court Management
  courtForm: FormGroup;
  isSubmittingCourt = false;
  editingCourt: BasketballCourt | null = null;

  // Statistics
  stats = {
    totalReservations: 0,
    pendingReservations: 0,
    approvedReservations: 0,
    completedReservations: 0,
    rejectedReservations: 0,
    cancelledReservations: 0,
    totalRevenue: 0
  };

  constructor(
    private basketballCourtService: BasketballCourtService,
    private fb: FormBuilder
  ) {
    this.courtForm = this.fb.group({
      courtNumber: ['', [Validators.required, Validators.min(1)]],
      name: ['', [Validators.required, Validators.minLength(3)]],
      location: ['', [Validators.required, Validators.minLength(5)]],
      capacity: ['', [Validators.required, Validators.min(1)]],
      amenities: ['', Validators.required],
      hourlyRate: ['', [Validators.required, Validators.min(1)]],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.loadReservations();
    this.loadCourts();
    this.calculateStats();
  }

  loadReservations() {
    this.reservations = this.basketballCourtService.getReservations();
    this.filterReservations();
  }

  loadCourts() {
    this.courts = this.basketballCourtService.getAllCourts();
  }

  calculateStats() {
    const reservationStats = this.basketballCourtService.getReservationStats();
    this.stats = {
      totalReservations: reservationStats.total,
      pendingReservations: reservationStats.pending,
      approvedReservations: reservationStats.approved,
      completedReservations: reservationStats.completed,
      rejectedReservations: reservationStats.rejected,
      cancelledReservations: reservationStats.cancelled,
      totalRevenue: this.calculateTotalRevenue()
    };
  }

  private calculateTotalRevenue(): number {
    return this.reservations
      .filter(reservation => reservation.status === 'completed')
      .reduce((total, reservation) => {
        const court = this.courts.find(c => c.courtNumber === reservation.courtNumber);
        return total + (court ? reservation.duration * court.hourlyRate : 0);
      }, 0);
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

    // FCFS: always list by queue number (submission order), not play date
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
      'Admin User'
    );
    
    if (result.success) {
      this.loadData();
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

  showAddCourtForm() {
    this.editingCourt = null;
    this.courtForm.reset();
    this.courtForm.patchValue({ isActive: true });
    this.showCourtForm = true;
  }

  showEditCourtForm(court: BasketballCourt) {
    this.editingCourt = court;
    this.courtForm.patchValue({
      courtNumber: court.courtNumber,
      name: court.name,
      location: court.location,
      capacity: court.capacity,
      amenities: court.amenities.join(', '),
      hourlyRate: court.hourlyRate,
      isActive: court.isActive
    });
    this.showCourtForm = true;
  }

  onSubmitCourt() {
    if (this.courtForm.valid) {
      this.isSubmittingCourt = true;
      
      const formData = this.courtForm.value;
      const courtData = {
        ...formData,
        amenities: formData.amenities.split(',').map((amenity: string) => amenity.trim()).filter((amenity: string) => amenity)
      };

      let result;
      if (this.editingCourt) {
        result = this.basketballCourtService.updateCourt(this.editingCourt.id, courtData);
      } else {
        result = this.basketballCourtService.addCourt(courtData);
      }

      if (result.success) {
        alert(result.message);
        this.loadCourts();
        this.closeCourtForm();
      } else {
        alert(result.message || 'Failed to save court');
      }

      this.isSubmittingCourt = false;
    } else {
      this.markFormGroupTouched();
    }
  }

  deleteCourt(courtId: number | string) {
    if (confirm('Are you sure you want to delete this court? This action cannot be undone.')) {
      const result = this.basketballCourtService.deleteCourt(courtId);
      
      if (result.success) {
        alert(result.message);
        this.loadCourts();
      } else {
        alert(result.message || 'Failed to delete court');
      }
    }
  }

  closeCourtForm() {
    this.showCourtForm = false;
    this.editingCourt = null;
    this.courtForm.reset();
  }

  private markFormGroupTouched() {
    Object.keys(this.courtForm.controls).forEach(key => {
      const control = this.courtForm.get(key);
      control?.markAsTouched();
    });
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
    const court = this.courts.find(c => c.courtNumber === courtNumber);
    return court ? court.name : `Court ${courtNumber}`;
  }

  getReservationCost(reservation: BasketballCourtReservation): number {
    const court = this.courts.find(c => c.courtNumber === reservation.courtNumber);
    return court ? reservation.duration * court.hourlyRate : 0;
  }

  getCourtReservationsCount(courtNumber: number): number {
    return this.reservations.filter(r => r.courtNumber === courtNumber).length;
  }

  getCourtRevenue(courtNumber: number): number {
    return this.reservations
      .filter(r => r.courtNumber === courtNumber && r.status === 'completed')
      .reduce((total, reservation) => {
        const court = this.courts.find(c => c.courtNumber === courtNumber);
        return total + (court ? reservation.duration * court.hourlyRate : 0);
      }, 0);
  }
}
