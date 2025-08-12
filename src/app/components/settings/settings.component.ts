import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { ApiService } from '../../services/api.service';
import { BackgroundCheckService } from '../../services/background-check.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  storageSize = signal(0);
  isServerConnected = signal(false);
  serverStatus = signal<any>(null);
  connectionStatus = signal('Vérification...');

  // Signaux pour la vérification en arrière-plan
  isCheckingBackground = computed(() => this.backgroundCheckService.isCheckingBackground());
  lastBackgroundCheck = computed(() => this.backgroundCheckService.lastCheck());
  backgroundCheckInterval = computed(() => this.backgroundCheckService.checkIntervalMs());

  constructor(
    private storageService: StorageService,
    private apiService: ApiService,
    private backgroundCheckService: BackgroundCheckService
  ) {}

  ngOnInit(): void {
    this.updateStorageInfo();
    this.checkServerStatus();
  }

  private updateStorageInfo(): void {
    this.storageSize.set(this.storageService.getStorageSize());
  }

  private checkServerStatus(): void {
    this.apiService.getConnectionStatus().subscribe(isConnected => {
      this.isServerConnected.set(isConnected);
      this.connectionStatus.set(isConnected ? 'Connecté' : 'Non connecté');
    });

    this.apiService.getServerStatus().subscribe(status => {
      this.serverStatus.set(status);
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

  async forceBackgroundCheck(): Promise<void> {
    await this.backgroundCheckService.forceCheck();
  }
}
