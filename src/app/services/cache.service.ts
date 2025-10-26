import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { ApiService } from './api.service';
import { Task } from '../models/task.model';
import { ShoppingItem, ShoppingListEntry } from '../models/shopping-item.model';

export interface CacheData {
  tasks: Task[];
  shoppingItems: ShoppingItem[];
  shoppingList: ShoppingListEntry[];
  lastUpdated: string;
}

@Injectable({
  providedIn: 'root',
})
export class CacheService {
  private storage = inject(StorageService);
  private api = inject(ApiService);

  private readonly CACHE_KEY = 'lambda_cache_data';
  private readonly CACHE_EXPIRY_HOURS = 24; // Cache valide 24h

  /**
   * Charge les données depuis le cache si disponible et valide
   */
  async loadFromCache(): Promise<CacheData | null> {
    const cached = this.storage.getItem<CacheData>(this.CACHE_KEY);

    if (!cached) {
      console.log('Aucun cache trouvé');
      return null;
    }

    // Vérifier si le cache n'est pas expiré
    const lastUpdated = new Date(cached.lastUpdated);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > this.CACHE_EXPIRY_HOURS) {
      console.log(`Cache expiré (${hoursDiff.toFixed(1)}h), sera mis à jour`);
      return null;
    }

    console.log(`Cache chargé (${hoursDiff.toFixed(1)}h)`);
    return cached;
  }

  /**
   * Sauvegarde les données dans le cache
   */
  saveToCache(data: Omit<CacheData, 'lastUpdated'>): void {
    const cacheData: CacheData = {
      ...data,
      lastUpdated: new Date().toISOString(),
    };

    this.storage.setItem(this.CACHE_KEY, cacheData);
    console.log('Cache sauvegardé');
  }

  /**
   * Charge les données depuis la lambda et met à jour le cache
   */
  async refreshFromLambda(): Promise<CacheData> {
    console.log('Mise à jour depuis la lambda...');

    try {
      const [tasks, shoppingItems, shoppingList] = await Promise.all([
        this.api.getTasksAsync(),
        this.api.getShoppingItemsAsync(),
        this.api.getShoppingListAsync(),
      ]);

      const cacheData: CacheData = {
        tasks,
        shoppingItems,
        shoppingList,
        lastUpdated: new Date().toISOString(),
      };

      this.saveToCache(cacheData);
      return cacheData;
    } catch (error) {
      console.error('Erreur lors de la mise à jour depuis la lambda:', error);
      throw error;
    }
  }

  /**
   * Charge les données : d'abord depuis le cache, puis mise à jour depuis la lambda
   */
  async loadData(): Promise<CacheData> {
    // Essayer de charger depuis le cache
    const cached = await this.loadFromCache();

    if (cached) {
      // Charger les données du cache immédiatement
      console.log('Données chargées depuis le cache');

      // Mettre à jour depuis la lambda en arrière-plan (sans bloquer)
      this.refreshFromLambda().catch((error) => {
        console.warn('Échec de la mise à jour en arrière-plan:', error);
      });

      return cached;
    } else {
      // Pas de cache valide, charger depuis la lambda
      console.log('Chargement depuis la lambda...');
      return await this.refreshFromLambda();
    }
  }

  /**
   * Vide le cache
   */
  clearCache(): void {
    this.storage.removeItem(this.CACHE_KEY);
    console.log('Cache vidé');
  }

  /**
   * Vérifie si le cache existe et est valide
   */
  hasValidCache(): boolean {
    const cached = this.storage.getItem<CacheData>(this.CACHE_KEY);
    if (!cached) return false;

    const lastUpdated = new Date(cached.lastUpdated);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

    return hoursDiff <= this.CACHE_EXPIRY_HOURS;
  }
}
