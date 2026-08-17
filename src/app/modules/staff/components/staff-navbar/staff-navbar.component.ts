import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AuthService, User } from '../../../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-staff-navbar',
  templateUrl: './staff-navbar.component.html',
  styleUrls: ['./staff-navbar.component.scss']
})
export class StaffNavbarComponent {
  @Input() menuOpen = false;
  @Output() menuToggle = new EventEmitter<void>();

  currentUser: User | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  toggleMenu(): void {
    this.menuToggle.emit();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  navigateToDashboard() {
    this.router.navigate(['/staff/dashboard']);
  }

  navigateToProfile() {
    this.router.navigate(['/staff/profile']);
  }
}
