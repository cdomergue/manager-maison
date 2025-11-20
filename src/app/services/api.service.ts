import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ShoppingItem, ShoppingListEntry } from '../models/shopping-item.model';
import { SKIP_GLOBAL_LOADING } from '../http/http-context.tokens';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  // URL AWS Lambda en production, local en développement
  private readonly API_BASE_URL = this.getApiBaseUrl();
  private readonly YOU_KNOW_WHAT = '21cdf2c38551';
  private connectionStatus = new BehaviorSubject<boolean>(false);
  private serverStatus = new BehaviorSubject<unknown | null>(null);

  private http = inject(HttpClient);
  constructor() {
    this.checkServerStatus();
  }

  // Créer les headers avec le truc spécial
  private getHeaders(): HttpHeaders {
    const userId = this.getCurrentUserIdSafely();
    const base = {
      'Content-Type': 'application/json',
      'X-Secret-Key': this.YOU_KNOW_WHAT,
    } as Record<string, string>;
    if (userId) base['X-User-Id'] = userId;
    return new HttpHeaders(base);
  }

  private getCurrentUserIdSafely(): string | null {
    try {
      // Lecture directe du localStorage où UserService persiste l'utilisateur courant
      return localStorage.getItem('current_user');
    } catch {
      return null;
    }
  }

  // Déterminer l'URL de l'API selon l'environnement
  private getApiBaseUrl(): string {
    return environment.apiUrl;
  }

  // Vérifier le statut du serveur
  checkServerStatus(): void {
    this.http
      .get<unknown>(`${this.API_BASE_URL}/status`, {
        headers: this.getHeaders(),
        context: new HttpContext().set(SKIP_GLOBAL_LOADING, true),
      })
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (status: unknown) => {
          this.connectionStatus.next(true);
          this.serverStatus.next(status);
        },
        error: () => {
          console.warn('Serveur non accessible');
          this.connectionStatus.next(false);
          this.serverStatus.next(null);
        },
      });
  }

  // Version asynchrone pour la vérification en arrière-plan
  async checkServerStatusAsync(): Promise<boolean> {
    try {
      const status = await this.http
        .get<unknown>(`${this.API_BASE_URL}/status`, {
          headers: this.getHeaders(),
          context: new HttpContext().set(SKIP_GLOBAL_LOADING, true),
        })
        .toPromise();
      this.connectionStatus.next(true);
      this.serverStatus.next(status ?? null);
      return true;
    } catch {
      this.connectionStatus.next(false);
      this.serverStatus.next(null);
      return false;
    }
  }

  // Obtenir le statut de connexion
  getConnectionStatus(): Observable<boolean> {
    return this.connectionStatus.asObservable();
  }

  // Obtenir le statut du serveur
  getServerStatus(): Observable<unknown | null> {
    return this.serverStatus.asObservable();
  }

  // Méthodes HTTP génériques
  get<T>(path: string): Observable<T> {
    return this.http
      .get<T>(`${this.API_BASE_URL}${path}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<T>(`${this.API_BASE_URL}${path}`, body, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .put<T>(`${this.API_BASE_URL}${path}`, body, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<T>(`${this.API_BASE_URL}${path}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // ================= SHOPPING LIST =================
  getShoppingItems(): Observable<ShoppingItem[]> {
    return this.get<ShoppingItem[]>('/shopping/items');
  }

  createShoppingItem(name: string, category?: string): Observable<ShoppingItem> {
    return this.post<ShoppingItem>('/shopping/items', { name, category });
  }

  updateShoppingItem(itemId: string, data: Partial<Pick<ShoppingItem, 'name' | 'category'>>): Observable<ShoppingItem> {
    return this.put<ShoppingItem>(`/shopping/items/${itemId}`, data);
  }

  deleteShoppingItem(itemId: string): Observable<void> {
    return this.delete<void>(`/shopping/items/${itemId}`);
  }

  getShoppingList(): Observable<ShoppingListEntry[]> {
    return this.get<ShoppingListEntry[]>('/shopping/list');
  }

  async getShoppingItemsAsync(): Promise<ShoppingItem[]> {
    try {
      const response = await this.http
        .get<ShoppingItem[]>(`${this.API_BASE_URL}/shopping/items`, {
          headers: this.getHeaders(),
        })
        .toPromise();
      return response || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des items de courses:', error);
      throw error;
    }
  }

  async getShoppingListAsync(): Promise<ShoppingListEntry[]> {
    try {
      const response = await this.http
        .get<ShoppingListEntry[]>(`${this.API_BASE_URL}/shopping/list`, {
          headers: this.getHeaders(),
        })
        .toPromise();
      return response || [];
    } catch (error) {
      console.error('Erreur lors de la récupération de la liste de courses:', error);
      throw error;
    }
  }

  addShoppingEntry(itemId: string, quantity: number): Observable<ShoppingListEntry> {
    return this.post<ShoppingListEntry>('/shopping/list', { itemId, quantity });
  }

  updateShoppingEntry(
    entryId: string,
    data: Partial<Pick<ShoppingListEntry, 'quantity' | 'checked'>>,
  ): Observable<ShoppingListEntry> {
    return this.put<ShoppingListEntry>(`/shopping/list/${entryId}`, data);
  }

  deleteShoppingEntry(entryId: string): Observable<void> {
    return this.delete<void>(`/shopping/list/${entryId}`);
  }

  clearCheckedShoppingList(): Observable<void> {
    return this.post<void>('/shopping/list/clear-checked', {});
  }

  clearAllShoppingList(): Observable<void> {
    return this.delete<void>('/shopping/list');
  }

  // ================= NOTES =================
  getNotes(): Observable<unknown[]> {
    return this.get<unknown[]>('/notes');
  }

  async getNotesAsync(): Promise<unknown[]> {
    try {
      const response = await this.http
        .get<unknown[]>(`${this.API_BASE_URL}/notes`, {
          headers: this.getHeaders(),
        })
        .toPromise();
      return response || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des notes:', error);
      throw error;
    }
  }

  getNote(id: string): Observable<unknown> {
    return this.get<unknown>(`/notes/${id}`);
  }

  createNote(payload: { title: string; content: string }): Observable<unknown> {
    return this.post<unknown>('/notes', payload);
  }

  updateNote(id: string, payload: Partial<{ title: string; content: string }>): Observable<unknown> {
    return this.put<unknown>(`/notes/${id}`, payload);
  }

  deleteNote(id: string): Observable<void> {
    return this.delete<void>(`/notes/${id}`);
  }

  // partage supprimé

  // ================= RECIPES =================
  getRecipes(): Observable<unknown[]> {
    return this.get<unknown[]>('/recipes');
  }

  async getRecipesAsync(): Promise<unknown[]> {
    try {
      const response = await this.http
        .get<unknown[]>(`${this.API_BASE_URL}/recipes`, {
          headers: this.getHeaders(),
        })
        .toPromise();
      return response || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des recettes:', error);
      throw error;
    }
  }

  createRecipe(payload: unknown): Observable<unknown> {
    return this.post<unknown>('/recipes', payload);
  }

  updateRecipe(id: string, payload: unknown): Observable<unknown> {
    return this.put<unknown>(`/recipes/${id}`, payload);
  }

  deleteRecipe(id: string): Observable<void> {
    return this.delete<void>(`/recipes/${id}`);
  }

  // Gestion des erreurs
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Une erreur est survenue';

    if (error.error instanceof ErrorEvent) {
      // Erreur côté client
      errorMessage = `Erreur: ${error.error.message}`;
    } else {
      // Erreur côté serveur
      const status = error.status || 'unknown';
      const statusText = error.statusText || 'unknown';
      const errorBody = error.error || {};

      errorMessage = `Code d'erreur: ${status}, Message: ${statusText}`;

      // Logger plus de détails pour les erreurs 500
      if (status === 500) {
        console.error('Erreur 500 - Détails:', {
          url: error.url,
          status,
          statusText,
          error: errorBody,
          headers: error.headers,
        });

        // Si le body contient un message d'erreur, l'ajouter
        if (typeof errorBody === 'object' && errorBody.message) {
          errorMessage += ` - ${errorBody.message}`;
        } else if (typeof errorBody === 'string') {
          errorMessage += ` - ${errorBody}`;
        }
      }
    }

    console.error('Erreur API:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}
