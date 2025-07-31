import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Task } from '../models/task.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // URL AWS Lambda en production, local en développement
  private readonly API_BASE_URL = this.getApiBaseUrl();
  private connectionStatus = new BehaviorSubject<boolean>(false);
  private serverStatus = new BehaviorSubject<any>(null);

  constructor(private http: HttpClient) {
    this.checkServerStatus();
  }

  // Déterminer l'URL de l'API selon l'environnement
  private getApiBaseUrl(): string {
    // En production (Amplify), utiliser Lambda
    if (window.location.hostname.includes('amplifyapp.com')) {
      return 'https://4cj8nou7ce.execute-api.eu-west-1.amazonaws.com/prod/api';
    }
    // En local, utiliser l'API relative
    return '/api';
  }

  // Vérifier le statut du serveur
  checkServerStatus(): void {
    this.http.get<any>(`${this.API_BASE_URL}/status`)
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
      const status = await this.http.get<any>(`${this.API_BASE_URL}/status`).toPromise();
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
      return await this.http.get<Task[]>(`${this.API_BASE_URL}/tasks`).toPromise() || [];
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

  // Récupérer toutes les tâches
  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.API_BASE_URL}/tasks`)
      .pipe(
        tap(tasks => this.convertDates(tasks)),
        catchError(this.handleError)
      );
  }

  // Créer une nouvelle tâche
  createTask(task: Omit<Task, 'id'>): Observable<Task> {
    return this.http.post<Task>(`${this.API_BASE_URL}/tasks`, task)
      .pipe(
        tap(task => this.convertDates([task])),
        catchError(this.handleError)
      );
  }

  // Mettre à jour une tâche
  updateTask(task: Task): Observable<Task> {
    return this.http.put<Task>(`${this.API_BASE_URL}/tasks/${task.id}`, task)
      .pipe(
        tap(task => this.convertDates([task])),
        catchError(this.handleError)
      );
  }

  // Supprimer une tâche
  deleteTask(taskId: string): Observable<void> {
    return this.http.delete<void>(`${this.API_BASE_URL}/tasks/${taskId}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Marquer une tâche comme terminée
  completeTask(taskId: string): Observable<Task> {
    return this.http.post<Task>(`${this.API_BASE_URL}/tasks/${taskId}/complete`, {})
      .pipe(
        tap(task => this.convertDates([task])),
        catchError(this.handleError)
      );
  }

  // Récupérer les tâches en retard
  getOverdueTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.API_BASE_URL}/tasks/overdue`)
      .pipe(
        tap(tasks => this.convertDates(tasks)),
        catchError(this.handleError)
      );
  }

  // Récupérer les tâches par catégorie
  getTasksByCategory(category: string): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.API_BASE_URL}/tasks/category/${encodeURIComponent(category)}`)
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