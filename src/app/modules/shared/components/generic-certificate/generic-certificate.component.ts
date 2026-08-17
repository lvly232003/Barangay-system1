import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CertificateService, Certificate } from '../../../../services/certificate.service';
import { AuthService } from '../../../../services/auth.service';
import { downloadCertificatePdf } from '../../certificate-pdf.util';
import { generateCertificateQrDataUrl } from '../../certificate-qr.util';
import { isPrintableCertificateStatus, mismatchedCertificateViewPath } from '../../certificate-view.util';

@Component({
  selector: 'app-generic-certificate',
  templateUrl: './generic-certificate.component.html',
  styleUrls: ['./generic-certificate.component.scss']
})
export class GenericCertificateComponent implements OnInit {
  certificate: Certificate | null = null;
  qrDataUrl = '';
  certYear = new Date().getFullYear();
  isLoading = true;
  isDownloading = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private certificateService: CertificateService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const certificateId = this.route.snapshot.paramMap.get('id');
    if (certificateId) {
      this.loadCertificate(certificateId);
    } else {
      this.error = 'Certificate ID not provided';
      this.isLoading = false;
    }
  }

  loadCertificate(id: string): void {
    this.isLoading = true;
    this.error = '';
    this.certificate = null;
    this.certificateService.getCertificateById(id).subscribe({
      next: async (cert) => {
        this.certificate = cert;
        if (!cert) {
          this.error = 'Certificate not found';
        } else if (!isPrintableCertificateStatus(cert.status)) {
          this.error = 'Certificate is not yet issued';
        } else {
          const redirectTo = mismatchedCertificateViewPath(this.router.url, cert);
          if (redirectTo) {
            void this.router.navigateByUrl(redirectTo, { replaceUrl: true });
            return;
          }
          this.error = '';
          try {
            this.qrDataUrl = await generateCertificateQrDataUrl(cert);
          } catch {
            this.qrDataUrl = '';
          }
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err?.message || 'Certificate not found';
        this.isLoading = false;
      }
    });
  }

  downloadPDF(): void {
    if (!this.certificate || this.isDownloading) return;
    this.isDownloading = true;
    void downloadCertificatePdf(this.certificate).finally(() => {
      this.isDownloading = false;
    });
  }

  goBack(): void {
    const role = this.authService.normalizeRole(this.authService.getCurrentUser()?.role);
    if (role === 'staff') {
      this.router.navigate(['/staff/certificates']);
    } else if (role === 'user') {
      this.router.navigate(['/user/form-history']);
    } else {
      this.router.navigate(['/admin/certificates']);
    }
  }
}
