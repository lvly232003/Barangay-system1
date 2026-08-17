import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { EmailService } from '../../../services/email.service';
import { EMAIL_TEMPLATES } from '../../../config/email.config';

type RegisterStep = 'form' | 'otp';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  registerForm: FormGroup;
  otpForm: FormGroup;
  errorMessage = '';
  successMessage = '';
  isLoading = false;
  step: RegisterStep = 'form';
  otpExpiryMinutes = EMAIL_TEMPLATES.OTP_EXPIRY_MINUTES;

  private pendingOtp = '';
  private pendingOtpExpiresAt = 0;
  private pendingFormValue: any = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private emailService: EmailService,
    private router: Router
  ) {
    this.registerForm = this.fb.group(
      {
        firstName: ['', Validators.required],
        lastName: ['', Validators.required],
        middleName: [''],
        suffix: [''],
        birthDate: ['', Validators.required],
        gender: ['', Validators.required],
        civilStatus: ['', Validators.required],
        nationality: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required],
        phone: ['', Validators.required],
        address: ['', Validators.required],
        agreeToTerms: [false, Validators.requiredTrue]
      },
      { validators: this.passwordMatchValidator }
    );

    this.otpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null
      : { mismatch: true };
  }

  async onSubmit() {
    if (this.step === 'otp') {
      await this.verifyOtpAndRegister();
      return;
    }

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.pendingFormValue = { ...this.registerForm.value };
    await this.startOtpFlow();
  }

  /** EmailJS OTP → then create Auth user + profiles in Supabase. */
  private async startOtpFlow() {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    const formValue = this.pendingFormValue || this.registerForm.value;
    const otp = this.emailService.generateOtpCode();

    const mail = await this.emailService.sendRegistrationOtpEmail({
      to: formValue.email,
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      otp
    });

    this.isLoading = false;

    if (!mail.success) {
      this.errorMessage = mail.message || 'Failed to send OTP';
      return;
    }

    this.pendingOtp = otp;
    this.pendingOtpExpiresAt = Date.now() + this.otpExpiryMinutes * 60 * 1000;
    this.pendingFormValue = { ...formValue };
    this.otpForm.reset();
    this.step = 'otp';
    this.errorMessage = '';
    this.successMessage = `OTP sent to ${formValue.email}. Enter the 6-digit code to finish registration.`;
  }

  async resendOtp() {
    if (!this.pendingFormValue) return;
    this.errorMessage = '';
    this.isLoading = true;
    const otp = this.emailService.generateOtpCode();
    const mail = await this.emailService.sendRegistrationOtpEmail({
      to: this.pendingFormValue.email,
      firstName: this.pendingFormValue.firstName,
      lastName: this.pendingFormValue.lastName,
      otp
    });
    this.isLoading = false;
    if (!mail.success) {
      this.successMessage = '';
      this.errorMessage = mail.message || 'Failed to resend OTP';
      return;
    }
    this.pendingOtp = otp;
    this.pendingOtpExpiresAt = Date.now() + this.otpExpiryMinutes * 60 * 1000;
    this.errorMessage = '';
    this.successMessage = 'A new OTP was sent to your email.';
  }

  private async verifyOtpAndRegister() {
    if (this.otpForm.invalid) {
      this.otpForm.markAllAsTouched();
      return;
    }

    const entered = String(this.otpForm.value.otp || '').trim();
    if (!this.pendingOtp || !this.pendingFormValue) {
      this.successMessage = '';
      this.errorMessage = 'OTP session expired. Go back and register again.';
      this.step = 'form';
      return;
    }

    if (Date.now() > this.pendingOtpExpiresAt) {
      this.successMessage = '';
      this.errorMessage = 'OTP expired. Request a new code.';
      return;
    }

    if (entered !== this.pendingOtp) {
      this.successMessage = '';
      this.errorMessage = 'Incorrect OTP. Check your email and try again.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.register(this.pendingFormValue).subscribe({
      next: () => {
        this.isLoading = false;
        this.pendingOtp = '';
        this.pendingFormValue = null;
        this.errorMessage = '';
        this.successMessage =
          'OTP verified. Account created. Redirecting to login...';
        setTimeout(() => this.navigateToLogin(), 2500);
      },
      error: (err) => {
        this.isLoading = false;
        this.successMessage = '';
        this.errorMessage = this.readError(err, 'Registration failed after OTP');
      }
    });
  }

  backToForm() {
    this.step = 'form';
    this.otpForm.reset();
    this.errorMessage = '';
    this.successMessage = '';
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }

  navigateToHome() {
    this.router.navigate(['/']);
  }

  private readError(err: any, fallback: string): string {
    const candidates = [
      err?.error?.message,
      err?.message,
      err?.msg,
      err?.error_description,
      typeof err?.error === 'string' ? err.error : null
    ];
    for (const c of candidates) {
      if (typeof c === 'string') {
        const t = c.trim();
        if (t && t !== '{}' && t !== '[object Object]') {
          return t;
        }
      }
    }
    return fallback;
  }
}
