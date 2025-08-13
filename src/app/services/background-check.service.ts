import { inject, Injectable, signal } from '@angular/core';
import { Task } from '../models/task.model';
import { TaskService } from './task.service';
import { ApiService } from './api.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class BackgroundCheckService {
  private isChecking = signal(false);
  private lastCheckTime = signal<Date | null>(null);
  private checkInterval = signal(300000); // 5 minutes par défaut
  private intervalId: number | null = null;
  private lastNotifiedOverdueTasks = new Set<string>(); // IDs des tâches en retard déjà notifiées

  // Signaux publics
  readonly isCheckingBackground = this.isChecking.asReadonly();
  readonly lastCheck = this.lastCheckTime.asReadonly();
  readonly checkIntervalMs = this.checkInterval.asReadonly();

  private taskService = inject(TaskService);
  private apiService = inject(ApiService);
  private notificationService = inject(NotificationService);

  constructor() {
    this.initializeBackgroundCheck();
  }

  private initializeBackgroundCheck(): void {
    // Démarrer la vérification périodique
    this.startPeriodicCheck();

    // Écouter les changements de visibilité de la page
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page cachée : réduire la fréquence à 1 appel par heure
        this.setCheckInterval(3600000); // 1 heure
      } else {
        // Page visible : fréquence normale
        this.setCheckInterval(300000); // 5 minutes
        // Vérifier immédiatement
        this.checkForNewTasks();
      }
    });

    // Écouter les événements de focus/blur
    window.addEventListener('focus', () => {
      this.checkForNewTasks();
    });

    // Écouter les événements de réseau
    window.addEventListener('online', () => {
      this.checkForNewTasks();
    });
  }

  startPeriodicCheck(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = window.setInterval(() => {
      this.checkForNewTasks();
    }, this.checkInterval());
  }

  stopPeriodicCheck(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isChecking.set(false);
  }

  setCheckInterval(intervalMs: number): void {
    this.checkInterval.set(intervalMs);
    this.startPeriodicCheck();
  }

  async checkForNewTasks(): Promise<void> {
    if (this.isChecking()) return;

    this.isChecking.set(true);

    try {
      // Vérifier si le serveur est accessible
      const isConnected = await this.apiService.checkServerStatusAsync();

      if (isConnected) {
        // Récupérer les tâches depuis l'API
        const apiTasks = await this.apiService.getTasksAsync();
        const currentTasks = this.taskService.tasks();

        // Comparer pour détecter les nouvelles tâches
        const newTasks = this.detectNewTasks(currentTasks, apiTasks);

        if (newTasks.length > 0) {
          // Notifier les nouvelles tâches
          this.notifyNewTasks(newTasks);

          // Mettre à jour le service de tâches
          this.taskService.refreshTasks(true);
        }

        // Vérifier les tâches en retard
        const overdueTasks = apiTasks.filter((task) => task.isActive && new Date(task.nextDueDate) < new Date());

        // Ne notifier que s'il y a des nouvelles tâches en retard
        if (overdueTasks.length > 0) {
          const currentOverdueIds = new Set(overdueTasks.map((task) => task.id));

          // Vérifier s'il y a de nouvelles tâches en retard depuis la dernière notification
          const hasNewOverdueTasks = overdueTasks.some((task) => !this.lastNotifiedOverdueTasks.has(task.id));

          if (hasNewOverdueTasks) {
            this.notificationService.showOverdueNotification(overdueTasks);
            this.lastNotifiedOverdueTasks = currentOverdueIds;
          }
        } else {
          // S'il n'y a plus de tâches en retard, vider la liste des notifications
          this.lastNotifiedOverdueTasks.clear();
        }
      }
    } catch (error) {
      console.warn('Erreur lors de la vérification en arrière-plan:', error);
    } finally {
      this.isChecking.set(false);
      this.lastCheckTime.set(new Date());
    }
  }

  private detectNewTasks(currentTasks: Task[], apiTasks: Task[]): Task[] {
    const currentIds = new Set(currentTasks.map((task) => task.id));
    return apiTasks.filter((task) => !currentIds.has(task.id));
  }

  private notifyNewTasks(newTasks: Task[]): void {
    if (newTasks.length === 1) {
      this.notificationService.showNewTaskNotification(newTasks[0]);
    } else if (newTasks.length > 1) {
      this.notificationService.showMultipleNewTasksNotification(newTasks);
    }
  }

  // Méthode pour forcer une vérification manuelle
  async forceCheck(): Promise<void> {
    await this.checkForNewTasks();
  }

  // Méthode pour obtenir le statut du service
  getStatus(): {
    isChecking: boolean;
    lastCheck: Date | null;
    interval: number;
    isOnline: boolean;
  } {
    return {
      isChecking: this.isChecking(),
      lastCheck: this.lastCheckTime(),
      interval: this.checkInterval(),
      isOnline: navigator.onLine,
    };
  }
}
