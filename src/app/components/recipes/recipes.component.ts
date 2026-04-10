import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { RecipeService } from '../../services/recipe.service';
import { ShoppingListService } from '../../services/shopping-list.service';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';
import { AutocompleteComponent, AutocompleteOption } from '../autocomplete/autocomplete.component';
import { Recipe, RecipeIngredient, CreateRecipeData, RecipeForm, IngredientForm } from '../../models/recipe.model';

@Component({
  selector: 'app-recipes',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RichTextEditorComponent, AutocompleteComponent],
  templateUrl: './recipes.component.html',
})
export class RecipesComponent {
  private recipeService = inject(RecipeService);
  private shoppingService = inject(ShoppingListService);
  private fb = inject(FormBuilder);

  // Reactive Forms typés
  newRecipeForm: RecipeForm;
  editRecipeForm: RecipeForm;
  ingredientForm: IngredientForm;

  // State signals
  newRecipeIngredients = signal<RecipeIngredient[]>([]);
  editingId = signal<string | null>(null);
  editIngredients = signal<RecipeIngredient[]>([]);
  searchTerm = signal<string>('');
  selectedCategory = signal<string>('');

  recipes = this.recipeService.recipes;
  shoppingItems = this.shoppingService.items;

  constructor() {
    this.newRecipeForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      servings: [null as number | null],
      prepTime: [null as number | null],
      cookTime: [null as number | null],
      category: [''],
    });

    this.editRecipeForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      servings: [null as number | null],
      prepTime: [null as number | null],
      cookTime: [null as number | null],
      category: [''],
    });

    this.ingredientForm = this.fb.group({
      selectedItemId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.1)]],
      unit: [''],
    });
  }

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
    if (this.newRecipeForm.invalid || this.newRecipeIngredients().length === 0) {
      this.newRecipeForm.markAllAsTouched();
      return;
    }

    const formValue = this.newRecipeForm.value;
    const recipeData: CreateRecipeData = {
      title: formValue.title!.trim(),
      description: formValue.description || '',
      ingredients: this.newRecipeIngredients(),
      servings: formValue.servings || undefined,
      prepTime: formValue.prepTime || undefined,
      cookTime: formValue.cookTime || undefined,
      category: formValue.category || undefined,
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
    this.newRecipeForm.reset();
    this.newRecipeIngredients.set([]);
    this.ingredientForm.reset({
      selectedItemId: '',
      quantity: 1,
      unit: '',
    });
  }

  startEdit(recipe: Recipe): void {
    this.editingId.set(recipe.id);
    this.editRecipeForm.patchValue({
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings || null,
      prepTime: recipe.prepTime || null,
      cookTime: recipe.cookTime || null,
      category: recipe.category || '',
    });
    this.editIngredients.set([...recipe.ingredients]);
  }

  saveEdit(): void {
    const id = this.editingId();
    if (!id || this.editRecipeForm.invalid) {
      this.editRecipeForm.markAllAsTouched();
      return;
    }

    const formValue = this.editRecipeForm.value;
    this.recipeService.update(id, {
      title: formValue.title!,
      description: formValue.description!,
      ingredients: this.editIngredients(),
      servings: formValue.servings || undefined,
      prepTime: formValue.prepTime || undefined,
      cookTime: formValue.cookTime || undefined,
      category: formValue.category || undefined,
    });

    this.cancelEdit();
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editRecipeForm.reset();
    this.editIngredients.set([]);
  }

  removeRecipe(id: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette recette ?')) {
      this.recipeService.remove(id);
    }
  }

  // Ingredient management
  addIngredient(): void {
    if (this.ingredientForm.invalid) {
      this.ingredientForm.markAllAsTouched();
      return;
    }

    const formValue = this.ingredientForm.value;
    const itemId = formValue.selectedItemId!;
    const quantity = formValue.quantity!;

    const item = this.shoppingItems().find((item) => item.id === itemId);
    if (!item) return;

    const ingredient: RecipeIngredient = {
      itemId: item.id,
      name: item.name,
      quantity,
      unit: formValue.unit || undefined,
    };

    const currentIngredients = this.getCurrentIngredients();
    this.setCurrentIngredients([...currentIngredients, ingredient]);

    // Reset ingredient form
    this.ingredientForm.reset({
      selectedItemId: '',
      quantity: 1,
      unit: '',
    });
  }

  onIngredientSelected(option: AutocompleteOption): void {
    this.ingredientForm.patchValue({ selectedItemId: option.id });
  }

  clearIngredientForm(): void {
    this.ingredientForm.reset({
      selectedItemId: '',
      quantity: 1,
      unit: '',
    });
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
