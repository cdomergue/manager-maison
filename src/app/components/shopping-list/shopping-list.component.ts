import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShoppingListService } from '../../services/shopping-list.service';

@Component({
  selector: 'app-shopping-list',
  imports: [CommonModule, FormsModule],
  templateUrl: 'shopping-list.component.html',
})
export class ShoppingListComponent {
  newItemName = signal<string>('');
  newItemCategory = signal<string>('');
  search = signal<string>('');
  editingId = signal<string | null>(null);
  editName = signal<string>('');
  editCategory = signal<string>('');
  autoRefresh = signal<boolean>(false);

  public shopping = inject(ShoppingListService);

  sortedCurrentList = computed(() => {
    const list = this.shopping.currentList();
    return [...list].sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1; // non cochés d'abord
      const an = (a.name || '').toLocaleLowerCase();
      const bn = (b.name || '').toLocaleLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    });
  });

  private filteredCatalog = computed(() => {
    const term = this.search().toLowerCase().trim();
    const items = this.shopping.items();
    if (!term) return items;
    return items.filter((i) => i.name.toLowerCase().includes(term) || i.category?.toLowerCase().includes(term));
  });

  sortedFilteredCatalog = computed(() => {
    const items = this.filteredCatalog();
    return [...items].sort((a, b) => {
      const ac = (a.category ?? '\uFFFF').toLocaleLowerCase();
      const bc = (b.category ?? '\uFFFF').toLocaleLowerCase();
      if (ac < bc) return -1;
      if (ac > bc) return 1;
      const an = (a.name || '').toLocaleLowerCase();
      const bn = (b.name || '').toLocaleLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    });
  });

  groupedFilteredCatalog = computed(() => {
    const items = this.sortedFilteredCatalog();
    const groups: { key: string; label: string; items: typeof items }[] = [];
    let currentKey: string | null = null;
    let currentGroup: { key: string; label: string; items: typeof items } | null = null;
    for (const item of items) {
      const rawCategory = item.category ?? '';
      const key = rawCategory.toLocaleLowerCase() || '\uFFFF';
      if (key !== currentKey) {
        currentKey = key;
        currentGroup = {
          key,
          label: rawCategory || 'Sans catégorie',
          items: [],
        };
        groups.push(currentGroup);
      }
      currentGroup!.items.push(item);
    }
    return groups;
  });

  constructor() {
    effect((onCleanup) => {
      const enabled = this.autoRefresh();
      const api = this.shopping.isUsingApi();
      if (!enabled || !api) return;
      const id = setInterval(() => this.shopping.refreshFromApi(), 2000);
      onCleanup(() => clearInterval(id));
    });
  }

  addCatalogItem(): void {
    const name = this.newItemName();
    const category = this.newItemCategory();
    if (!name.trim()) return;
    this.shopping.addCatalogItem(name, category);
    this.newItemName.set('');
    this.newItemCategory.set('');
  }

  addToList(itemId: string): void {
    this.shopping.addToCurrentList(itemId, 1);
  }

  startEdit(itemId: string): void {
    const item = this.shopping.items().find((i) => i.id === itemId);
    if (!item) return;
    this.editingId.set(itemId);
    this.editName.set(item.name);
    this.editCategory.set(item.category || '');
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editName.set('');
    this.editCategory.set('');
  }

  saveEdit(): void {
    const id = this.editingId();
    if (!id) return;
    this.shopping.updateCatalogItem(id, { name: this.editName(), category: this.editCategory() });
    this.cancelEdit();
  }

  inc(entryId: string): void {
    this.shopping.updateQuantity(entryId, 1);
  }

  dec(entryId: string): void {
    this.shopping.updateQuantity(entryId, -1);
  }

  toggle(entryId: string): void {
    this.shopping.toggleChecked(entryId);
  }

  remove(entryId: string): void {
    this.shopping.removeFromCurrentList(entryId);
  }

  toggleAutoRefresh(): void {
    this.autoRefresh.update((v) => !v);
  }
}
