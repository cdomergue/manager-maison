import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NotificationSettings } from '../../models/task.model';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notifications-config',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './notifications-config.component.html',
  styleUrls: ['./notifications-config.component.css']
})
export class NotificationsConfigComponent implements OnInit {
  configForm: FormGroup;
  notificationPermission: string = 'default';

  constructor(
    private fb: FormBuilder,
    private notificationService: NotificationService
  ) {
    this.configForm = this.fb.group({
      enabled: [true],
      reminderTime: ['09:00', [Validators.required, Validators.pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)]],
      advanceNotice: [2, [Validators.required, Validators.min(0), Validators.max(24)]]
    });
  }

  ngOnInit(): void {
    // Charger les paramètres actuels
    const settings = this.notificationService.getSettings();
    this.configForm.patchValue(settings);
    
    // Vérifier le statut des permissions
    this.checkNotificationPermission();
  }

  async requestPermission(): Promise<void> {
    const granted = await this.notificationService.requestPermission();
    this.checkNotificationPermission();
    
    if (granted) {
      alert('Notifications activées ! Vous recevrez des rappels pour vos tâches.');
    } else {
      alert('Les notifications sont désactivées. Vous ne recevrez pas de rappels.');
    }
  }

  onSave(): void {
    if (this.configForm.valid) {
      const settings: NotificationSettings = this.configForm.value;
      this.notificationService.updateSettings(settings);
      alert('Configuration des notifications sauvegardée !');
    }
  }

  testNotification(): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Test de notification', {
        body: 'Ceci est un test de notification pour vos tâches ménagères',
        icon: '/assets/icons/icon-192x192.png'
      });
    } else {
      alert('Veuillez d\'abord autoriser les notifications dans votre navigateur.');
    }
  }

  private checkNotificationPermission(): void {
    if ('Notification' in window) {
      this.notificationPermission = Notification.permission;
    }
  }

  get permissionStatusText(): string {
    switch (this.notificationPermission) {
      case 'granted': return 'Autorisées';
      case 'denied': return 'Refusées';
      default: return 'Non définies';
    }
  }

  get permissionStatusClass(): string {
    switch (this.notificationPermission) {
      case 'granted': return 'text-green-600';
      case 'denied': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  }
}
