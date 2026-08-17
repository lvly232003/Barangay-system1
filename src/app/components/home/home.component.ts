import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  readonly services = [
    { title: 'Barangay Clearance', desc: 'Standard clearance for employment and legal requirements', fee: 'Php 50.00' },
    { title: 'Barangay Residency', desc: 'Proof of residency within the barangay', fee: 'Php 50.00' },
    { title: 'Barangay Certification', desc: 'Living Together, Guardianship, and similar certifications', fee: 'Php 50.00' },
    { title: 'Vehicle Inspection / Renewal', desc: 'Vehicle inspection and renewal certification', fee: 'Php 50.00' },
    { title: 'Indigency', desc: 'Certificate of indigency for assistance programs', fee: 'FREE' },
    { title: 'Low Income', desc: 'Low income certification for assistance programs', fee: 'FREE' },
    { title: 'First Time Jobseeker', desc: 'First time jobseeker certification', fee: 'FREE' },
    { title: 'Business Endorsement', desc: 'Barangay endorsement for business permit processing', fee: 'FREE' },
    { title: 'Other Certifications', desc: 'Other barangay certifications as applicable', fee: 'Php 50.00' },
    { title: 'Basketball Court Reservation', desc: 'Book basketball courts for sports activities and events', fee: '' }
  ];

  private routeSub?: Subscription;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngAfterViewInit(): void {
    this.routeSub = this.route.data.subscribe((data) => {
      const section = data['section'] as string | undefined;
      if (section) {
        setTimeout(() => this.scrollToSection(section), 50);
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  scrollToSection(sectionId: string): void {
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  navigateToLogin() {
    if (this.authService.isLoggedIn()) {
      this.router.navigate([this.authService.getDashboardRoute()]);
      return;
    }
    this.router.navigate(['/login']);
  }

  navigateToRegister() {
    if (this.authService.isLoggedIn()) {
      this.router.navigate([this.authService.getDashboardRoute()]);
      return;
    }
    this.router.navigate(['/register']);
  }

  navigateToBasketballCourt() {
    if (this.authService.isLoggedIn()) {
      const role = this.authService.normalizeRole(this.authService.getCurrentUser()?.role);
      if (role === 'user') {
        this.router.navigate(['/user/basketball-court-reservation']);
        return;
      }
      this.router.navigate([this.authService.getDashboardRoute()]);
      return;
    }

    this.router.navigate(['/login'], {
      queryParams: {
        message: 'Please login to access basketball court reservations'
      }
    });
  }
}
