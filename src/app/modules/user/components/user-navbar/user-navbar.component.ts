import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, User } from '../../../../services/auth.service';

@Component({
  selector: 'app-user-navbar',
  templateUrl: './user-navbar.component.html',
  styleUrls: ['./user-navbar.component.scss']
})
export class UserNavbarComponent {
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
    this.router.navigate(['/user/dashboard']);
  }

  navigateToProfile() {
    this.router.navigate(['/user/profile']);
  }
}
