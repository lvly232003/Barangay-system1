import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService, User } from '../../../../services/auth.service';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  addUserForm: FormGroup;

  // Template properties
  showAddForm = false; 
  editingUser: User | null = null;
  isLoading = false;
  
  // ✅ FIX: Added missing property for loading state in buttons
  isAddingUser = false; 

  constructor(
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.addUserForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      role: ['staff', Validators.required],
      address: ['', [Validators.required, Validators.minLength(10)]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]+$')]],
      password: ['', [Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers() {
    this.authService.getAllUsers().subscribe({
      next: (data) => {
        this.users = data.map(u => {
          const fullName = u.name 
            ? u.name 
            : (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : 'Unknown User');

          const nameParts = fullName.split(' ');
          const fName = u.firstName || nameParts[0] || '';
          const lName = u.lastName || nameParts.slice(1).join(' ') || '';

          return {
            ...u,
            name: fullName,
            firstName: fName,
            lastName: lName,
            phone: u.phone || u.phoneNumber 
          };
        });
      },
      error: (err) => console.error('Error loading users', err)
    });
  }

  toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    this.editingUser = null;
    this.addUserForm.reset({ role: 'staff' });

    // Reset password validation
    const passControl = this.addUserForm.get('password');
    passControl?.setValidators([Validators.required, Validators.minLength(6)]);
    passControl?.updateValueAndValidity();
  }

  // ✅ FIX: Added missing method required by template
  cancelEdit() {
    this.toggleAddForm();
  }

  updateUser() {
    if (this.addUserForm.invalid || !this.editingUser) return;

    this.isLoading = true;
    this.isAddingUser = true; // Set button loading state
    
    const userData = this.addUserForm.value;

    if (!userData.password) {
      delete userData.password;
    }

    this.authService.updateUser(this.editingUser.id, userData).subscribe({
      next: () => {
        alert('User updated successfully');
        this.loadUsers();
        this.toggleAddForm(); 
        this.isLoading = false;
        this.isAddingUser = false;
      },
      error: () => {
        alert('Failed to update user');
        this.isLoading = false;
        this.isAddingUser = false;
      }
    });
  }

  onSubmit() {
    if (this.addUserForm.invalid) return;

    this.isLoading = true;
    this.isAddingUser = true; // Set button loading state

    const userData = this.addUserForm.value;

    this.authService.register(userData).subscribe({
      next: () => {
        alert('User added successfully');
        this.loadUsers();
        this.toggleAddForm(); 
        this.isLoading = false;
        this.isAddingUser = false;
      },
      error: () => {
        alert('Failed to add user');
        this.isLoading = false;
        this.isAddingUser = false;
      }
    });
  }

  editUser(user: User) {
    this.editingUser = user;
    this.showAddForm = true; 

    this.addUserForm.patchValue({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
      role: this.authService.normalizeRole(user.role) || 'user',
      address: user.address,
      phone: user.phone || user.phoneNumber,
      password: ''
    });

    const passControl = this.addUserForm.get('password');
    passControl?.clearValidators();
    passControl?.addValidators([Validators.minLength(6)]);
    passControl?.updateValueAndValidity();
  }

  // ✅ FIX: Added missing method to prevent deleting the last admin
  isLastAdmin(user: User): boolean {
    if (this.authService.normalizeRole(user.role) !== 'admin') return false;
    const adminCount = this.users.filter(u => this.authService.normalizeRole(u.role) === 'admin').length;
    return adminCount <= 1;
  }

  deleteUser(user: User) {
    // Check if trying to delete the last admin
    if (this.isLastAdmin(user)) {
      alert('Cannot delete the last Administrator account.');
      return;
    }

    if (confirm(`Are you sure you want to delete ${user.name}?`)) {
      this.authService.deleteUser(user.id).subscribe({
        next: () => this.loadUsers(),
        error: () => alert('Failed to delete user')
      });
    }
  }

  getRoleBadgeClass(role: string): string {
    switch (this.authService.normalizeRole(role)) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'staff': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getRoleDisplayName(role: string): string {
    const normalized = this.authService.normalizeRole(role);
    if (normalized === 'admin') return 'Administrator';
    if (normalized === 'staff') return 'Staff';
    if (normalized === 'user') return 'Resident';
    return 'User';
  }
}