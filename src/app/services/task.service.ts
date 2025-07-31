import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Task } from '../models/task.model';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private tasks = new BehaviorSubject<Task[]>([]);
  private readonly STORAGE_KEY = 'household_tasks';

  constructor() {
    this.loadTasks();
  }

  getTasks(): Observable<Task[]> {
    return this.tasks.asObservable();
  }

  addTask(task: Omit<Task, 'id'>): void {
    const newTask: Task = {
      ...task,
      id: this.generateId(),
      isActive: true
    };
    
    const currentTasks = this.tasks.value;
    this.tasks.next([...currentTasks, newTask]);
    this.saveTasks();
  }

  updateTask(task: Task): void {
    const currentTasks = this.tasks.value;
    const index = currentTasks.findIndex(t => t.id === task.id);
    
    if (index !== -1) {
      currentTasks[index] = task;
      this.tasks.next([...currentTasks]);
      this.saveTasks();
    }
  }

  deleteTask(taskId: string): void {
    const currentTasks = this.tasks.value;
    const filteredTasks = currentTasks.filter(t => t.id !== taskId);
    this.tasks.next(filteredTasks);
    this.saveTasks();
  }

  completeTask(taskId: string): void {
    const currentTasks = this.tasks.value;
    const task = currentTasks.find(t => t.id === taskId);
    
    if (task) {
      task.lastCompleted = new Date();
      task.nextDueDate = this.calculateNextDueDate(task);
      this.tasks.next([...currentTasks]);
      this.saveTasks();
    }
  }

  getTasksByCategory(category: string): Observable<Task[]> {
    return new Observable(observer => {
      this.tasks.subscribe(tasks => {
        const filteredTasks = tasks.filter(task => task.category === category);
        observer.next(filteredTasks);
      });
    });
  }

  getOverdueTasks(): Observable<Task[]> {
    return new Observable(observer => {
      this.tasks.subscribe(tasks => {
        const now = new Date();
        const overdueTasks = tasks.filter(task => 
          task.isActive && task.nextDueDate < now
        );
        observer.next(overdueTasks);
      });
    });
  }

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

  private loadTasks(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const tasks = JSON.parse(stored).map((task: any) => ({
          ...task,
          nextDueDate: new Date(task.nextDueDate),
          lastCompleted: task.lastCompleted ? new Date(task.lastCompleted) : undefined
        }));
        this.tasks.next(tasks);
      } catch (error) {
        console.error('Error loading tasks:', error);
      }
    }
  }

  private saveTasks(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tasks.value));
  }
}
