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
    'BO2fG8n5Za1r06U3lG-2rvcdqZmyiwpKbk18Bpn8Z6GtX80NzETCsu7RoWMylVzeCHfuaAVkRXxFuaDSLs8vMTc';

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

  /**
   * Affiche une notification de test (Compatible Android & PC)
   */
  async showTestNotification(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    // 1. Demander la permission si nécessaire
    if (this.permissionStatus !== 'granted') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') return;
    }

    const title = '🔔 Test de notification';
    const options: NotificationOptions = {
      body: 'Les notifications fonctionnent correctement !',
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1,
      },
    };

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;

        await registration.showNotification(title, options);
        return;
      } catch (error) {
        console.warn('[Notification] SW method failed, falling back to native constructor', error);
      }
    }

    try {
      new Notification(title, options);
    } catch (error) {
      console.error('[Notification] All methods failed', error);
    }
  }
}
