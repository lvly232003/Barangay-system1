import { Component, OnInit } from '@angular/core';
import { AuthService, User } from '../../../../services/auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  userProfile = {
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
    nationality: 'Filipino'
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
    this.userProfile = {
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
      nationality: user.nationality || 'Filipino'
    };
  }

  updateProfile(): void {
    this.profileMessage = '';
    this.profileError = '';
    this.saving = true;
    this.authService
      .updateOwnProfile({
        firstName: this.userProfile.firstName,
        middleName: this.userProfile.middleName,
        lastName: this.userProfile.lastName,
        suffix: this.userProfile.suffix,
        phone: this.userProfile.phone,
        address: this.userProfile.address,
        birthDate: this.userProfile.birthDate,
        gender: this.userProfile.gender,
        civilStatus: this.userProfile.civilStatus,
        nationality: this.userProfile.nationality
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
