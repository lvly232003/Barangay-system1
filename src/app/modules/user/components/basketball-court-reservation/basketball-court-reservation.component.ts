import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BasketballCourtService, BasketballCourt, BasketballCourtReservation } from '../../../../services/basketball-court.service';
import { AuthService, User } from '../../../../services/auth.service';

@Component({
  selector: 'app-basketball-court-reservation',
  templateUrl: './basketball-court-reservation.component.html',
  styleUrls: ['./basketball-court-reservation.component.scss']
})
export class BasketballCourtReservationComponent implements OnInit {
  courts: BasketballCourt[] = [];
  reservations: BasketballCourtReservation[] = [];
  reservationForm: FormGroup;
  isSubmitting = false;
  showForm = false;
  selectedCourt: BasketballCourt | null = null;
  availableTimeSlots: string[] = [];
  currentUser: User | null = null;
  userReservations: BasketballCourtReservation[] = [];
  lastQueueNumber: number | null = null;

  constructor(
    private basketballCourtService: BasketballCourtService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.reservationForm = this.fb.group({
      courtNumber: ['', Validators.required],
      reservationDate: ['', Validators.required],
      startTime: ['', Validators.required],
      duration: ['', [Validators.required, Validators.min(1), Validators.max(4)]],
      purpose: ['', [Validators.required, Validators.minLength(10)]],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.loadCourts();
    this.loadReservations();
    this.authService.currentUser$.subscribe((user: User | null) => {
      this.currentUser = user;
      if (user) {
        this.loadUserReservations(user.id);
      }
    });
  }

  loadCourts() {
    this.courts = this.basketballCourtService.getCourts();
  }

  loadReservations() {
    this.reservations = this.basketballCourtService.getReservations();
  }

  loadUserReservations(userId: number | string) {
    this.userReservations = this.basketballCourtService
      .getUserReservations(userId)
      .slice()
      .sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0));
  }

  selectCourt(courtNumber: number) {
    this.selectedCourt = this.basketballCourtService.getCourtById(courtNumber) || null;
    this.showForm = true;
    this.reservationForm.patchValue({ courtNumber });
    this.availableTimeSlots = [];
  }

  onDateChange() {
    const selectedDate = this.reservationForm.get('reservationDate')?.value;
    const courtNumber = this.reservationForm.get('courtNumber')?.value;
    
    if (selectedDate && courtNumber) {
      const date = new Date(selectedDate);
      this.availableTimeSlots = this.basketballCourtService.getAvailableTimeSlots(courtNumber, date);
      this.reservationForm.patchValue({ startTime: '' });
    }
  }

  onStartTimeChange() {
    const startTime = this.reservationForm.get('startTime')?.value;
    const duration = this.reservationForm.get('duration')?.value;
    
    if (startTime && duration) {
      const endTime = this.calculateEndTime(startTime, duration);
      this.reservationForm.patchValue({ endTime });
    }
  }

  onDurationChange() {
    const startTime = this.reservationForm.get('startTime')?.value;
    const duration = this.reservationForm.get('duration')?.value;
    
    if (startTime && duration) {
      const endTime = this.calculateEndTime(startTime, duration);
      this.reservationForm.patchValue({ endTime });
    }
  }

  private calculateEndTime(startTime: string, duration: number): string {
    const [time, period] = startTime.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    
    let totalMinutes = hours * 60 + minutes;
    if (period === 'PM' && hours !== 12) {
      totalMinutes += 12 * 60;
    } else if (period === 'AM' && hours === 12) {
      totalMinutes -= 12 * 60;
    }
    
    totalMinutes += duration * 60;
    
    let endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    
    let endPeriod = 'AM';
    if (endHours >= 12) {
      endPeriod = 'PM';
      if (endHours > 12) {
        endHours -= 12;
      }
    }
    if (endHours === 0) {
      endHours = 12;
    }
    
    return `${endHours}:${endMinutes.toString().padStart(2, '0')} ${endPeriod}`;
  }

  async onSubmit() {
    if (this.reservationForm.valid && this.currentUser) {
      this.isSubmitting = true;
      
      const formData = this.reservationForm.value;
      const reservationDate = new Date(formData.reservationDate);
      const endTime = this.calculateEndTime(formData.startTime, formData.duration);
      
      const reservationData = {
        userId: this.currentUser!.id,
        userName: `${this.currentUser!.firstName} ${this.currentUser!.lastName}`,
        userEmail: this.currentUser!.email,
        courtNumber: formData.courtNumber,
        reservationDate: reservationDate,
        startTime: formData.startTime,
        endTime: endTime,
        duration: formData.duration,
        purpose: formData.purpose,
        notes: formData.notes
      };
      
      try {
        const result = await this.basketballCourtService.createReservation(reservationData);
        
        if (result.success) {
          this.lastQueueNumber = result.queueNumber ?? null;
          alert(
            result.message ||
              `Reservation submitted! Your queue number is ${this.formatQueueNumber(result.queueNumber)}.`
          );
          this.resetForm();
          this.loadReservations();
          this.loadUserReservations(this.currentUser!.id);
        } else {
          alert(result.message || 'Failed to submit reservation request');
        }
      } catch (e) {
        console.error(e);
        alert('Failed to submit reservation request');
      }
      
      this.isSubmitting = false;
    } else {
      this.markFormGroupTouched();
    }
  }

  formatQueueNumber(queueNumber?: number | null): string {
    return this.basketballCourtService.formatQueueNumber(queueNumber);
  }

  getQueuePosition(reservationId: number | string): number {
    return this.basketballCourtService.getQueuePosition(reservationId);
  }

  cancelReservation(reservationId: number | string) {
    if (confirm('Are you sure you want to cancel this reservation?')) {
      const result = this.basketballCourtService.cancelReservation(reservationId, this.currentUser!.id);
      
      if (result.success) {
        alert('Reservation cancelled successfully');
        this.loadReservations();
        this.loadUserReservations(this.currentUser!.id);
      } else {
        alert(result.message || 'Failed to cancel reservation');
      }
    }
  }

  resetForm() {
    this.reservationForm.reset();
    this.showForm = false;
    this.selectedCourt = null;
    this.availableTimeSlots = [];
  }

  cancelRequest() {
    this.resetForm();
  }

  private markFormGroupTouched() {
    Object.keys(this.reservationForm.controls).forEach(key => {
      const control = this.reservationForm.get(key);
      control?.markAsTouched();
    });
  }

  getMinDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  getMaxDate(): string {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 2); // 2 months ahead
    return maxDate.toISOString().split('T')[0];
  }

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

  canCancelReservation(reservation: BasketballCourtReservation): boolean {
    return reservation.status === 'pending' || reservation.status === 'approved';
  }

  getTotalCost(duration: number, courtNumber: number): number {
    const court = this.courts.find(c => c.courtNumber === courtNumber);
    return court ? duration * court.hourlyRate : 0;
  }
}
