import {FormControl, FormGroup} from '@angular/forms';

export enum TaskCategory {
  CUISINE = 'Cuisine',
  MENAGE = 'Ménage',
  LINGE = 'Linge',
  JARDIN = 'Jardin',
  ADMINISTRATIF = 'Administratif',
  CHATS = 'Chats',
  RANGEMENTS = 'Rangements',
  AUTRE = 'Autre'
}

export enum Assignee {
  LAURENCE = 'Laurence',
  CHRISTOPHE = 'Christophe',
}

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'custom';

type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  name: string;
  description?: string;
  frequency: Frequency;
  customDays?: number;
  nextDueDate: Date;
  lastCompleted?: Date;
  isActive: boolean;
  category?: TaskCategory;
  priority: Priority;
  assignee: Assignee;
}

export interface NotificationSettings {
  enabled: boolean;
  reminderTime: string; // format HH:mm
  advanceNotice: number; // heures avant échéance
}

export type TaskForm = FormGroup<{
  name: FormControl<string | null>;
  description: FormControl<string | null>;
  category: FormControl<TaskCategory | null>;
  frequency: FormControl<Frequency | null>;
  customDays: FormControl<number | null>;
  priority: FormControl<Priority | null>;
  nextDueDate: FormControl<string | null>;
  assignee: FormControl<Assignee | null>;
}>;
