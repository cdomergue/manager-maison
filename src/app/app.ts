import {Component, computed, inject} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {UserSelectComponent} from './components/user-select/user-select.component';
import {LoadingService} from './services/loading.service';
import {BackgroundCheckService} from './services/background-check.service';
import {DatePipe, NgOptimizedImage} from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UserSelectComponent, DatePipe, NgOptimizedImage],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly loading = inject(LoadingService);
  private readonly backgroundCheckService = inject(BackgroundCheckService);

  // Signaux globaux pour l'état du serveur
  protected readonly isCheckingBackground = computed(() => this.backgroundCheckService.isCheckingBackground());
  protected readonly lastBackgroundCheck = computed(() => this.backgroundCheckService.lastCheck());
}
