import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UserLayoutComponent } from './components/user-layout/user-layout.component';
import { UserDashboardComponent } from './components/user-dashboard/user-dashboard.component';
import { AppointmentRequestComponent } from './components/appointment-request/appointment-request.component';
import { FormHistoryComponent } from './components/form-history/form-history.component';
import { ProfileComponent } from './components/profile/profile.component';
import { BasketballCourtReservationComponent } from './components/basketball-court-reservation/basketball-court-reservation.component';
import { UserRemindersComponent } from './components/user-reminders/user-reminders.component';

const routes: Routes = [
  { 
    path: '', 
    component: UserLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: UserDashboardComponent },
      { path: 'appointment-request', component: AppointmentRequestComponent },
      { path: 'form-history', component: FormHistoryComponent },
      { path: 'reminders', component: UserRemindersComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'basketball-court-reservation', component: BasketballCourtReservationComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UserRoutingModule { }
