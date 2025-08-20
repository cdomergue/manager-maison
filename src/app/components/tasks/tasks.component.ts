import { Component, computed, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TaskListComponent } from '../task-list/task-list.component';
import { TaskFormComponent } from '../task-form/task-form.component';
import { Task } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-tasks',
  imports: [RouterModule, TaskListComponent, TaskFormComponent],
  templateUrl: './tasks.component.html',
})
export class TasksComponent implements OnInit {
  // Signaux calculés pour les tâches
  tasks = computed(() => this.taskService.tasks());

  private taskService = inject(TaskService);
  private notificationService = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  // Signal pour la tâche à mettre en surbrillance
  highlightedTaskId = signal<string | null>(null);

  ngOnInit(): void {
    // Écouter les changements de fragment pour mettre en surbrillance une tâche
    this.route.fragment.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((fragment) => {
      if (fragment) {
        this.highlightedTaskId.set(fragment);
        // Scroll vers la tâche après un petit délai pour s'assurer que le DOM est mis à jour
        setTimeout(() => {
          this.scrollToTask(fragment);
        }, 100);
      } else {
        this.highlightedTaskId.set(null);
      }
    });
  }

  onTaskSaved(task: Task): void {
    // Fermer le panneau d'expansion après création
    try {
      const panel = document.querySelector('details') as HTMLDetailsElement | null;
      if (panel) panel.open = false;
    } catch {
      // ignore
    }

    // Programmer la notification pour cette tâche
    this.notificationService.scheduleTaskReminder(task);
  }

  onTaskFormCancelled(): void {
    // Méthode conservée pour l'annulation du formulaire de création
  }

  refreshTasks(): void {
    this.taskService.refreshTasks();
  }

  private scrollToTask(taskId: string): void {
    const element = document.querySelector(`[data-task-id="${taskId}"]`);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      // Optionnel : ajouter une animation flash pour attirer l'attention
      element.classList.add('animate-pulse');
      setTimeout(() => {
        element.classList.remove('animate-pulse');
      }, 2000);
    }
  }
}
