import { Injectable } from '@angular/core';
import { BehaviorSubject, from, map, Observable, of, tap, catchError } from 'rxjs';
import { AuthService, AppRole } from './auth.service';
import { supabase } from '../supabase/supabase.client';

export type ReminderKind = 'appointment' | 'document';
export type ReminderUrgency = 'pickup' | 'pending' | 'ready';
export type ReminderAudience = 'ops' | 'resident';

export interface PickupReminder {
  id: string;
  kind: ReminderKind;
  urgency: ReminderUrgency;
  title: string;
  message: string;
  residentName: string;
  reference: string;
  route: string;
  relatedId: string | number;
  createdAt?: string | Date;
  appointmentDate?: string | Date;
  audience: ReminderAudience;
  sourceKey?: string;
}

/** Back-compat name used by admin templates */
export type AdminReminder = PickupReminder;

export interface ReminderCounts {
  documents: number;
  appointments: number;
  pickupTotal: number;
  pendingTotal: number;
}

interface ReminderRow {
  id: string;
  source_key: string;
  audience: ReminderAudience;
  user_id: string;
  appointment_id?: string | null;
  certificate_id?: string | null;
  kind: ReminderKind;
  urgency: ReminderUrgency;
  title: string;
  message: string;
  reference?: string | null;
  resident_name?: string | null;
  status: 'active' | 'dismissed';
  created_at?: string;
}

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private remindersSubject = new BehaviorSubject<PickupReminder[]>([]);
  readonly reminders$ = this.remindersSubject.asObservable();

  constructor(private authService: AuthService) {
    this.refresh().subscribe();
  }

  refresh(): Observable<PickupReminder[]> {
    return from(
      supabase
        .from('pickup_reminders')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return ((data || []) as ReminderRow[]).map((row) => this.mapRow(row));
      }),
      tap((reminders) => this.remindersSubject.next(reminders)),
      catchError((err) => {
        console.error('Failed to load pickup_reminders', err);
        this.remindersSubject.next([]);
        return of([]);
      })
    );
  }

  getReminders(focus: ReminderKind | 'all' = 'all'): PickupReminder[] {
    return this.remindersSubject.value.filter((r) => {
      if (focus === 'all') return true;
      return r.kind === focus;
    });
  }

  getCounts(): ReminderCounts {
    const active = this.getReminders('all');
    return {
      documents: active.filter((r) => r.kind === 'document').length,
      appointments: active.filter((r) => r.kind === 'appointment').length,
      pickupTotal: active.filter((r) => r.urgency === 'pickup' || r.urgency === 'ready').length,
      pendingTotal: active.filter((r) => r.urgency === 'pending').length
    };
  }

  dismiss(id: string): void {
    const user = this.authService.getCurrentUser();
    void supabase
      .from('pickup_reminders')
      .update({
        status: 'dismissed',
        dismissed_at: new Date().toISOString(),
        dismissed_by: user?.id ? String(user.id) : null
      })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error('Failed to dismiss reminder', error);
          return;
        }
        this.remindersSubject.next(this.remindersSubject.value.filter((r) => r.id !== id));
      });
  }

  /**
   * Mark all currently visible active reminders as read (dismissed in Supabase).
   * RLS scopes this to ops rows for admin/staff, or the resident's own rows.
   */
  markAllAsRead(): Observable<void> {
    const user = this.authService.getCurrentUser();
    const ids = this.remindersSubject.value.map((r) => r.id);
    if (!ids.length) {
      return of(undefined);
    }

    return from(
      supabase
        .from('pickup_reminders')
        .update({
          status: 'dismissed',
          dismissed_at: new Date().toISOString(),
          dismissed_by: user?.id ? String(user.id) : null
        })
        .eq('status', 'active')
        .in('id', ids)
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
        this.remindersSubject.next([]);
      }),
      catchError((err) => {
        console.error('Failed to mark all reminders as read', err);
        throw err;
      })
    );
  }

  clearDismissed(): void {
    this.refresh().subscribe();
  }

  private mapRow(row: ReminderRow): PickupReminder {
    const role = this.authService.normalizeRole(this.authService.getCurrentUser()?.role);
    return {
      id: row.id,
      kind: row.kind,
      urgency: row.urgency,
      title: row.title,
      message: row.message,
      residentName: row.resident_name || 'Resident',
      reference: row.reference || '',
      route: this.resolveRoute(row, role),
      relatedId: row.appointment_id || row.certificate_id || row.id,
      createdAt: row.created_at,
      audience: row.audience,
      sourceKey: row.source_key
    };
  }

  private resolveRoute(row: ReminderRow, role: AppRole | null): string {
    if (role === 'user' || row.audience === 'resident') {
      if (role === 'user') return '/user/reminders';
    }
    if (role === 'staff') {
      if (row.kind === 'document') return '/staff/documents';
      return '/staff/appointments';
    }
    if (row.kind === 'document') return '/admin/documents';
    return '/admin/appointments';
  }
}

/** DI alias so existing admin inject(AdminReminderService) keeps working */
export { ReminderService as AdminReminderService };
