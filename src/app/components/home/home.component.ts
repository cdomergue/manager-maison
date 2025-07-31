import { Component, OnInit, signal, computed, effect } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TaskListComponent } from '../task-list/task-list.component';
import { TaskFormComponent } from '../task-form/task-form.component';
import { Task } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { NotificationService } from '../../services/notification.service';
import { BackgroundCheckService } from '../../services/background-check.service';

@Component({
  selector: 'app-home',
  imports: [RouterModule, DatePipe, TaskListComponent, TaskFormComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  showTaskForm = signal(false);
  editingTask = signal<Task | undefined>(undefined);
  
  // Signaux calculés pour les tâches
  tasks = computed(() => this.taskService.tasks());
  overdueTasks = computed(() => this.taskService.overdueTasks());
  
  // Signaux pour le statut de vérification en arrière-plan
  isCheckingBackground = computed(() => this.backgroundCheckService.isCheckingBackground());
  lastBackgroundCheck = computed(() => this.backgroundCheckService.lastCheck());
  backgroundCheckInterval = computed(() => this.backgroundCheckService.checkIntervalMs());

  constructor(
    private taskService: TaskService,
    private notificationService: NotificationService,
    private backgroundCheckService: BackgroundCheckService
  ) {}

  ngOnInit(): void {
    // Effet pour vérifier les tâches en retard
    effect(() => {
      const overdue = this.overdueTasks();
      if (overdue.length > 0) {
        this.notificationService.showOverdueNotification(overdue);
      }
    });
  }

  showAddTaskForm(): void {
    this.editingTask.set(undefined);
    this.showTaskForm.set(true);
  }

  showEditTaskForm(task: Task): void {
    this.editingTask.set(task);
    this.showTaskForm.set(true);
  }

  onTaskSaved(task: Task): void {
    this.showTaskForm.set(false);
    this.editingTask.set(undefined);
    
    // Programmer la notification pour cette tâche
    this.notificationService.scheduleTaskReminder(task);
  }

  onTaskFormCancelled(): void {
    this.showTaskForm.set(false);
    this.editingTask.set(undefined);
  }
}
