import { Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { supabase } from '../supabase/supabase.client';

export interface SystemSettingRow {
  id: string;
  setting_key: string;
  setting_value: string | null;
  description?: string | null;
}

/** Convenience shape for Admin > Settings */
export interface BarangaySystemSettings {
  barangayName: string;
  barangayCaptain: string;
  barangaySecretary: string;
  contactPhone: string;
  contactEmail: string;
  officeHours: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  autoApproveDocuments: boolean;
}

const KEYS = {
  barangayName: 'barangay_name',
  barangayCaptain: 'barangay_captain',
  barangaySecretary: 'barangay_secretary',
  contactPhone: 'contact_phone',
  contactEmail: 'contact_email',
  officeHours: 'office_hours',
  emailNotifications: 'email_notifications',
  smsNotifications: 'sms_notifications',
  autoApproveDocuments: 'auto_approve_documents'
} as const;

@Injectable({ providedIn: 'root' })
export class SystemSettingsService {
  constructor(private authService: AuthService) {}

  getAll(): Observable<SystemSettingRow[]> {
    return from(
      supabase.from('system_settings').select('*').order('setting_key', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []) as SystemSettingRow[];
      })
    );
  }

  getSettingsMap(): Observable<Record<string, string>> {
    return this.getAll().pipe(
      map((rows) => {
        const out: Record<string, string> = {};
        rows.forEach((r) => {
          out[r.setting_key] = r.setting_value ?? '';
        });
        return out;
      })
    );
  }

  loadBarangaySettings(): Observable<BarangaySystemSettings> {
    return this.getSettingsMap().pipe(
      map((m) => ({
        barangayName: m[KEYS.barangayName] || 'Barangay Old Cabalan',
        barangayCaptain: m[KEYS.barangayCaptain] || 'Hon. Ronaldo A. Alba Jr',
        barangaySecretary: m[KEYS.barangaySecretary] || 'Edmer T. Lucido',
        contactPhone: m[KEYS.contactPhone] || '(047) 223 - 1629',
        contactEmail: m[KEYS.contactEmail] || 'brg.oldcabalan.1988@gmail.com',
        officeHours: m[KEYS.officeHours] || '',
        emailNotifications: m[KEYS.emailNotifications] !== 'false',
        smsNotifications: m[KEYS.smsNotifications] === 'true',
        autoApproveDocuments: m[KEYS.autoApproveDocuments] === 'true'
      }))
    );
  }

  saveBarangaySettings(settings: BarangaySystemSettings): Observable<void> {
    const user = this.authService.getCurrentUser();
    const updatedBy = user?.id ? String(user.id) : null;

    const entries: Array<{ key: string; value: string; description: string }> = [
      { key: KEYS.barangayName, value: settings.barangayName, description: 'Official barangay display name' },
      { key: KEYS.barangayCaptain, value: settings.barangayCaptain, description: 'Barangay captain / punong barangay' },
      { key: KEYS.barangaySecretary, value: settings.barangaySecretary, description: 'Barangay secretary' },
      { key: KEYS.contactPhone, value: settings.contactPhone, description: 'Public contact phone' },
      { key: KEYS.contactEmail, value: settings.contactEmail, description: 'Public contact email' },
      { key: KEYS.officeHours, value: settings.officeHours, description: 'Public office hours' },
      {
        key: KEYS.emailNotifications,
        value: settings.emailNotifications ? 'true' : 'false',
        description: 'Enable email notifications'
      },
      {
        key: KEYS.smsNotifications,
        value: settings.smsNotifications ? 'true' : 'false',
        description: 'Enable SMS notifications'
      },
      {
        key: KEYS.autoApproveDocuments,
        value: settings.autoApproveDocuments ? 'true' : 'false',
        description: 'Auto-approve document requests'
      }
    ];

    return from(
      Promise.all(
        entries.map((e) =>
          supabase.from('system_settings').upsert(
            {
              setting_key: e.key,
              setting_value: e.value,
              description: e.description,
              updated_by: updatedBy
            },
            { onConflict: 'setting_key' }
          )
        )
      )
    ).pipe(
      map((results) => {
        const failed = results.find((r) => r.error);
        if (failed?.error) throw failed.error;
      })
    );
  }
}
