import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

// Services
import { CertificateService } from 'src/app/services/certificate.service'; 
import { AuthService } from 'src/app/services/auth.service';
import { downloadElementAsA4Pdf } from 'src/app/modules/shared/certificate-pdf.util';

@Component({
  selector: 'app-appointment-request',
  templateUrl: './appointment-request.component.html',
  styleUrls: ['./appointment-request.component.scss']
})
export class AppointmentRequestComponent implements OnInit {
  // --- Form & Step Variables ---
  appointmentForm: FormGroup;
  currentStep = 1;
  isSubmitting = false;
  isDownloadingSheet = false;
  
  // --- Data Variables ---
  certificateForms: any[] = [];
  selectedForm: any = null;
  currentUser: any = null;

  // --- Popup & Calendar Variables ---
  showForm = true; 
  activePopup: 'year' | 'month' | 'date' | 'time' | null = null;
  
  // Calendar State vars
  yearCalendarPages: any[] = []; 
  currentYearPage = 0;
  monthCalendarGrid: any[] = [];
  calendarYear: number | null = null;
  calendarMonth: string | null = null;
  calendarMonthName: string = '';
  calendarDays: any[] = [];
  weekDays: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  days: any[] = []; 
  availableTimeSlots: string[] = [];

  // --- NEW PREVIEW VARIABLES ---
  showPreview = false;
  previewData: any = null;
  private requestIssuedAt = new Date();

  constructor(
    private fb: FormBuilder,
    private certificateService: CertificateService, 
    private authService: AuthService,             
    private router: Router
  ) {
    this.appointmentForm = this.fb.group({
      certificateId: ['', Validators.required],
      requestedDate: ['', Validators.required],
      requestedYear: [''],
      requestedMonth: [''],
      requestedDay: [''],
      requestedTime: ['', Validators.required],
      
      // Personal Info
      date: [new Date().toISOString().split('T')[0], Validators.required],
      firstName: ['', Validators.required],
      middleName: [''],
      lastName: ['', Validators.required],
      address: ['', Validators.required],
      purok: ['', Validators.required],
      dateOfBirth: ['', Validators.required],
      gender: ['', Validators.required],
      civilStatus: ['', Validators.required],
      phoneNo: ['', Validators.required],
      residentSince: ['', Validators.required],
      purpose: ['', Validators.required],
      notes: ['']
    });
  }

  ngOnInit(): void {
    // 1. Load User
    this.currentUser = this.authService.getCurrentUser();

    if (this.currentUser) {
      this.appointmentForm.patchValue({
        firstName: this.currentUser.firstName,
        lastName: this.currentUser.lastName,
      });
    }

    this.loadCertificates();

    // 2. Initialize Calendar
    this.generateYearPages(); 
    this.generateMonthGrid();
  }

  loadCertificates() {
    this.certificateService.getAll().subscribe({
        next: (data: any) => {
            this.certificateForms = data;
        },
        error: (err: any) => {
            console.error("Failed to load certificates", err);
            this.certificateForms = [
              { id: 1, name: 'Barangay Clearance', fee: 50, description: 'Standard clearance for employment and legal requirements' },
              { id: 2, name: 'Barangay Residency', fee: 50, description: 'Proof of residency within the barangay' },
              { id: 3, name: 'Barangay Certification', fee: 50, description: 'Living Together, Guardianship, and similar certifications' },
              { id: 4, name: 'Vehicle Inspection / Renewal', fee: 50, description: 'Vehicle inspection and renewal certification' },
              { id: 5, name: 'Indigency', fee: 0, description: 'Certificate of indigency for assistance programs' },
              { id: 6, name: 'Low Income', fee: 0, description: 'Low income certification for assistance programs' },
              { id: 7, name: 'First Time Jobseeker', fee: 0, description: 'First time jobseeker certification' },
              { id: 8, name: 'Business Endorsement', fee: 0, description: 'Barangay endorsement for business permit processing' },
              { id: 9, name: 'Other Certifications', fee: 50, description: 'Other barangay certifications as applicable' }
            ];
        }
    });
  }

  // --- Wizard Navigation ---

  selectCertificate(id: number) {
    this.selectedForm = this.certificateForms.find(f => f.id === id);
    this.appointmentForm.patchValue({ certificateId: id });
    this.nextStep();
  }

  nextStep() { this.currentStep++; }
  previousStep() { this.currentStep--; }
  
  goToStep(step: number) {
    if (step < this.currentStep) this.currentStep = step;
  }

  cancelRequest() {
    this.router.navigate(['/user/dashboard']);
  }

  // --- SUBMISSION LOGIC ---

  onSubmit() {
    if (this.appointmentForm.valid) {
      // 1. CHECK LOGIN STATUS
      if (!this.currentUser || !this.currentUser.id) {
        alert("You must be LOGGED IN to submit an appointment.\nPlease go to the Login page.");
        // Optional: Redirect to login
        // this.router.navigate(['/login']); 
        return;
      }

      const formData = this.appointmentForm.value;

      this.requestIssuedAt = new Date();
      this.previewData = {
        userId: this.currentUser.id,
        userEmail: this.currentUser.email || '',
        requester: `${this.currentUser.firstName} ${this.currentUser.lastName}`,
        certificateId: this.selectedForm?.id ?? formData.certificateId,
        certificateType: this.selectedForm?.name || 'Certificate',
        certificateName: this.selectedForm?.name || 'Certificate',
        userName: `${this.currentUser.firstName || ''} ${this.currentUser.lastName || ''}`.trim(),
        appointmentDate: String(formData.requestedDate), 
        appointmentTime: String(formData.requestedTime),
        date: formData.date,
        firstName: formData.firstName,
        middleName: formData.middleName || '',
        lastName: formData.lastName,
        address: formData.address,
        purok: formData.purok,
        dateOfBirth: String(formData.dateOfBirth || ''),
        gender: String(formData.gender || ''),
        civilStatus: String(formData.civilStatus || ''),
        phoneNo: String(formData.phoneNo || ''),
        residentSince: String(formData.residentSince || ''),
        purpose: formData.purpose,
        notes: formData.notes || '',
        status: 'pending'
      };

      this.showPreview = true;
    } else {
      this.appointmentForm.markAllAsTouched();
      alert('Please fill in all required fields.');
    }
  }

  get previewFullName(): string {
    if (!this.previewData) return '';
    return [this.previewData.firstName, this.previewData.middleName, this.previewData.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  get previewAddress(): string {
    if (!this.previewData) return '';
    return [this.previewData.address, this.previewData.purok].filter(Boolean).join(', ');
  }

  get requestIssueDayOrdinal(): string {
    const d = this.requestIssuedAt.getDate();
    const j = d % 10;
    const k = d % 100;
    if (j === 1 && k !== 11) return `${d}st`;
    if (j === 2 && k !== 12) return `${d}nd`;
    if (j === 3 && k !== 13) return `${d}rd`;
    return `${d}th`;
  }

  get requestIssueMonthYear(): string {
    return this.requestIssuedAt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  async downloadRequestSheetPdf(): Promise<void> {
    if (!this.previewData || this.isDownloadingSheet) return;
    this.isDownloadingSheet = true;
    try {
      const type = (this.previewData.certificateType || 'Request').replace(/\s+/g, '_');
      const name = this.previewFullName.replace(/\s+/g, '_') || 'resident';
      await downloadElementAsA4Pdf('resident-request-sheet', `Resident_Request_${type}_${name}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Failed to generate request PDF.');
    } finally {
      this.isDownloadingSheet = false;
    }
  }

  printRequestSheet(): void {
    const sheet = document.getElementById('resident-request-sheet');
    if (!sheet) return;
    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
    if (!win) {
      alert('Please allow pop-ups to print the request sheet.');
      return;
    }
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((n) => n.outerHTML)
      .join('\n');
    win.document.write(`<!DOCTYPE html><html><head><title>Resident Request Summary</title>
      ${styles}
      <style>
        @page { size: A4 portrait; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        .request-sheet {
          box-shadow: none !important;
          border: none !important;
          margin: 0 !important;
          transform: none !important;
          width: 210mm !important;
          height: 297mm !important;
        }
      </style></head><body>${sheet.outerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 450);
  }

  confirmSubmission() {
    if (!this.previewData) return;
    
    this.isSubmitting = true;

    this.certificateService.requestAppointment(this.previewData).subscribe({
      next: (response: any) => {
        if (response && (response.success || response.success === undefined)) {
          this.showPreview = false;
          alert('Appointment request submitted successfully!');
          this.router.navigate(['/user/dashboard']); 
        } else {
           alert(response?.message || 'Submission failed');
           this.showPreview = false;
        }
      },
      error: (err: any) => {
        console.error('Submission Error Details:', err);
        
        let errorMessage = 'Failed to submit appointment request.';
        
        if (err.error && err.error.message) {
             errorMessage = err.error.message;
        } else if (err.error && err.error.errors) {
          const serverErrors = Object.values(err.error.errors).flat().join('\n');
          errorMessage += '\n\nServer Errors:\n' + serverErrors;
        } else if (typeof err.error === 'string') {
           errorMessage += '\n' + err.error;
        } else if (err.status === 400) {
            errorMessage += '\nBad Request: Please check your data.';
        }

        alert(errorMessage);
        this.isSubmitting = false;
        this.showPreview = false; 
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }

  closePreview() {
    this.showPreview = false;
  }

  // =========================================================
  // CALENDAR LOGIC (Preserved)
  // =========================================================

  // --- Year Logic ---
  generateYearPages() {
    const currentYear = new Date().getFullYear();
    const totalPages = 5; 
    const yearsPerPage = 12;

    this.yearCalendarPages = [];

    for (let i = 0; i < totalPages; i++) {
      const startYear = currentYear + (i * yearsPerPage);
      const endYear = startYear + yearsPerPage - 1;
      const years = [];
      
      for (let y = startYear; y <= endYear; y++) {
        years.push(y);
      }

      this.yearCalendarPages.push({
        startYear: startYear,
        endYear: endYear,
        years: years
      });
    }
    
    this.currentYearPage = 0;
  }

  prevYearPage() {
    if (this.currentYearPage > 0) {
      this.currentYearPage--;
    }
  }

  nextYearPage() {
    if (this.currentYearPage < this.yearCalendarPages.length - 1) {
      this.currentYearPage++;
    }
  }

  selectYear(year: number) {
    this.calendarYear = year;
    this.appointmentForm.patchValue({ requestedYear: year });
    this.activePopup = 'month'; 
  }

  isYearSelected(year: number): boolean {
    return this.calendarYear === year;
  }

  // --- Month Logic ---
  generateMonthGrid() {
    this.monthCalendarGrid = [
      [{ name: 'Jan', value: '01' }, { name: 'Feb', value: '02' }, { name: 'Mar', value: '03' }, { name: 'Apr', value: '04' }],
      [{ name: 'May', value: '05' }, { name: 'Jun', value: '06' }, { name: 'Jul', value: '07' }, { name: 'Aug', value: '08' }],
      [{ name: 'Sep', value: '09' }, { name: 'Oct', value: '10' }, { name: 'Nov', value: '11' }, { name: 'Dec', value: '12' }]
    ];
  }

  getSelectedMonthName() {
    if (!this.appointmentForm.get('requestedMonth')?.value) return 'Not selected';
    const flatMonths = this.monthCalendarGrid.flat();
    const found = flatMonths.find(m => m.value === this.appointmentForm.get('requestedMonth')?.value);
    return found ? found.name : 'Not selected';
  }

  selectMonth(monthVal: string) {
    this.calendarMonth = monthVal;
    
    const flatMonths = this.monthCalendarGrid.flat();
    const found = flatMonths.find(m => m.value === monthVal);
    this.calendarMonthName = found ? found.name : '';

    this.appointmentForm.patchValue({ requestedMonth: monthVal });
    
    this.generateDays();
    this.activePopup = 'date';
  }

  isMonthSelected(monthVal: string): boolean {
    return this.appointmentForm.get('requestedMonth')?.value === monthVal;
  }

  // --- Day Logic ---
  generateDays() {
    if (!this.calendarYear || !this.calendarMonth) return;

    const year = this.calendarYear;
    const monthIndex = parseInt(this.calendarMonth, 10) - 1; 
    
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay(); 

    this.calendarDays = [];

    for (let i = 0; i < startDay; i++) {
      this.calendarDays.push({ day: null, isCurrentMonth: false, isAvailable: false });
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    for (let i = 1; i <= daysInMonth; i++) {
      const dateToCheck = new Date(year, monthIndex, i);
      const isPast = dateToCheck < today;
      const isWeekend = dateToCheck.getDay() === 0 || dateToCheck.getDay() === 6;
      
      this.calendarDays.push({
        day: i,
        date: dateToCheck,
        isCurrentMonth: true,
        isAvailable: !isPast && !isWeekend 
      });
    }
    
    this.days = this.calendarDays; 
  }

  selectCalendarDate(dayData: any) {
    if (!dayData.isAvailable) return;

    this.appointmentForm.patchValue({ requestedDay: dayData.day });
    
    const m = this.calendarMonth;
    const d = dayData.day.toString().padStart(2, '0');
    const fullDate = `${this.calendarYear}-${m}-${d}`;
    
    this.appointmentForm.patchValue({ requestedDate: fullDate });

    this.availableTimeSlots = [
      '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
      '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'
    ];
    
    this.activePopup = 'time';
  }

  isDateSelected(dayData: any): boolean {
    return this.appointmentForm.get('requestedDay')?.value === dayData.day;
  }

  isDateAvailable(dayData: any): boolean {
    return dayData.isCurrentMonth && dayData.isAvailable;
  }

  selectTime(time: string) {
    this.appointmentForm.patchValue({ requestedTime: time });
    this.activePopup = null; 
  }
}