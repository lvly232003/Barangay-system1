import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { LoginComponent } from './components/auth/login/login.component';
import { RegisterComponent } from './components/auth/register/register.component';
import { AuthGuard } from './guards/auth.guard';
import { GuestGuard } from './guards/guest.guard';

const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [GuestGuard] },
  { path: 'home', component: HomeComponent, canActivate: [GuestGuard] },
  { path: 'about', component: HomeComponent, canActivate: [GuestGuard], data: { section: 'about' } },
  { path: 'services', component: HomeComponent, canActivate: [GuestGuard], data: { section: 'services' } },
  { path: 'contact', component: HomeComponent, canActivate: [GuestGuard], data: { section: 'contact' } },
  { path: 'login', component: LoginComponent, canActivate: [GuestGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [GuestGuard] },
  { path: 'admin-login', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'admin',
    canActivate: [AuthGuard],
    data: { roles: ['admin'] },
    loadChildren: () => import('./modules/admin/admin.module').then(m => m.AdminModule)
  },
  {
    path: 'user',
    canActivate: [AuthGuard],
    data: { roles: ['user'] },
    loadChildren: () => import('./modules/user/user.module').then(m => m.UserModule)
  },
  {
    path: 'staff',
    canActivate: [AuthGuard],
    data: { roles: ['staff'] },
    loadChildren: () => import('./modules/staff/staff.module').then(m => m.StaffModule)
  },
  {
    path: 'shared',
    canActivate: [AuthGuard],
    data: { roles: ['admin', 'staff', 'user'] },
    loadChildren: () => import('./modules/shared/shared.module').then(m => m.SharedModule)
  },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
