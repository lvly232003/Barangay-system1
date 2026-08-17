import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { Observable, map } from 'rxjs';
import { AuthService, AppRole } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean | UrlTree> {
    return this.authService.whenSessionReady().pipe(
      map(() => {
        if (!this.authService.isLoggedIn()) {
          return this.router.createUrlTree(['/login']);
        }

        const allowedRoles = route.data['roles'] as AppRole[] | undefined;
        if (allowedRoles?.length && !this.authService.hasRole(allowedRoles)) {
          return this.router.createUrlTree([this.authService.getDashboardRoute()]);
        }

        return true;
      })
    );
  }
}
