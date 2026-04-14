import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService, UserProfile } from '../services/user';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-account',
  imports: [FormsModule, CommonModule],
  templateUrl: './account.html',
  styleUrl: './account.css',
})
export class Account {
  userService = inject(UserService);
  router = inject(Router);

  username = signal('');
  nombre = signal('');
  apellidoPaterno = signal('');
  apellidoMaterno = signal('');
  fechaNacimiento = signal('');
  edad = signal('');
  titulos = signal('');
  linkedin = signal('');
  facebook = signal('');
  gmail = signal('');
  x = signal('');
  keywordKey = signal('');
  keywordValue = signal('');
  errorMessage = signal('');
  successMessage = signal('');
  Object: any;

  get currentUser(): UserProfile | null {
    return this.userService.currentUser();
  }

  ngOnInit() {
    this.syncProfileFields();
  }

  syncProfileFields() {
    const user = this.currentUser;
    if (!user) {
      return;
    }
    this.username.set(user.username || '');
    this.nombre.set(user.nombre || '');
    this.apellidoPaterno.set(user.apellidoPaterno || '');
    this.apellidoMaterno.set(user.apellidoMaterno || '');
    this.fechaNacimiento.set(user.fechaNacimiento || '');
    this.edad.set(user.edad || '');
    this.titulos.set(user.titulos || '');
    this.linkedin.set(user.linkedin || '');
    this.facebook.set(user.facebook || '');
    this.gmail.set(user.gmail || '');
    this.x.set(user.x || '');
  }

  saveProfile() {
    const current = this.currentUser;
    if (!current) {
      this.errorMessage.set('No hay un usuario conectado.');
      return;
    }

    const updated: UserProfile = {
      ...current,
      username: this.username().trim() || current.username,
      nombre: this.nombre().trim() || undefined,
      apellidoPaterno: this.apellidoPaterno().trim() || undefined,
      apellidoMaterno: this.apellidoMaterno().trim() || undefined,
      fechaNacimiento: this.fechaNacimiento().trim() || undefined,
      edad: this.edad().trim() || undefined,
      titulos: this.titulos().trim() || undefined,
      linkedin: this.linkedin().trim() || undefined,
      facebook: this.facebook().trim() || undefined,
      gmail: this.gmail().trim() || undefined,
      x: this.x().trim() || undefined,
    };

    this.userService.updateProfile(updated);
    this.successMessage.set('Perfil actualizado correctamente.');
    setTimeout(() => this.successMessage.set(''), 3000);
  }

  logout() {
    this.userService.logout();
    this.router.navigate(['/login']);
  }

  addKeyword() {
    const key = this.keywordKey().trim();
    const value = this.keywordValue().trim();
    if (!key || !value) {
      this.errorMessage.set('Ingresa clave y valor para el atajo.');
      return;
    }
    this.userService.addKeyword(key, value);
    this.keywordKey.set('');
    this.keywordValue.set('');
    this.successMessage.set('Atajo guardado en tu perfil.');
    setTimeout(() => this.successMessage.set(''), 3000);
  }

  removeKeyword(key: string) {
    this.userService.removeKeyword(key);
    this.successMessage.set('Atajo eliminado.');
    setTimeout(() => this.successMessage.set(''), 3000);
  }
}
