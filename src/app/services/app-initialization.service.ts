import { Injectable, inject } from '@angular/core';
import { CacheService } from './cache.service';
import { TaskService } from './task.service';
import { ShoppingListService } from './shopping-list.service';

@Injectable({
  providedIn: 'root',
})
export class AppInitializationService {
  private cacheService = inject(CacheService);
  private taskService = inject(TaskService);
  private shoppingListService = inject(ShoppingListService);

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

        // Charger les tâches depuis le cache
        if (cached.tasks.length > 0) {
          console.log(`${cached.tasks.length} tâches disponibles depuis le cache`);
        }

        // Charger les données de courses depuis le cache
        if (cached.shoppingItems.length > 0) {
          console.log(`${cached.shoppingItems.length} items de courses disponibles depuis le cache`);
        }

        if (cached.shoppingList.length > 0) {
          console.log(`${cached.shoppingList.length} entrées de liste disponibles depuis le cache`);
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

  private parseHistory(history: unknown): { date: Date; author: string }[] {
    if (!Array.isArray(history)) return [];
    return history.map((entry) => {
      const e = entry as { date: string | Date; author: string };
      const dateValue = e.date instanceof Date ? e.date : new Date(e.date);
      return { date: dateValue, author: e.author };
    });
  }
}
