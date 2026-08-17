import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Barangay Management System';
  showChrome = true;

  constructor(
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit() {
    // Ensure theme is applied on bootstrap
    void this.themeService.theme;

    this.showChrome = !this.isPortalRoute(this.router.url);

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.showChrome = !this.isPortalRoute((event as NavigationEnd).urlAfterRedirects);
      });
  }

  private isPortalRoute(url: string): boolean {
    const path = url.split('?')[0];
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
}
