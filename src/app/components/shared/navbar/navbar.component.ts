import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService, User } from '../../../services/auth.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  shouldShowNavbar = true;
  menuOpen = false;

  private subs = new Subscription();

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.subs.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
      })
    );

    this.shouldShowNavbar = !this.isPortalRoute(this.router.url);

    this.subs.add(
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe((event) => {
          this.shouldShowNavbar = !this.isPortalRoute((event as NavigationEnd).urlAfterRedirects);
          this.menuOpen = false;
        })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  private isPortalRoute(url: string): boolean {
    const path = url.split('?')[0].split('#')[0];
    return (
      path === '/admin' ||
      path.startsWith('/admin/') ||
      path === '/staff' ||
      path.startsWith('/staff/') ||
      path === '/user' ||
      path.startsWith('/user/') ||
      path.startsWith('/shared/')
    );
  }

  goToSection(event: Event, section: 'about' | 'services' | 'contact'): void {
    event.preventDefault();
    this.closeMenu();
    const url = this.router.url.split('?')[0].split('#')[0];
    const onLanding =
      url === '/' ||
      url === '/home' ||
      url === '/about' ||
      url === '/services' ||
      url === '/contact';

    this.router.navigate(['/', section]).then(() => {
      if (onLanding) {
        setTimeout(() => {
          document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 40);
      }
    });
  }

  navigateToHome() {
    this.closeMenu();
    if (this.authService.isLoggedIn()) {
      this.router.navigate([this.authService.getDashboardRoute()]);
      return;
    }
    this.router.navigate(['/']);
  }

  navigateToLogin() {
    this.closeMenu();
    this.router.navigate(['/login']);
  }

  navigateToRegister() {
    this.closeMenu();
    this.router.navigate(['/register']);
  }

  logout() {
    this.closeMenu();
    this.authService.logout();
    this.router.navigate(['/']);
  }

  navigateToDashboard() {
    this.closeMenu();
    this.router.navigate([this.authService.getDashboardRoute()]);
  }
}
