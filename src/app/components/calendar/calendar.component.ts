import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  startOfWeek,
  startOfMonth,
  endOfWeek,
  endOfMonth,
  eachDayOfInterval,
  format,
  addWeeks,
  addMonths,
  subWeeks,
  subMonths,
  isSameDay,
  isToday,
  isBefore,
  isSameMonth,
  parseISO,
  startOfDay,
  endOfDay,
  differenceInDays,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { TaskService } from '../../services/task.service';
import { Task } from '../../models/task.model';
import { rrulestr } from 'rrule';

type ViewMode = 'week' | 'month';

@Component({
  selector: 'app-calendar',
  imports: [CommonModule],
  templateUrl: './calendar.component.html',
})
export class CalendarComponent {
  private taskService = inject(TaskService);
  private router = inject(Router);

  // Signaux pour l'état du calendrier
  viewMode = signal<ViewMode>('week');
  currentDate = signal(new Date());

  // Signaux calculés
  currentPeriodTitle = computed(() => {
    const date = this.currentDate();
    const mode = this.viewMode();

    if (mode === 'week') {
      const weekStart = startOfWeek(date, { locale: fr });
      const weekEnd = endOfWeek(date, { locale: fr });

      if (isSameMonth(weekStart, weekEnd)) {
        return format(weekStart, 'MMMM yyyy', { locale: fr });
      } else {
        return `${format(weekStart, 'MMM', { locale: fr })} - ${format(weekEnd, 'MMM yyyy', { locale: fr })}`;
      }
    } else {
      return format(date, 'MMMM yyyy', { locale: fr });
    }
  });

  calendarDays = computed(() => {
    const currentDate = this.currentDate();
    const mode = this.viewMode();
    const tasks = this.taskService.tasks();

    let days: Date[];

    if (mode === 'week') {
      const weekStart = startOfWeek(currentDate, { locale: fr });
      const weekEnd = endOfWeek(currentDate, { locale: fr });
      days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      const monthStart = startOfWeek(startOfMonth(currentDate), { locale: fr });
      const monthEnd = endOfWeek(endOfMonth(currentDate), { locale: fr });
      days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    }

    return days.map((date) => ({
      date,
      isCurrentMonth: mode === 'week' || isSameMonth(date, currentDate),
      isToday: isToday(date),
      tasks: this.getTasksForDay(date, tasks),
    }));
  });

  private getTasksForDay(date: Date, tasks: Task[]): Task[] {
    const targetDay = startOfDay(date);

    return tasks.filter((task) => {
      if (!task.isActive) return false;

      const nextDueDate = typeof task.nextDueDate === 'string' ? parseISO(task.nextDueDate) : task.nextDueDate;

      const nextDueDayStart = startOfDay(nextDueDate);

      // Debug pour identifier le problème
      const isDebugTask =
        task.name.toLowerCase().includes('debug') || differenceInDays(nextDueDayStart, new Date()) >= 5;

      // Vérifier si c'est exactement le jour de la prochaine échéance
      if (isSameDay(targetDay, nextDueDayStart)) {
        if (isDebugTask) {
          console.log(`Tâche "${task.name}" - Jour exact de l'échéance:`, {
            targetDay: format(targetDay, 'yyyy-MM-dd'),
            nextDueDate: format(nextDueDayStart, 'yyyy-MM-dd'),
            frequency: task.frequency,
          });
        }
        return true;
      }

      // Si la date cible est avant la prochaine échéance, pas de tâche à afficher
      if (isBefore(targetDay, nextDueDayStart)) {
        return false;
      }

      // Si la tâche a une récurrence, vérifier les futures occurrences
      if (task.rrule) {
        try {
          const rule = rrulestr(task.rrule);
          const dayEnd = endOfDay(date);
          const occurrences = rule.between(targetDay, dayEnd, true);
          const hasOccurrence = occurrences.length > 0;

          if (isDebugTask && hasOccurrence) {
            console.log(`Tâche "${task.name}" - Récurrence RRULE trouvée:`, {
              targetDay: format(targetDay, 'yyyy-MM-dd'),
              occurrences: occurrences.map((d) => format(d, 'yyyy-MM-dd')),
            });
          }

          return hasOccurrence;
        } catch (error) {
          console.warn('Erreur lors du parsing de la rrule:', task.rrule, error);
          return false;
        }
      }

      // Pour les fréquences simples, calculer les occurrences futures uniquement après la première échéance
      if (task.frequency && task.frequency !== 'custom') {
        const isDue = this.isTaskDueOnDate(task, targetDay, nextDueDayStart);

        if (isDebugTask && isDue) {
          console.log(`Tâche "${task.name}" - Récurrence simple trouvée:`, {
            targetDay: format(targetDay, 'yyyy-MM-dd'),
            nextDueDate: format(nextDueDayStart, 'yyyy-MM-dd'),
            frequency: task.frequency,
            daysDiff: differenceInDays(targetDay, nextDueDayStart),
          });
        }

        return isDue;
      }

      return false;
    });
  }

  private isTaskDueOnDate(task: Task, targetDate: Date, nextDueDayStart: Date): boolean {
    // La date cible doit être après ou égale à la première échéance
    if (isBefore(targetDate, nextDueDayStart)) {
      return false;
    }

    const daysDiff = differenceInDays(targetDate, nextDueDayStart);

    switch (task.frequency) {
      case 'daily':
        return daysDiff >= 0;
      case 'weekly':
        return daysDiff >= 0 && daysDiff % 7 === 0;
      case 'monthly': {
        // Vérifier si c'est le même jour du mois
        const nextDate = nextDueDayStart.getDate();
        const targetDay = targetDate.getDate();
        return daysDiff >= 0 && nextDate === targetDay;
      }
      case 'custom':
        if (task.customDays) {
          return daysDiff >= 0 && daysDiff % task.customDays === 0;
        }
        return false;
      default:
        return false;
    }
  }

  getTaskClass(task: Task): string {
    const baseClass = 'border';
    const now = new Date();
    const taskDate = typeof task.nextDueDate === 'string' ? parseISO(task.nextDueDate) : task.nextDueDate;

    if (task.priority === 'high') {
      return `${baseClass} bg-green-200 dark:bg-green-800 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200`;
    }

    if (isBefore(taskDate, startOfDay(now))) {
      return `${baseClass} bg-red-200 dark:bg-red-800 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200`;
    }

    if (isToday(taskDate)) {
      return `${baseClass} bg-yellow-200 dark:bg-yellow-800 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200`;
    }

    return `${baseClass} bg-blue-200 dark:bg-blue-800 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200`;
  }

  formatDayName(date: Date): string {
    return format(date, 'EEE', { locale: fr });
  }

  formatDayNumber(date: Date): string {
    return format(date, 'd');
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  previousPeriod(): void {
    const current = this.currentDate();
    const mode = this.viewMode();

    if (mode === 'week') {
      this.currentDate.set(subWeeks(current, 1));
    } else {
      this.currentDate.set(subMonths(current, 1));
    }
  }

  nextPeriod(): void {
    const current = this.currentDate();
    const mode = this.viewMode();

    if (mode === 'week') {
      this.currentDate.set(addWeeks(current, 1));
    } else {
      this.currentDate.set(addMonths(current, 1));
    }
  }

  goToToday(): void {
    this.currentDate.set(new Date());
  }

  openTaskDetail(task: Task): void {
    // Navigation vers la page de détail de la tâche (si elle existe)
    // Sinon, retour à la page principale des tâches
    this.router.navigate(['/'], { fragment: task.id });
  }

  getTaskTooltip(task: Task): string {
    const dueDate = typeof task.nextDueDate === 'string' ? parseISO(task.nextDueDate) : task.nextDueDate;

    const formattedDate = format(dueDate, 'dd/MM/yyyy à HH:mm', { locale: fr });
    const frequency = this.getFrequencyText(task.frequency);

    return `${task.name}\nÉchéance: ${formattedDate}\nFréquence: ${frequency}\nAssigné à: ${task.assignee}\nPriorité: ${task.priority}`;
  }

  private getFrequencyText(frequency: string): string {
    switch (frequency) {
      case 'daily':
        return 'Quotidienne';
      case 'weekly':
        return 'Hebdomadaire';
      case 'monthly':
        return 'Mensuelle';
      case 'custom':
        return 'Personnalisée';
      default:
        return 'Unique';
    }
  }
}
