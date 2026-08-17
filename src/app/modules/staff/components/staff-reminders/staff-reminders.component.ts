import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  PickupReminder,
  ReminderCounts,
  ReminderService
} from '../../../../services/reminder.service';

@Component({
  selector: 'app-staff-reminders',
  templateUrl: './staff-reminders.component.html',
  styleUrls: ['./staff-reminders.component.scss']
})
export class StaffRemindersComponent implements OnInit, OnDestroy {
  reminders: PickupReminder[] = [];
  counts: ReminderCounts = { documents: 0, appointments: 0, pickupTotal: 0, pendingTotal: 0 };
  filter: 'all' | 'pickup' | 'pending' | 'document' | 'appointment' = 'all';
  loading = true;
  markingAll = false;
  private sub = new Subscription();

  constructor(
    private reminderService: ReminderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.reminderService.reminders$.subscribe(() => {
        this.applyFilter();
        this.counts = this.reminderService.getCounts();
        this.loading = false;
      })
    );
    this.reminderService.refresh().subscribe();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  applyFilter(): void {
    let list = this.reminderService.getReminders('all');
    if (this.filter === 'document' || this.filter === 'appointment') {
      list = this.reminderService.getReminders(this.filter);
    } else if (this.filter === 'pickup') {
      list = list.filter((r) => r.urgency === 'pickup' || r.urgency === 'ready');
    } else if (this.filter === 'pending') {
      list = list.filter((r) => r.urgency === 'pending');
    }
    this.reminders = list;
  }

  setFilter(value: typeof this.filter): void {
    this.filter = value;
    this.applyFilter();
  }

  open(reminder: PickupReminder): void {
    this.router.navigate([reminder.route]);
  }

  dismiss(reminder: PickupReminder, event: MouseEvent): void {
    event.stopPropagation();
    this.reminderService.dismiss(reminder.id);
    this.applyFilter();
    this.counts = this.reminderService.getCounts();
  }

  markAllAsRead(): void {
    if (!this.reminders.length || this.markingAll) return;
    this.markingAll = true;
    this.reminderService.markAllAsRead().subscribe({
      next: () => {
        this.markingAll = false;
        this.applyFilter();
        this.counts = this.reminderService.getCounts();
      },
      error: () => {
        this.markingAll = false;
      }
    });
  }

  refresh(): void {
    this.loading = true;
    this.reminderService.refresh().subscribe({
      next: () => (this.loading = false),
      error: () => (this.loading = false)
    });
  }

  urgencyClass(urgency: string): string {
    switch (urgency) {
      case 'pending':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
      case 'pickup':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
      case 'ready':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  formatDate(value?: string | Date): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
}
