import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserProfile, UserService } from '../../services/user';
import { NotebookService } from '../../services/notebook';
import { ThemeService } from '../../services/theme';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class Login {
  userService = inject(UserService);
  notebookService = inject(NotebookService);
  themeService = inject(ThemeService);
  router = inject(Router);

  username = signal('');
  password = signal('');
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
  errorMessage = signal('');
  sharedProfileMessage = signal('');
  activeForm = signal<'login' | 'register'>('login');
  selectedProfile = signal<UserProfile | null>(null);

  login() {
    const username = this.username().trim();
    if (!username) {
      this.errorMessage.set('Escribe un nombre de usuario válido.');
      return;
    }

    if (this.selectedProfile() && this.selectedProfile()?.password && !this.password().trim()) {
      this.errorMessage.set('Ingresa la contraseña del perfil seleccionado.');
      return;
    }

    try {
      this.userService.loginOrCreate({
        username,
        password: this.password().trim() || undefined,
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
      });
      this.router.navigate(['/']);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    }
  }

  register() {
    const username = this.username().trim();
    if (!username) {
      this.errorMessage.set('El nombre de usuario es obligatorio.');
      return;
    }

    const existing = this.userService.findByUsername(username);
    if (existing) {
      this.errorMessage.set('Ya existe un perfil con ese nombre de usuario.');
      return;
    }

    try {
      this.userService.loginOrCreate({
        username,
        password: this.password().trim() || undefined,
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
      });
      this.router.navigate(['/']);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo crear el perfil.');
    }
  }

  selectSavedProfile(profile: UserProfile) {
    this.selectedProfile.set(profile);
    this.activeForm.set('login');
    this.username.set(profile.username);
    this.password.set('');
    this.errorMessage.set('');
  }

  showRegisterForm() {
    this.selectedProfile.set(null);
    this.activeForm.set('register');
    this.username.set('');
    this.password.set('');
    this.errorMessage.set('');
  }

  showLoginForm() {
    this.selectedProfile.set(null);
    this.activeForm.set('login');
    this.username.set('');
    this.password.set('');
    this.errorMessage.set('');
  }

  clearProfileSelection() {
    this.selectedProfile.set(null);
    this.username.set('');
    this.password.set('');
    this.errorMessage.set('');
  }

  importSharedProfile(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = reader.result as string;
        const importedProfile = this.userService.importSharedProfile(raw);
        this.notebookService.importSharedProfile(raw, importedProfile.id);
        this.sharedProfileMessage.set(`Perfil compartido importado: ${importedProfile.username}`);
        this.router.navigate(['/']);
      } catch (error) {
        this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo importar el perfil compartido.');
      }
    };
    reader.readAsText(file);
  }
}
