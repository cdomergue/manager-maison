export interface ReminderNote {
  id: string;
  title: string;
  content: string;
  ownerId: string;
  reminderDate: string; // YYYY-MM-DD
  reminderTime: string; // HH:mm
  isRecurring: boolean;
  recurrenceRule?: RecurrenceRule;
  status: 'active' | 'triggered' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number; // ex: tous les 2 jours
  daysOfWeek?: number[]; // 0=dimanche, 1=lundi, ..., 6=samedi
  endDate?: string; // YYYY-MM-DD
}

export interface CreateReminderNoteData {
  title: string;
  content: string;
  reminderDate: string;
  reminderTime: string;
  isRecurring: boolean;
  recurrenceRule?: RecurrenceRule;
}

export interface UpdateReminderNoteData {
  title?: string;
  content?: string;
  reminderDate?: string;
  reminderTime?: string;
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule;
}

// Types pour les Reactive Forms typés
import { FormControl, FormGroup } from '@angular/forms';

export type ReminderNoteForm = FormGroup<{
  title: FormControl<string | null>;
  content: FormControl<string | null>;
  reminderDate: FormControl<string | null>;
  reminderTime: FormControl<string | null>;
  isRecurring: FormControl<boolean | null>;
  recurrenceFrequency: FormControl<'daily' | 'weekly' | 'monthly' | null>;
  recurrenceInterval: FormControl<number | null>;
  recurrenceDaysOfWeek: FormControl<number[] | null>;
  recurrenceEndDate: FormControl<string | null>;
}>;

// Helper pour formater la date de rappel
export function formatReminderDateTime(note: ReminderNote): string {
  const date = new Date(`${note.reminderDate}T${note.reminderTime}`);
  return date.toLocaleString('fr-FR', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Helper pour vérifier si un rappel est imminent (dans les prochaines 24h)
export function isReminderImminent(note: ReminderNote): boolean {
  if (note.status !== 'active') return false;
  const reminderDate = new Date(`${note.reminderDate}T${note.reminderTime}`);
  const now = new Date();
  const diffMs = reminderDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours > 0 && diffHours <= 24;
}

// Helper pour obtenir le temps restant avant le rappel
export function getTimeUntilReminder(note: ReminderNote): string {
  const reminderDate = new Date(`${note.reminderDate}T${note.reminderTime}`);
  const now = new Date();
  const diffMs = reminderDate.getTime() - now.getTime();

  if (diffMs < 0) return 'Passé';

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `Dans ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    return `Dans ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  } else if (diffMinutes > 0) {
    return `Dans ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  } else {
    return 'Maintenant';
  }
}

// Helper pour obtenir le libellé de récurrence
export function getRecurrenceLabel(rule: RecurrenceRule): string {
  const { frequency, interval = 1, daysOfWeek, endDate } = rule;

  let label = '';

  if (frequency === 'daily') {
    label = interval === 1 ? 'Tous les jours' : `Tous les ${interval} jours`;
  } else if (frequency === 'weekly') {
    if (daysOfWeek && daysOfWeek.length > 0) {
      const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      const days = daysOfWeek.map((d) => dayNames[d]).join(', ');
      label = interval === 1 ? `Chaque semaine (${days})` : `Toutes les ${interval} semaines (${days})`;
    } else {
      label = interval === 1 ? 'Chaque semaine' : `Toutes les ${interval} semaines`;
    }
  } else if (frequency === 'monthly') {
    label = interval === 1 ? 'Chaque mois' : `Tous les ${interval} mois`;
  }

  if (endDate) {
    const end = new Date(endDate);
    label += ` jusqu'au ${end.toLocaleDateString('fr-FR')}`;
  }

  return label;
}
