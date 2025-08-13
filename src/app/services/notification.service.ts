import { Injectable, inject } from '@angular/core';
import { NotificationSettings, Task } from '../models/task.model';
import { UserService } from './user.service';
import { SwPush } from '@angular/service-worker';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly SETTINGS_KEY = 'notification_settings';
  private settings: NotificationSettings = {
    enabled: true,
    reminderTime: '09:00',
    advanceNotice: 2,
  };

  private readonly VAPID_PUBLIC_KEY =
    'BMB8LZ-B0Fin4W_pYzumsB6L6Rqoh1CfO-V3giCPRSy954jXVcE4Sdj99O5epl5Z8cbBY-IkG_IJjIoIYDo8Iss';

  private userService = inject(UserService);
  private swPush = inject(SwPush);
  constructor() {
    this.loadSettings();
    this.requestPermission();
  }

  private isTaskForCurrentUser(task: Task): boolean {
    const currentUser = this.userService.getCurrentUser();
    return currentUser?.id === task.assignee;
  }

  async requestPermission(): Promise<boolean> {
    // En mode développement, utiliser l'API Notification native
    if (!this.swPush.isEnabled) {
      if (!('Notification' in window)) {
        console.warn('Notifications not supported');
        return false;
      }

      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }

      return Notification.permission === 'granted';
    }

    // En mode production, utiliser les notifications push avec Service Worker
    try {
      const subscription = await this.swPush.requestSubscription({
        serverPublicKey: this.VAPID_PUBLIC_KEY,
      });

      if (subscription) {
        console.log('Push subscription successful:', subscription);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error requesting push subscription:', error);

      // Fallback vers l'API Notification native si la souscription push échoue
      if ('Notification' in window) {
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          return permission === 'granted';
        }
        return Notification.permission === 'granted';
      }

      return false;
    }
  }

  async scheduleTaskReminder(task: Task): Promise<void> {
    if (!this.settings.enabled || !this.isTaskForCurrentUser(task)) return;

    const hasPermission = await this.requestPermission();
    if (!hasPermission) return;

    const reminderDate = new Date(task.nextDueDate);
    reminderDate.setHours(
      parseInt(this.settings.reminderTime.split(':')[0]),
      parseInt(this.settings.reminderTime.split(':')[1]),
      0,
      0,
    );
    reminderDate.setHours(reminderDate.getHours() - this.settings.advanceNotice);

    const now = new Date();
    const delay = reminderDate.getTime() - now.getTime();

    if (delay > 0) {
      setTimeout(() => {
        this.showNotification(task);
      }, delay);
    }
  }

  async showNotification(task: Task): Promise<void> {
    // Fallback vers l'API Notification native si Service Worker non disponible
    if (!this.swPush.isEnabled) {
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('Tâche ménagère à faire', {
          body: `Il est temps de faire : ${task.name}`,
          icon: '/icons/icon-192x192.png',
          tag: `task-${task.id}`,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          window.dispatchEvent(
            new CustomEvent('taskCompleted', {
              detail: { taskId: task.id },
            }),
          );
        };
      }
      return;
    }

    try {
      await this.swPush.notificationClicks.subscribe((action) => {
        if (action.notification.tag === `task-${task.id}`) {
          window.dispatchEvent(
            new CustomEvent('taskCompleted', {
              detail: { taskId: task.id },
            }),
          );
        }
      });

      // Envoyer une notification via Service Worker
      await this.sendNotificationToServiceWorker({
        title: 'Tâche ménagère à faire',
        body: `Il est temps de faire : ${task.name}`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: `task-${task.id}`,
        requireInteraction: true,
      });
    } catch (error) {
      console.error('Error showing notification:', error);

      // Fallback vers l'API Notification native
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('Tâche ménagère à faire', {
          body: `Il est temps de faire : ${task.name}`,
          icon: '/icons/icon-192x192.png',
          tag: `task-${task.id}`,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          window.dispatchEvent(
            new CustomEvent('taskCompleted', {
              detail: { taskId: task.id },
            }),
          );
        };
      }
    }
  }

  async showOverdueNotification(tasks: Task[]): Promise<void> {
    if (!this.swPush.isEnabled) {
      return;
    }

    const userTasks = tasks.filter((task) => this.isTaskForCurrentUser(task));

    await this.sendNotificationToServiceWorker({
      title: 'Tâches en retard',
      body: `Vous avez ${userTasks.length} tâche(s) en retard`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'overdue-tasks',
      requireInteraction: true,
    });
  }

  async showNewTaskNotification(task: Task): Promise<void> {
    if (!this.swPush.isEnabled || !this.isTaskForCurrentUser(task)) {
      return;
    }

    await this.sendNotificationToServiceWorker({
      title: 'Nouvelle tâche ajoutée',
      body: `Nouvelle tâche : ${task.name}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: `new-task-${task.id}`,
      requireInteraction: false,
    });
  }

  async showMultipleNewTasksNotification(tasks: Task[]): Promise<void> {
    if (!this.swPush.isEnabled) {
      return;
    }

    const userTasks = tasks.filter((task) => this.isTaskForCurrentUser(task));
    if (userTasks.length === 0) {
      return;
    }

    await this.sendNotificationToServiceWorker({
      title: 'Nouvelles tâches ajoutées',
      body: `${userTasks.length} nouvelles tâches vous ont été assignées`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'multiple-new-tasks',
      requireInteraction: false,
    });
  }

  updateSettings(settings: NotificationSettings): void {
    this.settings = { ...settings };
    this.saveSettings();
  }

  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  private loadSettings(): void {
    const stored = localStorage.getItem(this.SETTINGS_KEY);
    if (stored) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      } catch (error) {
        console.error('Error loading notification settings:', error);
      }
    }
  }

  private saveSettings(): void {
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
  }

  private async sendNotificationToServiceWorker(notificationData: {
    title: string;
    body: string;
    icon: string;
    badge?: string;
    tag?: string;
    requireInteraction?: boolean;
  }): Promise<void> {
    if ('serviceWorker' in navigator && 'showNotification' in ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(notificationData.title, {
          body: notificationData.body,
          icon: notificationData.icon,
          badge: notificationData.badge,
          tag: notificationData.tag,
          requireInteraction: notificationData.requireInteraction,
          data: notificationData,
        } as NotificationOptions);
      } catch (error) {
        console.error("Erreur lors de l'affichage de la notification:", error);
      }
    }
  }

  async testNotification(): Promise<void> {
    // En mode développement ou si Service Worker non disponible, utiliser l'API Notification native
    if (!this.swPush.isEnabled) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Test de notification', {
          body: 'Ceci est un test de notification pour vos tâches ménagères',
          icon: '/icons/icon-192x192.png',
        });
        return;
      } else {
        throw new Error('Les notifications ne sont pas autorisées');
      }
    }

    try {
      // Test avec une notification via Service Worker
      await this.sendNotificationToServiceWorker({
        title: 'Test de notification',
        body: 'Ceci est un test de notification pour vos tâches ménagères',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'test-notification',
        requireInteraction: false,
      });
    } catch (error) {
      console.error('Erreur avec Service Worker, fallback vers API native:', error);

      // Fallback vers l'API Notification native
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Test de notification', {
          body: 'Ceci est un test de notification pour vos tâches ménagères',
          icon: '/icons/icon-192x192.png',
        });
      } else {
        throw new Error('Les notifications ne sont pas autorisées');
      }
    }
  }
}
