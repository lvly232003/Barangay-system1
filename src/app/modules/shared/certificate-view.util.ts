import { AppointmentRequest, Certificate } from '../../services/certificate.service';

export function isPrintableCertificateStatus(status?: string): boolean {
  const value = String(status || '').toLowerCase();
  return value === 'issued' || value === 'completed';
}

/** Pick the printable layout used by /shared/... routes. */
export function certificateLayout(certificateType?: string): 'indigency' | 'business' | 'generic' {
  const type = (certificateType || '').toLowerCase();
  if (type.includes('indigency') || type.includes('low income')) return 'indigency';
  if (type.includes('business')) return 'business';
  return 'generic';
}

export function certificateViewPath(certificate: Pick<Certificate, 'id' | 'certificateType'>): string {
  const layout = certificateLayout(certificate.certificateType);
  if (layout === 'indigency') return `/shared/indigency/${certificate.id}`;
  if (layout === 'business') return `/shared/business-clearance/${certificate.id}`;
  return `/shared/certificate/${certificate.id}`;
}

export function mismatchedCertificateViewPath(
  currentUrl: string,
  certificate: Pick<Certificate, 'id' | 'certificateType'>
): string | null {
  const target = certificateViewPath(certificate);
  const path = (currentUrl || '').split('?')[0];
  return path === target || path.endsWith(target) ? null : target;
}

export function openCertificateView(certificate: Pick<Certificate, 'id' | 'certificateType'>): void {
  window.open(certificateViewPath(certificate), '_blank');
}

export function openCertificateForAppointment(
  request: Pick<AppointmentRequest, 'id' | 'certificateName' | 'certificateType' | 'type'>,
  certificate?: Pick<Certificate, 'id' | 'certificateType'> | null
): void {
  const type =
    certificate?.certificateType ||
    request.certificateName ||
    request.certificateType ||
    request.type ||
    'Certificate';
  openCertificateView({
    id: certificate?.id || request.id,
    certificateType: type
  });
}
