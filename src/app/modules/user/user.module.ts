import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { UserRoutingModule } from './user-routing.module';
import { UserLayoutComponent } from './components/user-layout/user-layout.component';
import { UserDashboardComponent } from './components/user-dashboard/user-dashboard.component';
import { UserNavbarComponent } from './components/user-navbar/user-navbar.component';
import { UserSidebarComponent } from './components/user-sidebar/user-sidebar.component';
import { AppointmentRequestComponent } from './components/appointment-request/appointment-request.component';
import { FormHistoryComponent } from './components/form-history/form-history.component';
import { ProfileComponent } from './components/profile/profile.component';
import { BasketballCourtReservationComponent } from './components/basketball-court-reservation/basketball-court-reservation.component';
import { UserRemindersComponent } from './components/user-reminders/user-reminders.component';
import { ThemeToggleComponent } from '../../components/shared/theme-toggle/theme-toggle.component';
import { ReminderBellComponent } from '../../components/shared/reminder-bell/reminder-bell.component';

@NgModule({
  declarations: [
    UserLayoutComponent,
    UserDashboardComponent,
    UserNavbarComponent,
    UserSidebarComponent,
    AppointmentRequestComponent,
    FormHistoryComponent,
    ProfileComponent,
    BasketballCourtReservationComponent,
    UserRemindersComponent
  ],
  imports: [
    CommonModule,
    UserRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    ThemeToggleComponent,
    ReminderBellComponent
  ]
})
export class UserModule { }
