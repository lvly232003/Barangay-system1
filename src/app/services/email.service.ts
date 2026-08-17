import { Injectable } from '@angular/core';
import emailjs from '@emailjs/browser';
import { EMAIL_CONFIG, EMAIL_TEMPLATES, DEVELOPMENT_MODE } from '../config/email.config';

export interface RegistrationOtpEmailData {
  to: string;
  firstName: string;
  lastName?: string;
  otp: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  private isInitialized = false;

  constructor() {
    if (!DEVELOPMENT_MODE) {
      this.initializeEmailJS();
    }
  }

  private initializeEmailJS() {
    try {
      emailjs.init({ publicKey: EMAIL_CONFIG.publicKey });
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize EmailJS:', error);
      this.isInitialized = false;
    }
  }

  private ensureReady(): boolean {
    if (DEVELOPMENT_MODE) return true;
    if (!this.isInitialized) this.initializeEmailJS();
    return this.isInitialized;
  }

  generateOtpCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  /** Registration OTP only (EmailJS). No confirm-link emails via EmailJS. */
  async sendRegistrationOtpEmail(
    data: RegistrationOtpEmailData
  ): Promise<{ success: boolean; message?: string; rateLimited?: boolean }> {
    const toName = [data.firstName, data.lastName].filter(Boolean).join(' ').trim() || 'Resident';

    const templateParams = {
      to_email: data.to,
      to_name: toName,
      first_name: data.firstName || 'there',
      otp_code: data.otp,
      expiry_minutes: EMAIL_TEMPLATES.OTP_EXPIRY_MINUTES,
      site_name: EMAIL_TEMPLATES.SITE_NAME,
      barangay_name: EMAIL_TEMPLATES.BARANGAY_NAME,
      from_name: EMAIL_TEMPLATES.FROM_NAME,
      subject: EMAIL_TEMPLATES.OTP_SUBJECT
    };

    if (DEVELOPMENT_MODE) {
      console.log('[EmailJS DEV] Registration OTP:', templateParams);
      alert(`DEV OTP for ${data.to}: ${data.otp}`);
      return { success: true, message: 'OTP logged (development mode)' };
    }

    if (!this.ensureReady()) {
      return { success: false, message: 'EmailJS not configured' };
    }

    if (!EMAIL_CONFIG.otpTemplateId) {
      return {
        success: false,
        message: 'Set environment.emailjs.otpTemplateId in environment.ts'
      };
    }

    try {
      await emailjs.send(EMAIL_CONFIG.serviceId, EMAIL_CONFIG.otpTemplateId, templateParams);
      return { success: true, message: 'OTP sent to your email' };
    } catch (error: any) {
      console.error('OTP email failed:', error);
      const text = JSON.stringify(error || {}).toLowerCase();
      const status = error?.status || error?.statusCode || error?.code;
      const rateLimited =
        status === 429 ||
        text.includes('rate') ||
        text.includes('quota') ||
        text.includes('limit');
      return {
        success: false,
        rateLimited,
        message: rateLimited
          ? 'EmailJS rate limit reached. Try again later.'
          : 'Failed to send OTP email'
      };
    }
  }
}
