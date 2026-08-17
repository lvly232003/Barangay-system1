import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

export interface ReportsExportPayload {
  generatedAt: Date;
  summary: {
    citizens: number;
    staff: number;
    appointments: number;
    certificates: number;
    forms: number;
    estimatedFees: number;
    reservations: number;
  };
  users: any[];
  appointments: any[];
  certificates: any[];
  forms: any[];
  reservations: any[];
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function safe(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/** Multi-sheet Excel workbook for Admin Reports */
export function exportReportsExcel(data: ReportsExportPayload): void {
  const wb = XLSX.utils.book_new();

  const summaryRows = [
    ['Barangay System — Admin Reports'],
    ['Generated', data.generatedAt.toLocaleString()],
    [],
    ['Metric', 'Value'],
    ['Citizens', data.summary.citizens],
    ['Staff / Admin', data.summary.staff],
    ['Appointments', data.summary.appointments],
    ['Certificates', data.summary.certificates],
    ['Certificate Formats', data.summary.forms],
    ['Estimated Fees (₱)', data.summary.estimatedFees],
    ['Court Reservations', data.summary.reservations]
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');

  const users = data.users.map((u) => ({
    ID: safe(u.id),
    FirstName: safe(u.firstName),
    LastName: safe(u.lastName),
    Email: safe(u.email),
    Role: safe(u.role),
    Status: safe(u.status),
    Phone: safe(u.phone || u.phoneNumber)
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(users), 'Users');

  const appointments = data.appointments.map((a) => ({
    ID: safe(a.id),
    Requester: safe(a.requester || a.userName || `${a.firstName || ''} ${a.lastName || ''}`.trim()),
    Email: safe(a.userEmail || a.email),
    Certificate: safe(a.certificateName || a.certificateType || a.type),
    Date: safe(a.appointmentDate || a.requestedDate),
    Time: safe(a.appointmentTime || a.requestedTime),
    Status: safe(a.status),
    Purpose: safe(a.purpose),
    CreatedAt: safe(a.createdAt)
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appointments), 'Appointments');

  const certificates = data.certificates.map((c) => ({
    ID: safe(c.id),
    Number: safe(c.certificateNumber),
    Type: safe(c.certificateType),
    Holder: safe(c.userName || c.residentName),
    Status: safe(c.status),
    IssuedDate: safe(c.issuedDate),
    Purpose: safe(c.purpose)
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(certificates), 'Certificates');

  const forms = data.forms.map((f) => ({
    ID: safe(f.id),
    Name: safe(f.name),
    Type: safe(f.type),
    Fee: Number(f.fee ?? f.price ?? 0),
    Description: safe(f.description)
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(forms), 'Formats');

  const reservations = data.reservations.map((r) => ({
    Queue: safe(r.queueNumber),
    ID: safe(r.id),
    User: safe(r.userName),
    Email: safe(r.userEmail),
    Court: safe(r.courtNumber),
    Date: safe(r.reservationDate),
    Start: safe(r.startTime),
    End: safe(r.endTime),
    DurationHours: safe(r.duration),
    Status: safe(r.status),
    Purpose: safe(r.purpose)
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reservations), 'CourtReservations');

  XLSX.writeFile(wb, `BarangaySystem_Reports_${stamp()}.xlsx`);
}

/** Summary PDF report for Admin Reports */
export function exportReportsPdf(data: ReportsExportPayload): void {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const margin = 16;
  let y = 18;

  const line = (text: string, size = 11, style: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, 210 - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * (size * 0.4) + 3;
    if (y > 280) {
      doc.addPage();
      y = 18;
    }
  };

  line('Barangay System', 18, 'bold');
  line('Admin Reports Export', 14, 'bold');
  line(`Generated: ${data.generatedAt.toLocaleString()}`, 10);
  y += 4;

  line('Summary', 13, 'bold');
  line(`Citizens: ${data.summary.citizens}`);
  line(`Staff / Admin: ${data.summary.staff}`);
  line(`Appointments: ${data.summary.appointments}`);
  line(`Certificates: ${data.summary.certificates}`);
  line(`Certificate formats: ${data.summary.forms}`);
  line(`Estimated fees: PHP ${Number(data.summary.estimatedFees).toLocaleString()}`);
  line(`Court reservations: ${data.summary.reservations}`);
  y += 4;

  line('Recent appointments (up to 25)', 12, 'bold');
  data.appointments.slice(0, 25).forEach((a, i) => {
    const who = a.requester || a.userName || `${a.firstName || ''} ${a.lastName || ''}`.trim() || '—';
    const cert = a.certificateName || a.certificateType || a.type || '—';
    line(
      `${i + 1}. ${who} | ${cert} | ${safe(a.appointmentDate || a.requestedDate)} ${safe(a.appointmentTime || a.requestedTime)} | ${safe(a.status)}`,
      9
    );
  });
  if (!data.appointments.length) line('No appointments.', 9);

  y += 3;
  line('Certificates (up to 25)', 12, 'bold');
  data.certificates.slice(0, 25).forEach((c, i) => {
    line(
      `${i + 1}. ${safe(c.certificateNumber || c.id)} | ${safe(c.certificateType)} | ${safe(c.userName)} | ${safe(c.status)}`,
      9
    );
  });
  if (!data.certificates.length) line('No certificates.', 9);

  y += 3;
  line('Court reservations (up to 25)', 12, 'bold');
  data.reservations.slice(0, 25).forEach((r, i) => {
    const q = r.queueNumber != null ? `Q-${String(r.queueNumber).padStart(4, '0')}` : '—';
    const date =
      r.reservationDate instanceof Date
        ? r.reservationDate.toLocaleDateString()
        : safe(r.reservationDate);
    line(
      `${i + 1}. ${q} | ${safe(r.userName)} | Court ${safe(r.courtNumber)} | ${date} ${safe(r.startTime)} | ${safe(r.status)}`,
      9
    );
  });
  if (!data.reservations.length) line('No court reservations.', 9);

  y += 6;
  line('Full datasets are available in the Excel export.', 9);
  line('© Barangay Appointment Certificate Management System', 8);

  doc.save(`BarangaySystem_Reports_${stamp()}.pdf`);
}
