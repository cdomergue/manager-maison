import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NotificationSettings } from '../../models/task.model';
import { NotificationService } from '../../services/notification.service';
import { SwPush } from '@angular/service-worker';

@Component({
  selector: 'app-notifications-config',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './notifications-config.component.html',
  styleUrls: ['./notifications-config.component.css'],
})
export class NotificationsConfigComponent implements OnInit {
  configForm: FormGroup;
  notificationPermission = 'default';

  private fb = inject(FormBuilder);
  private notificationService = inject(NotificationService);
  private swPush = inject(SwPush);

  constructor() {
    this.configForm = this.fb.group({
      enabled: [true],
      reminderTime: ['09:00', [Validators.required, Validators.pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)]],
      advanceNotice: [2, [Validators.required, Validators.min(0), Validators.max(24)]],
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

  async testNotification(): Promise<void> {
    try {
      await this.notificationService.testNotification();
      alert('Notification de test envoyée !');
    } catch (error) {
      console.error('Erreur lors du test de notification:', error);
      alert('Erreur lors du test de notification. Veuillez vérifier les permissions.');
    }
  }

  private checkNotificationPermission(): void {
    if (this.swPush.isEnabled) {
      // Vérifier si nous avons une subscription active
      this.swPush.subscription.subscribe((subscription) => {
        this.notificationPermission = subscription ? 'granted' : 'default';
      });
    } else if ('Notification' in window) {
      this.notificationPermission = Notification.permission;
    }
  }

  get permissionStatusText(): string {
    switch (this.notificationPermission) {
      case 'granted':
        return 'Autorisées';
      case 'denied':
        return 'Refusées';
      default:
        return 'Non définies';
    }
  }

  get permissionStatusClass(): string {
    switch (this.notificationPermission) {
      case 'granted':
        return 'text-green-600 dark:text-green-400';
      case 'denied':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-yellow-600 dark:text-yellow-400';
    }
  }
}
