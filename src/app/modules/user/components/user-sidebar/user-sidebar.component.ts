import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ReminderCounts, ReminderService } from '../../../../services/reminder.service';

@Component({
  selector: 'app-user-sidebar',
  templateUrl: './user-sidebar.component.html',
  styleUrls: ['./user-sidebar.component.scss']
})
export class UserSidebarComponent implements OnInit, OnDestroy {
  menuItems = [
    { path: '/user/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/user/appointment-request', label: 'Request Appointment', icon: 'appointment' },
    { path: '/user/basketball-court-reservation', label: 'Basketball Court', icon: 'basketball' },
    { path: '/user/form-history', label: 'Form History', icon: 'history' },
    { path: '/user/reminders', label: 'Pickup Reminders', icon: 'reminders' },
    { path: '/user/profile', label: 'Profile', icon: 'profile' }
  ];

  counts: ReminderCounts = { documents: 0, appointments: 0, pickupTotal: 0, pendingTotal: 0 };
  private sub = new Subscription();

  constructor(
    private router: Router,
    private reminderService: ReminderService
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.reminderService.reminders$.subscribe(() => {
        this.counts = this.reminderService.getCounts();
      })
    );
    this.reminderService.refresh().subscribe();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  isActive(path: string): boolean {
    return this.router.url === path || this.router.url.startsWith(path + '/');
  }

  get reminderBadge(): number {
    return this.counts.pickupTotal;
  }
}
