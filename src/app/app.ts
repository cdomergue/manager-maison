import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UserSelectComponent } from './components/user-select/user-select.component';
import { LoadingService } from './services/loading.service';
import { BackgroundCheckService } from './services/background-check.service';
import { NgOptimizedImage } from '@angular/common';
import { PwaUpdateService } from './services/pwa-update.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UserSelectComponent, NgOptimizedImage],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly loading = inject(LoadingService);
  private readonly backgroundCheckService = inject(BackgroundCheckService);
  // Injection pour initialiser le suivi des mises à jour PWA
  private readonly pwaUpdateService = inject(PwaUpdateService);
  // Service de thème exposé pour le template
  protected readonly themeService = inject(ThemeService);

  // Signaux globaux pour l'état du serveur
  protected readonly isCheckingBackground = computed(() => this.backgroundCheckService.isCheckingBackground());
  protected readonly lastBackgroundCheck = computed(() => this.backgroundCheckService.lastCheck());

  // Signaux pour le thème
  protected readonly isDarkMode = computed(() => this.themeService.isDarkMode());
}
