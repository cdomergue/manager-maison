import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'info';

export interface AppNotification {
  id: string;
  message: string;
  type: NotificationType;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notificationsSignal = signal<AppNotification[]>([]);
  readonly notifications = this.notificationsSignal.asReadonly();

  show(message: string, type: NotificationType = 'info', durationMs = 5000): void {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const notification: AppNotification = { id, message, type };

    this.notificationsSignal.update((current) => [...current, notification]);

    if (durationMs > 0) {
      setTimeout(() => {
        this.remove(id);
      }, durationMs);
    }
  }

  showError(message: string, durationMs = 5000): void {
    this.show(message, 'error', durationMs);
  }

  showSuccess(message: string, durationMs = 3000): void {
    this.show(message, 'success', durationMs);
  }

  showInfo(message: string, durationMs = 3000): void {
    this.show(message, 'info', durationMs);
  }

  remove(id: string): void {
    this.notificationsSignal.update((current) => current.filter((n) => n.id !== id));
  }
}
