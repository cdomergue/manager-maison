import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { ApiService } from '../../services/api.service';
import { Theme, ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  storageSize = signal(0);
  isServerConnected = signal(false);
  serverStatus = signal<ServerStatus | null>(null);
  connectionStatus = signal('Vérification...');

  // Signaux pour le thème
  currentTheme = computed(() => this.themeService.selectedTheme());
  isDarkMode = computed(() => this.themeService.isDarkMode());
  effectiveTheme = computed(() => this.themeService.effectiveTheme());

  // Options de thèmes disponibles
  themeOptions: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: 'Clair', icon: '☀️' },
    { value: 'dark', label: 'Sombre', icon: '🌙' },
    { value: 'auto', label: 'Automatique', icon: '🔄' },
  ];

  private storageService = inject(StorageService);
  private apiService = inject(ApiService);
  private themeService = inject(ThemeService);

  ngOnInit(): void {
    this.updateStorageInfo();
    this.checkServerStatus();
  }

  private updateStorageInfo(): void {
    this.storageSize.set(this.storageService.getStorageSize());
  }

  private checkServerStatus(): void {
    this.apiService.getConnectionStatus().subscribe((isConnected) => {
      this.isServerConnected.set(isConnected);
      this.connectionStatus.set(isConnected ? 'Connecté' : 'Non connecté');
    });

    this.apiService.getServerStatus().subscribe((status) => {
      this.serverStatus.set(status as ServerStatus | null);
    });
  }

  clearLocalStorage(): void {
    if (confirm('Êtes-vous sûr de vouloir effacer toutes les données locales ?')) {
      this.storageService.clear();
      this.updateStorageInfo();
    }
  }

  refreshServerStatus(): void {
    this.connectionStatus.set('Vérification...');
    this.apiService.checkServerStatus();
    this.checkServerStatus();
  }

  onThemeChange(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  getThemeDisplayName(theme: Theme): string {
    return this.themeService.getThemeDisplayName(theme);
  }

  getThemeIcon(theme: Theme): string {
    return this.themeService.getThemeIcon(theme);
  }
}

interface ServerStatus {
  totalTasks: number;
  lastUpdated: string | Date;
  serverTime: string | Date;
}
