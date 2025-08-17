import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecipeService } from '../../services/recipe.service';
import { ShoppingListService } from '../../services/shopping-list.service';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';
import { AutocompleteComponent, AutocompleteOption } from '../autocomplete/autocomplete.component';
import { Recipe, RecipeIngredient, CreateRecipeData } from '../../models/recipe.model';

@Component({
  selector: 'app-recipes',
  imports: [CommonModule, FormsModule, RichTextEditorComponent, AutocompleteComponent],
  templateUrl: './recipes.component.html',
})
export class RecipesComponent {
  private recipeService = inject(RecipeService);
  private shoppingService = inject(ShoppingListService);

  // State for new recipe creation
  newRecipeTitle = signal<string>('');
  newRecipeDescription = signal<string>('');
  newRecipeServings = signal<number | undefined>(undefined);
  newRecipePrepTime = signal<number | undefined>(undefined);
  newRecipeCookTime = signal<number | undefined>(undefined);
  newRecipeCategory = signal<string>('');
  newRecipeIngredients = signal<RecipeIngredient[]>([]);

  // State for editing
  editingId = signal<string | null>(null);
  editTitle = signal<string>('');
  editDescription = signal<string>('');
  editServings = signal<number | undefined>(undefined);
  editPrepTime = signal<number | undefined>(undefined);
  editCookTime = signal<number | undefined>(undefined);
  editCategory = signal<string>('');
  editIngredients = signal<RecipeIngredient[]>([]);

  // Search and filters
  searchTerm = signal<string>('');
  selectedCategory = signal<string>('');

  // Ingredient selection
  selectedItemId = signal<string>('');
  ingredientQuantity = signal<number>(1);
  ingredientUnit = signal<string>('');

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

    // Filter by search term
    const search = this.searchTerm().toLowerCase().trim();
    if (search) {
      recipes = recipes.filter(
        (recipe) =>
          recipe.title.toLowerCase().includes(search) ||
          recipe.category?.toLowerCase().includes(search) ||
          recipe.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(search)),
      );
    }

    // Filter by category
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
    const title = this.newRecipeTitle().trim();
    const description = this.newRecipeDescription();

    if (!title || this.newRecipeIngredients().length === 0) return;

    const recipeData: CreateRecipeData = {
      title,
      description,
      ingredients: this.newRecipeIngredients(),
      servings: this.newRecipeServings(),
      prepTime: this.newRecipePrepTime(),
      cookTime: this.newRecipeCookTime(),
      category: this.newRecipeCategory() || undefined,
    };

    this.recipeService.create(recipeData);
    this.resetNewRecipeForm();

    // Close the expansion panel
    try {
      const panel = document.querySelector('details') as HTMLDetailsElement | null;
      if (panel) panel.open = false;
    } catch {
      // ignore
    }
  }

  private resetNewRecipeForm(): void {
    this.newRecipeTitle.set('');
    this.newRecipeDescription.set('');
    this.newRecipeServings.set(undefined);
    this.newRecipePrepTime.set(undefined);
    this.newRecipeCookTime.set(undefined);
    this.newRecipeCategory.set('');
    this.newRecipeIngredients.set([]);
    this.selectedItemId.set('');
    this.ingredientQuantity.set(1);
    this.ingredientUnit.set('');
  }

  startEdit(recipe: Recipe): void {
    this.editingId.set(recipe.id);
    this.editTitle.set(recipe.title);
    this.editDescription.set(recipe.description);
    this.editServings.set(recipe.servings);
    this.editPrepTime.set(recipe.prepTime);
    this.editCookTime.set(recipe.cookTime);
    this.editCategory.set(recipe.category || '');
    this.editIngredients.set([...recipe.ingredients]);
  }

  saveEdit(): void {
    const id = this.editingId();
    if (!id) return;

    this.recipeService.update(id, {
      title: this.editTitle(),
      description: this.editDescription(),
      ingredients: this.editIngredients(),
      servings: this.editServings(),
      prepTime: this.editPrepTime(),
      cookTime: this.editCookTime(),
      category: this.editCategory() || undefined,
    });

    this.cancelEdit();
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editTitle.set('');
    this.editDescription.set('');
    this.editServings.set(undefined);
    this.editPrepTime.set(undefined);
    this.editCookTime.set(undefined);
    this.editCategory.set('');
    this.editIngredients.set([]);
  }

  removeRecipe(id: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette recette ?')) {
      this.recipeService.remove(id);
    }
  }

  // Ingredient management
  addIngredient(): void {
    const itemId = this.selectedItemId();
    const quantity = this.ingredientQuantity();

    if (!itemId || quantity <= 0) return;

    const item = this.shoppingItems().find((item) => item.id === itemId);
    if (!item) return;

    const ingredient: RecipeIngredient = {
      itemId: item.id,
      name: item.name,
      quantity,
      unit: this.ingredientUnit() || undefined,
    };

    const currentIngredients = this.getCurrentIngredients();
    this.setCurrentIngredients([...currentIngredients, ingredient]);

    // Reset ingredient form
    this.selectedItemId.set('');
    this.ingredientQuantity.set(1);
    this.ingredientUnit.set('');
  }

  onIngredientSelected(option: AutocompleteOption): void {
    this.selectedItemId.set(option.id);
  }

  clearIngredientForm(): void {
    this.selectedItemId.set('');
    this.ingredientQuantity.set(1);
    this.ingredientUnit.set('');
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
