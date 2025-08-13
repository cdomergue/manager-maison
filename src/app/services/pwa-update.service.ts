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
          // Une nouvelle version est prête: on l'active puis on recharge l'application
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
    // Vérification au focus de la fenêtre
    window.addEventListener('focus', () => {
      void this.safeCheckForUpdate();
    });

    // Vérification quand on revient en ligne
    window.addEventListener('online', () => {
      void this.safeCheckForUpdate();
    });

    // Vérification périodique (toutes les 6 heures)
    const sixHoursMs = 6 * 60 * 60 * 1000;
    window.setInterval(() => {
      void this.safeCheckForUpdate();
    }, sixHoursMs);
  }

  private async safeCheckForUpdate(): Promise<void> {
    try {
      await this.swUpdate.checkForUpdate();
    } catch {
      // Silencieux: peut échouer si offline ou si le SW n'est pas encore prêt
    }
  }

  private async activateAndReload(): Promise<void> {
    try {
      const activated = await this.swUpdate.activateUpdate();
      if (activated) {
        // Recharger pour servir les nouveaux assets
        location.reload();
      }
    } catch (err) {
      console.error("Erreur lors de l'activation de la mise à jour PWA:", err);
    }
  }
}
