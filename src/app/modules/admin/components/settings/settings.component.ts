import { Component, OnInit } from '@angular/core';
import {
  BarangaySystemSettings,
  SystemSettingsService
} from '../../../../services/system-settings.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  settings: BarangaySystemSettings = {
    barangayName: 'Barangay Old Cabalan',
    barangayCaptain: 'Hon. Ronaldo A. Alba Jr',
    barangaySecretary: 'Edmer T. Lucido',
    contactPhone: '(047) 223 - 1629',
    contactEmail: 'brg.oldcabalan.1988@gmail.com',
    officeHours: '',
    emailNotifications: true,
    smsNotifications: false,
    autoApproveDocuments: false
  };

  loading = true;
  saving = false;
  message = '';
  error = '';

  constructor(private settingsService: SystemSettingsService) {}

  ngOnInit(): void {
    this.settingsService.loadBarangaySettings().subscribe({
      next: (data) => {
        this.settings = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.message || 'Failed to load settings from Supabase.';
      }
    });
  }

  saveSettings(): void {
    this.saving = true;
    this.message = '';
    this.error = '';
    this.settingsService.saveBarangaySettings(this.settings).subscribe({
      next: () => {
        this.saving = false;
        this.message = 'Settings saved to Supabase.';
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.message || 'Failed to save settings.';
      }
    });
  }
}
