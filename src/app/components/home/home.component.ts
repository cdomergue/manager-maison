import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TaskListComponent } from '../task-list/task-list.component';
import { TaskFormComponent } from '../task-form/task-form.component';
import { Task } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, TaskListComponent, TaskFormComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  showTaskForm = false;
  editingTask: Task | undefined;
  tasks: Task[] = [];

  constructor(
    private taskService: TaskService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.taskService.getTasks().subscribe(tasks => {
      this.tasks = tasks;
      this.checkOverdueTasks();
    });
  }

  showAddTaskForm(): void {
    this.editingTask = undefined;
    this.showTaskForm = true;
  }

  showEditTaskForm(task: Task): void {
    this.editingTask = task;
    this.showTaskForm = true;
  }

  onTaskSaved(task: Task): void {
    this.showTaskForm = false;
    this.editingTask = undefined;
    
    // Programmer la notification pour cette tâche
    this.notificationService.scheduleTaskReminder(task);
  }

  onTaskFormCancelled(): void {
    this.showTaskForm = false;
    this.editingTask = undefined;
  }

  private checkOverdueTasks(): void {
    const overdueTasks = this.tasks.filter(task => 
      task.isActive && new Date(task.nextDueDate) < new Date()
    );
    
    if (overdueTasks.length > 0) {
      this.notificationService.showOverdueNotification(overdueTasks);
    }
  }
}
