import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Task, TaskCategory } from '../../models/task.model';
import { TaskService } from '../../services/task.service';

@Component({
  selector: 'app-task-form',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './task-form.component.html',
  styleUrls: ['./task-form.component.css']
})
export class TaskFormComponent implements OnInit {
  @Input() task?: Task;
  @Output() taskSaved = new EventEmitter<Task>();
  @Output() cancelled = new EventEmitter<void>();

  taskForm: FormGroup;
  categories = Object.values(TaskCategory);
  frequencies = [
    { value: 'daily', label: 'Quotidienne' },
    { value: 'weekly', label: 'Hebdomadaire' },
    { value: 'monthly', label: 'Mensuelle' },
    { value: 'custom', label: 'Personnalisée' }
  ];
  priorities = [
    { value: 'low', label: 'Basse' },
    { value: 'medium', label: 'Moyenne' },
    { value: 'high', label: 'Haute' }
  ];

  constructor(
    private fb: FormBuilder,
    private taskService: TaskService
  ) {
    this.taskForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      category: [''],
      frequency: ['weekly', Validators.required],
      customDays: [7],
      priority: ['medium', Validators.required],
      nextDueDate: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    if (this.task) {
      this.taskForm.patchValue({
        name: this.task.name,
        description: this.task.description || '',
        category: this.task.category || '',
        frequency: this.task.frequency,
        customDays: this.task.customDays || 7,
        priority: this.task.priority,
        nextDueDate: this.formatDateForInput(this.task.nextDueDate)
      });
    } else {
      // Date par défaut : demain
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      this.taskForm.patchValue({
        nextDueDate: this.formatDateForInput(tomorrow)
      });
    }

    // Écouter les changements de fréquence pour ajuster les jours personnalisés
    this.taskForm.get('frequency')?.valueChanges.subscribe(frequency => {
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
        priority: formValue.priority,
        nextDueDate: new Date(formValue.nextDueDate),
        isActive: true
      };

      if (this.task) {
        // Mode édition
        const updatedTask: Task = {
          ...this.task,
          ...taskData
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
