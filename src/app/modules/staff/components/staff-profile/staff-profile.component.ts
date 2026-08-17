import { Component, OnInit } from '@angular/core';
import { AuthService, User } from '../../../../services/auth.service';

@Component({
  selector: 'app-staff-profile',
  templateUrl: './staff-profile.component.html',
  styleUrls: ['./staff-profile.component.scss']
})
export class StaffProfileComponent implements OnInit {
  staffProfile = {
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    position: '',
    department: '',
    employeeId: '',
    hireDate: ''
  };

  passwordForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  saving = false;
  changingPassword = false;
  profileMessage = '';
  profileError = '';
  passwordMessage = '';
  passwordError = '';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.loadFromUser(this.authService.getCurrentUser());
    this.authService.currentUser$.subscribe((user) => this.loadFromUser(user));
  }

  private loadFromUser(user: User | null): void {
    if (!user) return;
    this.staffProfile = {
      firstName: user.firstName || '',
      middleName: user.middleName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || user.phoneNumber || '',
      address: user.address || '',
      position: user.position || '',
      department: user.department || '',
      employeeId: user.employeeId || '',
      hireDate: user.hireDate || ''
    };
  }

  updateProfile(): void {
    this.profileMessage = '';
    this.profileError = '';
    this.saving = true;
    this.authService
      .updateOwnProfile({
        firstName: this.staffProfile.firstName,
        middleName: this.staffProfile.middleName,
        lastName: this.staffProfile.lastName,
        phone: this.staffProfile.phone,
        address: this.staffProfile.address,
        position: this.staffProfile.position,
        department: this.staffProfile.department,
        employeeId: this.staffProfile.employeeId,
        hireDate: this.staffProfile.hireDate
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.profileMessage = 'Profile updated successfully.';
        },
        error: (err) => {
          this.saving = false;
          this.profileError = err?.error?.message || err?.message || 'Failed to update profile.';
        }
      });
  }

  changePassword(): void {
    this.passwordMessage = '';
    this.passwordError = '';

    if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
      this.passwordError = 'New password and confirmation do not match.';
      return;
    }

    this.changingPassword = true;
    this.authService
      .changePassword(this.passwordForm.currentPassword, this.passwordForm.newPassword)
      .subscribe({
        next: () => {
          this.changingPassword = false;
          this.passwordMessage = 'Password changed successfully.';
          this.passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
        },
        error: (err) => {
          this.changingPassword = false;
          this.passwordError = err?.error?.message || err?.message || 'Failed to change password.';
        }
      });
  }
}
