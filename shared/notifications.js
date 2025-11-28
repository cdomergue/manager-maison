/**
 * Utilitaires pour la gestion des notifications push
 */

// Types de notifications
const NOTIFICATION_TYPES = {
  REMINDER: "reminder",
  REMINDER_RECURRING: "reminder_recurring",
};

// Statuts de rappel
const REMINDER_STATUS = {
  ACTIVE: "active",
  TRIGGERED: "triggered",
  CANCELLED: "cancelled",
};

// Fréquences de récurrence
const RECURRENCE_FREQUENCY = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
};

/**
 * Valide un token de notification
 * @param {string} token - Token à valider
 * @returns {boolean}
 */
function isValidNotificationToken(token) {
  if (!token) {
    return false;
  }

  // Si c'est un objet (PushSubscriptionJSON), on vérifie qu'il a un endpoint
  if (typeof token === "object") {
    return !!token.endpoint;
  }

  // Si c'est une chaîne, on vérifie la longueur
  if (typeof token === "string") {
    return token.length > 20;
  }

  return false;
}

/**
 * Valide une règle de récurrence
 * @param {Object} rule - Règle de récurrence
 * @returns {boolean}
 */
function isValidRecurrenceRule(rule) {
  if (!rule || typeof rule !== "object") {
    return false;
  }

  const { frequency, interval, daysOfWeek, endDate } = rule;

  // Fréquence requise
  if (!frequency || !Object.values(RECURRENCE_FREQUENCY).includes(frequency)) {
    return false;
  }

  // Intervalle doit être un nombre positif
  if (interval !== undefined && (typeof interval !== "number" || interval < 1)) {
    return false;
  }

  // Pour récurrence hebdomadaire, vérifier les jours de la semaine
  if (frequency === RECURRENCE_FREQUENCY.WEEKLY && daysOfWeek) {
    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      return false;
    }
    // Vérifier que tous les jours sont entre 0 (dimanche) et 6 (samedi)
    if (!daysOfWeek.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) {
      return false;
    }
  }

  // Si date de fin spécifiée, vérifier qu'elle est dans le futur
  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime()) || end <= new Date()) {
      return false;
    }
  }

  return true;
}

/**
 * Crée le payload de notification pour un rappel
 * @param {Object} reminderNote - Note avec rappel
 * @returns {Object}
 */
function createReminderNotificationPayload(reminderNote) {
  const { title, content, isRecurring } = reminderNote;

  return {
    title: isRecurring ? "🔔 Rappel récurrent" : "🔔 Rappel",
    body: title || content.substring(0, 100),
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    tag: `reminder-${reminderNote.id}`,
    requireInteraction: true,
    data: {
      type: isRecurring ? NOTIFICATION_TYPES.REMINDER_RECURRING : NOTIFICATION_TYPES.REMINDER,
      reminderNoteId: reminderNote.id,
      url: "/reminder-notes",
    },
    actions: [
      {
        action: "view",
        title: "Voir",
      },
      {
        action: "dismiss",
        title: "Fermer",
      },
    ],
  };
}

/**
 * Calcule la prochaine date de rappel pour une note récurrente
 * @param {string} currentDate - Date actuelle ISO
 * @param {Object} recurrenceRule - Règle de récurrence
 * @returns {string|null} - Prochaine date ISO ou null si terminé
 */
function calculateNextReminderDate(currentDate, recurrenceRule) {
  const { frequency, interval = 1, daysOfWeek, endDate } = recurrenceRule;
  const current = new Date(currentDate);
  let next = new Date(current);

  switch (frequency) {
    case RECURRENCE_FREQUENCY.DAILY:
      next.setDate(next.getDate() + interval);
      break;

    case RECURRENCE_FREQUENCY.WEEKLY:
      if (daysOfWeek && daysOfWeek.length > 0) {
        // Trouver le prochain jour de la semaine dans la liste
        const currentDay = next.getDay();
        const sortedDays = [...daysOfWeek].sort((a, b) => a - b);

        // Chercher le prochain jour dans la même semaine
        let nextDay = sortedDays.find((day) => day > currentDay);

        if (nextDay !== undefined) {
          // Prochain jour dans la même semaine
          next.setDate(next.getDate() + (nextDay - currentDay));
        } else {
          // Passer à la semaine suivante, premier jour de la liste
          const daysToAdd = 7 - currentDay + sortedDays[0];
          next.setDate(next.getDate() + daysToAdd + (interval - 1) * 7);
        }
      } else {
        // Si pas de jours spécifiés, ajouter interval semaines
        next.setDate(next.getDate() + interval * 7);
      }
      break;

    case RECURRENCE_FREQUENCY.MONTHLY:
      next.setMonth(next.getMonth() + interval);
      break;

    default:
      return null;
  }

  // Vérifier si on a dépassé la date de fin
  if (endDate) {
    const end = new Date(endDate);
    if (next > end) {
      return null;
    }
  }

  return next.toISOString();
}

/**
 * Vérifie si un rappel doit être déclenché maintenant
 * @param {Object} reminderNote - Note avec rappel
 * @param {Date} now - Date/heure actuelle
 * @returns {boolean}
 */
function shouldTriggerReminder(reminderNote, now = new Date()) {
  if (reminderNote.status !== "active") {
    // Utilise ta constante REMINDER_STATUS.ACTIVE
    return false;
  }

  const reminderDateTime = new Date(`${reminderNote.reminderDate}T${reminderNote.reminderTime}`);

  // Ajuster pour le rappel en avance si configuré
  if (reminderNote.alertBeforeMinutes && reminderNote.alertBeforeMinutes > 0) {
    reminderDateTime.setMinutes(reminderDateTime.getMinutes() - reminderNote.alertBeforeMinutes);
  }

  const parisTimeStr = now.toLocaleString("en-US", { timeZone: "Europe/Paris" });
  const nowInParisContext = new Date(parisTimeStr);

  const diffMs = nowInParisContext.getTime() - reminderDateTime.getTime();

  return diffMs >= 0 && diffMs < 60000;
}

module.exports = {
  NOTIFICATION_TYPES,
  REMINDER_STATUS,
  RECURRENCE_FREQUENCY,
  isValidNotificationToken,
  isValidRecurrenceRule,
  createReminderNotificationPayload,
  calculateNextReminderDate,
  shouldTriggerReminder,
};
