import { Component, OnInit } from '@angular/core';
import { AuthService, User } from '../../../../services/auth.service';

@Component({
  selector: 'app-admin-profile',
  templateUrl: './admin-profile.component.html',
  styleUrls: ['./admin-profile.component.scss']
})
export class AdminProfileComponent implements OnInit {
  profile = {
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    email: '',
    phone: '',
    address: '',
    birthDate: '',
    gender: '',
    civilStatus: '',
    nationality: 'Filipino',
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
    this.profile = {
      firstName: user.firstName || '',
      middleName: user.middleName || '',
      lastName: user.lastName || '',
      suffix: user.suffix || '',
      email: user.email || '',
      phone: user.phone || user.phoneNumber || '',
      address: user.address || '',
      birthDate: user.birthDate || '',
      gender: user.gender || '',
      civilStatus: user.civilStatus || '',
      nationality: user.nationality || 'Filipino',
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
        firstName: this.profile.firstName,
        middleName: this.profile.middleName,
        lastName: this.profile.lastName,
        suffix: this.profile.suffix,
        phone: this.profile.phone,
        address: this.profile.address,
        birthDate: this.profile.birthDate,
        gender: this.profile.gender,
        civilStatus: this.profile.civilStatus,
        nationality: this.profile.nationality,
        position: this.profile.position,
        department: this.profile.department,
        employeeId: this.profile.employeeId,
        hireDate: this.profile.hireDate
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
