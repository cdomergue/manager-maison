import { computed, inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, of } from 'rxjs';
import { Assignee, Task, TaskHistoryEntry } from '../models/task.model';
import { RRule, RRuleSet, rrulestr } from 'rrule';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  // Signaux pour la gestion des tâches
  private tasksSignal = signal<Task[]>([]);
  private useLocalStorageSignal = signal(false);

  // Signaux publics en lecture seule
  readonly tasks = this.tasksSignal.asReadonly();
  readonly useLocalStorage = this.useLocalStorageSignal.asReadonly();

  // Signaux calculés pour les filtres
  readonly activeTasks = computed(() => this.tasksSignal().filter((task) => task.isActive));

  readonly overdueTasks = computed(() => {
    const now = new Date();
    return this.tasksSignal().filter((task) => task.isActive && new Date(task.nextDueDate) < now);
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
      this.apiService.getConnectionStatus().subscribe((isConnected) => {
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
        console.error("Erreur lors du chargement depuis l'API:", error);
        // Fallback vers localStorage
        this.useLocalStorageSignal.set(true);
        this.loadTasksFromLocalStorage();
      },
    });
  }

  private loadTasksFromLocalStorage(): void {
    const stored = this.storageService.getItem<Task[]>(this.STORAGE_KEY);
    if (stored) {
      try {
        const tasks = stored.map((task: Task) => ({
          ...task,
          nextDueDate: new Date(task.nextDueDate),
          lastCompleted: task.lastCompleted ? new Date(task.lastCompleted) : undefined,
          history: this.parseHistory((task as unknown as { history?: { date: string; author: Assignee }[] }).history),
        }));
        this.tasksSignal.set(tasks);
      } catch (error) {
        console.error('Erreur lors du chargement depuis localStorage:', error);
      }
    }
  }

  private parseHistory(history: unknown): TaskHistoryEntry[] {
    if (!Array.isArray(history)) return [];
    return history.map((entry) => {
      const e = entry as { date: string | Date; author: Assignee };
      const dateValue = e.date instanceof Date ? e.date : new Date(e.date);
      return { date: dateValue, author: e.author } as TaskHistoryEntry;
    });
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
        isActive: true,
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
        },
      });
    }
  }

  updateTask(task: Task): void {
    if (this.useLocalStorageSignal()) {
      const currentTasks = this.tasksSignal();
      const index = currentTasks.findIndex((t) => t.id === task.id);

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
          const index = currentTasks.findIndex((t) => t.id === task.id);
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
        },
      });
    }
  }

  deleteTask(taskId: string): void {
    if (this.useLocalStorageSignal()) {
      const currentTasks = this.tasksSignal();
      const filteredTasks = currentTasks.filter((t) => t.id !== taskId);
      this.tasksSignal.set(filteredTasks);
      this.saveTasksToLocalStorage();
    } else {
      this.apiService.deleteTask(taskId).subscribe({
        next: () => {
          const currentTasks = this.tasksSignal();
          const filteredTasks = currentTasks.filter((t) => t.id !== taskId);
          this.tasksSignal.set(filteredTasks);
        },
        error: (error) => {
          console.error('Erreur lors de la suppression de la tâche:', error);
          // Fallback vers localStorage
          this.useLocalStorageSignal.set(true);
          this.deleteTask(taskId);
        },
      });
    }
  }

  completeTask(taskId: string): void {
    if (this.useLocalStorageSignal()) {
      const currentTasks = this.tasksSignal();
      const task = currentTasks.find((t) => t.id === taskId);

      if (task) {
        const author = (localStorage.getItem('current_user') as Assignee) || task.assignee;
        const updatedTask = {
          ...task,
          lastCompleted: new Date(),
          nextDueDate: this.calculateNextDueDate(task),
          isActive: true, // Réactiver la tâche
          history: [...(task.history || []), { date: new Date(), author }],
        };
        const updatedTasks = currentTasks.map((t) => (t.id === taskId ? updatedTask : t));
        this.tasksSignal.set(updatedTasks);
        this.saveTasksToLocalStorage();
      }
    } else {
      this.apiService.completeTask(taskId).subscribe({
        next: (updatedTask) => {
          const currentTasks = this.tasksSignal();
          const index = currentTasks.findIndex((t) => t.id === taskId);
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
        },
      });
    }
  }

  // Méthodes pour les requêtes spécialisées (compatibilité)
  getTasksByCategory(category: string): Observable<Task[]> {
    if (this.useLocalStorageSignal()) {
      return of(this.tasksSignal().filter((task) => task.category === category));
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
    const base = new Date();

    // Si une RRULE est définie, elle prime sur la fréquence simple
    if (task.rrule) {
      return this.computeNextWithRRule(task, base);
    }

    // Sinon, logique simple existante
    const nextDate = new Date(base);
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

    return this.skipExcludedDates(nextDate, task);
  }

  private computeNextWithRRule(task: Task, fromDate: Date): Date {
    try {
      const set = new RRuleSet();
      // Base: parser la RRULE utilisateur
      const rule = rrulestr(task.rrule!, { forceset: false }) as RRule;
      // Ancrer l'itération après la dernière complétion (si dispo) sinon après fromDate
      const after = task.lastCompleted ? new Date(task.lastCompleted) : new Date(fromDate);
      after.setSeconds(after.getSeconds() + 1);

      set.rrule(rule);
      // Exceptions explicites
      (task.exDates || []).forEach((iso) => {
        const d = new Date(iso);
        if (!isNaN(d.getTime())) set.exdate(d);
      });

      // Exclure jours fériés connus
      // On exclut pour +/- 2 ans autour de la date de départ
      const startYear = after.getFullYear() - 1;
      const endYear = after.getFullYear() + 2;
      for (let y = startYear; y <= endYear; y++) {
        [
          `${y}-01-01`,
          `${y}-05-01`,
          `${y}-05-08`,
          `${y}-07-14`,
          `${y}-08-15`,
          `${y}-11-01`,
          `${y}-11-11`,
          `${y}-12-25`,
        ].forEach((s) => set.exdate(new Date(`${s}T00:00:00.000Z`)));
      }

      const next = set.after(after, true);
      return next ? next : this.skipExcludedDates(new Date(fromDate), task);
    } catch {
      return this.skipExcludedDates(new Date(fromDate), task);
    }
  }

  // Ancien parser conservé uniquement si besoin futur
  // private parseRRule(...) supprimé au profit de rrule

  private nextByDayAfter(from: Date, byDays: number[], includeToday = false): Date {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    if (!includeToday) {
      start.setDate(start.getDate() + 1);
    }

    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (byDays.includes(d.getDay())) {
        return d;
      }
    }
    return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  private nthWeekdayOfMonth(year: number, monthIndex0: number, weekday: number, n: number): Date {
    const firstOfMonth = new Date(year, monthIndex0, 1);
    const firstWeekday = firstOfMonth.getDay();
    const offset = (weekday - firstWeekday + 7) % 7;
    const day = 1 + offset + (n - 1) * 7;
    return new Date(year, monthIndex0, day);
  }

  private skipExcludedDates(date: Date, task: Task): Date {
    const d = new Date(date);
    while (this.isExcluded(d, task)) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  private isExcluded(date: Date, task: Task): boolean {
    return this.isHolidayFrance(date) || this.isExceptionDate(date, task.exDates || []);
  }

  private isExceptionDate(date: Date, exceptions: string[]): boolean {
    if (!exceptions || exceptions.length === 0) return false;
    const yyyyMmDd = date.toISOString().split('T')[0];
    return exceptions.some((iso) => iso.startsWith(yyyyMmDd));
  }

  private isHolidayFrance(date: Date): boolean {
    const [, monthStr, dayStr] = date.toISOString().split('T')[0].split('-');
    const mmdd = `${monthStr}-${dayStr}`;
    const fixed = new Set([
      '01-01',
      '05-01',
      '05-08',
      '07-14',
      '08-15',
      '11-01',
      '11-11',
      '12-25',
    ]);
    if (fixed.has(mmdd)) return true;
    return false;
  }
}
