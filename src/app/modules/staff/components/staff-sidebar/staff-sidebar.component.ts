import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ReminderCounts, ReminderService } from '../../../../services/reminder.service';

@Component({
  selector: 'app-staff-sidebar',
  templateUrl: './staff-sidebar.component.html',
  styleUrls: ['./staff-sidebar.component.scss']
})
export class StaffSidebarComponent implements OnInit, OnDestroy {
  menuItems = [
    { path: '/staff/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/staff/documents', label: 'Process Documents', icon: 'documents' },
    { path: '/staff/appointments', label: 'Appointment Management', icon: 'appointment' },
    { path: '/staff/certificates', label: 'Certificate Management', icon: 'certificate' },
    { path: '/staff/reminders', label: 'Pickup Reminders', icon: 'reminders' },
    { path: '/staff/basketball-courts', label: 'Basketball Courts', icon: 'basketball' },
    { path: '/staff/profile', label: 'Profile', icon: 'profile' }
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
    return this.counts.pickupTotal + this.counts.pendingTotal;
  }
}
