import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';

import {CommonModule} from '@angular/common';
import {CategoryService} from '../../services/category.service';
import {Category} from '../../models/category.model';
import {Router} from '@angular/router';

@Component({
  selector: 'app-category-management',
  templateUrl: './category-management.component.html',
  styleUrls: ['./category-management.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class CategoryManagementComponent implements OnInit {
  categories: Category[] = [];
  categoryForm: FormGroup;
  editingCategory: Category | null = null;
  showForm = false;

  constructor(
    private categoryService: CategoryService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.categoryForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      color: [''],
      icon: ['']
    });
  }

  private loadCategories(): void {
    this.categoryService.getCategories().subscribe(
      categories => this.categories = categories
    );
  }

  startEdit(category: Category): void {
    this.editingCategory = category;
    this.categoryForm.patchValue({
      name: category.name,
      description: category.description,
      color: category.color,
      icon: category.icon
    });
    this.showForm = true;
  }

  cancelEdit(): void {
    this.editingCategory = null;
    this.categoryForm.reset();
    this.showForm = false;
  }

  deleteCategory(category: Category): void {
    if (category.isDefault) {
      alert('Les catégories par défaut ne peuvent pas être supprimées.');
      return;
    }

    if (confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
      this.categoryService.deleteCategory(category.id).subscribe({
        next: () => {
          this.loadCategories();
        },
        error: (error) => {
          console.error('Erreur lors de la suppression de la catégorie:', error);
          alert('Erreur lors de la suppression de la catégorie');
        }
      });
    }
  }

  onSubmit(): void {
    if (this.categoryForm.invalid) {
      return;
    }

    const formValue = this.categoryForm.value;

    if (this.editingCategory) {
      this.categoryService.updateCategory(this.editingCategory.id, formValue).subscribe({
        next: () => {
          this.loadCategories();
          this.cancelEdit();
        },
        error: (error) => {
          console.error('Erreur lors de la mise à jour de la catégorie:', error);
          alert('Erreur lors de la mise à jour de la catégorie');
        }
      });
    } else {
      this.categoryService.createCategory(formValue).subscribe({
        next: () => {
          this.loadCategories();
          this.cancelEdit();
        },
        error: (error) => {
          console.error('Erreur lors de la création de la catégorie:', error);
          alert('Erreur lors de la création de la catégorie');
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}
