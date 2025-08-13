import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Category } from '../models/category.model';
import { BehaviorSubject, map, Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private categories = new BehaviorSubject<Category[]>([]);
  categories$ = this.categories.asObservable();

  private api = inject(ApiService);
  constructor() {
    this.loadCategories();
  }

  private loadCategories(): void {
    this.api.get<Category[]>('/categories').subscribe((categories) => this.categories.next(categories));
  }

  getCategories(): Observable<Category[]> {
    return this.categories$;
  }

  getCategory(id: string): Observable<Category | undefined> {
    return this.categories$.pipe(map((categories) => categories.find((cat) => cat.id === id)));
  }

  createCategory(category: Omit<Category, 'id'>): Observable<Category> {
    return this.api.post<Category>('/categories', category).pipe(
      tap((newCategory) => {
        const currentCategories = this.categories.value;
        this.categories.next([...currentCategories, newCategory]);
      }),
    );
  }

  updateCategory(id: string, category: Partial<Category>): Observable<Category> {
    return this.api.put<Category>(`/categories/${id}`, category).pipe(
      tap((updatedCategory) => {
        const currentCategories = this.categories.value;
        const index = currentCategories.findIndex((cat) => cat.id === id);
        if (index !== -1) {
          currentCategories[index] = updatedCategory;
          this.categories.next([...currentCategories]);
        }
      }),
    );
  }

  deleteCategory(id: string): Observable<void> {
    return this.api.delete<void>(`/categories/${id}`).pipe(
      tap(() => {
        const currentCategories = this.categories.value;
        this.categories.next(currentCategories.filter((cat) => cat.id !== id));
      }),
    );
  }
}
