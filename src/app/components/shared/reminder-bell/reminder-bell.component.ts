import { Component, ElementRef, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  PickupReminder,
  ReminderCounts,
  ReminderService
} from '../../../services/reminder.service';

@Component({
  selector: 'app-reminder-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reminder-bell.component.html',
  styleUrls: ['./reminder-bell.component.scss']
})
export class ReminderBellComponent implements OnInit, OnDestroy {
  /** Route for "View all" — e.g. /admin/reminders */
  @Input() remindersPath = '/admin/reminders';

  open = false;
  reminders: PickupReminder[] = [];
  counts: ReminderCounts = { documents: 0, appointments: 0, pickupTotal: 0, pendingTotal: 0 };
  isMobile = false;
  markingAll = false;

  private sub = new Subscription();
  private mq?: MediaQueryList;

  constructor(
    private reminderService: ReminderService,
    private router: Router,
    private host: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    this.mq = window.matchMedia('(max-width: 639px)');
    const syncMq = () => {
      this.isMobile = this.mq!.matches;
    };
    syncMq();
    this.mq.addEventListener('change', syncMq);
    this.sub.add({ unsubscribe: () => this.mq?.removeEventListener('change', syncMq) });

    this.sub.add(
      this.reminderService.reminders$.subscribe(() => {
        this.reminders = this.reminderService.getReminders('all').slice(0, 8);
        this.counts = this.reminderService.getCounts();
      })
    );
    this.reminderService.refresh().subscribe();
  }

  ngOnDestroy(): void {
    this.setBodyScrollLocked(false);
    this.sub.unsubscribe();
  }

  get badgeTotal(): number {
    return this.counts.pickupTotal + this.counts.pendingTotal;
  }

  toggle(): void {
    this.open = !this.open;
    this.setBodyScrollLocked(this.open && this.isMobile);
    if (this.open) {
      this.reminderService.refresh().subscribe();
    }
  }

  close(): void {
    this.open = false;
    this.setBodyScrollLocked(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.open) {
      this.setBodyScrollLocked(this.open && this.isMobile);
    }
  }

  openReminder(reminder: PickupReminder): void {
    this.close();
    this.router.navigate([reminder.route]);
  }

  dismiss(reminder: PickupReminder, event: MouseEvent): void {
    event.stopPropagation();
    this.reminderService.dismiss(reminder.id);
    this.reminders = this.reminderService.getReminders('all').slice(0, 8);
    this.counts = this.reminderService.getCounts();
  }

  markAllAsRead(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.badgeTotal || this.markingAll) return;
    this.markingAll = true;
    this.reminderService.markAllAsRead().subscribe({
      next: () => {
        this.markingAll = false;
        this.reminders = [];
        this.counts = this.reminderService.getCounts();
      },
      error: () => {
        this.markingAll = false;
      }
    });
  }

  viewAll(): void {
    this.close();
    this.router.navigate([this.remindersPath]);
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

  private setBodyScrollLocked(locked: boolean): void {
    document.body.style.overflow = locked ? 'hidden' : '';
  }
}
