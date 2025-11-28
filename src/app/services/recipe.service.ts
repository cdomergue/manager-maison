import { inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { ShoppingListService } from './shopping-list.service';
import { CreateRecipeData, Recipe, UpdateRecipeData } from '../models/recipe.model';

@Injectable({ providedIn: 'root' })
export class RecipeService {
  private recipesSignal = signal<Recipe[]>([]);
  private useLocalStorageSignal = signal(false);

  readonly recipes = this.recipesSignal.asReadonly();
  readonly recipes$ = toObservable(this.recipes);
  readonly useLocalStorage = this.useLocalStorageSignal.asReadonly();

  private readonly STORAGE_KEY = 'shared_recipes';
  private api = inject(ApiService);
  private storage = inject(StorageService);
  private shoppingService = inject(ShoppingListService);

  constructor() {
    setTimeout(() => {
      this.api.getConnectionStatus().subscribe((isConnected) => {
        if (isConnected) {
          this.useLocalStorageSignal.set(false);
          this.loadFromAPI();
        } else {
          this.useLocalStorageSignal.set(true);
          this.loadFromLocal();
        }
      });
    }, 500);
  }

  refresh(): void {
    if (this.useLocalStorageSignal()) this.loadFromLocal();
    else this.loadFromAPI();
  }

  private loadFromAPI(): void {
    this.api.getRecipes().subscribe({
      next: (recipes) => {
        // normalize dates
        const normalized = (recipes as Recipe[]).map((r) => ({
          ...r,
          createdAt: new Date((r as Recipe & { createdAt: string }).createdAt),
          updatedAt: new Date((r as Recipe & { updatedAt: string }).updatedAt),
        }));
        this.recipesSignal.set(normalized);
      },
      error: () => {
        this.useLocalStorageSignal.set(true);
        this.loadFromLocal();
      },
    });
  }

  private loadFromLocal(): void {
    const stored = this.storage.getItem<Recipe[]>(this.STORAGE_KEY);
    if (stored) {
      // Convert string dates to Date objects
      const recipes = stored.map((recipe) => ({
        ...recipe,
        createdAt: new Date(recipe.createdAt),
        updatedAt: new Date(recipe.updatedAt),
      }));
      this.recipesSignal.set(recipes);
    }
  }

  private saveLocal(): void {
    this.storage.setItem(this.STORAGE_KEY, this.recipesSignal());
  }

  create(recipeData: CreateRecipeData): void {
    if (this.useLocalStorageSignal()) {
      const newRecipe: Recipe = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        title: recipeData.title,
        description: recipeData.description,
        ingredients: recipeData.ingredients,
        servings: recipeData.servings,
        prepTime: recipeData.prepTime,
        cookTime: recipeData.cookTime,
        category: recipeData.category,
        ownerId: localStorage.getItem('current_user') || 'anonymous',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.recipesSignal.set([newRecipe, ...this.recipesSignal()]);
      this.saveLocal();
    } else {
      this.api.createRecipe(recipeData).subscribe({
        next: (created) => {
          const r = created as Recipe & { createdAt: string; updatedAt: string };
          const normalized: Recipe = {
            ...r,
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt),
          };
          this.recipesSignal.set([normalized, ...this.recipesSignal()]);
        },
        error: () => {
          this.useLocalStorageSignal.set(true);
          this.create(recipeData);
        },
      });
    }
  }

  update(id: string, data: UpdateRecipeData): void {
    if (this.useLocalStorageSignal()) {
      const updated = this.recipesSignal().map((recipe) =>
        recipe.id === id ? { ...recipe, ...data, updatedAt: new Date() } : recipe,
      );
      this.recipesSignal.set(updated);
      this.saveLocal();
    } else {
      this.api.updateRecipe(id, data).subscribe({
        next: (serverRecipe) => {
          const s = serverRecipe as Recipe & { createdAt: string; updatedAt: string };
          const normalized: Recipe = {
            ...s,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
          };
          const updated = this.recipesSignal().map((recipe) => (recipe.id === id ? normalized : recipe));
          this.recipesSignal.set(updated);
        },
        error: () => {
          this.useLocalStorageSignal.set(true);
          this.update(id, data);
        },
      });
    }
  }

  remove(id: string): void {
    if (this.useLocalStorageSignal()) {
      this.recipesSignal.set(this.recipesSignal().filter((recipe) => recipe.id !== id));
      this.saveLocal();
    } else {
      this.api.deleteRecipe(id).subscribe({
        next: () => this.recipesSignal.set(this.recipesSignal().filter((recipe) => recipe.id !== id)),
        error: () => {
          this.useLocalStorageSignal.set(true);
          this.remove(id);
        },
      });
    }
  }

  // Add all ingredients of a recipe to the shopping list
  addRecipeToShoppingList(recipeId: string): void {
    const recipe = this.recipesSignal().find((r) => r.id === recipeId);
    if (!recipe) return;

    // Add each ingredient to the shopping list
    recipe.ingredients.forEach((ingredient) => {
      this.shoppingService.addToCurrentList(ingredient.itemId, ingredient.quantity);
    });
  }

  // Get a recipe by ID
  getRecipeById(id: string): Recipe | undefined {
    return this.recipesSignal().find((recipe) => recipe.id === id);
  }

  // Search recipes by title or category
  searchRecipes(searchTerm: string): Recipe[] {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return this.recipesSignal();

    return this.recipesSignal().filter(
      (recipe) =>
        recipe.title.toLowerCase().includes(term) ||
        recipe.category?.toLowerCase().includes(term) ||
        recipe.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(term)),
    );
  }
}
