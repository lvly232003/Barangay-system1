import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ReminderCounts,
  ReminderKind,
  ReminderService
} from '../../../../services/reminder.service';

@Component({
  selector: 'app-admin-sidebar',
  templateUrl: './admin-sidebar.component.html',
  styleUrls: ['./admin-sidebar.component.scss']
})
export class AdminSidebarComponent implements OnInit, OnDestroy {
  menuItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard', reminderKey: null as ReminderKind | null },
    { path: '/admin/documents', label: 'Document Management', icon: 'documents', reminderKey: 'document' as ReminderKind },
    { path: '/admin/users', label: 'User Management', icon: 'user-management', reminderKey: null },
    { path: '/admin/certificate-forms', label: 'Certificate Forms', icon: 'certificate', reminderKey: null },
    { path: '/admin/appointments', label: 'Appointment Management', icon: 'appointment', reminderKey: 'appointment' as ReminderKind },
    { path: '/admin/certificates', label: 'Certificate Museum', icon: 'certificate-management', reminderKey: null },
    { path: '/admin/reminders', label: 'Pickup Reminders', icon: 'reminders', reminderKey: null },
    { path: '/admin/basketball-courts', label: 'Basketball Courts', icon: 'basketball', reminderKey: null },
    { path: '/admin/reports', label: 'Reports', icon: 'reports', reminderKey: null },
    { path: '/admin/profile', label: 'Profile', icon: 'profile', reminderKey: null },
    { path: '/admin/settings', label: 'Settings', icon: 'settings', reminderKey: null }
  ];

  counts: ReminderCounts = { documents: 0, appointments: 0, pickupTotal: 0, pendingTotal: 0 };
  private subs = new Subscription();

  constructor(
    private router: Router,
    private reminderService: ReminderService
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.reminderService.reminders$.subscribe(() => {
        this.counts = this.reminderService.getCounts();
      })
    );
    this.reminderService.refresh().subscribe();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  badgeCount(key: ReminderKind | null): number {
    if (key === 'document') return this.counts.documents;
    if (key === 'appointment') return this.counts.appointments;
    return 0;
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  isActive(path: string): boolean {
    return this.router.url === path || this.router.url.startsWith(path + '/');
  }
}
