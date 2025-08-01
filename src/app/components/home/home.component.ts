import {Component, computed, OnDestroy, OnInit, signal} from '@angular/core';
import {RouterModule} from '@angular/router';
import {DatePipe} from '@angular/common';
import {TaskListComponent} from '../task-list/task-list.component';
import {TaskFormComponent} from '../task-form/task-form.component';
import {Task} from '../../models/task.model';
import {TaskService} from '../../services/task.service';
import {NotificationService} from '../../services/notification.service';
import {BackgroundCheckService} from '../../services/background-check.service';

@Component({
  selector: 'app-home',
  imports: [RouterModule, DatePipe, TaskListComponent, TaskFormComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, OnDestroy {
  showTaskForm = signal(false);
  editingTask = signal<Task | undefined>(undefined);

  // Signaux calculés pour les tâches
  tasks = computed(() => this.taskService.tasks());
  overdueTasks = computed(() => this.taskService.overdueTasks());

  // Signaux pour le statut de vérification en arrière-plan
  isCheckingBackground = computed(() => this.backgroundCheckService.isCheckingBackground());
  lastBackgroundCheck = computed(() => this.backgroundCheckService.lastCheck());
  backgroundCheckInterval = computed(() => this.backgroundCheckService.checkIntervalMs());

  // Référence à la fonction pour pouvoir la supprimer
  private popstateHandler = (event: PopStateEvent) => {
    console.log('PopState event triggered, showTaskForm:', this.showTaskForm());
    if (this.showTaskForm()) {
      this.closeTaskFormFromBack();
    }
  };

  constructor(
    private taskService: TaskService,
    private notificationService: NotificationService,
    private backgroundCheckService: BackgroundCheckService
  ) {}

  ngOnInit(): void {
    // Écouter l'événement popstate pour fermer la modale
    window.addEventListener('popstate', this.popstateHandler);
  }

  showAddTaskForm(): void {
    this.editingTask.set(undefined);
    this.showTaskForm.set(true);
    // Ajouter un état dans l'historique pour la modale
    history.pushState({modal: true}, '');
  }

  showEditTaskForm(task: Task): void {
    this.editingTask.set(task);
    this.showTaskForm.set(true);
    // Ajouter un état dans l'historique pour la modale
    history.pushState({modal: true}, '');
  }

  onTaskSaved(task: Task): void {
    this.closeTaskForm();

    // Programmer la notification pour cette tâche
    this.notificationService.scheduleTaskReminder(task);
  }

  onTaskFormCancelled(): void {
    this.closeTaskForm();
  }

  closeTaskForm(): void {
    this.showTaskForm.set(false);
    this.editingTask.set(undefined);
    // Si on ferme manuellement, on revient dans l'historique
    if (history.state?.modal) {
      history.back();
    }
  }

  closeTaskFormFromBack(): void {
    // Fermeture via le bouton retour - pas besoin de modifier l'historique
    this.showTaskForm.set(false);
    this.editingTask.set(undefined);
  }

  editTask(task: Task): void {
    this.showEditTaskForm(task);
  }

  ngOnDestroy(): void {
    // Supprimer les écouteurs d'événements
    window.removeEventListener('popstate', this.popstateHandler);
  }
}
