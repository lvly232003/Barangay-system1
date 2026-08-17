import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Certificate } from '../../services/certificate.service';

/** A4 @ 96dpi — lock capture to one page */
const A4_W = 794;
const A4_H = 1123;

/** Capture any DOM node and export exactly one A4 PDF page. */
export async function downloadElementAsA4Pdf(
  elementId: string,
  fileName: string,
  exportClass = 'a4-sheet--export'
): Promise<void> {
  const source = document.getElementById(elementId);
  if (!source) return;

  const mount = document.createElement('div');
  mount.setAttribute('aria-hidden', 'true');
  mount.style.cssText = `position:fixed;left:-12000px;top:0;width:${A4_W}px;height:${A4_H}px;overflow:hidden;background:#fff;z-index:-1;pointer-events:none;`;

  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  if (exportClass) clone.classList.add(exportClass);
  Object.assign(clone.style, {
    width: `${A4_W}px`,
    height: `${A4_H}px`,
    maxWidth: `${A4_W}px`,
    maxHeight: `${A4_H}px`,
    margin: '0',
    boxShadow: 'none',
    border: 'none',
    overflow: 'hidden',
    transform: 'none'
  });

  mount.appendChild(clone);
  document.body.appendChild(mount);

  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = await html2canvas(clone, {
      scale: 2,
      width: A4_W,
      height: A4_H,
      windowWidth: A4_W,
      windowHeight: A4_H,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  } finally {
    mount.remove();
  }
}

export async function downloadCertificatePdf(
  certificate: Certificate,
  elementId = 'certificate-content'
): Promise<void> {
  const type = (certificate.certificateType || 'Certificate').replace(/\s+/g, '_');
  const number = (certificate.certificateNumber || 'doc').replace(/\s+/g, '_');
  const name = (certificate.userName || 'resident').replace(/\s+/g, '_');
  await downloadElementAsA4Pdf(elementId, `${type}_${number}_${name}.pdf`, 'cert-sheet--export');
}
