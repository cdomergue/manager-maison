import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { UserService } from './user.service';

// Interface pour typer l'envoi au backend
interface NotificationRegisterPayload {
  token: PushSubscriptionJSON;
  deviceId: string;
  platform: 'web';
  userId: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationRegistrationService {
  private readonly apiService = inject(ApiService);
  private readonly userService = inject(UserService);
  private readonly swPush = inject(SwPush);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly VAPID_PUBLIC_KEY =
    'BMB8LZ-B0Fin4W_pYzumsB6L6Rqoh1CfO-V3giCPRSy954jXVcE4Sdj99O5epl5Z8cbBY-IkG_IJjIoIYDo8Iss';

  private readonly STORAGE_KEY = 'device_id';
  private deviceId: string | null = null;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.deviceId = this.getOrCreateDeviceId();
    }
  }

  private getOrCreateDeviceId(): string {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) return stored;

    const newId =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    localStorage.setItem(this.STORAGE_KEY, newId);
    return newId;
  }

  async requestPermissionAndRegister(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) return false;

    const currentUser = this.userService.getCurrentUser();
    if (!currentUser) return false;

    if (!this.swPush.isEnabled) {
      console.warn('[Notification] Service Worker disabled.');
      return false;
    }

    try {
      const subscription: PushSubscription = await this.swPush.requestSubscription({
        serverPublicKey: this.VAPID_PUBLIC_KEY,
      });

      await this.registerToken(subscription.toJSON(), currentUser.id);
      return true;
    } catch (error) {
      console.error('[Notification] Subscription failed:', error);
      return false;
    }
  }

  private async registerToken(token: PushSubscriptionJSON, userId: string): Promise<void> {
    if (!this.deviceId) return;

    const payload: NotificationRegisterPayload = {
      token,
      deviceId: this.deviceId,
      platform: 'web',
      userId: userId,
    };

    try {
      await firstValueFrom(this.apiService.post('/notifications/register', payload));
    } catch (error) {
      console.error('[Notification] Backend registration failed:', error);
      throw error;
    }
  }

  async unregister(): Promise<void> {
    try {
      // On désabonne localement le SW pour être propre
      if (this.swPush.isEnabled) {
        await this.swPush.unsubscribe();
      }

      if (!this.deviceId) {
        return;
      }

      await firstValueFrom(this.apiService.delete('/notifications/unregister'));

      console.log('Token unregistered successfully');
    } catch (error) {
      console.error('Error unregistering notification token:', error);
      throw error;
    }
  }

  get permissionStatus(): NotificationPermission {
    if (!isPlatformBrowser(this.platformId) || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  async showTestNotification(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.permissionStatus !== 'granted') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') return;
    }

    const notification = new Notification('🔔 Test de notification', {
      body: 'Les notifications fonctionnent correctement !',
    });
    setTimeout(() => notification.close(), 5000);
  }
}
