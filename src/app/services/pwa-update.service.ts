import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionEvent } from '@angular/service-worker';

@Injectable({
  providedIn: 'root',
})
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate);

  constructor() {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.subscribeToVersionUpdates();
    this.setupProactiveChecks();
  }

  private subscribeToVersionUpdates(): void {
    this.swUpdate.versionUpdates.subscribe((event: VersionEvent) => {
      switch (event.type) {
        case 'VERSION_READY':
          // A new version is ready: activate it and reload the application
          this.activateAndReload();
          break;
        case 'VERSION_INSTALLATION_FAILED':
          console.error("Echec d'installation de la nouvelle version du Service Worker");
          break;
        default:
          // VERSION_DETECTED, NO_NEW_VERSION_DETECTED
          break;
      }
    });
  }

  private setupProactiveChecks(): void {
    // Check on window focus
    window.addEventListener('focus', () => {
      void this.safeCheckForUpdate();
    });

    // Check when back online
    window.addEventListener('online', () => {
      void this.safeCheckForUpdate();
    });

    // Periodic check (every 6 hours)
    const sixHoursMs = 6 * 60 * 60 * 1000;
    window.setInterval(() => {
      void this.safeCheckForUpdate();
    }, sixHoursMs);
  }

  private async safeCheckForUpdate(): Promise<void> {
    try {
      await this.swUpdate.checkForUpdate();
    } catch {
      // Silent: may fail if offline or if SW is not ready yet
    }
  }

  private async activateAndReload(): Promise<void> {
    try {
      const activated = await this.swUpdate.activateUpdate();
      if (activated) {
        // Reload to serve new assets
        location.reload();
      }
    } catch (err) {
      console.error("Erreur lors de l'activation de la mise à jour PWA:", err);
    }
  }
}
