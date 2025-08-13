import {computed, inject, Injectable, signal} from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {Observable, of} from 'rxjs';
import {Task} from '../models/task.model';
import {ApiService} from './api.service';
import {StorageService} from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  // Signaux pour la gestion des tâches
  private tasksSignal = signal<Task[]>([]);
  private useLocalStorageSignal = signal(false);

  // Signaux publics en lecture seule
  readonly tasks = this.tasksSignal.asReadonly();
  readonly useLocalStorage = this.useLocalStorageSignal.asReadonly();

  // Signaux calculés pour les filtres
  readonly activeTasks = computed(() =>
    this.tasksSignal().filter(task => task.isActive)
  );

  readonly overdueTasks = computed(() => {
    const now = new Date();
    return this.tasksSignal().filter(task =>
      task.isActive && new Date(task.nextDueDate) < now
    );
  });

  // Observable pour la compatibilité avec le code existant
  readonly tasks$ = toObservable(this.tasks);

  private readonly STORAGE_KEY = 'household_tasks';
  private apiService = inject(ApiService);
  private storageService = inject(StorageService);

  constructor() {
    this.initializeService();
  }

  private initializeService(): void {
    // Vérifier d'abord si le serveur est disponible avec un délai
    setTimeout(() => {
      this.apiService.getConnectionStatus().subscribe(isConnected => {
        if (isConnected) {
          this.useLocalStorageSignal.set(false);
          // Charger les données depuis l'API
          this.loadTasksFromAPI();
        } else {
          this.useLocalStorageSignal.set(true);
          // Charger depuis localStorage seulement si le serveur n'est pas disponible
          this.loadTasksFromLocalStorage();
        }
      });
    }, 1000); // Attendre 1 seconde pour laisser l'API se connecter
  }

  // Méthodes pour charger les tâches
  private loadTasksFromAPI(silent = false): void {
    this.apiService.getTasks(silent).subscribe({
      next: (tasks) => {
        this.tasksSignal.set(tasks);
      },
      error: (error) => {
        console.error('Erreur lors du chargement depuis l\'API:', error);
        // Fallback vers localStorage
        this.useLocalStorageSignal.set(true);
        this.loadTasksFromLocalStorage();
      }
    });
  }

  private loadTasksFromLocalStorage(): void {
    const stored = this.storageService.getItem<Task[]>(this.STORAGE_KEY);
    if (stored) {
      try {
        const tasks = stored.map((task: Task) => ({
          ...task,
          nextDueDate: new Date(task.nextDueDate),
          lastCompleted: task.lastCompleted ? new Date(task.lastCompleted) : undefined
        }));
        this.tasksSignal.set(tasks);
      } catch (error) {
        console.error('Erreur lors du chargement depuis localStorage:', error);
      }
    }
  }

  // Méthodes pour sauvegarder les tâches
  private saveTasksToLocalStorage(): void {
    this.storageService.setItem(this.STORAGE_KEY, this.tasksSignal());
  }

  // Méthode pour forcer le rechargement des tâches
  refreshTasks(silent = false): void {
    if (this.useLocalStorageSignal()) {
      this.loadTasksFromLocalStorage();
    } else {
      this.loadTasksFromAPI(silent);
    }
  }

  // Méthodes CRUD avec signaux
  addTask(task: Omit<Task, 'id'>): void {
    if (this.useLocalStorageSignal()) {
      const newTask: Task = {
        ...task,
        id: this.generateId(),
        isActive: true
      };

      const currentTasks = this.tasksSignal();
      this.tasksSignal.set([...currentTasks, newTask]);
      this.saveTasksToLocalStorage();
    } else {
      this.apiService.createTask(task).subscribe({
        next: (newTask) => {
          const currentTasks = this.tasksSignal();
          this.tasksSignal.set([...currentTasks, newTask]);
        },
        error: (error) => {
          console.error('Erreur lors de la création de la tâche:', error);
          // Fallback vers localStorage en cas d'erreur
          this.useLocalStorageSignal.set(true);
          this.addTask(task);
        }
      });
    }
  }

  updateTask(task: Task): void {
    if (this.useLocalStorageSignal()) {
      const currentTasks = this.tasksSignal();
      const index = currentTasks.findIndex(t => t.id === task.id);

      if (index !== -1) {
        const updatedTasks = [...currentTasks];
        updatedTasks[index] = task;
        this.tasksSignal.set(updatedTasks);
        this.saveTasksToLocalStorage();
      }
    } else {
      this.apiService.updateTask(task).subscribe({
        next: (updatedTask) => {
          const currentTasks = this.tasksSignal();
          const index = currentTasks.findIndex(t => t.id === task.id);
          if (index !== -1) {
            const updatedTasks = [...currentTasks];
            updatedTasks[index] = updatedTask;
            this.tasksSignal.set(updatedTasks);
          }
        },
        error: (error) => {
          console.error('Erreur lors de la mise à jour de la tâche:', error);
          // Fallback vers localStorage
          this.useLocalStorageSignal.set(true);
          this.updateTask(task);
        }
      });
    }
  }

  deleteTask(taskId: string): void {
    if (this.useLocalStorageSignal()) {
      const currentTasks = this.tasksSignal();
      const filteredTasks = currentTasks.filter(t => t.id !== taskId);
      this.tasksSignal.set(filteredTasks);
      this.saveTasksToLocalStorage();
    } else {
      this.apiService.deleteTask(taskId).subscribe({
        next: () => {
          const currentTasks = this.tasksSignal();
          const filteredTasks = currentTasks.filter(t => t.id !== taskId);
          this.tasksSignal.set(filteredTasks);
        },
        error: (error) => {
          console.error('Erreur lors de la suppression de la tâche:', error);
          // Fallback vers localStorage
          this.useLocalStorageSignal.set(true);
          this.deleteTask(taskId);
        }
      });
    }
  }

  completeTask(taskId: string): void {
    if (this.useLocalStorageSignal()) {
      const currentTasks = this.tasksSignal();
      const task = currentTasks.find(t => t.id === taskId);

      if (task) {
        const updatedTask = {
          ...task,
          lastCompleted: new Date(),
          nextDueDate: this.calculateNextDueDate(task),
          isActive: true // Réactiver la tâche
        };
        const updatedTasks = currentTasks.map(t => t.id === taskId ? updatedTask : t);
        this.tasksSignal.set(updatedTasks);
        this.saveTasksToLocalStorage();
      }
    } else {
      this.apiService.completeTask(taskId).subscribe({
        next: (updatedTask) => {
          const currentTasks = this.tasksSignal();
          const index = currentTasks.findIndex(t => t.id === taskId);
          if (index !== -1) {
            const updatedTasks = [...currentTasks];
            updatedTasks[index] = updatedTask;
            this.tasksSignal.set(updatedTasks);
          }
        },
        error: (error) => {
          console.error('Erreur lors de la complétion de la tâche:', error);
          // Fallback vers localStorage
          this.useLocalStorageSignal.set(true);
          this.completeTask(taskId);
        }
      });
    }
  }

  // Méthodes pour les requêtes spécialisées (compatibilité)
  getTasksByCategory(category: string): Observable<Task[]> {
    if (this.useLocalStorageSignal()) {
      return of(this.tasksSignal().filter(task => task.category === category));
    } else {
      return this.apiService.getTasksByCategory(category);
    }
  }

  getOverdueTasks(): Observable<Task[]> {
    if (this.useLocalStorageSignal()) {
      return of(this.overdueTasks());
    } else {
      return this.apiService.getOverdueTasks();
    }
  }

  // Méthodes utilitaires
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private calculateNextDueDate(task: Task): Date {
    const now = new Date();
    const nextDate = new Date(now);

    switch (task.frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'custom':
        nextDate.setDate(nextDate.getDate() + (task.customDays || 1));
        break;
    }

    return nextDate;
  }
}
