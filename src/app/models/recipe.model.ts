export interface RecipeIngredient {
  itemId: string;
  name: string;
  quantity: number;
  unit?: string; // ex: "kg", "g", "ml", "tasses", etc.
}

export interface Recipe {
  id: string;
  title: string;
  description: string; // HTML content from rich text editor
  ingredients: RecipeIngredient[];
  servings?: number; // nombre de portions
  prepTime?: number; // temps de préparation en minutes
  cookTime?: number; // temps de cuisson en minutes
  category?: string; // ex: "Entrée", "Plat principal", "Dessert"
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRecipeData {
  title: string;
  description: string;
  ingredients: RecipeIngredient[];
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  category?: string;
}

export interface UpdateRecipeData {
  title?: string;
  description?: string;
  ingredients?: RecipeIngredient[];
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  category?: string;
}

// Types pour les Reactive Forms typés
import { FormControl, FormGroup } from '@angular/forms';

export type RecipeForm = FormGroup<{
  title: FormControl<string | null>;
  description: FormControl<string | null>;
  servings: FormControl<number | null>;
  prepTime: FormControl<number | null>;
  cookTime: FormControl<number | null>;
  category: FormControl<string | null>;
}>;

export type IngredientForm = FormGroup<{
  selectedItemId: FormControl<string | null>;
  quantity: FormControl<number | null>;
  unit: FormControl<string | null>;
}>;
