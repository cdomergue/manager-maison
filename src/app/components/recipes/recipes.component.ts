import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { form, Field, submit, required, min, minLength, FieldTree } from '@angular/forms/signals';
import { RecipeService } from '../../services/recipe.service';
import { ShoppingListService } from '../../services/shopping-list.service';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';
import { AutocompleteComponent, AutocompleteOption } from '../autocomplete/autocomplete.component';
import { Recipe, RecipeIngredient, CreateRecipeData } from '../../models/recipe.model';

interface RecipeFormModel {
  title: string;
  description: string;
  servings: number;
  prepTime: number;
  cookTime: number;
  category: string;
}

interface IngredientFormModel {
  selectedItemId: string;
  quantity: number;
  unit: string;
}

@Component({
  selector: 'app-recipes',
  imports: [CommonModule, RichTextEditorComponent, AutocompleteComponent, Field],
  templateUrl: './recipes.component.html',
})
export class RecipesComponent {
  private recipeService = inject(RecipeService);
  private shoppingService = inject(ShoppingListService);

  private newRecipeModel = signal<RecipeFormModel>({
    title: '',
    description: '',
    servings: 0,
    prepTime: 0,
    cookTime: 0,
    category: '',
  });
  newRecipeForm: FieldTree<RecipeFormModel> = form(this.newRecipeModel, (p) => {
    required(p.title);
    minLength(p.title, 2);
  });

  private editRecipeModel = signal<RecipeFormModel>({
    title: '',
    description: '',
    servings: 0,
    prepTime: 0,
    cookTime: 0,
    category: '',
  });
  editRecipeForm: FieldTree<RecipeFormModel> = form(this.editRecipeModel, (p) => {
    required(p.title);
    minLength(p.title, 2);
  });

  private ingredientModel = signal<IngredientFormModel>({ selectedItemId: '', quantity: 1, unit: '' });
  ingredientForm: FieldTree<IngredientFormModel> = form(this.ingredientModel, (p) => {
    required(p.selectedItemId);
    min(p.quantity, 0.1);
  });

  // State signals
  newRecipeIngredients = signal<RecipeIngredient[]>([]);
  editingId = signal<string | null>(null);
  editIngredients = signal<RecipeIngredient[]>([]);
  searchTerm = signal<string>('');
  selectedCategory = signal<string>('');

  recipes = this.recipeService.recipes;
  shoppingItems = this.shoppingService.items;

  // Options pour l'autocomplete
  autocompleteOptions = computed((): AutocompleteOption[] => {
    return this.availableItems().map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
    }));
  });

  // Computed properties
  filteredRecipes = computed(() => {
    let recipes = this.recipes();

    const search = this.searchTerm().toLowerCase().trim();
    if (search) {
      recipes = recipes.filter(
        (recipe) =>
          recipe.title.toLowerCase().includes(search) ||
          recipe.category?.toLowerCase().includes(search) ||
          recipe.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(search)),
      );
    }

    const category = this.selectedCategory();
    if (category) {
      recipes = recipes.filter((recipe) => recipe.category === category);
    }

    return recipes;
  });

  categories = computed(() => {
    const cats = new Set<string>();
    this.recipes().forEach((recipe) => {
      if (recipe.category) cats.add(recipe.category);
    });
    return Array.from(cats).sort();
  });

  availableItems = computed(() => {
    return this.shoppingItems().filter(
      (item) => !this.getCurrentIngredients().some((ingredient) => ingredient.itemId === item.id),
    );
  });

  private getCurrentIngredients(): RecipeIngredient[] {
    return this.editingId() ? this.editIngredients() : this.newRecipeIngredients();
  }

  private setCurrentIngredients(ingredients: RecipeIngredient[]): void {
    if (this.editingId()) {
      this.editIngredients.set(ingredients);
    } else {
      this.newRecipeIngredients.set(ingredients);
    }
  }

  // Recipe CRUD operations
  createRecipe(): void {
    submit(this.newRecipeForm, async () => {
      if (this.newRecipeIngredients().length === 0) return;

      const m = this.newRecipeModel();
      const recipeData: CreateRecipeData = {
        title: m.title.trim(),
        description: m.description || '',
        ingredients: this.newRecipeIngredients(),
        servings: m.servings || undefined,
        prepTime: m.prepTime || undefined,
        cookTime: m.cookTime || undefined,
        category: m.category || undefined,
      };

      this.recipeService.create(recipeData);
      this.resetNewRecipeForm();

      try {
        const panel = document.querySelector('details') as HTMLDetailsElement | null;
        if (panel) panel.open = false;
      } catch {
        // ignore
      }
    });
  }

  private resetNewRecipeForm(): void {
    this.newRecipeModel.set({ title: '', description: '', servings: 0, prepTime: 0, cookTime: 0, category: '' });
    this.newRecipeForm().reset();
    this.newRecipeIngredients.set([]);
    this.ingredientModel.set({ selectedItemId: '', quantity: 1, unit: '' });
    this.ingredientForm().reset();
  }

  startEdit(recipe: Recipe): void {
    this.editingId.set(recipe.id);
    this.editRecipeModel.set({
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings || 0,
      prepTime: recipe.prepTime || 0,
      cookTime: recipe.cookTime || 0,
      category: recipe.category || '',
    });
    this.editRecipeForm().reset();
    this.editIngredients.set([...recipe.ingredients]);
  }

  saveEdit(): void {
    submit(this.editRecipeForm, async () => {
      const id = this.editingId();
      if (!id) return;

      const m = this.editRecipeModel();
      this.recipeService.update(id, {
        title: m.title,
        description: m.description,
        ingredients: this.editIngredients(),
        servings: m.servings || undefined,
        prepTime: m.prepTime || undefined,
        cookTime: m.cookTime || undefined,
        category: m.category || undefined,
      });

      this.cancelEdit();
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editRecipeModel.set({ title: '', description: '', servings: 0, prepTime: 0, cookTime: 0, category: '' });
    this.editRecipeForm().reset();
    this.editIngredients.set([]);
  }

  removeRecipe(id: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette recette ?')) {
      this.recipeService.remove(id);
    }
  }

  // Ingredient management
  addIngredient(): void {
    submit(this.ingredientForm, async () => {
      const m = this.ingredientModel();
      const itemId = m.selectedItemId;
      const quantity = m.quantity;

      const item = this.shoppingItems().find((item) => item.id === itemId);
      if (!item) return;

      const ingredient: RecipeIngredient = {
        itemId: item.id,
        name: item.name,
        quantity,
        unit: m.unit || undefined,
      };

      const currentIngredients = this.getCurrentIngredients();
      this.setCurrentIngredients([...currentIngredients, ingredient]);

      this.ingredientModel.set({ selectedItemId: '', quantity: 1, unit: '' });
      this.ingredientForm().reset();
    });
  }

  onIngredientSelected(option: AutocompleteOption): void {
    this.ingredientModel.update((m) => ({ ...m, selectedItemId: option.id }));
  }

  removeIngredient(index: number): void {
    const currentIngredients = this.getCurrentIngredients();
    const updated = currentIngredients.filter((_, i) => i !== index);
    this.setCurrentIngredients(updated);
  }

  updateIngredientQuantity(index: number, quantity: number): void {
    if (quantity <= 0) return;

    const currentIngredients = this.getCurrentIngredients();
    const updated = currentIngredients.map((ingredient, i) => (i === index ? { ...ingredient, quantity } : ingredient));
    this.setCurrentIngredients(updated);
  }

  updateIngredientUnit(index: number, unit: string): void {
    const currentIngredients = this.getCurrentIngredients();
    const updated = currentIngredients.map((ingredient, i) =>
      i === index ? { ...ingredient, unit: unit || undefined } : ingredient,
    );
    this.setCurrentIngredients(updated);
  }

  // Shopping list integration
  addRecipeToShoppingList(recipeId: string): void {
    this.recipeService.addRecipeToShoppingList(recipeId);
  }

  // Utility methods
  refresh(): void {
    this.recipeService.refresh();
  }

  formatTime(minutes?: number): string {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}min` : `${hours}h`;
  }
}
