import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CreateReminderNoteData, ReminderNote, UpdateReminderNoteData } from '../models/reminder-note.model';
import { ApiService } from './api.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root',
})
export class ReminderNotesService {
  private readonly apiService = inject(ApiService);
  private readonly userService = inject(UserService);

  // Signal pour stocker les notes avec rappels
  private reminderNotesSignal = signal<ReminderNote[]>([]);

  // Exposer les notes en lecture seule
  public reminderNotes = this.reminderNotesSignal.asReadonly();

  // Notes actives seulement
  public activeReminders = computed(() => this.reminderNotesSignal().filter((note) => note.status === 'active'));

  // Notes déclenchées
  public triggeredReminders = computed(() => this.reminderNotesSignal().filter((note) => note.status === 'triggered'));

  // Notes de l'utilisateur courant
  public myReminders = computed(() => {
    const currentUser = this.userService.getCurrentUser();
    if (!currentUser) return [];
    return this.reminderNotesSignal().filter((note) => note.ownerId === currentUser.id);
  });

  constructor() {
    // Charger les notes au démarrage
    this.refresh();
  }

  /**
   * Récupère toutes les notes avec rappels depuis l'API
   */
  async refresh(): Promise<void> {
    try {
      const notes = await firstValueFrom(this.apiService.get<ReminderNote[]>('/reminder-notes'));
      this.reminderNotesSignal.set(notes);
    } catch (error) {
      console.error('Error fetching reminder notes:', error);
      throw error;
    }
  }

  /**
   * Crée une nouvelle note avec rappel
   */
  async create(data: CreateReminderNoteData): Promise<ReminderNote> {
    try {
      const newNote = await firstValueFrom(this.apiService.post<ReminderNote>('/reminder-notes', data));

      // Ajouter la nouvelle note au signal
      this.reminderNotesSignal.update((notes) => [...notes, newNote]);

      return newNote;
    } catch (error) {
      console.error('Error creating reminder note:', error);
      throw error;
    }
  }

  /**
   * Met à jour une note avec rappel
   */
  async update(id: string, data: UpdateReminderNoteData): Promise<ReminderNote> {
    try {
      const updatedNote = await firstValueFrom(this.apiService.put<ReminderNote>(`/reminder-notes/${id}`, data));

      // Mettre à jour la note dans le signal
      this.reminderNotesSignal.update((notes) => notes.map((note) => (note.id === id ? updatedNote : note)));

      return updatedNote;
    } catch (error) {
      console.error('Error updating reminder note:', error);
      throw error;
    }
  }

  /**
   * Supprime une note avec rappel
   */
  async remove(id: string): Promise<void> {
    try {
      await firstValueFrom(this.apiService.delete(`/reminder-notes/${id}`));

      // Retirer la note du signal
      this.reminderNotesSignal.update((notes) => notes.filter((note) => note.id !== id));
    } catch (error) {
      console.error('Error deleting reminder note:', error);
      throw error;
    }
  }

  /**
   * Annule un rappel (change le statut à 'cancelled')
   */
  async cancel(id: string): Promise<ReminderNote> {
    // Pour annuler, on met une date dans le passé
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);

    return this.update(id, {
      reminderDate: pastDate.toISOString().split('T')[0],
      reminderTime: '00:00',
    });
  }

  /**
   * Récupère une note spécifique par ID
   */
  getById(id: string): ReminderNote | undefined {
    return this.reminderNotesSignal().find((note) => note.id === id);
  }

  /**
   * Calcule la prochaine date de rappel pour une note récurrente
   * (Logique côté client pour affichage, le calcul réel se fait côté serveur)
   */
  calculateNextOccurrence(note: ReminderNote): Date | null {
    if (!note.isRecurring || !note.recurrenceRule) {
      return new Date(`${note.reminderDate}T${note.reminderTime}`);
    }

    const { frequency, interval = 1, daysOfWeek, endDate } = note.recurrenceRule;
    const current = new Date(`${note.reminderDate}T${note.reminderTime}`);
    const next = new Date(current);

    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + interval);
        break;

      case 'weekly':
        if (daysOfWeek && daysOfWeek.length > 0) {
          const currentDay = next.getDay();
          const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
          const nextDay = sortedDays.find((day) => day > currentDay);

          if (nextDay !== undefined) {
            next.setDate(next.getDate() + (nextDay - currentDay));
          } else {
            const daysToAdd = 7 - currentDay + sortedDays[0];
            next.setDate(next.getDate() + daysToAdd + (interval - 1) * 7);
          }
        } else {
          next.setDate(next.getDate() + interval * 7);
        }
        break;

      case 'monthly':
        next.setMonth(next.getMonth() + interval);
        break;
    }

    if (endDate) {
      const end = new Date(endDate);
      if (next > end) {
        return null;
      }
    }

    return next;
  }
}
