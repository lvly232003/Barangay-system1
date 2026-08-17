import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CertificateService, CertificateForm } from '../../../../services/certificate.service';

@Component({
  selector: 'app-certificate-form-management',
  templateUrl: './certificate-form-management.component.html',
  styleUrls: ['./certificate-form-management.component.scss']
})
export class CertificateFormManagementComponent implements OnInit {
  certificateForms: CertificateForm[] = [];
  addForm: FormGroup;
  isAddingForm = false;
  showAddForm = false;
  editingForm: CertificateForm | null = null;

  constructor(
    private certificateService: CertificateService,
    private fb: FormBuilder
  ) {
    this.addForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      // We'll treat requirements as a comma-separated string in the form
      requirements: ['', [Validators.required]], 
      fee: [0, [Validators.required, Validators.min(0)]],
      isActive: [true],
      type: ['Certificate'] // Added default type to satisfy interface
    });
  }

  ngOnInit(): void {
    this.loadCertificateForms();
  }

  loadCertificateForms() {
    this.certificateService.getAllCertificateFormsAdmin().subscribe({
      next: (data) => {
        this.certificateForms = data;
      },
      error: (err) => {
        console.error('Error loading forms:', err);
      }
    });
  }

  toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    this.editingForm = null;
    this.addForm.reset({ isActive: true, fee: 0, type: 'Certificate' });
  }

  onSubmit() {
    if (this.addForm.valid) {
      this.isAddingForm = true;
      const formData = this.addForm.value;

      // ✅ FIX: Convert form string to string[] for requirements
      // ✅ FIX: Ensure all required fields (type, price) from Step 1 Interface are present
      const formPayload: CertificateForm = {
        id: 0, // Placeholder
        name: formData.name,
        description: formData.description,
        requirements: typeof formData.requirements === 'string' 
          ? formData.requirements.split(',').map((s: string) => s.trim()) 
          : formData.requirements,
        processingTime: '1-2 business days',
        fee: formData.fee,
        price: formData.fee, // Map fee to price to satisfy interface
        type: formData.type || 'Certificate',
        isActive: formData.isActive
      };

      this.certificateService.addCertificateForm(formPayload).subscribe({
        next: (response) => {
          this.loadCertificateForms();
          this.toggleAddForm();
          this.isAddingForm = false;
          alert('Certificate form added successfully');
        },
        error: (err) => {
          this.isAddingForm = false;
          alert(err.error?.message || 'Failed to add certificate form');
        }
      });

    } else {
      this.markFormGroupTouched();
    }
  }

  editForm(form: CertificateForm) {
    this.editingForm = form;
    this.showAddForm = true;

    // ✅ FIX: Join array back to string for the form input
    const reqString = Array.isArray(form.requirements) 
      ? form.requirements.join(', ') 
      : form.requirements;

    this.addForm.patchValue({
      name: form.name,
      description: form.description,
      requirements: reqString, 
      fee: form.fee ?? form.price, // Handle either property
      isActive: form.isActive,
      type: form.type
    });
  }

  updateForm() {
    if (this.addForm.valid && this.editingForm) {
      this.isAddingForm = true;
      const formData = this.addForm.value;

      const formPayload: CertificateForm = {
        id: this.editingForm.id,
        name: formData.name,
        description: formData.description,
        requirements: typeof formData.requirements === 'string' 
          ? formData.requirements.split(',').map((s: string) => s.trim()) 
          : formData.requirements,
        processingTime: '1-2 business days',
        fee: formData.fee,
        price: formData.fee,
        type: formData.type || 'Certificate',
        isActive: formData.isActive
      };

      this.certificateService.updateCertificateForm(this.editingForm.id, formPayload).subscribe({
        next: (response) => {
          this.loadCertificateForms();
          this.toggleAddForm();
          this.isAddingForm = false;
          alert('Certificate form updated successfully');
        },
        error: (err) => {
          this.isAddingForm = false;
          alert(err.error?.message || 'Failed to update certificate form');
        }
      });
    }
  }

  deleteForm(form: CertificateForm) {
    if (confirm(`Are you sure you want to delete "${form.name}"?`)) {
      this.certificateService.deleteCertificateForm(form.id).subscribe({
        next: (response) => {
          this.loadCertificateForms();
          alert('Certificate form deleted successfully');
        },
        error: (err) => {
          alert(err.error?.message || 'Failed to delete certificate form');
        }
      });
    }
  }

  cancelEdit() {
    this.toggleAddForm();
  }

  private markFormGroupTouched() {
    Object.keys(this.addForm.controls).forEach(key => {
      const control = this.addForm.get(key);
      control?.markAsTouched();
    });
  }

  getStatusBadgeClass(isActive: boolean | undefined): string {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  }

  getStatusText(isActive: boolean | undefined): string {
    return isActive ? 'Active' : 'Inactive';
  }
}