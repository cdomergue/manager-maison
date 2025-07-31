import { Injectable } from '@angular/core';
import { Task } from '../models/task.model';
import { NotificationSettings } from '../models/task.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly SETTINGS_KEY = 'notification_settings';
  private settings: NotificationSettings = {
    enabled: true,
    reminderTime: '09:00',
    advanceNotice: 2
  };

  constructor() {
    this.loadSettings();
    this.requestPermission();
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return Notification.permission === 'granted';
  }

  async scheduleTaskReminder(task: Task): Promise<void> {
    if (!this.settings.enabled) return;

    const hasPermission = await this.requestPermission();
    if (!hasPermission) return;

    const reminderDate = new Date(task.nextDueDate);
    reminderDate.setHours(
      parseInt(this.settings.reminderTime.split(':')[0]),
      parseInt(this.settings.reminderTime.split(':')[1]),
      0,
      0
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
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const notification = new Notification('Tâche ménagère à faire', {
      body: `Il est temps de faire : ${task.name}`,
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/icon-72x72.png',
      tag: `task-${task.id}`,
      requireInteraction: true
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      // Émettre un événement pour marquer la tâche comme terminée
      window.dispatchEvent(new CustomEvent('taskCompleted', { 
        detail: { taskId: task.id } 
      }));
    };
  }

  async showOverdueNotification(tasks: Task[]): Promise<void> {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const notification = new Notification('Tâches en retard', {
      body: `Vous avez ${tasks.length} tâche(s) en retard`,
      icon: '/assets/icons/icon-192x192.png',
      badge: '/assets/icons/icon-72x72.png',
      tag: 'overdue-tasks',
      requireInteraction: true
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
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
}
