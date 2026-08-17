import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, map, switchMap, tap, of } from 'rxjs';
import { supabase } from '../supabase/supabase.client';
import { getSampleCertificate } from '../modules/shared/certificate-preview.util';

export interface CertificateForm {
  id: string | number;
  name: string;
  type: string;
  requirements: string[];
  price: number;
  description?: string;
  fee?: number;
  isActive?: boolean;
  processingTime?: string;
}

export interface AppointmentRequest {
  id: string | number;
  userId: string | number;
  status: string;
  appointmentDate: any;
  appointmentTime: string;
  requestedDate: any;
  requestedTime: string;
  reservationDate?: string;
  userEmail?: string;
  userName?: string;
  requester?: any;
  courtId?: number;
  purpose?: string;
  createdAt?: any;
  type?: string;
  certificateName?: string;
  certificateId?: string | number;
  notes?: string;
  date?: any;
  time?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  address?: string;
  purok?: string;
  dateOfBirth?: string;
  gender?: string;
  civilStatus?: string;
  phoneNo?: string;
  residentSince?: string;
  certificateType?: any;
}

export interface Certificate {
  id: number | string;
  userId: number | string;
  userName: string;
  certificateType: string;
  certificateNumber?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'issued';
  requestDate: string;
  issuedDate?: string;
  expiryDate?: string;
  purpose?: string;
  notes?: string;
  appointmentId?: number | string;
}

@Injectable({
  providedIn: 'root'
})
export class CertificateService {
  private certificatesSubject = new BehaviorSubject<Certificate[]>([]);
  public certificates$ = this.certificatesSubject.asObservable();

  constructor() {
    this.loadInitialCertificates();
  }

  getAll(): Observable<CertificateForm[]> {
    return this.getAllCertificateForms();
  }

  private loadInitialCertificates() {
    this.getAllCertificates().subscribe({
      next: (data) => this.certificatesSubject.next(data),
      error: (err) => console.error('Failed to load certificates:', err)
    });
  }

  getCertificates(): Observable<Certificate[]> {
    return this.getAllCertificates();
  }

  getAllCertificates(): Observable<Certificate[]> {
    return from(
      supabase.from('certificates').select('*').order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []).map((row: any) => this.mapCertificate(row));
      }),
      tap((rows) => this.certificatesSubject.next(rows))
    );
  }

  /** Load one printable certificate from samples or Supabase (by id or appointment_id). */
  getCertificateById(id: string | number): Observable<Certificate | null> {
    const key = String(id);
    const sample = getSampleCertificate(key);
    if (sample) return of(sample);

    return from(
      (async () => {
        const byId = await supabase.from('certificates').select('*').eq('id', key).maybeSingle();
        if (byId.data) return this.mapCertificate(byId.data);

        const byAppointment = await supabase
          .from('certificates')
          .select('*')
          .eq('appointment_id', key)
          .maybeSingle();
        if (byAppointment.data) return this.mapCertificate(byAppointment.data);

        const appointment = await supabase.from('appointments').select('*').eq('id', key).maybeSingle();
        const appointmentStatus = String(appointment.data?.status || '').toLowerCase();
        if (appointment.data && (appointmentStatus === 'completed' || appointmentStatus === 'issued')) {
          return this.mapCertificateFromAppointment(appointment.data);
        }

        if (byId.error && byId.error.code !== 'PGRST116') throw byId.error;
        return null;
      })()
    );
  }

  getUserCertificates(userId: number | string): Observable<Certificate[]> {
    return from(
      supabase
        .from('certificates')
        .select('*')
        .eq('user_id', String(userId))
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []).map((row: any) => this.mapCertificate(row));
      })
    );
  }

  getCertificateByAppointmentId(appointmentId: number | string): Observable<Certificate> {
    return from(
      supabase
        .from('certificates')
        .select('*')
        .eq('appointment_id', String(appointmentId))
        .maybeSingle()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.mapCertificate(data);
      })
    );
  }

  createCertificate(requestData: any): Observable<any> {
    const payload = {
      user_id: String(requestData.userId),
      appointment_id: requestData.appointmentId ? String(requestData.appointmentId) : null,
      certificate_form_id: requestData.certificateFormId
        ? String(requestData.certificateFormId)
        : null,
      user_name: requestData.userName,
      certificate_type: requestData.certificateType,
      certificate_number: requestData.certificateNumber || null,
      status: requestData.status || 'pending',
      request_date: requestData.requestDate || new Date().toISOString().slice(0, 10),
      issued_date: requestData.issuedDate || null,
      expiry_date: requestData.expiryDate || null,
      purpose: requestData.purpose || null,
      notes: requestData.notes || null
    };

    return from(supabase.from('certificates').insert(payload).select().single()).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.mapCertificate(data);
      }),
      tap(() => this.loadInitialCertificates())
    );
  }

  updateCertificateStatus(id: number | string, status: string, notes?: string): Observable<any> {
    const patch: Record<string, unknown> = { status };
    if (notes !== undefined) patch['notes'] = notes;
    if (status === 'issued' || status === 'completed') {
      patch['issued_date'] = new Date().toISOString().slice(0, 10);
    }

    return from(
      supabase.from('certificates').update(patch).eq('id', String(id)).select().single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.mapCertificate(data);
      }),
      tap(() => this.loadInitialCertificates())
    );
  }

  requestAppointment(data: AppointmentRequest): Observable<any> {
    const certName = data.certificateName || data.certificateType || data.type || 'Certificate';
    const userName =
      data.userName ||
      data.requester ||
      [data.firstName, data.lastName].filter(Boolean).join(' ').trim() ||
      null;
    const apptDate = data.appointmentDate || data.requestedDate || data.date || null;
    const apptTime = data.appointmentTime || data.requestedTime || data.time || null;
    const payload = {
      user_id: String(data.userId),
      certificate_form_id: data.certificateId ? String(data.certificateId) : null,
      certificate_type: certName,
      certificate_name: certName,
      status: data.status || 'pending',
      appointment_date: apptDate,
      appointment_time: apptTime,
      requested_date: data.requestedDate || apptDate || new Date().toISOString().slice(0, 10),
      requested_time: apptTime,
      purpose: data.purpose || null,
      notes: data.notes || null,
      first_name: data.firstName || null,
      last_name: data.lastName || null,
      middle_name: data.middleName || null,
      address: data.address || null,
      purok: data.purok || null,
      date_of_birth: data.dateOfBirth || null,
      gender: data.gender || null,
      civil_status: data.civilStatus || null,
      phone_no: data.phoneNo || null,
      resident_since: data.residentSince || null,
      user_email: data.userEmail || null,
      user_name: userName
    };

    return from(supabase.from('appointments').insert(payload).select().single()).pipe(
      map(({ data: row, error }) => {
        if (error) throw error;
        return this.mapAppointment(row);
      })
    );
  }

  getAppointmentRequests(): Observable<AppointmentRequest[]> {
    return from(
      supabase.from('appointments').select('*, certificate_forms ( name, type )').order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []).map((row: any) => this.mapAppointment(row));
      })
    );
  }

  getAllAppointments(): Observable<AppointmentRequest[]> {
    return this.getAppointmentRequests();
  }

  getUserAppointmentRequests(userId: number | string): Observable<AppointmentRequest[]> {
    return from(
      supabase
        .from('appointments')
        .select('*, certificate_forms ( name, type )')
        .eq('user_id', String(userId))
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []).map((row: any) => this.mapAppointment(row));
      })
    );
  }

  getUserAppointments(userId: string): Observable<AppointmentRequest[]> {
    return this.getUserAppointmentRequests(userId);
  }

  updateAppointmentStatus(id: number | string, status: string): Observable<any> {
    return from(
      supabase
        .from('appointments')
        .update({ status })
        .eq('id', String(id))
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.mapAppointment(data);
      }),
      switchMap((appointment) =>
        from(this.syncCertificateForAppointment(appointment, status)).pipe(
          map(() => appointment)
        )
      )
    );
  }

  /** Create/update linked certificate when appointment is approved/completed/rejected. */
  private async syncCertificateForAppointment(
    appointment: AppointmentRequest,
    status: string
  ): Promise<void> {
    const normalized = String(status || '').toLowerCase();
    if (!['approved', 'completed', 'issued', 'rejected'].includes(normalized)) {
      return;
    }

    const certStatus =
      normalized === 'rejected'
        ? 'rejected'
        : normalized === 'approved'
          ? 'approved'
          : 'issued';

    const { data: existing, error: findError } = await supabase
      .from('certificates')
      .select('id')
      .eq('appointment_id', String(appointment.id))
      .maybeSingle();

    if (findError) throw findError;

    const userName =
      appointment.userName ||
      appointment.requester ||
      [appointment.firstName, appointment.lastName].filter(Boolean).join(' ').trim() ||
      'Resident';

    if (existing?.id) {
      const patch: Record<string, unknown> = { status: certStatus };
      if (certStatus === 'issued') {
        patch['issued_date'] = new Date().toISOString().slice(0, 10);
      }
      const { error } = await supabase
        .from('certificates')
        .update(patch)
        .eq('id', String(existing.id));
      if (error) throw error;
    } else if (certStatus !== 'rejected') {
      const typeLabel =
        appointment.certificateType ||
        appointment.certificateName ||
        appointment.type ||
        'Certificate';
      const prefix = typeLabel.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'CERT';
      const payload = {
        user_id: String(appointment.userId),
        appointment_id: String(appointment.id),
        certificate_form_id: appointment.certificateId
          ? String(appointment.certificateId)
          : null,
        user_name: userName,
        certificate_type: typeLabel,
        certificate_number: `BMS-${prefix}-${Date.now().toString().slice(-8)}`,
        status: certStatus,
        request_date: new Date().toISOString().slice(0, 10),
        issued_date: certStatus === 'issued' ? new Date().toISOString().slice(0, 10) : null,
        purpose: appointment.purpose || null,
        notes: appointment.notes || null
      };
      const { error } = await supabase.from('certificates').insert(payload);
      if (error) throw error;
    }

    this.loadInitialCertificates();
  }

  getCertificateForms(): CertificateForm[] {
    return [];
  }

  /** Active forms only — for resident request UI. */
  getAllCertificateForms(): Observable<CertificateForm[]> {
    return from(
      supabase
        .from('certificate_forms')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []).map((row: any) => this.mapForm(row));
      })
    );
  }

  /** All forms including inactive — for admin form management. */
  getAllCertificateFormsAdmin(): Observable<CertificateForm[]> {
    return from(
      supabase
        .from('certificate_forms')
        .select('*')
        .order('name', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []).map((row: any) => this.mapForm(row));
      })
    );
  }

  getCertificateFormById(id: string | number): CertificateForm | undefined {
    return undefined;
  }

  addCertificateForm(form: CertificateForm): Observable<CertificateForm> {
    const payload = {
      name: form.name,
      type: form.type,
      description: form.description || null,
      requirements: form.requirements || [],
      price: form.price ?? form.fee ?? 0,
      fee: form.fee ?? form.price ?? 0,
      processing_time: form.processingTime || '1 day',
      is_active: form.isActive ?? true
    };

    return from(supabase.from('certificate_forms').insert(payload).select().single()).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.mapForm(data);
      })
    );
  }

  updateCertificateForm(id: string | number, form: Partial<CertificateForm>): Observable<CertificateForm> {
    const patch: Record<string, unknown> = {};
    if (form.name !== undefined) patch['name'] = form.name;
    if (form.type !== undefined) patch['type'] = form.type;
    if (form.description !== undefined) patch['description'] = form.description;
    if (form.requirements !== undefined) patch['requirements'] = form.requirements;
    if (form.price !== undefined) patch['price'] = form.price;
    if (form.fee !== undefined) patch['fee'] = form.fee;
    if (form.processingTime !== undefined) patch['processing_time'] = form.processingTime;
    if (form.isActive !== undefined) patch['is_active'] = form.isActive;

    return from(
      supabase.from('certificate_forms').update(patch).eq('id', String(id)).select().single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.mapForm(data);
      })
    );
  }

  deleteCertificateForm(id: string | number): Observable<any> {
    return from(supabase.from('certificate_forms').delete().eq('id', String(id))).pipe(
      map(({ error }) => {
        if (error) throw error;
        return true;
      })
    );
  }

  getAvailableTimeSlots(_date: string | Date): string[] {
    return [
      '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
      '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM',
      '04:00 PM', '05:00 PM'
    ];
  }

  private mapForm(row: any): CertificateForm {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description || undefined,
      requirements: row.requirements || [],
      price: Number(row.price ?? 0),
      fee: Number(row.fee ?? row.price ?? 0),
      processingTime: row.processing_time || undefined,
      isActive: row.is_active
    };
  }

  private mapAppointment(row: any): AppointmentRequest {
    const form = Array.isArray(row.certificate_forms) ? row.certificate_forms[0] : row.certificate_forms;
    const certName =
      row.certificate_name || form?.name || row.certificate_type || form?.type || 'Certificate';
    const userName =
      row.user_name ||
      [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').trim() ||
      undefined;
    const apptDate = row.appointment_date || row.requested_date || undefined;
    const apptTime = row.appointment_time || row.requested_time || '';
    const status = String(row.status || 'pending').toLowerCase();

    return {
      id: row.id,
      userId: row.user_id,
      status,
      appointmentDate: apptDate,
      appointmentTime: apptTime,
      requestedDate: row.requested_date || apptDate,
      requestedTime: row.requested_time || apptTime,
      purpose: row.purpose || undefined,
      notes: row.notes || undefined,
      certificateName: certName,
      certificateType: certName,
      certificateId: row.certificate_form_id || undefined,
      userEmail: row.user_email || undefined,
      userName,
      requester: userName,
      firstName: row.first_name || undefined,
      lastName: row.last_name || undefined,
      middleName: row.middle_name || undefined,
      address: row.address || undefined,
      purok: row.purok || undefined,
      dateOfBirth: row.date_of_birth || undefined,
      gender: row.gender || undefined,
      civilStatus: row.civil_status || undefined,
      phoneNo: row.phone_no || undefined,
      residentSince: row.resident_since || undefined,
      createdAt: row.created_at,
      type: certName,
      date: apptDate,
      time: apptTime || undefined
    };
  }

  private mapCertificate(row: any): Certificate {
    return {
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      certificateType: row.certificate_type,
      certificateNumber: row.certificate_number || undefined,
      status: String(row.status || 'pending').toLowerCase() as Certificate['status'],
      requestDate: row.request_date,
      issuedDate: row.issued_date || undefined,
      expiryDate: row.expiry_date || undefined,
      purpose: row.purpose || undefined,
      notes: row.notes || undefined,
      appointmentId: row.appointment_id || undefined
    };
  }

  /** Fallback printable record when a completed appointment has no certificates row yet. */
  private mapCertificateFromAppointment(row: any): Certificate {
    const appointment = this.mapAppointment(row);
    const typeLabel =
      appointment.certificateName || appointment.certificateType || appointment.type || 'Certificate';
    const prefix = String(typeLabel).replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'CERT';
    return {
      id: row.id,
      userId: appointment.userId,
      userName: appointment.userName || appointment.requester || 'Resident',
      certificateType: typeLabel,
      certificateNumber: `BMS-${prefix}-${String(row.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`,
      status: 'issued',
      requestDate:
        appointment.requestedDate ||
        appointment.appointmentDate ||
        new Date().toISOString().slice(0, 10),
      issuedDate: new Date().toISOString().slice(0, 10),
      purpose: appointment.purpose,
      notes: appointment.notes,
      appointmentId: row.id
    };
  }
}
