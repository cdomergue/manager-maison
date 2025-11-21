import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ReminderNotesService } from '../../services/reminder-notes.service';
import { NotificationRegistrationService } from '../../services/notification-registration.service';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';
import {
  CreateReminderNoteData,
  formatReminderDateTime,
  getRecurrenceLabel,
  getTimeUntilReminder,
  isReminderImminent,
  ReminderNote,
  ReminderNoteForm,
  UpdateReminderNoteData,
} from '../../models/reminder-note.model';

@Component({
  selector: 'app-reminder-notes',
  imports: [CommonModule, ReactiveFormsModule, RichTextEditorComponent],
  templateUrl: './reminder-notes.component.html',
  styleUrls: ['./reminder-notes.component.css'],
})
export class ReminderNotesComponent {
  private reminderNotesService = inject(ReminderNotesService);
  private notificationService = inject(NotificationRegistrationService);
  private fb = inject(FormBuilder);

  // Formulaires
  newReminderForm: ReminderNoteForm;
  editReminderForm: ReminderNoteForm;

  // État
  editingId = signal<string | null>(null);
  filterStatus = signal<'all' | 'active' | 'triggered'>('active');
  showRecurrenceOptions = signal(false);
  showEditRecurrenceOptions = signal(false);

  // Données
  reminderNotes = this.reminderNotesService.reminderNotes;
  myReminders = this.reminderNotesService.myReminders;

  // Notes filtrées
  filteredReminders = computed(() => {
    const filter = this.filterStatus();
    const notes = this.myReminders();

    if (filter === 'all') return notes;
    return notes.filter((note) => note.status === filter);
  });

  // Helpers exposés au template
  formatDateTime = formatReminderDateTime;
  isImminent = isReminderImminent;
  getTimeUntil = getTimeUntilReminder;
  getRecurrenceText = getRecurrenceLabel;

  // Jours de la semaine pour la sélection
  weekDays = [
    { value: 1, label: 'Lun' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Mer' },
    { value: 4, label: 'Jeu' },
    { value: 5, label: 'Ven' },
    { value: 6, label: 'Sam' },
    { value: 0, label: 'Dim' },
  ];

  constructor() {
    // Initialiser les formulaires
    this.newReminderForm = this.createReminderForm();
    this.editReminderForm = this.createReminderForm();

    // Demander la permission de notification au démarrage
    // this.requestNotificationPermission(); // Removed: requires user gesture
  }

  private createReminderForm(): ReminderNoteForm {
    return this.fb.group({
      title: ['', Validators.required],
      content: [''],
      reminderDate: ['', Validators.required],
      reminderTime: ['', Validators.required],
      isRecurring: [false],
      recurrenceFrequency: ['daily' as 'daily' | 'weekly' | 'monthly'],
      recurrenceInterval: [1, [Validators.min(1)]],
      recurrenceDaysOfWeek: [[] as number[]],
      recurrenceEndDate: [null as string | null],
    });
  }

  async enableNotifications(): Promise<void> {
    try {
      const granted = await this.notificationService.requestPermissionAndRegister();
      if (granted) {
        alert('Notifications activées avec succès !');
      } else {
        alert("Impossible d'activer les notifications. Vérifiez vos paramètres.");
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      alert("Erreur lors de l'activation des notifications");
    }
  }

  // Old method kept for reference or if needed internally, but not called on init
  async requestNotificationPermission(): Promise<void> {
    try {
      await this.notificationService.requestPermissionAndRegister();
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    }
  }

  async createReminder(): Promise<void> {
    if (this.newReminderForm.invalid) {
      this.newReminderForm.markAllAsTouched();
      return;
    }

    const formValue = this.newReminderForm.value;
    if (!formValue.title || !formValue.reminderDate || !formValue.reminderTime) {
      return;
    }

    try {
      const data: CreateReminderNoteData = {
        title: formValue.title,
        content: formValue.content || '',
        reminderDate: formValue.reminderDate,
        reminderTime: formValue.reminderTime,
        isRecurring: formValue.isRecurring || false,
      };

      if (data.isRecurring) {
        data.recurrenceRule = {
          frequency: formValue.recurrenceFrequency || 'daily',
          interval: formValue.recurrenceInterval || 1,
          daysOfWeek: formValue.recurrenceFrequency === 'weekly' ? formValue.recurrenceDaysOfWeek || [] : undefined,
          endDate: formValue.recurrenceEndDate || undefined,
        };
      }

      await this.reminderNotesService.create(data);
      this.newReminderForm.reset();
      this.showRecurrenceOptions.set(false);

      // Fermer l'expansion panel si présent
      try {
        const panel = document.querySelector('details') as HTMLDetailsElement | null;
        if (panel) panel.open = false;
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('Error creating reminder:', error);
      alert('Erreur lors de la création du rappel');
    }
  }

  startEdit(note: ReminderNote): void {
    this.editingId.set(note.id);

    this.editReminderForm.patchValue({
      title: note.title,
      content: note.content,
      reminderDate: note.reminderDate,
      reminderTime: note.reminderTime,
      isRecurring: note.isRecurring,
      recurrenceFrequency: note.recurrenceRule?.frequency || 'daily',
      recurrenceInterval: note.recurrenceRule?.interval || 1,
      recurrenceDaysOfWeek: note.recurrenceRule?.daysOfWeek || [],
      recurrenceEndDate: note.recurrenceRule?.endDate || null,
    });

    this.showEditRecurrenceOptions.set(note.isRecurring);
  }

  async saveEdit(): Promise<void> {
    const id = this.editingId();
    if (!id || this.editReminderForm.invalid) {
      this.editReminderForm.markAllAsTouched();
      return;
    }

    const formValue = this.editReminderForm.value;

    try {
      const data: UpdateReminderNoteData = {
        title: formValue.title ?? undefined,
        content: formValue.content ?? undefined,
        reminderDate: formValue.reminderDate ?? undefined,
        reminderTime: formValue.reminderTime ?? undefined,
        isRecurring: formValue.isRecurring ?? undefined,
      };

      if (data.isRecurring) {
        data.recurrenceRule = {
          frequency: formValue.recurrenceFrequency || 'daily',
          interval: formValue.recurrenceInterval || 1,
          daysOfWeek: formValue.recurrenceFrequency === 'weekly' ? formValue.recurrenceDaysOfWeek || [] : undefined,
          endDate: formValue.recurrenceEndDate || undefined,
        };
      }

      await this.reminderNotesService.update(id, data);
      this.cancelEdit();
    } catch (error) {
      console.error('Error updating reminder:', error);
      alert('Erreur lors de la mise à jour du rappel');
    }
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editReminderForm.reset();
    this.showEditRecurrenceOptions.set(false);
  }

  async deleteReminder(id: string): Promise<void> {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce rappel ?')) {
      return;
    }

    try {
      await this.reminderNotesService.remove(id);
    } catch (error) {
      console.error('Error deleting reminder:', error);
      alert('Erreur lors de la suppression du rappel');
    }
  }

  async refresh(): Promise<void> {
    try {
      await this.reminderNotesService.refresh();
    } catch (error) {
      console.error('Error refreshing reminders:', error);
    }
  }

  async testNotification(): Promise<void> {
    try {
      await this.notificationService.showTestNotification();
    } catch (error) {
      alert('Erreur: ' + (error as Error).message);
    }
  }

  toggleRecurrence(form: ReminderNoteForm, isNew: boolean): void {
    const isRecurring = form.get('isRecurring')?.value;
    if (isNew) {
      this.showRecurrenceOptions.set(!!isRecurring);
    } else {
      this.showEditRecurrenceOptions.set(!!isRecurring);
    }
  }

  toggleDayOfWeek(day: number, form: ReminderNoteForm): void {
    const daysControl = form.get('recurrenceDaysOfWeek');
    const currentDays = daysControl?.value || [];

    if (currentDays.includes(day)) {
      daysControl?.setValue(currentDays.filter((d: number) => d !== day));
    } else {
      daysControl?.setValue([...currentDays, day].sort());
    }
  }

  isDaySelected(day: number, form: ReminderNoteForm): boolean {
    const days = form.get('recurrenceDaysOfWeek')?.value || [];
    return days.includes(day);
  }

  setFilter(status: 'all' | 'active' | 'triggered'): void {
    this.filterStatus.set(status);
  }

  getMinDate(): string {
    // Date minimale = aujourd'hui
    return new Date().toISOString().split('T')[0];
  }

  getMinTime(form: ReminderNoteForm): string {
    const selectedDate = form.get('reminderDate')?.value;
    const today = new Date().toISOString().split('T')[0];

    // Si la date sélectionnée est aujourd'hui, heure minimale = maintenant
    if (selectedDate === today) {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    return '00:00';
  }
}
