import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  PickupReminder,
  ReminderCounts,
  ReminderService
} from '../../../../services/reminder.service';

@Component({
  selector: 'app-user-reminders',
  templateUrl: './user-reminders.component.html',
  styleUrls: ['./user-reminders.component.scss']
})
export class UserRemindersComponent implements OnInit, OnDestroy {
  reminders: PickupReminder[] = [];
  counts: ReminderCounts = { documents: 0, appointments: 0, pickupTotal: 0, pendingTotal: 0 };
  loading = true;
  markingAll = false;
  private sub = new Subscription();

  constructor(private reminderService: ReminderService) {}

  ngOnInit(): void {
    this.sub.add(
      this.reminderService.reminders$.subscribe(() => {
        this.reminders = this.reminderService.getReminders('all');
        this.counts = this.reminderService.getCounts();
        this.loading = false;
      })
    );
    this.reminderService.refresh().subscribe();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  dismiss(reminder: PickupReminder, event: MouseEvent): void {
    event.stopPropagation();
    this.reminderService.dismiss(reminder.id);
    this.reminders = this.reminderService.getReminders('all');
    this.counts = this.reminderService.getCounts();
  }

  markAllAsRead(): void {
    if (!this.reminders.length || this.markingAll) return;
    this.markingAll = true;
    this.reminderService.markAllAsRead().subscribe({
      next: () => {
        this.markingAll = false;
        this.reminders = this.reminderService.getReminders('all');
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
      case 'pickup':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
      case 'ready':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
      default:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
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
