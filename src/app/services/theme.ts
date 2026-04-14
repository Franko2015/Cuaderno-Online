import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private isDarkMode = signal(false);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  constructor() {
    if (this.isBrowser) {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark') {
        this.isDarkMode.set(true);
      } else if (saved === 'light') {
        this.isDarkMode.set(false);
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        this.isDarkMode.set(true);
      }
    }
    this.applyTheme();
  }

  toggleTheme() {
    this.isDarkMode.set(!this.isDarkMode());
    this.saveTheme();
    this.applyTheme();
  }

  isDark(): boolean {
    return this.isDarkMode();
  }

  private saveTheme() {
    if (!this.isBrowser) {
      return;
    }
    localStorage.setItem('theme', this.isDarkMode() ? 'dark' : 'light');
  }

  private applyTheme() {
    if (!this.isBrowser) {
      return;
    }
    const root = document.documentElement;
    if (this.isDarkMode()) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}
