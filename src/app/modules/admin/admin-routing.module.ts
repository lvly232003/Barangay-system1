import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from './components/admin-layout/admin-layout.component';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';
import { DocumentManagementComponent } from './components/document-management/document-management.component';
import { UserManagementComponent } from './components/user-management/user-management.component';
import { CertificateFormManagementComponent } from './components/certificate-form-management/certificate-form-management.component';
import { AppointmentManagementComponent } from '../admin/components/appointment-management/appointment-management.component';
import { AdminCertificateManagementComponent } from './components/admin-certificate-management/admin-certificate-management.component';
import { ReportsComponent } from './components/reports/reports.component';
import { SettingsComponent } from './components/settings/settings.component';
import { AdminBasketballCourtManagementComponent } from './components/admin-basketball-court-management/admin-basketball-court-management.component';
import { AdminRemindersComponent } from './components/admin-reminders/admin-reminders.component';
import { AdminProfileComponent } from './components/admin-profile/admin-profile.component';

const routes: Routes = [
  { 
    path: '', 
    component: AdminLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'documents', component: DocumentManagementComponent },
      { path: 'users', component: UserManagementComponent },
      { path: 'certificate-forms', component: CertificateFormManagementComponent },
      { path: 'appointments', component: AppointmentManagementComponent },
      { path: 'certificates', component: AdminCertificateManagementComponent },
      { path: 'reminders', component: AdminRemindersComponent },
      { path: 'reports', component: ReportsComponent },
      { path: 'profile', component: AdminProfileComponent },
      { path: 'settings', component: SettingsComponent },
      { path: 'basketball-courts', component: AdminBasketballCourtManagementComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
