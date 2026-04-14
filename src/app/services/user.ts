import { Injectable, inject, signal, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

export interface UserProfile {
  id: string;
  username: string;
  password?: string;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  fechaNacimiento?: string;
  edad?: string;
  titulos?: string;
  linkedin?: string;
  facebook?: string;
  gmail?: string;
  x?: string;
  avatarUrl?: string;
  keywords?: Record<string, string>;
  createdAt: string;
}

export interface SharedProfilePackageV1 {
  version: 1;
  exportedAt: string;
  source?: string;
  profile: UserProfile;
  notebooks?: any[];
  trashedSheets?: any[];
  trashedNotebooks?: any[];
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private users = signal<UserProfile[]>([]);
  currentUser = signal<UserProfile | null>(null);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private readonly STORAGE_KEYS = {
    users: 'nb_users',
    currentUser: 'nb_current_user',
  };

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (!this.isBrowser) {
      return;
    }

    const usersData = localStorage.getItem(this.STORAGE_KEYS.users);
    const currentData = localStorage.getItem(this.STORAGE_KEYS.currentUser);

    if (usersData) {
      try {
        this.users.set(JSON.parse(usersData));
      } catch {
        this.users.set([]);
      }
    }

    if (currentData) {
      try {
        const current = JSON.parse(currentData) as UserProfile;
        this.currentUser.set(current);
      } catch {
        this.currentUser.set(null);
      }
    }
  }

  private saveToStorage() {
    if (!this.isBrowser) {
      return;
    }
    localStorage.setItem(this.STORAGE_KEYS.users, JSON.stringify(this.users()));
    if (this.currentUser()) {
      localStorage.setItem(this.STORAGE_KEYS.currentUser, JSON.stringify(this.currentUser()));
    } else {
      localStorage.removeItem(this.STORAGE_KEYS.currentUser);
    }
  }

  getUsers(): UserProfile[] {
    return [...this.users()];
  }

  findByUsername(username: string): UserProfile | undefined {
    return this.users().find((user) => user.username.toLowerCase() === username.trim().toLowerCase());
  }

  isLoggedIn(): boolean {
    return !!this.currentUser();
  }

  logout() {
    this.currentUser.set(null);
    this.saveToStorage();
  }

  loginOrCreate(profile: Omit<UserProfile, 'id' | 'createdAt' | 'keywords'> & { password?: string; keywords?: Record<string, string> }): UserProfile {
    const normalized = profile.username.trim().toLowerCase();
    const existing = this.findByUsername(normalized);

    if (existing) {
      if (existing.password && profile.password && existing.password !== profile.password) {
        throw new Error('Contraseña incorrecta');
      }
      if (existing.password && !profile.password) {
        throw new Error('Esta cuenta requiere contraseña');
      }
      this.currentUser.set(existing);
      this.saveToStorage();
      return existing;
    }

    const newUser: UserProfile = {
      id: Date.now().toString(),
      username: normalized,
      password: profile.password ? profile.password : undefined,
      nombre: profile.nombre,
      apellidoPaterno: profile.apellidoPaterno,
      apellidoMaterno: profile.apellidoMaterno,
      fechaNacimiento: profile.fechaNacimiento,
      edad: profile.edad,
      titulos: profile.titulos,
      linkedin: profile.linkedin,
      facebook: profile.facebook,
      gmail: profile.gmail,
      x: profile.x,
      keywords: profile.keywords ?? {},
      createdAt: new Date().toISOString(),
    };

    this.users.set([...this.users(), newUser]);
    this.currentUser.set(newUser);
    this.saveToStorage();
    return newUser;
  }

  updateProfile(updated: UserProfile) {
    const users = this.users().map((user) =>
      user.id === updated.id ? { ...updated, username: updated.username.trim().toLowerCase() } : user,
    );
    this.users.set(users);
    if (this.currentUser()?.id === updated.id) {
      this.currentUser.set({ ...updated, username: updated.username.trim().toLowerCase() });
    }
    this.saveToStorage();
  }

  getAllProfiles(): UserProfile[] {
    return [...this.users()];
  }

  selectProfile(profileId: string): boolean {
    const profile = this.users().find((user) => user.id === profileId);
    if (!profile) {
      return false;
    }
    this.currentUser.set(profile);
    this.saveToStorage();
    return true;
  }

  setAvatarUrl(avatarUrl: string) {
    const current = this.currentUser();
    if (!current) {
      return;
    }
    this.updateProfile({ ...current, avatarUrl });
  }

  changePassword(oldPassword: string | undefined, newPassword: string) {
    const current = this.currentUser();
    if (!current) {
      throw new Error('No hay un perfil activo.');
    }
    if (!newPassword.trim()) {
      throw new Error('La nueva contraseña no puede estar vacía.');
    }
    if (current.password && current.password !== oldPassword) {
      throw new Error('Contraseña anterior incorrecta.');
    }
    this.updateProfile({ ...current, password: newPassword });
  }

  importSharedProfile(json: string): UserProfile {
    const parsed = JSON.parse(json) as SharedProfilePackageV1;
    if (!parsed || parsed.version !== 1 || !parsed.profile || !parsed.profile.username) {
      throw new Error('Formato de perfil compartido no válido.');
    }

    const incoming = parsed.profile;
    const existing = this.findByUsername(incoming.username.trim().toLowerCase());
    const profileToSave: UserProfile = existing
      ? { ...existing, ...incoming, id: existing.id, username: existing.username }
      : {
          ...incoming,
          id: incoming.id || Date.now().toString(),
          username: incoming.username.trim().toLowerCase(),
          createdAt: incoming.createdAt || new Date().toISOString(),
        };

    const users = this.users().filter((user) => user.id !== profileToSave.id);
    this.users.set([...users, profileToSave]);
    this.currentUser.set(profileToSave);
    this.saveToStorage();
    return profileToSave;
  }

  addKeyword(key: string, value: string) {
    const current = this.currentUser();
    if (!current || !key.trim() || !value.trim()) {
      return;
    }
    const normalizedKey = key.trim().toLowerCase();
    const nextKeywords = { ...(current.keywords || {}), [normalizedKey]: value.trim() };
    this.updateProfile({ ...current, keywords: nextKeywords });
  }

  removeKeyword(key: string) {
    const current = this.currentUser();
    if (!current || !current.keywords) {
      return;
    }
    const nextKeywords = { ...current.keywords };
    delete nextKeywords[key];
    this.updateProfile({ ...current, keywords: nextKeywords });
  }
}
