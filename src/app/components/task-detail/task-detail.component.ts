import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Task } from '../../models/task.model';

@Component({
  selector: 'app-task-detail',
  imports: [CommonModule],
  templateUrl: './task-detail.component.html',
  styleUrls: ['./task-detail.component.css'],
})
export class TaskDetailComponent {
  @Input() task!: Task;
  @Output() closed = new EventEmitter<void>();
  @Output() complete = new EventEmitter<string>();
  @Output() edit = new EventEmitter<Task>();
  @Output() removeTask = new EventEmitter<string>();
  @Output() toggleActive = new EventEmitter<Task>();

  priorities = [
    { value: 'low', label: 'Basse', color: 'text-green-600' },
    { value: 'medium', label: 'Moyenne', color: 'text-yellow-600' },
    { value: 'high', label: 'Haute', color: 'text-red-600' },
  ];

  getPriorityColor(priority: string): string {
    const priorityObj = this.priorities.find((p) => p.value === priority);
    return priorityObj ? priorityObj.color : 'text-gray-600';
  }

  getPriorityLabel(priority: string): string {
    const priorityObj = this.priorities.find((p) => p.value === priority);
    return priorityObj ? priorityObj.label : 'Inconnue';
  }

  getDueDateText(task: Task): string {
    const now = new Date();
    const dueDate = new Date(task.nextDueDate);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `En retard de ${Math.abs(diffDays)} jour(s)`;
    } else if (diffDays === 0) {
      return "Aujourd'hui";
    } else if (diffDays === 1) {
      return 'Demain';
    } else {
      return `Dans ${diffDays} jour(s)`;
    }
  }

  getDueDateClass(task: Task): string {
    const now = new Date();
    const dueDate = new Date(task.nextDueDate);

    if (dueDate < now) return 'text-red-600';
    if (dueDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000) return 'text-yellow-600';
    return 'text-green-600';
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  get sortedHistory() {
    const entries = this.task?.history || [];
    return [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  formatDateTime(date: Date): string {
    const d = new Date(date);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
