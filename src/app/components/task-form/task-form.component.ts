import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Assignee, Task } from '../../models/task.model';
import { CategoryService } from '../../services/category.service';
import { Category } from '../../models/category.model';
import { TaskService } from '../../services/task.service';

@Component({
  selector: 'app-task-form',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './task-form.component.html',
  styleUrls: ['./task-form.component.css'],
})
export class TaskFormComponent implements OnInit {
  @Input() task?: Task;
  @Output() taskSaved = new EventEmitter<Task>();
  @Output() cancelled = new EventEmitter<void>();

  taskForm: FormGroup;
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

  private fb = inject(FormBuilder);
  private taskService = inject(TaskService);
  private categoryService = inject(CategoryService);

  constructor() {
    this.taskForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      category: [''],
      frequency: ['weekly', Validators.required],
      customDays: [7],
      rrule: [''],
      exDates: [''], // CSV de dates (YYYY-MM-DD)
      priority: ['medium', Validators.required],
      nextDueDate: ['', Validators.required],
      assignee: [''],
    });
  }

  ngOnInit(): void {
    // Charger les catégories
    this.categoryService.getCategories().subscribe((categories) => (this.categories = categories));

    if (this.task) {
      this.taskForm.patchValue({
        name: this.task.name,
        description: this.task.description || '',
        category: this.task.category || '',
        frequency: this.task.frequency,
        customDays: this.task.customDays || 7,
        rrule: this.task.rrule || '',
        exDates: (this.task.exDates || []).map((d) => d.split('T')[0]).join(','),
        priority: this.task.priority,
        nextDueDate: this.formatDateForInput(this.task.nextDueDate),
      });
    } else {
      // Date par défaut : demain
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      this.taskForm.patchValue({
        nextDueDate: this.formatDateForInput(tomorrow),
      });
    }

    // Écouter les changements de fréquence pour ajuster les jours personnalisés
    this.taskForm.get('frequency')?.valueChanges.subscribe((frequency) => {
      if (frequency === 'custom') {
        this.taskForm.get('customDays')?.enable();
      } else {
        this.taskForm.get('customDays')?.disable();
      }
    });
  }

  onSubmit(): void {
    if (this.taskForm.valid) {
      const formValue = this.taskForm.value;

      const taskData: Omit<Task, 'id'> = {
        name: formValue.name,
        description: formValue.description || undefined,
        category: formValue.category || undefined,
        frequency: formValue.frequency,
        customDays: formValue.frequency === 'custom' ? formValue.customDays : undefined,
        rrule: (formValue.rrule || '').trim() || undefined,
        exDates: (formValue.exDates || '')
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s)
          .map((d: string) => new Date(d).toISOString()),
        priority: formValue.priority,
        nextDueDate: new Date(formValue.nextDueDate),
        isActive: true,
        assignee: formValue.assignee,
      };

      if (this.task) {
        // Mode édition
        const updatedTask: Task = {
          ...this.task,
          ...taskData,
        };
        this.taskService.updateTask(updatedTask);
        this.taskSaved.emit(updatedTask);
      } else {
        // Mode création
        this.taskService.addTask(taskData);
        this.taskForm.reset();
        this.taskSaved.emit(taskData as Task);
      }
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  get isCustomFrequency(): boolean {
    return this.taskForm.get('frequency')?.value === 'custom';
  }

  get isFormValid(): boolean {
    return this.taskForm.valid;
  }
}
