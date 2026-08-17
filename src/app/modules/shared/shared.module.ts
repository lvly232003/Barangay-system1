import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { BusinessClearanceCertificateComponent } from './components/business-clearance-certificate/business-clearance-certificate.component';
import { IndigencyCertificateComponent } from './components/indigency-certificate/indigency-certificate.component';
import { GenericCertificateComponent } from './components/generic-certificate/generic-certificate.component';

const routes: Routes = [
  { path: 'business-clearance/:id', component: BusinessClearanceCertificateComponent },
  { path: 'indigency/:id', component: IndigencyCertificateComponent },
  { path: 'certificate/:id', component: GenericCertificateComponent }
];

@NgModule({
  declarations: [
    BusinessClearanceCertificateComponent,
    IndigencyCertificateComponent,
    GenericCertificateComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    ReactiveFormsModule,
    FormsModule
  ]
})
export class SharedModule { }
