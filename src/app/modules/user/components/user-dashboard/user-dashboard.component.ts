import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router'; // ✅ FIX: Import Router
import { AuthService, User } from '../../../../services/auth.service';
import { CertificateService, AppointmentRequest } from '../../../../services/certificate.service';

@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.scss']
})
export class UserDashboardComponent implements OnInit {
  currentUser: User | null = null;
  // ✅ FIX: Updated stats structure to match template
  userStats = {
    totalAppointments: 0,
    pendingAppointments: 0,
    approvedAppointments: 0,
    completedAppointments: 0,
    rejectedAppointments: 0
  };
  recentAppointments: AppointmentRequest[] = []; // ✅ FIX: Added property

  constructor(
    private authService: AuthService,
    private certificateService: CertificateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (this.currentUser) {
        this.loadStats();
      }
    });
  }

  loadStats() {
    if (!this.currentUser) return;

    this.certificateService.getUserAppointmentRequests(this.currentUser.id).subscribe(apps => {
      // Calculate Stats
      this.userStats.totalAppointments = apps.length;
      this.userStats.pendingAppointments = apps.filter(a => a.status === 'pending').length;
      this.userStats.approvedAppointments = apps.filter(a => a.status === 'approved').length;
      this.userStats.completedAppointments = apps.filter(a => a.status === 'completed').length;
      
      // Get Recent
      this.recentAppointments = apps
        .sort((a, b) => new Date(b.createdAt || b.reservationDate).getTime() - new Date(a.createdAt || a.reservationDate).getTime())
        .slice(0, 5);
    });
  }

  // ✅ FIX: Added Navigation Methods
  requestNewAppointment() {
    this.router.navigate(['/user/appointment-request']);
  }

  updateProfile() {
    this.router.navigate(['/user/profile']); // Ensure this route exists or remove the button
  }
}