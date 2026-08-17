import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage = '';
  basketballCourtMessage = '';
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    const { email, password } = this.loginForm.value;

    this.authService.login({ email, password }).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.handleLoginSuccess(res);
      },
      error: (err: any) => {
        this.isLoading = false;
        const raw = err?.error?.message || err?.message || 'Login failed';
        if (/email not confirmed|confirm/i.test(String(raw))) {
          this.errorMessage =
            'Please confirm your email first (check your inbox for the confirmation link), then sign in.';
        } else {
          this.errorMessage = raw;
        }
      }
    });
  }

  handleLoginSuccess(response: any) {
    const user = response.user || response;
    this.router.navigate([this.authService.getDashboardRoute(user)]);
  }

  navigateToRegister() {
    this.router.navigate(['/register']);
  }

  navigateToHome() {
    this.router.navigate(['/']);
  }
}
