import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { form, Field, submit, required, min, FieldTree } from '@angular/forms/signals';
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
  UpdateReminderNoteData,
} from '../../models/reminder-note.model';

interface ReminderFormModel {
  title: string;
  content: string;
  reminderDate: string;
  reminderTime: string;
  isRecurring: boolean;
  recurrenceFrequency: 'daily' | 'weekly' | 'monthly';
  recurrenceInterval: number;
  recurrenceDaysOfWeek: number[];
  recurrenceEndDate: string;
  alertBeforeMinutes: number;
}

const defaultReminderModel = (): ReminderFormModel => ({
  title: '',
  content: '',
  reminderDate: '',
  reminderTime: '',
  isRecurring: false,
  recurrenceFrequency: 'daily',
  recurrenceInterval: 1,
  recurrenceDaysOfWeek: [],
  recurrenceEndDate: '',
  alertBeforeMinutes: 0,
});

@Component({
  selector: 'app-reminder-notes',
  imports: [CommonModule, Field, RichTextEditorComponent],
  templateUrl: './reminder-notes.component.html',
  styleUrls: ['./reminder-notes.component.css'],
})
export class ReminderNotesComponent {
  private reminderNotesService = inject(ReminderNotesService);
  private notificationService = inject(NotificationRegistrationService);

  // Forms
  newReminderModel = signal<ReminderFormModel>(defaultReminderModel());
  newReminderForm: FieldTree<ReminderFormModel> = form(this.newReminderModel, (p) => {
    required(p.title);
    required(p.reminderDate);
    required(p.reminderTime);
    min(p.recurrenceInterval, 1);
  });

  editReminderModel = signal<ReminderFormModel>(defaultReminderModel());
  editReminderForm: FieldTree<ReminderFormModel> = form(this.editReminderModel, (p) => {
    required(p.title);
    required(p.reminderDate);
    required(p.reminderTime);
    min(p.recurrenceInterval, 1);
  });

  // State
  editingId = signal<string | null>(null);
  filterStatus = signal<'all' | 'active' | 'triggered'>('active');
  showRecurrenceOptions = signal(false);
  showEditRecurrenceOptions = signal(false);

  // Data
  reminderNotes = this.reminderNotesService.reminderNotes;
  myReminders = this.reminderNotesService.myReminders;

  // Filtered notes
  filteredReminders = computed(() => {
    const filter = this.filterStatus();
    const notes = this.myReminders();

    if (filter === 'all') return notes;
    return notes.filter((note) => note.status === filter);
  });

  // Helpers exposed to the template
  formatDateTime = formatReminderDateTime;
  isImminent = isReminderImminent;
  getTimeUntil = getTimeUntilReminder;
  getRecurrenceText = getRecurrenceLabel;

  // Days of the week for selection
  weekDays = [
    { value: 1, label: 'Lun' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Mer' },
    { value: 4, label: 'Jeu' },
    { value: 5, label: 'Ven' },
    { value: 6, label: 'Sam' },
    { value: 0, label: 'Dim' },
  ];

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

  async requestNotificationPermission(): Promise<void> {
    try {
      await this.notificationService.requestPermissionAndRegister();
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    }
  }

  createReminder(): void {
    submit(this.newReminderForm, async () => {
      const m = this.newReminderModel();

      try {
        const data: CreateReminderNoteData = {
          title: m.title,
          content: m.content || '',
          reminderDate: m.reminderDate,
          reminderTime: m.reminderTime,
          isRecurring: m.isRecurring,
          alertBeforeMinutes: m.alertBeforeMinutes,
        };

        if (data.isRecurring) {
          data.recurrenceRule = {
            frequency: m.recurrenceFrequency,
            interval: m.recurrenceInterval,
            daysOfWeek: m.recurrenceFrequency === 'weekly' ? m.recurrenceDaysOfWeek : undefined,
            endDate: m.recurrenceEndDate || undefined,
          };
        }

        await this.reminderNotesService.create(data);
        this.newReminderModel.set(defaultReminderModel());
        this.newReminderForm().reset();
        this.showRecurrenceOptions.set(false);

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
    });
  }

  startEdit(note: ReminderNote): void {
    this.editingId.set(note.id);
    this.editReminderModel.set({
      title: note.title,
      content: note.content,
      reminderDate: note.reminderDate,
      reminderTime: note.reminderTime,
      isRecurring: note.isRecurring,
      recurrenceFrequency: note.recurrenceRule?.frequency || 'daily',
      recurrenceInterval: note.recurrenceRule?.interval || 1,
      recurrenceDaysOfWeek: note.recurrenceRule?.daysOfWeek || [],
      recurrenceEndDate: note.recurrenceRule?.endDate || '',
      alertBeforeMinutes: note.alertBeforeMinutes || 0,
    });
    this.editReminderForm().reset();
    this.showEditRecurrenceOptions.set(note.isRecurring);
  }

  saveEdit(): void {
    submit(this.editReminderForm, async () => {
      const id = this.editingId();
      if (!id) return;

      const m = this.editReminderModel();

      try {
        const data: UpdateReminderNoteData = {
          title: m.title,
          content: m.content,
          reminderDate: m.reminderDate,
          reminderTime: m.reminderTime,
          isRecurring: m.isRecurring,
          alertBeforeMinutes: m.alertBeforeMinutes,
        };

        if (data.isRecurring) {
          data.recurrenceRule = {
            frequency: m.recurrenceFrequency,
            interval: m.recurrenceInterval,
            daysOfWeek: m.recurrenceFrequency === 'weekly' ? m.recurrenceDaysOfWeek : undefined,
            endDate: m.recurrenceEndDate || undefined,
          };
        }

        await this.reminderNotesService.update(id, data);
        this.cancelEdit();
      } catch (error) {
        console.error('Error updating reminder:', error);
        alert('Erreur lors de la mise à jour du rappel');
      }
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editReminderModel.set(defaultReminderModel());
    this.editReminderForm().reset();
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

  toggleRecurrence(isNew: boolean): void {
    const isRecurring = isNew ? this.newReminderModel().isRecurring : this.editReminderModel().isRecurring;
    if (isNew) {
      this.showRecurrenceOptions.set(isRecurring);
    } else {
      this.showEditRecurrenceOptions.set(isRecurring);
    }
  }

  toggleDayOfWeek(day: number, isNew: boolean): void {
    const model = isNew ? this.newReminderModel : this.editReminderModel;
    const currentDays = model().recurrenceDaysOfWeek;
    if (currentDays.includes(day)) {
      model.update((m) => ({ ...m, recurrenceDaysOfWeek: currentDays.filter((d) => d !== day) }));
    } else {
      model.update((m) => ({ ...m, recurrenceDaysOfWeek: [...currentDays, day].sort() }));
    }
  }

  isDaySelected(day: number, isNew: boolean): boolean {
    const days = isNew ? this.newReminderModel().recurrenceDaysOfWeek : this.editReminderModel().recurrenceDaysOfWeek;
    return days.includes(day);
  }

  setNewAlertBeforeMinutes(value: string): void {
    this.newReminderModel.update((m) => ({ ...m, alertBeforeMinutes: +value }));
  }

  setNewRecurrenceFrequency(value: string): void {
    this.newReminderModel.update((m) => ({ ...m, recurrenceFrequency: value as 'daily' | 'weekly' | 'monthly' }));
  }

  setEditAlertBeforeMinutes(value: string): void {
    this.editReminderModel.update((m) => ({ ...m, alertBeforeMinutes: +value }));
  }

  setEditRecurrenceFrequency(value: string): void {
    this.editReminderModel.update((m) => ({ ...m, recurrenceFrequency: value as 'daily' | 'weekly' | 'monthly' }));
  }

  setFilter(status: 'all' | 'active' | 'triggered'): void {
    this.filterStatus.set(status);
  }

  getMinDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  getMinTime(reminderDate: string): string {
    const today = new Date().toISOString().split('T')[0];
    if (reminderDate === today) {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    return '00:00';
  }
}
