import {Component, computed, OnDestroy, OnInit, output, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Task, TaskCategory} from '../../models/task.model';
import {TaskService} from '../../services/task.service';
import {NotificationService} from '../../services/notification.service';
import {Subscription} from 'rxjs';
import {TaskDetailComponent} from '../task-detail/task-detail.component';

@Component({
  selector: 'app-task-list',
  imports: [CommonModule, FormsModule, TaskDetailComponent],
  templateUrl: './task-list.component.html',
  styleUrls: ['./task-list.component.css']
})
export class TaskListComponent implements OnInit, OnDestroy {
  selectedTask = signal<Task | null>(null);
  // Événement pour signaler qu'une tâche doit être éditée
  editTaskEvent = output<Task>();

  // Signaux pour les filtres
  selectedCategory = signal<string>('all');
  selectedPriority = signal<string>('all');

  searchTerm = signal<string>('');

  // Référence à la fonction pour pouvoir la supprimer
  private popstateHandler = () => {
    if (this.selectedTask()) {
      this.closeTaskDetailsFromBack();
    }
  };

  // Signaux calculés pour les tâches filtrées et triées
  filteredTasks = computed(() => {
    const tasks = this.taskService.tasks();
    const category = this.selectedCategory();
    const priority = this.selectedPriority();
    const search = this.searchTerm();


    // Filtrer d'abord les tâches
    const filtered = tasks.filter(task => {
      const matchesCategory = category === 'all' || (task.category && task.category === category);
      const matchesPriority = priority === 'all' || task.priority === priority;
      const matchesSearch = !search ||
        task.name.toLowerCase().includes(search.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(search.toLowerCase()));


      return matchesCategory && matchesPriority && matchesSearch;
    });

    // Trier les tâches par date d'échéance
    return filtered.sort((a, b) => {
      const now = new Date();
      const dateA = new Date(a.nextDueDate);
      const dateB = new Date(b.nextDueDate);
      const isOverdueA = dateA < now;
      const isOverdueB = dateB < now;

      // Si les deux tâches sont en retard, trier par la plus en retard d'abord
      if (isOverdueA && isOverdueB) {
        return dateA.getTime() - dateB.getTime();
      }
      // Si une seule tâche est en retard, la mettre en premier
      if (isOverdueA) return -1;
      if (isOverdueB) return 1;
      // Pour les tâches non en retard, trier par date la plus proche
      return dateA.getTime() - dateB.getTime();
    });
  });

  // Signaux calculés pour les statistiques
  totalTasks = computed(() => this.taskService.tasks().length);
  activeTasksCount = computed(() => this.taskService.activeTasks().length);
  overdueTasksCount = computed(() => this.taskService.overdueTasks().length);

  categories = Object.values(TaskCategory);
  priorities = [
    { value: 'low', label: 'Basse', color: 'text-green-600' },
    { value: 'medium', label: 'Moyenne', color: 'text-yellow-600' },
    { value: 'high', label: 'Haute', color: 'text-red-600' }
  ];

  private subscription: Subscription = new Subscription();

  constructor(
    private taskService: TaskService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    // Écouter les événements de notification
    window.addEventListener('taskCompleted', ((event: CustomEvent) => {
      this.completeTask(event.detail.taskId);
    }) as EventListener);

    // Écouter l'événement popstate pour fermer la modale
    window.addEventListener('popstate', this.popstateHandler);

    // Forcer le rechargement après un délai pour s'assurer que l'API est connectée
    setTimeout(() => {
      this.taskService.refreshTasks();
    }, 2000);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    // Supprimer les écouteurs d'événements
    window.removeEventListener('popstate', this.popstateHandler);
  }

  completeTask(taskId: string): void {
    this.taskService.completeTask(taskId);
  }

  deleteTask(taskId: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
      this.taskService.deleteTask(taskId);
    }
  }

  toggleTaskActive(task: Task): void {
    task.isActive = !task.isActive;
    this.taskService.updateTask(task);
  }

  getPriorityColor(priority: string): string {
    const priorityObj = this.priorities.find(p => p.value === priority);
    return priorityObj ? priorityObj.color : 'text-gray-600';
  }

  getPriorityLabel(priority: string): string {
    const priorityObj = this.priorities.find(p => p.value === priority);
    return priorityObj ? priorityObj.label : 'Inconnue';
  }

  getStatusClass(task: Task): string {
    if (!task.isActive) return 'opacity-50';

    const now = new Date();
    const dueDate = new Date(task.nextDueDate);

    if (dueDate < now) return 'border-red-500 bg-red-50';
    if (dueDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000) return 'border-yellow-500 bg-yellow-50';
    return 'border-green-500 bg-green-50';
  }

  getDueDateText(task: Task): string {
    const now = new Date();
    const dueDate = new Date(task.nextDueDate);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `En retard de ${Math.abs(diffDays)} jour(s)`;
    } else if (diffDays === 0) {
      return 'Aujourd\'hui';
    } else if (diffDays === 1) {
      return 'Demain';
    } else {
      return `Dans ${diffDays} jour(s)`;
    }
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  onFilterChange(): void {
    // Les signaux se mettent à jour automatiquement
  }

  getDueDateClass(task: Task): string {
    const now = new Date();
    const dueDate = new Date(task.nextDueDate);

    if (dueDate < now) return 'text-red-600';
    if (dueDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000) return 'text-yellow-600';
    return 'text-green-600';
  }

  editTask(task: Task): void {
    this.selectedTask.set(null);
    this.editTaskEvent.emit(task);
  }

  showTaskDetails(task: Task): void {
    this.selectedTask.set(task);
    // Ajouter un état dans l'historique pour la modale
    history.pushState({modal: true}, '');
  }

  closeTaskDetails(): void {
    this.selectedTask.set(null);
    // Si on ferme manuellement, on revient dans l'historique
    if (history.state?.modal) {
      history.back();
    }
  }

  closeTaskDetailsFromBack(): void {
    // Fermeture via le bouton retour - pas besoin de modifier l'historique
    this.selectedTask.set(null);
  }
}
