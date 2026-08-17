import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, map } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Public auth pages: if already logged in, send the user to their dashboard.
 */
@Injectable({
  providedIn: 'root'
})
export class GuestGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.authService.whenSessionReady().pipe(
      map(() => {
        if (this.authService.isLoggedIn()) {
          return this.router.createUrlTree([this.authService.getDashboardRoute()]);
        }
        return true;
      })
    );
  }
}
