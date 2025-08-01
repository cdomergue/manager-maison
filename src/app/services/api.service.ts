import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpHeaders} from '@angular/common/http';
import {BehaviorSubject, Observable, throwError} from 'rxjs';
import {catchError, tap} from 'rxjs/operators';
import {Task} from '../models/task.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // URL AWS Lambda en production, local en développement
  private readonly API_BASE_URL = this.getApiBaseUrl();
  private readonly YOU_KNOW_WHAT = '21cdf2c38551';
  private connectionStatus = new BehaviorSubject<boolean>(false);
  private serverStatus = new BehaviorSubject<any>(null);

  constructor(private http: HttpClient) {
    this.checkServerStatus();
  }

  // Créer les headers avec le truc spécial
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Secret-Key': this.YOU_KNOW_WHAT
    });
  }

  // Déterminer l'URL de l'API selon l'environnement
  private getApiBaseUrl(): string {
    // En local (localhost), utiliser l'API relative vers le serveur local
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return '/api';
    }
    // En production (Amplify ou autre), utiliser Lambda
    return 'https://4cj8nou7ce.execute-api.eu-west-1.amazonaws.com/prod/api';
  }

  // Vérifier le statut du serveur
  checkServerStatus(): void {
    this.http.get<any>(`${this.API_BASE_URL}/status`, {headers: this.getHeaders()})
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (status) => {
          this.connectionStatus.next(true);
          this.serverStatus.next(status);
        },
        error: (error) => {
          console.warn('Serveur non accessible:', error);
          this.connectionStatus.next(false);
          this.serverStatus.next(null);
        }
      });
  }

  // Version asynchrone pour la vérification en arrière-plan
  async checkServerStatusAsync(): Promise<boolean> {
    try {
      const status = await this.http.get<any>(`${this.API_BASE_URL}/status`, {headers: this.getHeaders()}).toPromise();
      this.connectionStatus.next(true);
      this.serverStatus.next(status);
      return true;
    } catch (error) {
      this.connectionStatus.next(false);
      this.serverStatus.next(null);
      return false;
    }
  }

  // Version asynchrone pour récupérer les tâches
  async getTasksAsync(): Promise<Task[]> {
    try {
      return await this.http.get<Task[]>(`${this.API_BASE_URL}/tasks`, {headers: this.getHeaders()}).toPromise() || [];
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
  getServerStatus(): Observable<any> {
    return this.serverStatus.asObservable();
  }

  // Méthodes HTTP génériques
  get<T>(path: string): Observable<T> {
    return this.http.get<T>(`${this.API_BASE_URL}${path}`, {headers: this.getHeaders()})
      .pipe(catchError(this.handleError));
  }

  post<T>(path: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.API_BASE_URL}${path}`, body, {headers: this.getHeaders()})
      .pipe(catchError(this.handleError));
  }

  put<T>(path: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.API_BASE_URL}${path}`, body, {headers: this.getHeaders()})
      .pipe(catchError(this.handleError));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.API_BASE_URL}${path}`, {headers: this.getHeaders()})
      .pipe(catchError(this.handleError));
  }

  // Récupérer toutes les tâches
  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.API_BASE_URL}/tasks`, {headers: this.getHeaders()})
      .pipe(
        tap(tasks => this.convertDates(tasks)),
        catchError(this.handleError)
      );
  }

  // Créer une nouvelle tâche
  createTask(task: Omit<Task, 'id'>): Observable<Task> {
    return this.http.post<Task>(`${this.API_BASE_URL}/tasks`, task, {headers: this.getHeaders()})
      .pipe(
        tap(task => this.convertDates([task])),
        catchError(this.handleError)
      );
  }

  // Mettre à jour une tâche
  updateTask(task: Task): Observable<Task> {
    return this.http.put<Task>(`${this.API_BASE_URL}/tasks/${task.id}`, task, {headers: this.getHeaders()})
      .pipe(
        tap(task => this.convertDates([task])),
        catchError(this.handleError)
      );
  }

  // Supprimer une tâche
  deleteTask(taskId: string): Observable<void> {
    return this.http.delete<void>(`${this.API_BASE_URL}/tasks/${taskId}`, {headers: this.getHeaders()})
      .pipe(
        catchError(this.handleError)
      );
  }

  // Marquer une tâche comme terminée
  completeTask(taskId: string): Observable<Task> {
    return this.http.post<Task>(`${this.API_BASE_URL}/tasks/${taskId}/complete`, {}, {headers: this.getHeaders()})
      .pipe(
        tap(task => this.convertDates([task])),
        catchError(this.handleError)
      );
  }

  // Récupérer les tâches en retard
  getOverdueTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.API_BASE_URL}/tasks/overdue`, {headers: this.getHeaders()})
      .pipe(
        tap(tasks => this.convertDates(tasks)),
        catchError(this.handleError)
      );
  }

  // Récupérer les tâches par catégorie
  getTasksByCategory(category: string): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.API_BASE_URL}/tasks/category/${encodeURIComponent(category)}`, {headers: this.getHeaders()})
      .pipe(
        tap(tasks => this.convertDates(tasks)),
        catchError(this.handleError)
      );
  }

  // Convertir les dates ISO en objets Date
  private convertDates(tasks: Task[]): void {
    tasks.forEach(task => {
      if (task.nextDueDate) {
        task.nextDueDate = new Date(task.nextDueDate);
      }
      if (task.lastCompleted) {
        task.lastCompleted = new Date(task.lastCompleted);
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
