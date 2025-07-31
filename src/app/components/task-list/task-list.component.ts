import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Task, TaskCategory } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { NotificationService } from '../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-task-list',
  imports: [CommonModule, FormsModule],
  templateUrl: './task-list.component.html',
  styleUrls: ['./task-list.component.css']
})
export class TaskListComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  selectedCategory: string = 'all';
  selectedPriority: string = 'all';
  showCompleted: boolean = false;
  searchTerm: string = '';
  
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
    this.subscription.add(
      this.taskService.getTasks().subscribe(tasks => {
        this.tasks = tasks;
        this.filterTasks();
      })
    );

    // Écouter les événements de notification
    window.addEventListener('taskCompleted', ((event: CustomEvent) => {
      this.completeTask(event.detail.taskId);
    }) as EventListener);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  filterTasks(): void {
    this.filteredTasks = this.tasks.filter(task => {
      const matchesCategory = this.selectedCategory === 'all' || task.category === this.selectedCategory;
      const matchesPriority = this.selectedPriority === 'all' || task.priority === this.selectedPriority;
      const matchesSearch = !this.searchTerm || 
        task.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(this.searchTerm.toLowerCase()));
      const matchesCompleted = this.showCompleted || !task.lastCompleted;
      
      return matchesCategory && matchesPriority && matchesSearch && matchesCompleted;
    });
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
    this.filterTasks();
  }

  getActiveTasksCount(): number {
    return this.tasks.filter(t => t.isActive).length;
  }

  getOverdueTasksCount(): number {
    const now = new Date();
    return this.tasks.filter(t => t.isActive && new Date(t.nextDueDate) < now).length;
  }

  getDueDateClass(task: Task): string {
    const now = new Date();
    const dueDate = new Date(task.nextDueDate);
    
    if (dueDate < now) return 'text-red-600';
    if (dueDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000) return 'text-yellow-600';
    return 'text-green-600';
  }
}
