export interface ShoppingItem {
  id: string;
  name: string;
  category?: string;
}

export interface ShoppingListEntry {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  checked: boolean;
}


