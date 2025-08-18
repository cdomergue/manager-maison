import { Component, EventEmitter, Input, OnInit, Output, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Assignee, Task } from '../../models/task.model';
import { CategoryService } from '../../services/category.service';
import { Category } from '../../models/category.model';
import { TaskService } from '../../services/task.service';
import { addDays, addWeeks, addMonths } from 'date-fns';
import { rrulestr } from 'rrule';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-task-form',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './task-form.component.html',
})
export class TaskFormComponent implements OnInit {
  @Input() task?: Task;
  @Output() taskSaved = new EventEmitter<Task>();
  @Output() cancelled = new EventEmitter<void>();

  taskForm: FormGroup;
  categories: Category[] = [];
  assignees = Object.values(Assignee);

  // Flags pour suivre si l'utilisateur a modifié manuellement la date
  dateModifiedManually = false;
  private lastAutoCalculatedDate: string | null = null;
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
  private destroyRef = inject(DestroyRef);

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
    this.categoryService
      .getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((categories) => (this.categories = categories));

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

      // Pour une tâche existante, on considère que la date a été définie manuellement
      this.dateModifiedManually = true;
      this.lastAutoCalculatedDate = this.formatDateForInput(this.task.nextDueDate);
    } else {
      // Pour une nouvelle tâche, calculer automatiquement la date basée sur la fréquence par défaut
      this.dateModifiedManually = false;
      this.updateDueDateIfNeeded();
    }

    // Écouter les changements de fréquence pour ajuster les jours personnalisés et recalculer la date
    this.taskForm
      .get('frequency')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((frequency) => {
        if (frequency === 'custom') {
          this.taskForm.get('customDays')?.enable();
        } else {
          this.taskForm.get('customDays')?.disable();
        }

        // Recalculer la date d'échéance si elle n'a pas été modifiée manuellement
        this.updateDueDateIfNeeded();
      });

    // Écouter les changements de jours personnalisés
    this.taskForm
      .get('customDays')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.updateDueDateIfNeeded();
      });

    // Écouter les changements de RRULE
    this.taskForm
      .get('rrule')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.updateDueDateIfNeeded();
      });

    // Écouter les changements manuels de la date d'échéance
    this.taskForm
      .get('nextDueDate')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((newDate) => {
        if (newDate && newDate !== this.lastAutoCalculatedDate) {
          this.dateModifiedManually = true;
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

  private updateDueDateIfNeeded(): void {
    // Ne pas mettre à jour si l'utilisateur a modifié manuellement la date
    if (this.dateModifiedManually) {
      return;
    }

    const frequency = this.taskForm.get('frequency')?.value;
    const customDays = this.taskForm.get('customDays')?.value;
    const rrule = this.taskForm.get('rrule')?.value?.trim();

    let nextDueDate: Date;

    // Si une RRULE est définie, elle prime sur la fréquence
    if (rrule) {
      nextDueDate = this.calculateNextDueDateFromRRule(rrule);
    } else {
      nextDueDate = this.calculateNextDueDateFromFrequency(frequency, customDays);
    }

    const formattedDate = this.formatDateForInput(nextDueDate);
    this.lastAutoCalculatedDate = formattedDate;

    // Mettre à jour le formulaire sans déclencher l'événement de modification manuelle
    this.taskForm.get('nextDueDate')?.setValue(formattedDate, { emitEvent: false });
  }

  private calculateNextDueDateFromFrequency(frequency: string, customDays?: number): Date {
    const now = new Date();

    switch (frequency) {
      case 'daily':
        return addDays(now, 1);

      case 'weekly':
        return addWeeks(now, 1);

      case 'monthly':
        return addMonths(now, 1);

      case 'custom':
        if (customDays && customDays > 0) {
          return addDays(now, customDays);
        }
        return addDays(now, 7); // Fallback à 7 jours

      default:
        return addDays(now, 1); // Fallback quotidien
    }
  }

  private calculateNextDueDateFromRRule(rruleString: string): Date {
    try {
      const rule = rrulestr(rruleString);
      const now = new Date();

      // Obtenir la prochaine occurrence après maintenant
      const nextOccurrence = rule.after(now);

      if (nextOccurrence) {
        return nextOccurrence;
      } else {
        // Si pas de prochaine occurrence, fallback sur demain
        return addDays(now, 1);
      }
    } catch (error) {
      console.warn('Erreur lors du parsing de la RRULE:', rruleString, error);
      // En cas d'erreur, fallback sur demain
      return addDays(new Date(), 1);
    }
  }

  // Méthode publique pour réinitialiser le flag de modification manuelle
  resetDateModificationFlag(): void {
    this.dateModifiedManually = false;
    this.updateDueDateIfNeeded();
  }
}
