export enum TaskCategory {
  CUISINE = 'Cuisine',
  MENAGE = 'Ménage',
  LINGE = 'Linge',
  JARDIN = 'Jardin',
  ADMINISTRATIF = 'Administratif',
  CHATS = 'Chats',
  AUTRE = 'Autre'
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  customDays?: number;
  nextDueDate: Date;
  lastCompleted?: Date;
  isActive: boolean;
  category?: TaskCategory;
  priority: 'low' | 'medium' | 'high';
}

export interface NotificationSettings {
  enabled: boolean;
  reminderTime: string; // format HH:mm
  advanceNotice: number; // heures avant échéance
}
