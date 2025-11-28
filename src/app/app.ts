import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UserSelectComponent } from './components/user-select/user-select.component';
import { LoadingService } from './services/loading.service';
import { NgOptimizedImage } from '@angular/common';
import { PwaUpdateService } from './services/pwa-update.service';
import { ThemeService } from './services/theme.service';
import { DebugService } from './services/debug.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UserSelectComponent, NgOptimizedImage],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly loading = inject(LoadingService);
  // BackgroundCheckService temporarily disabled (task polling)
  // private readonly backgroundCheckService = inject(BackgroundCheckService);
  // Injection to initialize PWA update tracking
  private readonly pwaUpdateService = inject(PwaUpdateService);
  // Theme service exposed for the template
  protected readonly themeService = inject(ThemeService);

  // Global signals for server state
  // protected readonly isCheckingBackground = computed(() => this.backgroundCheckService.isCheckingBackground());
  // protected readonly lastBackgroundCheck = computed(() => this.backgroundCheckService.lastCheck());

  // Signals for the theme
  protected readonly isDarkMode = computed(() => this.themeService.isDarkMode());

  private readonly debugService = inject(DebugService);

  constructor() {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'DEBUG_LOG') {
          this.debugService.log(event.data.message, event.data.details);
        }
      });
    }
  }
}
