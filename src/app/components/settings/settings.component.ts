import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  storageSize: number = 0;
  isStorageAvailable: boolean = true;
  showConfirmDelete: boolean = false;

  constructor(private storageService: StorageService) {}

  ngOnInit(): void {
    this.updateStorageInfo();
  }

  updateStorageInfo(): void {
    this.storageSize = this.storageService.getStorageSize();
    this.isStorageAvailable = this.storageService.isStorageAvailable();
  }

  clearAllData(): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer toutes les données ? Cette action est irréversible.')) {
      this.storageService.clear();
      this.updateStorageInfo();
      alert('Toutes les données ont été supprimées.');
    }
  }

  exportData(): void {
    try {
      const data = {
        tasks: JSON.parse(localStorage.getItem('household_tasks') || '[]'),
        notifications: JSON.parse(localStorage.getItem('notification_settings') || '{}'),
        exportDate: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taches-menageres-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('Données exportées avec succès !');
    } catch (error) {
      alert('Erreur lors de l\'export des données.');
    }
  }

  importData(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (data.tasks) {
          localStorage.setItem('household_tasks', JSON.stringify(data.tasks));
        }
        if (data.notifications) {
          localStorage.setItem('notification_settings', JSON.stringify(data.notifications));
        }
        
        this.updateStorageInfo();
        alert('Données importées avec succès ! Veuillez recharger la page.');
        window.location.reload();
      } catch (error) {
        alert('Erreur lors de l\'import des données. Vérifiez que le fichier est valide.');
      }
    };
    reader.readAsText(file);
  }

  formatStorageSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
