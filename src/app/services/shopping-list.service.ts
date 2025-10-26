import { computed, inject, Injectable, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { ShoppingItem, ShoppingListEntry } from '../models/shopping-item.model';
import { ApiService } from './api.service';
import { CacheService } from './cache.service';

@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  private storage = inject(StorageService);
  private api = inject(ApiService);
  private cacheService = inject(CacheService);

  private readonly ITEMS_KEY = 'shopping_items_catalog';
  private readonly CURRENT_LIST_KEY = 'shopping_current_list';

  private itemsSignal = signal<ShoppingItem[]>([]);
  private currentListSignal = signal<ShoppingListEntry[]>([]);
  private useLocalStorageSignal = signal<boolean>(true);

  readonly items = this.itemsSignal.asReadonly();
  readonly currentList = this.currentListSignal.asReadonly();
  readonly uncheckedCount = computed(() => this.currentListSignal().filter((e) => !e.checked).length);
  readonly isUsingApi = computed(() => !this.useLocalStorageSignal());

  constructor() {
    // Charger d'abord depuis le cache si disponible
    this.loadFromCache();

    // Décider du mode de synchronisation en fonction de l'API
    this.api.getConnectionStatus().subscribe((isConnected) => {
      this.useLocalStorageSignal.set(!isConnected);
      if (isConnected) {
        this.loadFromApi();
      } else {
        this.loadFromStorage();
      }
    });
  }

  private async loadFromCache(): Promise<void> {
    try {
      const cached = await this.cacheService.loadFromCache();
      if (cached) {
        if (cached.shoppingItems.length > 0) {
          this.itemsSignal.set(cached.shoppingItems);
          console.log('Items de courses chargés depuis le cache');
        }
        if (cached.shoppingList.length > 0) {
          this.currentListSignal.set(cached.shoppingList);
          console.log('Liste de courses chargée depuis le cache');
        }
      }
    } catch (error) {
      console.warn('Erreur lors du chargement depuis le cache:', error);
    }
  }

  private loadFromStorage(): void {
    const storedItems = this.storage.getItem<ShoppingItem[]>(this.ITEMS_KEY) || [];
    const storedList = this.storage.getItem<ShoppingListEntry[]>(this.CURRENT_LIST_KEY) || [];
    this.itemsSignal.set(storedItems);
    this.currentListSignal.set(storedList);
  }

  private persist(): void {
    this.storage.setItem(this.ITEMS_KEY, this.itemsSignal());
    this.storage.setItem(this.CURRENT_LIST_KEY, this.currentListSignal());
  }

  private loadFromApi(): void {
    this.api.getShoppingItems().subscribe((items) => this.itemsSignal.set(items));
    this.api.getShoppingList().subscribe((list) => this.currentListSignal.set(list));
  }

  // Permet de forcer un rafraîchissement depuis la source active (API ou storage)
  refreshFromApi(): void {
    if (this.useLocalStorageSignal()) {
      this.loadFromStorage();
    } else {
      this.loadFromApi();
    }
  }

  addCatalogItem(name: string, category?: string): ShoppingItem {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Name is required');

    if (this.useLocalStorageSignal()) {
      const newItem: ShoppingItem = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        name: trimmed,
        category: category?.trim() || undefined,
      };
      this.itemsSignal.set([newItem, ...this.itemsSignal()]);
      this.persist();
      return newItem;
    } else {
      let created: ShoppingItem | null = null;
      this.api.createShoppingItem(trimmed, category).subscribe((item) => {
        created = item;
        this.itemsSignal.set([item, ...this.itemsSignal()]);
      });
      // Retour optimiste si besoin
      return created || ({ id: 'pending', name: trimmed, category } as ShoppingItem);
    }
  }

  updateCatalogItem(itemId: string, data: Partial<Pick<ShoppingItem, 'name' | 'category'>>): void {
    const existing = this.itemsSignal().find((i) => i.id === itemId);
    if (!existing) return;

    const sanitized = {
      name: data.name !== undefined ? data.name.trim() : undefined,
      category: data.category !== undefined ? data.category.trim() : undefined,
    };

    if (this.useLocalStorageSignal()) {
      // Mettre à jour le catalogue
      const updatedItems = this.itemsSignal().map((i) =>
        i.id === itemId
          ? {
              ...i,
              name: sanitized.name !== undefined && sanitized.name !== '' ? sanitized.name : i.name,
              category: sanitized.category !== undefined && sanitized.category !== '' ? sanitized.category : undefined,
            }
          : i,
      );
      this.itemsSignal.set(updatedItems);

      // Mettre à jour le nom dans les entrées de liste courante associées
      const updatedList = this.currentListSignal().map((e) =>
        e.itemId === itemId
          ? {
              ...e,
              name: sanitized.name !== undefined && sanitized.name !== '' ? sanitized.name : e.name,
            }
          : e,
      );
      this.currentListSignal.set(updatedList);
      this.persist();
    } else {
      this.api.updateShoppingItem(itemId, sanitized).subscribe((serverItem) => {
        // Catalogue
        const updatedItems = this.itemsSignal().map((i) => (i.id === itemId ? serverItem : i));
        this.itemsSignal.set(updatedItems);
        // Liste courante (synchroniser le nom)
        if (serverItem.name) {
          const updatedList = this.currentListSignal().map((e) =>
            e.itemId === itemId ? { ...e, name: serverItem.name } : e,
          );
          this.currentListSignal.set(updatedList);
        }
      });
    }
  }

  removeCatalogItem(itemId: string): void {
    if (this.useLocalStorageSignal()) {
      this.itemsSignal.set(this.itemsSignal().filter((i) => i.id !== itemId));
      this.currentListSignal.set(this.currentListSignal().filter((e) => e.itemId !== itemId));
      this.persist();
    } else {
      this.api.deleteShoppingItem(itemId).subscribe(() => {
        this.itemsSignal.set(this.itemsSignal().filter((i) => i.id !== itemId));
        this.currentListSignal.set(this.currentListSignal().filter((e) => e.itemId !== itemId));
      });
    }
  }

  addToCurrentList(itemId: string, quantity = 1): void {
    const item = this.itemsSignal().find((i) => i.id === itemId);
    if (!item) return;

    if (this.useLocalStorageSignal()) {
      const existing = this.currentListSignal().find((e) => e.itemId === itemId && !e.checked);
      if (existing) {
        const updated = this.currentListSignal().map((e) =>
          e.id === existing.id ? { ...e, quantity: e.quantity + quantity } : e,
        );
        this.currentListSignal.set(updated);
      } else {
        const entry: ShoppingListEntry = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2),
          itemId: item.id,
          name: item.name,
          quantity: Math.max(1, quantity),
          checked: false,
        };
        this.currentListSignal.set([entry, ...this.currentListSignal()]);
      }
      this.persist();
    } else {
      this.api.addShoppingEntry(itemId, quantity).subscribe((entry) => {
        // Si l'API a agrégé, remplacer/mettre à jour l'entrée
        const idx = this.currentListSignal().findIndex((e) => e.id === entry.id);
        if (idx !== -1) {
          const updated = [...this.currentListSignal()];
          updated[idx] = entry;
          this.currentListSignal.set(updated);
        } else {
          this.currentListSignal.set([entry, ...this.currentListSignal()]);
        }
      });
    }
  }

  updateQuantity(entryId: string, delta: number): void {
    const entry = this.currentListSignal().find((e) => e.id === entryId);
    if (!entry) return;
    const newQty = Math.max(1, entry.quantity + delta);
    if (this.useLocalStorageSignal()) {
      const updated = this.currentListSignal().map((e) => (e.id === entryId ? { ...e, quantity: newQty } : e));
      this.currentListSignal.set(updated);
      this.persist();
    } else {
      this.api.updateShoppingEntry(entryId, { quantity: newQty }).subscribe((updatedEntry) => {
        const updated = this.currentListSignal().map((e) => (e.id === entryId ? updatedEntry : e));
        this.currentListSignal.set(updated);
      });
    }
  }

  toggleChecked(entryId: string): void {
    const entry = this.currentListSignal().find((e) => e.id === entryId);
    if (!entry) return;
    const newChecked = !entry.checked;
    if (this.useLocalStorageSignal()) {
      const updated = this.currentListSignal().map((e) => (e.id === entryId ? { ...e, checked: newChecked } : e));
      this.currentListSignal.set(updated);
      this.persist();
    } else {
      this.api.updateShoppingEntry(entryId, { checked: newChecked }).subscribe((updatedEntry) => {
        const updated = this.currentListSignal().map((e) => (e.id === entryId ? updatedEntry : e));
        this.currentListSignal.set(updated);
      });
    }
  }

  removeFromCurrentList(entryId: string): void {
    if (this.useLocalStorageSignal()) {
      this.currentListSignal.set(this.currentListSignal().filter((e) => e.id !== entryId));
      this.persist();
    } else {
      this.api.deleteShoppingEntry(entryId).subscribe(() => {
        this.currentListSignal.set(this.currentListSignal().filter((e) => e.id !== entryId));
      });
    }
  }

  clearChecked(): void {
    if (this.useLocalStorageSignal()) {
      this.currentListSignal.set(this.currentListSignal().filter((e) => !e.checked));
      this.persist();
    } else {
      this.api.clearCheckedShoppingList().subscribe(() => {
        this.currentListSignal.set(this.currentListSignal().filter((e) => !e.checked));
      });
    }
  }

  clearAll(): void {
    if (this.useLocalStorageSignal()) {
      this.currentListSignal.set([]);
      this.persist();
    } else {
      this.api.clearAllShoppingList().subscribe(() => {
        this.currentListSignal.set([]);
      });
    }
  }
}
