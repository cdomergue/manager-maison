import { Component, input, output, inject, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Task, TaskForm, Assignee, Frequency } from '../../models/task.model';
import { Category } from '../../models/category.model';
import { CategoryService } from '../../services/category.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-task-inline-edit',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './task-inline-edit.html',
  styleUrl: './task-inline-edit.css',
})
export class TaskInlineEdit implements OnInit {
  // Inputs et Outputs
  task = input.required<Task>();
  taskSaved = output<Task>();
  cancelled = output<void>();

  // Injections
  private fb = inject(FormBuilder);
  private categoryService = inject(CategoryService);
  private destroyRef = inject(DestroyRef);

  // Formulaire et données
  taskForm!: TaskForm;
  categories: Category[] = [];
  assignees = Object.values(Assignee);
  frequencies = [
    { value: 'daily', label: 'Quotidienne' },
    { value: 'weekly', label: 'Hebdomadaire' },
    { value: 'monthly', label: 'Mensuelle' },
    { value: 'custom', label: 'Personnalisée' },
  ];
  priorities = [
    { value: 'low', label: 'Basse' },
    { value: 'medium', label: 'Moyenne' },
    { value: 'high', label: 'Haute' },
  ];

  ngOnInit(): void {
    // Charger les catégories
    this.categoryService
      .getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((categories) => (this.categories = categories));

    // Initialiser le formulaire
    this.initializeForm();
  }

  private initializeForm(): void {
    const currentTask = this.task();

    this.taskForm = this.fb.group({
      name: [currentTask.name, [Validators.required, Validators.minLength(2)]],
      description: [currentTask.description || ''],
      category: [currentTask.category || ''],
      frequency: [currentTask.frequency as Frequency, Validators.required],
      customDays: [currentTask.customDays || 7],
      rrule: [currentTask.rrule || ''],
      exDates: [(currentTask.exDates || []).map((d) => d.split('T')[0]).join(',')],
      priority: [currentTask.priority, Validators.required],
      nextDueDate: [this.formatDateForInput(currentTask.nextDueDate), Validators.required],
      assignee: [currentTask.assignee as Assignee, Validators.required],
    });
  }

  private formatDateForInput(date: Date): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  get isCustomFrequency(): boolean {
    return this.taskForm?.get('frequency')?.value === 'custom';
  }

  onSubmit(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    const formValue = this.taskForm.value;
    const currentTask = this.task();

    const updatedTask: Task = {
      ...currentTask,
      name: formValue.name!,
      description: formValue.description!,
      category: formValue.category! || undefined,
      frequency: formValue.frequency!,
      customDays: formValue.customDays!,
      rrule: formValue.rrule! || undefined,
      exDates: formValue.exDates!
        ? formValue
            .exDates!.split(',')
            .map((d: string) => d.trim())
            .filter((d: string) => d)
        : undefined,
      priority: formValue.priority!,
      nextDueDate: new Date(formValue.nextDueDate!),
      assignee: formValue.assignee!,
    };

    this.taskSaved.emit(updatedTask);
  }

  onCancel(event: Event): void {
    event.stopPropagation();
    this.cancelled.emit();
  }
}
