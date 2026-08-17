import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { AdminRoutingModule } from './admin-routing.module';
import { AdminLayoutComponent } from './components/admin-layout/admin-layout.component';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';
import { AdminNavbarComponent } from './components/admin-navbar/admin-navbar.component';
import { AdminSidebarComponent } from './components/admin-sidebar/admin-sidebar.component';
import { DocumentManagementComponent } from './components/document-management/document-management.component';
import { UserManagementComponent } from './components/user-management/user-management.component';
import { CertificateFormManagementComponent } from './components/certificate-form-management/certificate-form-management.component';

// ---------------------------------------------------------
// CHECK THIS PATH MANUALLY IN YOUR SIDEBAR
// Does the folder 'components' exist? Does 'appointment-management' exist inside it?
import { AppointmentManagementComponent } from './components/appointment-management/appointment-management.component';
// ---------------------------------------------------------

import { AdminCertificateManagementComponent } from './components/admin-certificate-management/admin-certificate-management.component';
import { ReportsComponent } from './components/reports/reports.component';
import { SettingsComponent } from './components/settings/settings.component';
import { AdminBasketballCourtManagementComponent } from './components/admin-basketball-court-management/admin-basketball-court-management.component';
import { AdminRemindersComponent } from './components/admin-reminders/admin-reminders.component';
import { AdminProfileComponent } from './components/admin-profile/admin-profile.component';
import { ThemeToggleComponent } from '../../components/shared/theme-toggle/theme-toggle.component';
import { ReminderBellComponent } from '../../components/shared/reminder-bell/reminder-bell.component';

@NgModule({
  declarations: [
    AdminLayoutComponent,
    AdminDashboardComponent,
    AdminNavbarComponent,
    AdminSidebarComponent,
    DocumentManagementComponent,
    UserManagementComponent,
    CertificateFormManagementComponent,
    AppointmentManagementComponent,
    AdminCertificateManagementComponent,
    ReportsComponent,
    SettingsComponent,
    AdminBasketballCourtManagementComponent,
    AdminRemindersComponent,
    AdminProfileComponent
  ],
  imports: [
    CommonModule,
    AdminRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    ThemeToggleComponent,
    ReminderBellComponent
  ]
})
export class AdminModule { }