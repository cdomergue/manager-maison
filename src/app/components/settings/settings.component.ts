import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../services/task.service';
import { StorageService } from '../../services/storage.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  storageSize: number = 0;
  isServerConnected: boolean = false;
  serverStatus: any = null;
  connectionStatus: string = 'Vérification...';

  constructor(
    private storageService: StorageService,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.updateStorageInfo();
    this.checkServerStatus();
  }

  private updateStorageInfo(): void {
    this.storageSize = this.storageService.getStorageSize();
  }

  private checkServerStatus(): void {
    this.apiService.getConnectionStatus().subscribe(isConnected => {
      this.isServerConnected = isConnected;
      this.connectionStatus = isConnected ? 'Connecté' : 'Non connecté';
    });

    this.apiService.getServerStatus().subscribe(status => {
      this.serverStatus = status;
    });
  }

  clearLocalStorage(): void {
    if (confirm('Êtes-vous sûr de vouloir effacer toutes les données locales ?')) {
      this.storageService.clear();
      this.updateStorageInfo();
    }
  }

  refreshServerStatus(): void {
    this.connectionStatus = 'Vérification...';
    this.apiService.checkServerStatus();
    this.checkServerStatus();
  }
}
