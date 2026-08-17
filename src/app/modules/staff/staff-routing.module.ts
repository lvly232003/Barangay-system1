import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StaffLayoutComponent } from './components/staff-layout/staff-layout.component';
import { StaffDashboardComponent } from './components/staff-dashboard/staff-dashboard.component';
import { ProcessDocumentsComponent } from './components/process-documents/process-documents.component';
import { StaffAppointmentManagementComponent } from './components/staff-appointment-management/staff-appointment-management.component';
import { CertificateManagementComponent } from './components/certificate-management/certificate-management.component';
import { StaffProfileComponent } from './components/staff-profile/staff-profile.component';
import { StaffBasketballCourtManagementComponent } from './components/staff-basketball-court-management/staff-basketball-court-management.component';
import { StaffRemindersComponent } from './components/staff-reminders/staff-reminders.component';

const routes: Routes = [
  { 
    path: '', 
    component: StaffLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: StaffDashboardComponent },
      { path: 'documents', component: ProcessDocumentsComponent },
      { path: 'appointments', component: StaffAppointmentManagementComponent },
      { path: 'certificates', component: CertificateManagementComponent },
      { path: 'reminders', component: StaffRemindersComponent },
      { path: 'profile', component: StaffProfileComponent },
      { path: 'basketball-courts', component: StaffBasketballCourtManagementComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class StaffRoutingModule { }
