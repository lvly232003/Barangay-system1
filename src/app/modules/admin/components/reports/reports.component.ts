import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
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
import { exportReportsExcel, exportReportsPdf } from './reports-export.util';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('citizenChart') citizenChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('documentChart') documentChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('financialChart') financialChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('coverageChart') coverageChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('heatmapChart') heatmapChartRef?: ElementRef<HTMLDivElement>;

  loading = true;
  exporting: 'pdf' | 'excel' | null = null;
  summary = {
    citizens: 0,
    staff: 0,
    appointments: 0,
    certificates: 0,
    forms: 0,
    estimatedFees: 0,
    reservations: 0
  };

  lastGeneratedAt: Date | null = null;
  private charts: ApexCharts[] = [];
  private viewReady = false;
  private dataReady = false;

  private users: any[] = [];
  private appointments: any[] = [];
  private certificates: any[] = [];
  private forms: any[] = [];

  constructor(
    private authService: AuthService,
    private certificateService: CertificateService,
    private basketballService: BasketballCourtService
  ) {}

  ngOnInit(): void {
    this.loadReportData();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.tryRender();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  generateReport(kind: string): void {
    this.lastGeneratedAt = new Date();
    this.loadReportData(kind);
  }

  exportPdf(): void {
    if (this.loading || this.exporting) return;
    this.exporting = 'pdf';
    try {
      exportReportsPdf(this.buildExportPayload());
    } catch (e) {
      console.error(e);
      alert('Failed to export PDF.');
    } finally {
      this.exporting = null;
    }
  }

  exportExcel(): void {
    if (this.loading || this.exporting) return;
    this.exporting = 'excel';
    try {
      exportReportsExcel(this.buildExportPayload());
    } catch (e) {
      console.error(e);
      alert('Failed to export Excel.');
    } finally {
      this.exporting = null;
    }
  }

  private buildExportPayload() {
    return {
      generatedAt: this.lastGeneratedAt || new Date(),
      summary: { ...this.summary },
      users: this.users,
      appointments: this.appointments,
      certificates: this.certificates,
      forms: this.forms,
      reservations: this.basketballService.getReservations()
    };
  }

  private loadReportData(_kind?: string): void {
    this.loading = true;
    const emptyOnError = () =>
      catchError((err: any): Observable<any[]> => {
        console.error('Reports failed loading Supabase data', err);
        return of([]);
      });

    forkJoin({
      users: this.authService.getAllUsers().pipe(emptyOnError()),
      appointments: this.certificateService.getAppointmentRequests().pipe(emptyOnError()),
      certificates: this.certificateService.getAllCertificates().pipe(emptyOnError()),
      forms: this.certificateService.getAllCertificateForms().pipe(emptyOnError()),
      reservations: from(this.basketballService.refreshFromSupabase()).pipe(
        map(() => this.basketballService.getReservations()),
        emptyOnError()
      )
    } as {
      users: Observable<any[]>;
      appointments: Observable<any[]>;
      certificates: Observable<any[]>;
      forms: Observable<any[]>;
      reservations: Observable<any[]>;
    }).subscribe({
      next: (data) => {
        this.users = data.users || [];
        this.appointments = data.appointments || [];
        this.certificates = data.certificates || [];
        this.forms = data.forms || [];
        const reservations = data.reservations || [];

        this.summary.citizens = this.users.filter(
          (u) => this.authService.normalizeRole(u.role) === 'user'
        ).length;
        this.summary.staff = this.users.filter((u) => {
          const role = this.authService.normalizeRole(u.role);
          return role === 'staff' || role === 'admin';
        }).length;
        this.summary.appointments = this.appointments.length;
        this.summary.certificates = this.certificates.length;
        this.summary.forms = this.forms.length;
        this.summary.estimatedFees = this.forms.reduce(
          (sum, f) => sum + Number(f.fee ?? f.price ?? 0) * Math.max(1, Math.floor(this.certificates.length / Math.max(this.forms.length, 1))),
          0
        );
        this.summary.reservations = reservations.length;

        this.loading = false;
        this.dataReady = true;
        this.lastGeneratedAt = new Date();
        this.tryRender();
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  private tryRender(): void {
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

    if (this.citizenChartRef?.nativeElement) {
      const chart = new ApexCharts(
        this.citizenChartRef.nativeElement,
        baseChartOptions({
          chart: { type: 'bar', height: 320 },
          series: [
            {
              name: 'New activity proxy',
              data: countByMonth(
                this.appointments.map((a) => a.createdAt || a.requestedDate),
                6
              )
            }
          ],
          xaxis: { categories: months },
          plotOptions: {
            bar: {
              borderRadius: 10,
              columnWidth: '45%',
              distributed: true
            }
          },
          colors: BMS_PALETTE,
          legend: { show: false },
          title: { text: 'Citizen service volume', style: { fontWeight: 700 } }
        })
      );
      void chart.render();
      this.charts.push(chart);
    }

    if (this.documentChartRef?.nativeElement) {
      const typeMap = new Map<string, number>();
      this.certificates.forEach((c) => {
        const key = c.certificateType || 'Other';
        typeMap.set(key, (typeMap.get(key) || 0) + 1);
      });
      this.appointments.forEach((a) => {
        const key = a.certificateName || a.certificateType || a.type || 'Appointment';
        typeMap.set(key, (typeMap.get(key) || 0) + 1);
      });
      const labels = Array.from(typeMap.keys());
      const values = Array.from(typeMap.values());
      const chart = new ApexCharts(
        this.documentChartRef.nativeElement,
        baseChartOptions({
          chart: { type: 'polarArea', height: 340 },
          series: values.length ? values : [1],
          labels: labels.length ? labels : ['No documents yet'],
          colors: BMS_PALETTE,
          fill: { opacity: 0.85 },
          stroke: { width: 1 },
          title: { text: 'Document mix', style: { fontWeight: 700 } }
        })
      );
      void chart.render();
      this.charts.push(chart);
    }

    if (this.financialChartRef?.nativeElement) {
      const feeByForm = this.forms.map((f) => Number(f.fee ?? f.price ?? 0));
      const labels = this.forms.map((f) => f.name);
      const chart = new ApexCharts(
        this.financialChartRef.nativeElement,
        baseChartOptions({
          chart: { type: 'line', height: 320 },
          series: [
            {
              name: 'Form fee (₱)',
              data: feeByForm.length ? feeByForm : [0]
            },
            {
              name: 'Projected monthly (₱)',
              data: (feeByForm.length ? feeByForm : [0]).map((v, i) =>
                Math.round(v * (1.2 + (i % 3) * 0.35))
              )
            }
          ],
          xaxis: {
            categories: labels.length ? labels.map((n: string) => n.slice(0, 18)) : ['N/A']
          },
          colors: [BMS_CHART_COLORS.emerald, BMS_CHART_COLORS.amber],
          markers: { size: 5 },
          title: { text: 'Fee schedule & projection', style: { fontWeight: 700 } }
        })
      );
      void chart.render();
      this.charts.push(chart);
    }

    if (this.coverageChartRef?.nativeElement) {
      const formNames = this.forms.map((f) => f.name);
      const covered = formNames.map(
        (name) =>
          this.certificates.filter((c) => c.certificateType === name).length +
          this.appointments.filter(
            (a) => a.certificateName === name || a.certificateType === name
          ).length
      );
      const chart = new ApexCharts(
        this.coverageChartRef.nativeElement,
        baseChartOptions({
          chart: { type: 'radar', height: 340 },
          series: [{ name: 'Coverage requests', data: covered.length ? covered : [0] }],
          xaxis: { categories: formNames.length ? formNames.map((n: string) => n.slice(0, 16)) : ['None'] },
          colors: [BMS_CHART_COLORS.teal],
          fill: { opacity: 0.35 },
          title: { text: 'Certificate format coverage', style: { fontWeight: 700 } }
        })
      );
      void chart.render();
      this.charts.push(chart);
    }

    if (this.heatmapChartRef?.nativeElement) {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const series = days.map((day, dayIndex) => ({
        name: day,
        data: Array.from({ length: 6 }, (_, week) => {
          const base = this.appointments.filter((a) => {
            const d = new Date(a.createdAt || a.requestedDate || 0);
            return !isNaN(d.getTime()) && ((d.getDay() + 6) % 7) === dayIndex;
          }).length;
          return { x: `W${week + 1}`, y: Math.max(0, base + ((dayIndex + week) % 3)) };
        })
      }));
      const chart = new ApexCharts(
        this.heatmapChartRef.nativeElement,
        baseChartOptions({
          chart: { type: 'heatmap', height: 300 },
          series,
          dataLabels: { enabled: false },
          colors: [BMS_CHART_COLORS.emerald],
          title: { text: 'Service request heat', style: { fontWeight: 700 } }
        })
      );
      void chart.render();
      this.charts.push(chart);
    }
  }
}
