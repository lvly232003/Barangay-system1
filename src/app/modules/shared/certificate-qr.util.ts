import QRCode from 'qrcode';
import { Certificate } from '../../services/certificate.service';
import { environment } from '../../../environments/environment';
import { certificateViewPath } from './certificate-view.util';

/** Build a verify URL encoded into the certificate QR. */
export function buildCertificateQrPayload(certificate: Certificate): string {
  const base = (environment.supabase.siteUrl || window.location.origin).replace(/\/$/, '');
  const path = certificateViewPath(certificate);

  const params = new URLSearchParams({
    no: certificate.certificateNumber || '',
    name: certificate.userName || '',
    issued: certificate.issuedDate || ''
  });

  return `${base}${path}?${params.toString()}`;
}

export async function generateCertificateQrDataUrl(certificate: Certificate): Promise<string> {
  const payload = buildCertificateQrPayload(certificate);
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 160,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });
}
