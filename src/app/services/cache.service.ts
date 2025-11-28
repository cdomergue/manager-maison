import { inject, Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { ApiService } from './api.service';
import { ShoppingItem, ShoppingListEntry } from '../models/shopping-item.model';
import { Note } from '../models/note.model';
import { Recipe } from '../models/recipe.model';

export interface CacheData {
  shoppingItems: ShoppingItem[];
  shoppingList: ShoppingListEntry[];
  notes: Note[];
  recipes: Recipe[];
  lastUpdated: string;
}

@Injectable({
  providedIn: 'root',
})
export class CacheService {
  private storage = inject(StorageService);
  private api = inject(ApiService);

  private readonly CACHE_KEY = 'lambda_cache_data';
  private readonly CACHE_EXPIRY_HOURS = 24; // Cache valid for 24h

  /**
   * Load data from cache if available and valid
   */
  async loadFromCache(): Promise<CacheData | null> {
    const cached = this.storage.getItem<CacheData>(this.CACHE_KEY);

    if (!cached) {
      console.log('Aucun cache trouvé');
      return null;
    }

    // Check if cache is not expired
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
   * Save data to cache
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
   * Load data from lambda and update cache
   */
  async refreshFromLambda(): Promise<CacheData> {
    console.log('Mise à jour depuis la lambda...');

    try {
      const [shoppingItems, shoppingList, notes, recipes] = await Promise.all([
        this.api.getShoppingItemsAsync(),
        this.api.getShoppingListAsync(),
        this.api.getNotesAsync(),
        this.api.getRecipesAsync(),
      ]);

      const cacheData: CacheData = {
        shoppingItems,
        shoppingList,
        notes: notes as Note[],
        recipes: recipes as Recipe[],
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
   * Load data: first from cache, then update from lambda
   */
  async loadData(): Promise<CacheData> {
    // Try to load from cache
    const cached = await this.loadFromCache();

    if (cached) {
      // Load cache data immediately
      console.log('Données chargées depuis le cache');

      // Update from lambda in background (non-blocking)
      this.refreshFromLambda().catch((error) => {
        console.warn('Échec de la mise à jour en arrière-plan:', error);
      });

      return cached;
    } else {
      // No valid cache, load from lambda
      console.log('Chargement depuis la lambda...');
      return await this.refreshFromLambda();
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.storage.removeItem(this.CACHE_KEY);
    console.log('Cache vidé');
  }

  /**
   * Check if cache exists and is valid
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
