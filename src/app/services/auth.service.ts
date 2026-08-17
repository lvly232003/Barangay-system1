import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, map, of, switchMap, throwError, filter, take } from 'rxjs';
import { environment } from 'src/environments/environment';
import { supabase } from '../supabase/supabase.client';
import type { Session } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'staff' | 'user';

export interface User {
  id: string | number;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email: string;
  role: 'admin' | 'staff' | 'user' | 'Resident' | string;
  status?: 'active' | 'inactive';
  address?: string;
  purok?: string;
  phoneNumber?: string;
  password?: string;
  middleName?: string;
  suffix?: string;
  birthDate?: string;
  gender?: string;
  civilStatus?: string;
  nationality?: string;
  position?: string;
  department?: string;
  employeeId?: string;
  hireDate?: string;
}

export interface OwnProfileUpdate {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  suffix?: string;
  birthDate?: string;
  gender?: string;
  civilStatus?: string;
  nationality?: string;
  phone?: string;
  address?: string;
  purok?: string;
  position?: string;
  department?: string;
  employeeId?: string;
  hireDate?: string;
  /** Email is display-only; changing it requires a separate Auth flow. */
}

interface ProfileRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  suffix?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  civil_status?: string | null;
  nationality?: string | null;
  phone?: string | null;
  address?: string | null;
  purok?: string | null;
  position?: string | null;
  department?: string | null;
  employee_id?: string | null;
  hire_date?: string | null;
  role: 'admin' | 'staff' | 'resident';
  status: 'active' | 'inactive';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  /** True after the first Supabase session check finishes. */
  private sessionReadySubject = new BehaviorSubject<boolean>(false);
  readonly sessionReady$ = this.sessionReadySubject.asObservable();

  constructor() {
    void this.bootstrapSession();
    supabase.auth.onAuthStateChange((_event, session) => {
      if (!this.sessionReadySubject.value) return;
      void this.applySession(session);
    });
  }

  whenSessionReady(): Observable<boolean> {
    return this.sessionReady$.pipe(
      filter((ready) => ready),
      take(1)
    );
  }

  private async bootstrapSession(): Promise<void> {
    try {
      const { data } = await supabase.auth.getSession();
      await this.applySession(data.session);
    } finally {
      this.sessionReadySubject.next(true);
    }
  }

  /** Bind the UI user to a live Supabase Auth session only — never localStorage alone. */
  private async applySession(session: Session | null): Promise<void> {
    if (session?.user) {
      if (session.access_token) {
        localStorage.setItem('token', session.access_token);
      }
      const profile = await this.fetchProfile(session.user.id);
      if (profile) {
        this.persistUser(profile);
        return;
      }
    }
    this.clearClientSession();
  }

  login(credentials: { email: string; password: string }): Observable<any> {
    const email = (credentials.email || '').trim().toLowerCase();
    const password = credentials.password || '';
    return from(
      supabase.auth.signInWithPassword({
        email,
        password
      })
    ).pipe(
      switchMap(({ data, error }) => {
        if (error || !data.user) {
          return throwError(() => ({ error: { message: error?.message || 'Login failed' } }));
        }
        return from(this.fetchProfile(data.user.id)).pipe(
          switchMap((profile) => {
            if (!profile) {
              return throwError(() => ({ error: { message: 'Profile not found for this account' } }));
            }
            if (profile.status === 'inactive') {
              return from(supabase.auth.signOut()).pipe(
                switchMap(() => throwError(() => ({ error: { message: 'Account is inactive' } })))
              );
            }
            const user = this.persistUser(profile);
            if (data.session?.access_token) {
              localStorage.setItem('token', data.session.access_token);
            }
            return of({
              token: data.session?.access_token,
              user
            });
          })
        );
      })
    );
  }

  /**
   * After EmailJS OTP: create Auth + profiles.
   * Expects Supabase “Confirm email” OFF so signup/login works without Auth SMTP.
   */
  register(formData: any): Observable<any> {
    return from(this.registerAccount(formData));
  }

  private async registerAccount(formData: any): Promise<any> {
    const viaApi = await this.tryRegisterViaServerApi(formData);
    if (viaApi) {
      return viaApi;
    }
    // Confirm email OFF → classic signup works without mailing / without service role key
    return this.signUpViaAuthApi(formData);
  }

  private async tryRegisterViaServerApi(formData: any): Promise<any | null> {
    const redirectTo =
      environment.supabase.emailRedirectTo ||
      `${typeof window !== 'undefined' ? window.location.origin : ''}/login`;

    const appRole = this.normalizeRole(formData.role);
    const payload: Record<string, unknown> = {
      mode: 'otp',
      email: String(formData.email || '').trim().toLowerCase(),
      password: String(formData.password || ''),
      redirectTo,
      firstName: formData.firstName,
      lastName: formData.lastName,
      middleName: formData.middleName || '',
      suffix: formData.suffix || '',
      birthDate: formData.birthDate || '',
      gender: formData.gender || '',
      civilStatus: formData.civilStatus || '',
      nationality: formData.nationality || 'Filipino',
      phone: formData.phone || '',
      address: formData.address || ''
    };
    // Admin create-user may set role; public signup stays resident by default.
    if (appRole) {
      payload['role'] = appRole === 'user' ? 'resident' : appRole;
    }

    for (const url of this.registerApiEndpoints()) {
      try {
        const result = await this.postRegisterJson(url, payload);
        if (result === null) continue;
        return result;
      } catch (err: any) {
        const msg = String(err?.error?.message || err?.message || '');
        // Helper misconfigured / project waking up → try next endpoint, then browser Auth signup
        if (
          /missing real supabase_service|service_role|cannot reach supabase|enotfound|placeholder|dns\/network|503/i.test(
            msg
          )
        ) {
          console.warn('[register] skipping endpoint', url, msg);
          continue;
        }
        throw err;
      }
    }
    return null;
  }

  private registerApiEndpoints(): string[] {
    const urls: string[] = [];
    const configured = (environment as { registerApiUrl?: string }).registerApiUrl;
    if (configured) {
      urls.push(configured);
    }

    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (!/localhost:4200|127\.0\.0\.1:4200/.test(origin)) {
        urls.push(`${origin}/api/register`);
      }
    }

    urls.push(`${environment.supabase.url}/functions/v1/register`);
    return urls;
  }

  private async postRegisterJson(
    url: string,
    payload: Record<string, unknown>
  ): Promise<any | null> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: environment.supabase.anonKey,
          Authorization: `Bearer ${environment.supabase.anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch {
      return null;
    }

    const contentType = res.headers.get('content-type') || '';
    if (res.status === 404 || res.status === 405 || !contentType.includes('json')) {
      return null;
    }

    const body = await res.json().catch(() => ({} as Record<string, unknown>));

    if (!res.ok) {
      const msg =
        (typeof body?.error === 'string' && body.error) ||
        (typeof body?.message === 'string' && body.message) ||
        this.mapSignupFailure(res.status, body);

      // Local helper not ready (missing secret / waking project) → caller falls back
      if (
        res.status === 503 ||
        /missing real supabase_service|service_role|cannot reach supabase|placeholder|dns\/network/i.test(
          String(msg)
        )
      ) {
        return null;
      }

      throw { error: { message: msg } };
    }

    return {
      user: body?.user,
      session: null,
      needsEmailConfirmation: false,
      message:
        (typeof body?.message === 'string' && body.message) ||
        'Registration successful'
    };
  }

  private async signUpViaAuthApi(formData: any): Promise<any> {
    const email = String(formData.email || '').trim().toLowerCase();
    const password = String(formData.password || '');
    const redirectTo =
      environment.supabase.emailRedirectTo ||
      `${typeof window !== 'undefined' ? window.location.origin : ''}/login`;

    const meta = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      middle_name: formData.middleName || '',
      suffix: formData.suffix || '',
      birth_date: formData.birthDate || '',
      gender: formData.gender || '',
      civil_status: formData.civilStatus || '',
      nationality: formData.nationality || 'Filipino',
      phone: formData.phone || '',
      address: formData.address || '',
      role: 'resident'
    };

    let res: Response;
    try {
      res = await fetch(`${environment.supabase.url}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          apikey: environment.supabase.anonKey,
          Authorization: `Bearer ${environment.supabase.anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          email_redirect_to: redirectTo,
          data: meta
        })
      });
    } catch {
      throw {
        error: {
          message:
            'Cannot reach Supabase Auth. Your SUPABASE_URL host may be wrong or the project was deleted. Open Supabase Dashboard → Project Settings → API and update environment.ts + .env.'
        }
      };
    }

    const body = await res.json().catch(() => ({} as Record<string, unknown>));

    if (!res.ok) {
      throw {
        error: { message: this.mapSignupFailure(res.status, body) }
      };
    }

    if (body?.access_token && body?.refresh_token) {
      await supabase.auth.setSession({
        access_token: String(body.access_token),
        refresh_token: String(body.refresh_token)
      });
      if (body.access_token) {
        localStorage.setItem('token', String(body.access_token));
      }
    }

    const needsConfirm = !body?.access_token;
    return {
      user: body?.user,
      session: body?.access_token
        ? {
            access_token: body.access_token,
            refresh_token: body.refresh_token
          }
        : null,
      needsEmailConfirmation: needsConfirm,
      message: needsConfirm
        ? 'Account created. Check your Gmail for the Supabase confirmation email, open the link to verify, then sign in. You cannot log in until email is confirmed.'
        : 'Registration successful'
    };
  }

  /** Clear Auth / SMTP / API messages — never show "{}". */
  private mapSignupFailure(status: number, body: any): string {
    const raw =
      (typeof body?.msg === 'string' && body.msg) ||
      (typeof body?.message === 'string' && body.message) ||
      (typeof body?.error_description === 'string' && body.error_description) ||
      (typeof body?.error === 'string' && body.error) ||
      '';

    const text = raw.trim();
    if (
      status === 500 ||
      status === 503 ||
      !text ||
      text === '{}' ||
      text === '[object Object]' ||
      /confirmation email|sending confirmation|smtp|mailer/i.test(text)
    ) {
      return (
        'Could not create the account. Turn OFF “Confirm email” in Supabase → Authentication → Providers → Email (Save), then try again. OTP already verified your email via EmailJS.'
      );
    }

    if (/already registered|already been registered|user already/i.test(text)) {
      return 'This email is already registered. Sign in instead, or use a different email.';
    }

    if (status === 429 || /rate.?limit/i.test(text)) {
      return 'Too many registration attempts. Wait a minute and try again.';
    }

    return text || `Registration failed (HTTP ${status}).`;
  }

  getAllUsers(): Observable<User[]> {
    return from(
      supabase.from('profiles').select('*').order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as ProfileRow[]).map((row) => this.mapProfile(row));
      })
    );
  }

  updateUser(id: string | number, userData: any): Observable<any> {
    const patch: Record<string, unknown> = {};
    if (userData.firstName !== undefined) patch['first_name'] = userData.firstName;
    if (userData.lastName !== undefined) patch['last_name'] = userData.lastName;
    if (userData.middleName !== undefined) patch['middle_name'] = userData.middleName;
    if (userData.phone !== undefined) patch['phone'] = userData.phone;
    if (userData.address !== undefined) patch['address'] = userData.address;
    if (userData.status !== undefined) patch['status'] = userData.status;
    if (userData.role !== undefined) {
      const role = this.normalizeRole(userData.role);
      patch['role'] = role === 'user' ? 'resident' : role;
    }

    return from(
      supabase.from('profiles').update(patch).eq('id', String(id)).select().single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.mapProfile(data as ProfileRow);
      })
    );
  }

  deleteUser(id: string | number): Observable<any> {
    return from(supabase.from('profiles').delete().eq('id', String(id))).pipe(
      map(({ error }) => {
        if (error) throw error;
        return { success: true };
      })
    );
  }

  /** Update the logged-in user's profile row and refresh local session user. */
  updateOwnProfile(data: OwnProfileUpdate): Observable<User> {
    const current = this.getCurrentUser();
    if (!current?.id) {
      return throwError(() => ({ error: { message: 'Not logged in' } }));
    }

    const patch: Record<string, unknown> = {};
    if (data.firstName !== undefined) patch['first_name'] = data.firstName;
    if (data.lastName !== undefined) patch['last_name'] = data.lastName;
    if (data.middleName !== undefined) patch['middle_name'] = data.middleName || null;
    if (data.suffix !== undefined) patch['suffix'] = data.suffix || null;
    if (data.birthDate !== undefined) patch['birth_date'] = data.birthDate || null;
    if (data.gender !== undefined) patch['gender'] = data.gender || null;
    if (data.civilStatus !== undefined) patch['civil_status'] = data.civilStatus || null;
    if (data.nationality !== undefined) patch['nationality'] = data.nationality || null;
    if (data.phone !== undefined) patch['phone'] = data.phone || null;
    if (data.address !== undefined) patch['address'] = data.address || null;
    if (data.purok !== undefined) patch['purok'] = data.purok || null;
    if (data.position !== undefined) patch['position'] = data.position || null;
    if (data.department !== undefined) patch['department'] = data.department || null;
    if (data.employeeId !== undefined) patch['employee_id'] = data.employeeId || null;
    if (data.hireDate !== undefined) patch['hire_date'] = data.hireDate || null;

    return from(
      supabase.from('profiles').update(patch).eq('id', String(current.id)).select().single()
    ).pipe(
      map(({ data: row, error }) => {
        if (error) throw error;
        return this.persistUser(row as ProfileRow);
      })
    );
  }

  /**
   * Change password for the logged-in user.
   * Re-authenticates with the current password, then updates via Supabase Auth.
   */
  changePassword(currentPassword: string, newPassword: string): Observable<{ success: true }> {
    const current = this.getCurrentUser();
    if (!current?.email) {
      return throwError(() => ({ error: { message: 'Not logged in' } }));
    }
    if (!currentPassword || !newPassword) {
      return throwError(() => ({ error: { message: 'Current and new password are required' } }));
    }
    if (newPassword.length < 6) {
      return throwError(() => ({ error: { message: 'New password must be at least 6 characters' } }));
    }

    return from(
      supabase.auth.signInWithPassword({
        email: current.email,
        password: currentPassword
      })
    ).pipe(
      switchMap(({ error: authError }) => {
        if (authError) {
          return throwError(() => ({ error: { message: 'Current password is incorrect' } }));
        }
        return from(supabase.auth.updateUser({ password: newPassword })).pipe(
          map(({ error }) => {
            if (error) throw error;
            return { success: true as const };
          })
        );
      })
    );
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  normalizeRole(role: string | undefined | null): AppRole | null {
    if (!role) return null;
    const value = role.toString().trim().toLowerCase();
    if (value === 'admin') return 'admin';
    if (value === 'staff') return 'staff';
    if (value === 'user' || value === 'resident' || value === 'citizen') return 'user';
    return null;
  }

  getDashboardRoute(user: User | null = this.getCurrentUser()): string {
    const role = this.normalizeRole(user?.role);
    switch (role) {
      case 'admin':
        return '/admin/dashboard';
      case 'staff':
        return '/staff/dashboard';
      case 'user':
        return '/user/dashboard';
      default:
        return '/';
    }
  }

  hasRole(allowed: AppRole | AppRole[]): boolean {
    const role = this.normalizeRole(this.getCurrentUser()?.role);
    if (!role) return false;
    const roles = Array.isArray(allowed) ? allowed : [allowed];
    return roles.includes(role);
  }

  logout() {
    void supabase.auth.signOut();
    this.clearClientSession();
  }

  private clearClientSession(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  private async fetchProfile(userId: string): Promise<ProfileRow | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Failed to load profile', error);
      return null;
    }
    return data as ProfileRow | null;
  }

  private persistUser(profile: ProfileRow): User {
    const user = this.mapProfile(profile);
    localStorage.setItem('user', JSON.stringify(user));
    this.currentUserSubject.next(user);
    return user;
  }

  private mapProfile(row: ProfileRow): User {
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      middleName: row.middle_name || undefined,
      suffix: row.suffix || undefined,
      birthDate: row.birth_date || undefined,
      gender: row.gender || undefined,
      civilStatus: row.civil_status || undefined,
      nationality: row.nationality || undefined,
      phone: row.phone || undefined,
      phoneNumber: row.phone || undefined,
      address: row.address || undefined,
      purok: row.purok || undefined,
      position: row.position || undefined,
      department: row.department || undefined,
      employeeId: row.employee_id || undefined,
      hireDate: row.hire_date || undefined,
      role: this.normalizeRole(row.role) || 'user',
      status: row.status,
      name: `${row.first_name} ${row.last_name}`.trim()
    };
  }
}
