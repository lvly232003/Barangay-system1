import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, User } from '../../../../services/auth.service';
import { CertificateService, AppointmentRequest } from '../../../../services/certificate.service';

@Component({
  selector: 'app-staff-dashboard',
  templateUrl: './staff-dashboard.component.html',
  styleUrls: ['./staff-dashboard.component.scss']
})
export class StaffDashboardComponent implements OnInit {
  currentUser: User | null = null;
  
  staffStats = {
    pendingAppointments: 0,
    totalProcessed: 0,
    processedToday: 0,
    totalCertificates: 0 
  };
  
  // ✅ FIX: Added missing property required by template
  recentAppointments: AppointmentRequest[] = [];
  recentActivities: any[] = [];

  constructor(
    private authService: AuthService,
    private certificateService: CertificateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => this.currentUser = user);
    this.loadStats();
    this.loadRecentActivities();
  }

  loadStats() {
    this.certificateService.getAppointmentRequests().subscribe(apps => {
      // Calculate Stats
      this.staffStats.pendingAppointments = apps.filter(a => a.status === 'pending').length;
      this.staffStats.totalProcessed = apps.filter(a => ['approved', 'completed', 'rejected'].includes(a.status)).length;
      
      const today = new Date().toDateString();
      this.staffStats.processedToday = apps.filter(a => 
        ['approved', 'completed'].includes(a.status) && 
        new Date(a.createdAt || '').toDateString() === today
      ).length;

      // ✅ FIX: Populate recentAppointments (e.g., take top 5 or 10 recent ones)
      // Sorting by ID descending as a proxy for 'recent' if date isn't strictly reliable, 
      // or sort by createdAt if available.
      this.recentAppointments = apps.slice(0, 10); 
    });

    this.certificateService.getAllCertificates().subscribe(certs => {
      this.staffStats.totalCertificates = certs.length;
    });
  }

  loadRecentActivities() {
    this.certificateService.getAppointmentRequests().subscribe(apps => {
      this.recentActivities = apps
        .slice(0, 5) 
        .map(app => ({
          description: `Processed request for ${app.userName || 'User'}`,
          time: app.createdAt || new Date(),
          type: app.status
        }));
    });
  }

  navigateToAppointments() {
    this.router.navigate(['/staff/appointments']);
  }

  navigateToDocuments() {
    this.router.navigate(['/staff/certificates']); 
  }

  navigateToCertificates() {
    this.router.navigate(['/staff/certificates']);
  }
  
  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}