import { Injectable, signal, computed, inject } from '@angular/core';
import { StorageService } from './storage.service';

export type Theme = 'light' | 'dark' | 'auto';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly THEME_KEY = 'app_theme';
  private storageService = inject(StorageService);

  // Signal pour le thème sélectionné par l'utilisateur
  private selectedThemeSignal = signal<Theme>('auto');

  // Signal pour détecter la préférence système
  private systemPrefersDarkSignal = signal<boolean>(false);

  // Signal calculé pour le thème effectif appliqué
  readonly effectiveTheme = computed(() => {
    const selected = this.selectedThemeSignal();
    if (selected === 'auto') {
      return this.systemPrefersDarkSignal() ? 'dark' : 'light';
    }
    return selected;
  });

  // Signal en lecture seule pour le thème sélectionné
  readonly selectedTheme = this.selectedThemeSignal.asReadonly();

  // Signal calculé pour savoir si le mode sombre est actif
  readonly isDarkMode = computed(() => this.effectiveTheme() === 'dark');

  constructor() {
    this.initializeTheme();
    this.setupSystemThemeListener();
  }

  private initializeTheme(): void {
    // Charger la préférence sauvegardée
    const savedTheme = this.storageService.getItem<Theme>(this.THEME_KEY);
    if (savedTheme && ['light', 'dark', 'auto'].includes(savedTheme)) {
      this.selectedThemeSignal.set(savedTheme);
    } else {
      // Premier utilisateur - définir automatique par défaut et le sauvegarder
      this.selectedThemeSignal.set('auto');
      this.storageService.setItem(this.THEME_KEY, 'auto');
    }

    // Détecter la préférence système initiale
    this.updateSystemPreference();

    // Appliquer le thème initial
    this.applyTheme();
  }

  private setupSystemThemeListener(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      // Écouter les changements de préférence système
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

      // Mettre à jour la couleur du thème pour la barre d'état mobile
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
