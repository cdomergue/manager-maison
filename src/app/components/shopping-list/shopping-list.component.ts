import {Component, computed, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ShoppingListService} from '../../services/shopping-list.service';

@Component({
  selector: 'app-shopping-list',
  imports: [CommonModule, FormsModule],
  templateUrl: 'shopping-list.component.html',
  styleUrls: ['shopping-list.component.css']
})
export class ShoppingListComponent {
  newItemName = signal<string>('');
  newItemCategory = signal<string>('');
  search = signal<string>('');

  constructor(public shopping: ShoppingListService) {}

  filteredCatalog = computed(() => {
    const term = this.search().toLowerCase().trim();
    const items = this.shopping.items();
    if (!term) return items;
    return items.filter(i => i.name.toLowerCase().includes(term) || i.category?.toLowerCase().includes(term));
  });

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
}


