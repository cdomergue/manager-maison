import { Injectable, signal, computed, inject } from '@angular/core';
import { StorageService } from './storage.service';

export type Theme = 'light' | 'dark' | 'auto';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly THEME_KEY = 'app_theme';
  private storageService = inject(StorageService);

  // Signal for the theme selected by the user
  private selectedThemeSignal = signal<Theme>('auto');

  // Signal to detect system preference
  private systemPrefersDarkSignal = signal<boolean>(false);

  // Computed signal for the effective applied theme
  readonly effectiveTheme = computed(() => {
    const selected = this.selectedThemeSignal();
    if (selected === 'auto') {
      return this.systemPrefersDarkSignal() ? 'dark' : 'light';
    }
    return selected;
  });

  // Read-only signal for the selected theme
  readonly selectedTheme = this.selectedThemeSignal.asReadonly();

  // Computed signal to know if dark mode is active
  readonly isDarkMode = computed(() => this.effectiveTheme() === 'dark');

  constructor() {
    this.initializeTheme();
    this.setupSystemThemeListener();
  }

  private initializeTheme(): void {
    // Load saved preference
    const savedTheme = this.storageService.getItem<Theme>(this.THEME_KEY);
    if (savedTheme && ['light', 'dark', 'auto'].includes(savedTheme)) {
      this.selectedThemeSignal.set(savedTheme);
    } else {
      // First user - set automatic by default and save it
      this.selectedThemeSignal.set('auto');
      this.storageService.setItem(this.THEME_KEY, 'auto');
    }

    // Detect initial system preference
    this.updateSystemPreference();

    // Apply initial theme
    this.applyTheme();
  }

  private setupSystemThemeListener(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      // Listen for system preference changes
      mediaQuery.addEventListener('change', (e) => {
        this.systemPrefersDarkSignal.set(e.matches);
        this.applyTheme();
      });
    }
  }

  private updateSystemPreference(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.systemPrefersDarkSignal.set(prefersDark);
    }
  }

  private applyTheme(): void {
    if (typeof document !== 'undefined') {
      const isDark = this.isDarkMode();

      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      // Update theme color for mobile status bar
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', isDark ? '#1f2937' : '#3b82f6');
      }
    }
  }

  setTheme(theme: Theme): void {
    this.selectedThemeSignal.set(theme);
    this.storageService.setItem(this.THEME_KEY, theme);
    this.applyTheme();
  }

  toggleTheme(): void {
    const current = this.selectedThemeSignal();
    let next: Theme;

    switch (current) {
      case 'light':
        next = 'dark';
        break;
      case 'dark':
        next = 'auto';
        break;
      case 'auto':
      default:
        next = 'light';
        break;
    }

    this.setTheme(next);
  }

  getThemeDisplayName(theme: Theme): string {
    switch (theme) {
      case 'light':
        return 'Clair';
      case 'dark':
        return 'Sombre';
      case 'auto':
        return 'Automatique';
      default:
        return 'Automatique';
    }
  }

  getThemeIcon(theme: Theme): string {
    switch (theme) {
      case 'light':
        return '☀️';
      case 'dark':
        return '🌙';
      case 'auto':
        return '🔄';
      default:
        return '🔄';
    }
  }
}
