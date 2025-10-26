import { inject, Injectable } from '@angular/core';
import { CacheService } from './cache.service';

@Injectable({
  providedIn: 'root',
})
export class AppInitializationService {
  private cacheService = inject(CacheService);

  /**
   * Initialise l'application en chargeant les données depuis le cache
   * puis en mettant à jour depuis la lambda en arrière-plan
   */
  async initializeApp(): Promise<void> {
    console.log("Initialisation de l'application...");

    try {
      // Charger toutes les données depuis le cache
      const cached = await this.cacheService.loadFromCache();

      if (cached) {
        console.log('Données chargées depuis le cache');

        // Charger les données de courses depuis le cache
        if (cached.shoppingItems.length > 0) {
          console.log(`${cached.shoppingItems.length} items de courses disponibles depuis le cache`);
        }

        if (cached.shoppingList.length > 0) {
          console.log(`${cached.shoppingList.length} entrées de liste disponibles depuis le cache`);
        }

        // Charger les notes depuis le cache
        if (cached.notes.length > 0) {
          console.log(`${cached.notes.length} notes disponibles depuis le cache`);
        }

        // Charger les recettes depuis le cache
        if (cached.recipes.length > 0) {
          console.log(`${cached.recipes.length} recettes disponibles depuis le cache`);
        }

        // Mettre à jour depuis la lambda en arrière-plan
        this.refreshFromLambdaInBackground();
      } else {
        console.log('Aucun cache valide, chargement depuis la lambda...');
        // Pas de cache, charger depuis la lambda
        await this.cacheService.refreshFromLambda();
      }
    } catch (error) {
      console.error("Erreur lors de l'initialisation:", error);
    }
  }

  /**
   * Met à jour les données depuis la lambda en arrière-plan
   */
  private refreshFromLambdaInBackground(): void {
    // Attendre un peu avant de faire la mise à jour en arrière-plan
    setTimeout(async () => {
      try {
        console.log('Mise à jour en arrière-plan depuis la lambda...');
        await this.cacheService.refreshFromLambda();
        console.log('Mise à jour en arrière-plan terminée');
      } catch (error) {
        console.warn('Échec de la mise à jour en arrière-plan:', error);
      }
    }, 2000); // Attendre 2 secondes
  }
}
