import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Task } from '../models/task.model';
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

  // Version asynchrone pour récupérer les tâches
  async getTasksAsync(): Promise<Task[]> {
    try {
      return (
        (await this.http
          .get<
            Task[]
          >(`${this.API_BASE_URL}/tasks`, { headers: this.getHeaders(), context: new HttpContext().set(SKIP_GLOBAL_LOADING, true) })
          .toPromise()) || []
      );
    } catch (error) {
      console.warn('Erreur lors de la récupération des tâches:', error);
      return [];
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

  // Récupérer toutes les tâches
  getTasks(silent = false): Observable<Task[]> {
    const context = silent ? new HttpContext().set(SKIP_GLOBAL_LOADING, true) : new HttpContext();
    return this.http.get<Task[]>(`${this.API_BASE_URL}/tasks`, { headers: this.getHeaders(), context }).pipe(
      tap((tasks) => this.convertDates(tasks)),
      catchError(this.handleError),
    );
  }

  // Créer une nouvelle tâche
  createTask(task: Omit<Task, 'id'>): Observable<Task> {
    return this.http.post<Task>(`${this.API_BASE_URL}/tasks`, task, { headers: this.getHeaders() }).pipe(
      tap((task) => this.convertDates([task])),
      catchError(this.handleError),
    );
  }

  // Mettre à jour une tâche
  updateTask(task: Task): Observable<Task> {
    return this.http.put<Task>(`${this.API_BASE_URL}/tasks/${task.id}`, task, { headers: this.getHeaders() }).pipe(
      tap((task) => this.convertDates([task])),
      catchError(this.handleError),
    );
  }

  // Supprimer une tâche
  deleteTask(taskId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.API_BASE_URL}/tasks/${taskId}`, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  // Marquer une tâche comme terminée
  completeTask(taskId: string): Observable<Task> {
    return this.http
      .post<Task>(`${this.API_BASE_URL}/tasks/${taskId}/complete`, {}, { headers: this.getHeaders() })
      .pipe(
        tap((task) => this.convertDates([task])),
        catchError(this.handleError),
      );
  }

  // Récupérer les tâches en retard
  getOverdueTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.API_BASE_URL}/tasks/overdue`, { headers: this.getHeaders() }).pipe(
      tap((tasks) => this.convertDates(tasks)),
      catchError(this.handleError),
    );
  }

  // Récupérer les tâches par catégorie
  getTasksByCategory(category: string): Observable<Task[]> {
    return this.http
      .get<
        Task[]
      >(`${this.API_BASE_URL}/tasks/category/${encodeURIComponent(category)}`, { headers: this.getHeaders() })
      .pipe(
        tap((tasks) => this.convertDates(tasks)),
        catchError(this.handleError),
      );
  }

  // ================= SHOPPING LIST =================
  getShoppingItems(): Observable<ShoppingItem[]> {
    return this.get<ShoppingItem[]>('/shopping/items');
  }

  createShoppingItem(name: string, category?: string): Observable<ShoppingItem> {
    return this.post<ShoppingItem>('/shopping/items', { name, category });
  }

  deleteShoppingItem(itemId: string): Observable<void> {
    return this.delete<void>(`/shopping/items/${itemId}`);
  }

  getShoppingList(): Observable<ShoppingListEntry[]> {
    return this.get<ShoppingListEntry[]>('/shopping/list');
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

  // Convertir les dates ISO en objets Date
  private convertDates(tasks: Task[]): void {
    tasks.forEach((task) => {
      if (task.nextDueDate) {
        task.nextDueDate = new Date(task.nextDueDate);
      }
      if (task.lastCompleted) {
        task.lastCompleted = new Date(task.lastCompleted);
      }
      if (task.history && Array.isArray(task.history)) {
        task.history = task.history.map((entry) => ({
          ...entry,
          date: new Date(entry.date as unknown as string),
        }));
      }
    });
  }

  // Gestion des erreurs
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Une erreur est survenue';

    if (error.error instanceof ErrorEvent) {
      // Erreur côté client
      errorMessage = `Erreur: ${error.error.message}`;
    } else {
      // Erreur côté serveur
      errorMessage = `Code d'erreur: ${error.status}, Message: ${error.message}`;
    }

    console.error('Erreur API:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
