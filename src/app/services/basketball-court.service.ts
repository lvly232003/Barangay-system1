import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { supabase } from '../supabase/supabase.client';

export interface BasketballCourtReservation {
  id: number | string;
  userId: number | string;
  userName: string;
  userEmail: string;
  courtNumber: number;
  courtId?: string;
  /** FCFS ticket assigned at booking time (not by play date). */
  queueNumber: number;
  reservationDate: Date;
  startTime: string;
  endTime: string;
  duration: number;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface BasketballCourt {
  id: number | string;
  courtNumber: number;
  name: string;
  location: string;
  capacity: number;
  amenities: string[];
  hourlyRate: number;
  isActive: boolean;
  maintenanceSchedule?: {
    startDate: Date;
    endDate: Date;
    reason: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class BasketballCourtService {
  private reservationsSubject = new BehaviorSubject<BasketballCourtReservation[]>([]);
  public reservations$ = this.reservationsSubject.asObservable();

  private courtsSubject = new BehaviorSubject<BasketballCourt[]>([]);
  public courts$ = this.courtsSubject.asObservable();

  private reservations: BasketballCourtReservation[] = [];
  private courts: BasketballCourt[] = [];

  constructor() {
    void this.refreshFromSupabase();
  }

  async refreshFromSupabase(): Promise<void> {
    const [courtsRes, reservationsRes] = await Promise.all([
      supabase.from('basketball_courts').select('*').order('court_number', { ascending: true }),
      supabase.from('basketball_reservations').select('*').order('queue_number', { ascending: true })
    ]);

    if (!courtsRes.error && courtsRes.data) {
      this.courts = courtsRes.data.map((row: any) => this.mapCourt(row));
      this.courtsSubject.next(this.courts);
    } else if (courtsRes.error) {
      console.error('Failed loading courts', courtsRes.error);
    }

    if (!reservationsRes.error && reservationsRes.data) {
      this.reservations = reservationsRes.data.map((row: any) => this.mapReservation(row));
      this.reservationsSubject.next(this.reservations);
    } else if (reservationsRes.error) {
      console.error('Failed loading reservations', reservationsRes.error);
    }
  }

  getCourts(): BasketballCourt[] {
    return this.courts.filter((court) => court.isActive);
  }

  getAllCourts(): BasketballCourt[] {
    return this.courts;
  }

  getCourtById(courtId: number | string): BasketballCourt | undefined {
    return this.courts.find((court) => String(court.id) === String(courtId) || court.courtNumber === Number(courtId));
  }

  addCourt(courtData: Omit<BasketballCourt, 'id'>): { success: boolean; message?: string } {
    const tempId = `temp-${Date.now()}`;
    const newCourt: BasketballCourt = { id: tempId, ...courtData };
    this.courts.push(newCourt);
    this.courtsSubject.next([...this.courts]);

    void supabase
      .from('basketball_courts')
      .insert({
        court_number: courtData.courtNumber,
        name: courtData.name,
        location: courtData.location,
        capacity: courtData.capacity,
        amenities: courtData.amenities || [],
        hourly_rate: courtData.hourlyRate,
        is_active: courtData.isActive,
        maintenance_start: courtData.maintenanceSchedule?.startDate?.toISOString().slice(0, 10) || null,
        maintenance_end: courtData.maintenanceSchedule?.endDate?.toISOString().slice(0, 10) || null,
        maintenance_reason: courtData.maintenanceSchedule?.reason || null
      })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          return;
        }
        this.courts = this.courts.map((c) => (c.id === tempId ? this.mapCourt(data) : c));
        this.courtsSubject.next([...this.courts]);
      });

    return { success: true, message: 'Basketball court added successfully' };
  }

  updateCourt(courtId: number | string, courtData: Partial<BasketballCourt>): { success: boolean; message?: string } {
    const courtIndex = this.courts.findIndex((court) => String(court.id) === String(courtId));
    if (courtIndex === -1) {
      return { success: false, message: 'Basketball court not found' };
    }

    this.courts[courtIndex] = { ...this.courts[courtIndex], ...courtData };
    this.courtsSubject.next([...this.courts]);

    const patch: Record<string, unknown> = {};
    if (courtData.courtNumber !== undefined) patch['court_number'] = courtData.courtNumber;
    if (courtData.name !== undefined) patch['name'] = courtData.name;
    if (courtData.location !== undefined) patch['location'] = courtData.location;
    if (courtData.capacity !== undefined) patch['capacity'] = courtData.capacity;
    if (courtData.amenities !== undefined) patch['amenities'] = courtData.amenities;
    if (courtData.hourlyRate !== undefined) patch['hourly_rate'] = courtData.hourlyRate;
    if (courtData.isActive !== undefined) patch['is_active'] = courtData.isActive;
    if (courtData.maintenanceSchedule) {
      patch['maintenance_start'] = courtData.maintenanceSchedule.startDate.toISOString().slice(0, 10);
      patch['maintenance_end'] = courtData.maintenanceSchedule.endDate.toISOString().slice(0, 10);
      patch['maintenance_reason'] = courtData.maintenanceSchedule.reason;
    }

    void supabase.from('basketball_courts').update(patch).eq('id', String(courtId));
    return { success: true, message: 'Basketball court updated successfully' };
  }

  deleteCourt(courtId: number | string): { success: boolean; message?: string } {
    const courtIndex = this.courts.findIndex((court) => String(court.id) === String(courtId));
    if (courtIndex === -1) {
      return { success: false, message: 'Basketball court not found' };
    }
    this.courts.splice(courtIndex, 1);
    this.courtsSubject.next([...this.courts]);
    void supabase.from('basketball_courts').delete().eq('id', String(courtId));
    return { success: true, message: 'Basketball court deleted successfully' };
  }

  getReservations(): BasketballCourtReservation[] {
    return this.reservations;
  }

  getUserReservations(userId: number | string): BasketballCourtReservation[] {
    return this.reservations.filter((reservation) => String(reservation.userId) === String(userId));
  }

  getCourtReservations(courtNumber: number): BasketballCourtReservation[] {
    return this.reservations.filter((reservation) => reservation.courtNumber === courtNumber);
  }

  async createReservation(
    reservationData: Omit<
      BasketballCourtReservation,
      'id' | 'status' | 'createdAt' | 'updatedAt' | 'queueNumber' | 'courtId' | 'approvedBy' | 'approvedAt'
    >
  ): Promise<{ success: boolean; message?: string; queueNumber?: number; reservation?: BasketballCourtReservation }> {
    const conflictingReservation = this.reservations.find(
      (reservation) =>
        reservation.courtNumber === reservationData.courtNumber &&
        reservation.reservationDate.toDateString() === reservationData.reservationDate.toDateString() &&
        reservation.status !== 'rejected' &&
        reservation.status !== 'cancelled' &&
        this.isTimeOverlapping(
          reservationData.startTime,
          reservationData.endTime,
          reservation.startTime,
          reservation.endTime
        )
    );

    if (conflictingReservation) {
      return {
        success: false,
        message: `Time slot already taken (held by queue ${this.formatQueueNumber(conflictingReservation.queueNumber)}). Please select another time.`
      };
    }

    const court = this.courts.find((c) => c.courtNumber === reservationData.courtNumber);
    if (!court || !court.isActive) {
      return { success: false, message: 'Selected court is not available.' };
    }

    if (court.maintenanceSchedule) {
      const reservationDate = reservationData.reservationDate;
      const maintenanceStart = court.maintenanceSchedule.startDate;
      const maintenanceEnd = court.maintenanceSchedule.endDate;
      if (reservationDate >= maintenanceStart && reservationDate <= maintenanceEnd) {
        return {
          success: false,
          message: 'Court is under maintenance during the selected date.'
        };
      }
    }

    const { data, error } = await supabase
      .from('basketball_reservations')
      .insert({
        user_id: String(reservationData.userId),
        court_id: String(court.id),
        court_number: reservationData.courtNumber,
        user_name: reservationData.userName,
        user_email: reservationData.userEmail,
        reservation_date: reservationData.reservationDate.toISOString().slice(0, 10),
        start_time: reservationData.startTime,
        end_time: reservationData.endTime,
        duration_hours: reservationData.duration,
        purpose: reservationData.purpose,
        status: 'pending',
        notes: reservationData.notes || null
      })
      .select()
      .single();

    if (error || !data) {
      console.error(error);
      return {
        success: false,
        message: error?.message || 'Failed to submit reservation request'
      };
    }

    const mapped = this.mapReservation(data);
    this.reservations = [...this.reservations, mapped].sort(
      (a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)
    );
    this.reservationsSubject.next([...this.reservations]);

    return {
      success: true,
      queueNumber: mapped.queueNumber,
      reservation: mapped,
      message: `Reservation submitted. Your queue number is ${this.formatQueueNumber(mapped.queueNumber)}. First-come, first-served — earlier queues are processed first even if a later date was booked before yours.`
    };
  }

  /** Display ticket like Q-0007 */
  formatQueueNumber(queueNumber?: number | null): string {
    if (queueNumber == null || Number.isNaN(Number(queueNumber))) return 'Q-—';
    return `Q-${String(queueNumber).padStart(4, '0')}`;
  }

  /** Pending queue position among active FCFS line (1 = next up). */
  getQueuePosition(reservationId: number | string): number {
    const active = this.reservations.filter(
      (r) => r.status === 'pending' || r.status === 'approved'
    );
    const idx = active.findIndex((r) => String(r.id) === String(reservationId));
    return idx >= 0 ? idx + 1 : 0;
  }

  updateReservationStatus(
    reservationId: number | string,
    status: BasketballCourtReservation['status'],
    notes?: string,
    approvedBy?: string
  ): { success: boolean; message?: string } {
    const reservationIndex = this.reservations.findIndex(
      (reservation) => String(reservation.id) === String(reservationId)
    );
    if (reservationIndex === -1) {
      return { success: false, message: 'Reservation not found' };
    }

    this.reservations[reservationIndex].status = status;
    this.reservations[reservationIndex].updatedAt = new Date();
    if (notes) this.reservations[reservationIndex].notes = notes;
    if (approvedBy && (status === 'approved' || status === 'rejected')) {
      this.reservations[reservationIndex].approvedBy = approvedBy;
      this.reservations[reservationIndex].approvedAt = new Date();
    }
    this.reservationsSubject.next([...this.reservations]);

    const patch: Record<string, unknown> = { status };
    if (notes) patch['notes'] = notes;
    if (approvedBy && (status === 'approved' || status === 'rejected')) {
      patch['approved_by'] = approvedBy;
      patch['approved_at'] = new Date().toISOString();
    }
    void supabase.from('basketball_reservations').update(patch).eq('id', String(reservationId));

    return { success: true, message: 'Reservation status updated successfully' };
  }

  cancelReservation(reservationId: number | string, userId: number | string): { success: boolean; message?: string } {
    const reservationIndex = this.reservations.findIndex(
      (reservation) =>
        String(reservation.id) === String(reservationId) && String(reservation.userId) === String(userId)
    );

    if (reservationIndex === -1) {
      return { success: false, message: 'Reservation not found' };
    }

    if (
      this.reservations[reservationIndex].status === 'pending' ||
      this.reservations[reservationIndex].status === 'approved'
    ) {
      this.reservations[reservationIndex].status = 'cancelled';
      this.reservations[reservationIndex].updatedAt = new Date();
      this.reservationsSubject.next([...this.reservations]);
      void supabase
        .from('basketball_reservations')
        .update({ status: 'cancelled' })
        .eq('id', String(reservationId));
      return { success: true, message: 'Reservation cancelled successfully' };
    }

    return { success: false, message: 'Cannot cancel this reservation' };
  }

  private isTimeOverlapping(start1: string, end1: string, start2: string, end2: string): boolean {
    const time1Start = this.parseTime(start1);
    const time1End = this.parseTime(end1);
    const time2Start = this.parseTime(start2);
    const time2End = this.parseTime(end2);
    return time1Start < time2End && time2Start < time1End;
  }

  private parseTime(timeStr: string): number {
    const [time, period] = timeStr.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    let totalMinutes = hours * 60 + minutes;
    if (period === 'PM' && hours !== 12) totalMinutes += 12 * 60;
    else if (period === 'AM' && hours === 12) totalMinutes -= 12 * 60;
    return totalMinutes;
  }

  getAvailableTimeSlots(courtNumber: number, date: Date): string[] {
    const timeSlots = [
      '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
      '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
      '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'
    ];

    const bookedSlots = this.reservations
      .filter(
        (reservation) =>
          reservation.courtNumber === courtNumber &&
          reservation.reservationDate.toDateString() === date.toDateString() &&
          reservation.status !== 'rejected' &&
          reservation.status !== 'cancelled'
      )
      .map((reservation) => reservation.startTime);

    return timeSlots.filter((slot) => !bookedSlots.includes(slot));
  }

  getReservationStats() {
    const reservations = this.reservations;
    return {
      total: reservations.length,
      pending: reservations.filter((r) => r.status === 'pending').length,
      approved: reservations.filter((r) => r.status === 'approved').length,
      completed: reservations.filter((r) => r.status === 'completed').length,
      rejected: reservations.filter((r) => r.status === 'rejected').length,
      cancelled: reservations.filter((r) => r.status === 'cancelled').length
    };
  }

  getCourtStats(courtNumber: number) {
    const courtReservations = this.reservations.filter((r) => r.courtNumber === courtNumber);
    return {
      totalReservations: courtReservations.length,
      pendingReservations: courtReservations.filter((r) => r.status === 'pending').length,
      approvedReservations: courtReservations.filter((r) => r.status === 'approved').length,
      completedReservations: courtReservations.filter((r) => r.status === 'completed').length,
      monthlyRevenue: this.calculateMonthlyRevenue(courtNumber)
    };
  }

  private calculateMonthlyRevenue(courtNumber: number): number {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyReservations = this.reservations.filter((reservation) => {
      const reservationDate = new Date(reservation.reservationDate);
      return (
        reservation.courtNumber === courtNumber &&
        reservationDate.getMonth() === currentMonth &&
        reservationDate.getFullYear() === currentYear &&
        reservation.status === 'completed'
      );
    });
    const court = this.courts.find((c) => c.courtNumber === courtNumber);
    if (!court) return 0;
    return monthlyReservations.reduce((total, reservation) => total + reservation.duration * court.hourlyRate, 0);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  }

  formatDateTime(date: Date, time: string): string {
    return `${this.formatDate(date)} at ${time}`;
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200';
      case 'approved':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  }

  private mapCourt(row: any): BasketballCourt {
    return {
      id: row.id,
      courtNumber: row.court_number,
      name: row.name,
      location: row.location,
      capacity: row.capacity,
      amenities: row.amenities || [],
      hourlyRate: Number(row.hourly_rate || 0),
      isActive: row.is_active,
      maintenanceSchedule:
        row.maintenance_start && row.maintenance_end
          ? {
              startDate: new Date(row.maintenance_start),
              endDate: new Date(row.maintenance_end),
              reason: row.maintenance_reason || ''
            }
          : undefined
    };
  }

  private mapReservation(row: any): BasketballCourtReservation {
    return {
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      courtNumber: row.court_number,
      courtId: row.court_id || undefined,
      queueNumber: Number(row.queue_number || 0),
      reservationDate: new Date(row.reservation_date),
      startTime: row.start_time,
      endTime: row.end_time,
      duration: Number(row.duration_hours || 1),
      purpose: row.purpose,
      status: row.status,
      notes: row.notes || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      approvedBy: row.approved_by || undefined,
      approvedAt: row.approved_at ? new Date(row.approved_at) : undefined
    };
  }
}
