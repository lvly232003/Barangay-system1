import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of, from, catchError, map, Observable } from 'rxjs';
import ApexCharts from 'apexcharts';
import { AuthService } from '../../../../services/auth.service';
import { CertificateService } from '../../../../services/certificate.service';
import { BasketballCourtService } from '../../../../services/basketball-court.service';
import {
  BMS_CHART_COLORS,
  BMS_PALETTE,
  baseChartOptions,
  countByMonth,
  lastNMonthsLabels
} from '../../chart-theme';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('appointmentsChart') appointmentsChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('usersChart') usersChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('certsChart') certsChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('radialChart') radialChartRef?: ElementRef<HTMLDivElement>;

  stats = {
    totalUsers: 0,
    totalResidents: 0,
    totalStaff: 0,
    totalAdmins: 0,
    pendingAppointments: 0,
    approvedAppointments: 0,
    completedAppointments: 0,
    rejectedAppointments: 0,
    totalCertificates: 0,
    issuedCertificates: 0,
    courtReservations: 0,
    activeStaff: 0
  };

  recentActivities: any[] = [];
  loadError = '';
  private charts: ApexCharts[] = [];
  private viewReady = false;
  private dataReady = false;
  private users: any[] = [];
  private appointments: any[] = [];
  private certificates: any[] = [];

  constructor(
    private authService: AuthService,
    private certificateService: CertificateService,
    private basketballService: BasketballCourtService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.tryRenderCharts();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  loadDashboardData() {
    this.loadError = '';
    const emptyOnError = (label: string) =>
      catchError((err: any): Observable<any[]> => {
        const msg = err?.message || err?.error_description || String(err);
        this.loadError = this.loadError
          ? `${this.loadError} ${label}: ${msg}`
          : `Could not read ${label} from Supabase (${msg}). Sign out and sign in again, then re-run supabase/sql/ALL_IN_ONE.sql if tables or RLS are missing.`;
        console.error(`Dashboard failed loading ${label}`, err);
        return of([]);
      });

    forkJoin({
      users: this.authService.getAllUsers().pipe(emptyOnError('users')),
      appointments: this.certificateService.getAppointmentRequests().pipe(emptyOnError('appointments')),
      certificates: this.certificateService.getAllCertificates().pipe(emptyOnError('certificates')),
      reservations: from(this.basketballService.refreshFromSupabase()).pipe(
        map(() => this.basketballService.getReservations()),
        emptyOnError('court reservations')
      )
    } as {
      users: Observable<any[]>;
      appointments: Observable<any[]>;
      certificates: Observable<any[]>;
      reservations: Observable<any[]>;
    }).subscribe({
      next: (data) => {
        this.users = data.users || [];
        this.appointments = data.appointments || [];
        this.certificates = data.certificates || [];
        const reservations = data.reservations || [];

        this.stats.totalUsers = this.users.length;
        this.stats.totalResidents = this.users.filter(
          (u) => this.authService.normalizeRole(u.role) === 'user'
        ).length;
        this.stats.totalStaff = this.users.filter(
          (u) => this.authService.normalizeRole(u.role) === 'staff'
        ).length;
        this.stats.totalAdmins = this.users.filter(
          (u) => this.authService.normalizeRole(u.role) === 'admin'
        ).length;
        this.stats.activeStaff = this.stats.totalStaff;

        this.stats.pendingAppointments = this.appointments.filter((a) => a.status === 'pending').length;
        this.stats.approvedAppointments = this.appointments.filter((a) => a.status === 'approved').length;
        this.stats.completedAppointments = this.appointments.filter(
          (a) => a.status === 'completed' || a.status === 'issued'
        ).length;
        this.stats.rejectedAppointments = this.appointments.filter((a) => a.status === 'rejected').length;

        this.stats.totalCertificates = this.certificates.length;
        this.stats.issuedCertificates = this.certificates.filter(
          (c) => c.status === 'issued' || c.status === 'completed'
        ).length;
        this.stats.courtReservations = reservations.length;

        this.processRecentActivities(this.appointments);
        this.dataReady = true;
        this.tryRenderCharts();
      },
      error: (err) => {
        this.loadError = err?.message || 'Failed to load dashboard data from Supabase.';
        console.error('Error loading dashboard data', err);
      }
    });
  }

  private tryRenderCharts(): void {
    if (!this.viewReady || !this.dataReady) return;
    setTimeout(() => this.renderCharts(), 0);
  }

  private destroyCharts(): void {
    this.charts.forEach((c) => {
      try {
        c.destroy();
      } catch {
        /* ignore */
      }
    });
    this.charts = [];
  }

  private renderCharts(): void {
    this.destroyCharts();

    const months = lastNMonthsLabels(6);
    const apptTrend = countByMonth(
      this.appointments.map((a) => a.createdAt || a.requestedDate || a.appointmentDate),
      6
    );
    const certTrend = countByMonth(
      this.certificates.map((c) => c.issuedDate || c.requestDate),
      6
    );

    if (this.appointmentsChartRef?.nativeElement) {
      const chart = new ApexCharts(
        this.appointmentsChartRef.nativeElement,
        baseChartOptions({
          chart: { type: 'area', height: 300 },
          series: [
            { name: 'Appointments', data: apptTrend },
            { name: 'Certificates', data: certTrend }
          ],
          xaxis: { categories: months },
          fill: {
            type: 'gradient',
            gradient: {
              shadeIntensity: 1,
              opacityFrom: 0.55,
              opacityTo: 0.05,
              stops: [0, 90, 100]
            }
          },
          colors: [BMS_CHART_COLORS.emerald, BMS_CHART_COLORS.cyan],
          title: { text: 'Activity pulse (6 months)', style: { fontWeight: 700 } }
        })
      );
      void chart.render();
      this.charts.push(chart);
    }

    if (this.usersChartRef?.nativeElement) {
      const chart = new ApexCharts(
        this.usersChartRef.nativeElement,
        baseChartOptions({
          chart: { type: 'donut', height: 300 },
          labels: ['Residents', 'Staff', 'Admins'],
          series: [
            this.stats.totalResidents,
            this.stats.totalStaff,
            Math.max(this.stats.totalAdmins, 0)
          ],
          colors: [BMS_CHART_COLORS.emerald, BMS_CHART_COLORS.teal, BMS_CHART_COLORS.violet],
          plotOptions: {
            pie: {
              donut: {
                size: '68%',
                labels: {
                  show: true,
                  total: {
                    show: true,
                    label: 'Users',
                    formatter: () => String(this.stats.totalUsers)
                  }
                }
              }
            }
          },
          title: { text: 'User mix', style: { fontWeight: 700 } }
        })
      );
      void chart.render();
      this.charts.push(chart);
    }

    if (this.certsChartRef?.nativeElement) {
      const statusKeys = ['pending', 'approved', 'completed', 'issued', 'rejected'];
      const statusCounts = statusKeys.map(
        (s) => this.appointments.filter((a) => a.status === s).length
      );
      const chart = new ApexCharts(
        this.certsChartRef.nativeElement,
        baseChartOptions({
          chart: { type: 'bar', height: 300 },
          series: [{ name: 'Appointments', data: statusCounts }],
          xaxis: { categories: statusKeys.map((s) => s[0].toUpperCase() + s.slice(1)) },
          plotOptions: {
            bar: {
              borderRadius: 8,
              columnWidth: '55%',
              distributed: true
            }
          },
          colors: BMS_PALETTE,
          legend: { show: false },
          title: { text: 'Appointment pipeline', style: { fontWeight: 700 } }
        })
      );
      void chart.render();
      this.charts.push(chart);
    }

    if (this.radialChartRef?.nativeElement) {
      const completionRate =
        this.stats.totalCertificates === 0
          ? 0
          : Math.round((this.stats.issuedCertificates / this.stats.totalCertificates) * 100);
      const approvalRate =
        this.appointments.length === 0
          ? 0
          : Math.round(
              ((this.stats.approvedAppointments + this.stats.completedAppointments) /
                this.appointments.length) *
                100
            );
      const coverageRate = Math.min(
        100,
        Math.round(
          ((this.stats.totalCertificates + this.stats.completedAppointments) /
            Math.max(this.stats.totalUsers, 1)) *
            40
        )
      );

      const chart = new ApexCharts(
        this.radialChartRef.nativeElement,
        baseChartOptions({
          chart: { type: 'radialBar', height: 320 },
          series: [completionRate, approvalRate, coverageRate],
          labels: ['Issued certs', 'Appt progress', 'Coverage index'],
          colors: [BMS_CHART_COLORS.emerald, BMS_CHART_COLORS.amber, BMS_CHART_COLORS.cyan],
          plotOptions: {
            radialBar: {
              hollow: { size: '28%' },
              track: { background: isDark() ? '#132820' : '#ecfdf5' },
              dataLabels: {
                name: { fontSize: '12px' },
                value: { fontSize: '16px', fontWeight: 700 },
                total: {
                  show: true,
                  label: 'Health',
                  formatter: () => `${Math.round((completionRate + approvalRate + coverageRate) / 3)}%`
                }
              }
            }
          },
          title: { text: 'System health gauges', style: { fontWeight: 700 } }
        })
      );
      void chart.render();
      this.charts.push(chart);
    }
  }

  processRecentActivities(appointments: any[]) {
    const recentAppointments = [...appointments]
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || a.reservationDate || 0).getTime();
        const dateB = new Date(b.createdAt || b.reservationDate || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);

    this.recentActivities = recentAppointments.map((appointment) => ({
      id: appointment.id,
      type: 'appointment',
      description: `Appointment for ${appointment.certificateName || appointment.type || 'document'} from ${
        appointment.userName || 'resident'
      }`,
      time: this.getTimeAgo(appointment.createdAt || appointment.reservationDate),
      status: appointment.status
    }));
  }

  getTimeAgo(dateInput: string | Date | undefined): string {
    if (!dateInput) return 'Just now';
    const date = new Date(dateInput);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    if (isNaN(diffInMs) || diffInMs < 0) return 'Just now';
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays > 0) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    if (diffInHours > 0) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    return diffInMinutes > 0 ? `${diffInMinutes} min ago` : 'Just now';
  }

  navigateToAppointments() {
    this.router.navigate(['/admin/appointments']);
  }

  navigateToUsers() {
    this.router.navigate(['/admin/users']);
  }

  navigateToDocuments() {
    this.router.navigate(['/admin/documents']);
  }

  navigateToMuseum() {
    this.router.navigate(['/admin/certificates']);
  }

  navigateToReports() {
    this.router.navigate(['/admin/reports']);
  }
}

function isDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}
