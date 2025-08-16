/**
 * Logique de calcul des dates partagée entre le serveur local et les fonctions Lambda
 */

const { RRule, RRuleSet, rrulestr } = require("rrule");

/**
 * Jours fériés fixes en France (format MM-DD)
 */
const FRENCH_HOLIDAYS = new Set([
  "01-01", // Jour de l'An
  "05-01", // Fête du Travail
  "05-08", // Victoire 1945
  "07-14", // Fête Nationale
  "08-15", // Assomption
  "11-01", // Toussaint
  "11-11", // Armistice
  "12-25", // Noël
]);

/**
 * Vérifie si une date est un jour férié en France
 * @param {Date} date - Date à vérifier
 * @returns {boolean} True si c'est un jour férié
 */
function isHolidayFrance(date) {
  const [ymd] = date.toISOString().split("T");
  const [, mm, dd] = ymd.split("-");
  const mmdd = `${mm}-${dd}`;
  return FRENCH_HOLIDAYS.has(mmdd);
}

/**
 * Vérifie si une date est dans la liste des exceptions
 * @param {Date} date - Date à vérifier
 * @param {Array} exceptions - Liste des dates d'exception (ISO strings)
 * @returns {boolean} True si la date est exceptée
 */
function isExceptionDate(date, exceptions) {
  if (!exceptions || exceptions.length === 0) return false;
  const yyyyMmDd = date.toISOString().split("T")[0];
  return exceptions.some((iso) => typeof iso === "string" && iso.startsWith(yyyyMmDd));
}

/**
 * Vérifie si une date doit être exclue (férié ou exception)
 * @param {Date} date - Date à vérifier
 * @param {Object} task - Tâche contenant les exceptions
 * @returns {boolean} True si la date est exclue
 */
function isExcluded(date, task) {
  return isHolidayFrance(date) || isExceptionDate(date, task.exDates || []);
}

/**
 * Trouve la prochaine date non exclue à partir d'une date donnée
 * @param {Date} date - Date de départ
 * @param {Object} task - Tâche contenant les exceptions
 * @returns {Date} Prochaine date valide
 */
function skipExcludedDates(date, task) {
  let d = new Date(date);
  while (isExcluded(d, task)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Trouve le prochain jour spécifique après une date donnée
 * @param {Date} from - Date de départ
 * @param {Array} byDays - Jours de la semaine (0=dimanche, 1=lundi, etc.)
 * @param {boolean} includeToday - Inclure le jour actuel dans la recherche
 * @returns {Date} Prochaine date correspondante
 */
function nextByDayAfter(from, byDays, includeToday = false) {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  if (!includeToday) {
    start.setDate(start.getDate() + 1);
  }
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (byDays.includes(d.getDay())) {
      return d;
    }
  }
  return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
}

/**
 * Calcule la prochaine occurrence avec RRule
 * @param {Object} task - Tâche contenant la RRule
 * @param {Date} fromDate - Date de référence
 * @returns {Date} Prochaine occurrence
 */
function computeNextWithRRule(task, fromDate) {
  try {
    const set = new RRuleSet();
    const rule = rrulestr(task.rrule, { forceset: false });
    const after = task.lastCompleted ? new Date(task.lastCompleted) : new Date(fromDate);
    after.setSeconds(after.getSeconds() + 1);

    set.rrule(rule);

    // Ajouter les dates d'exception de la tâche
    (task.exDates || []).forEach((iso) => {
      const d = new Date(iso);
      if (!isNaN(d.getTime())) set.exdate(d);
    });

    // Ajouter les jours fériés français pour les années pertinentes
    const startYear = after.getFullYear() - 1;
    const endYear = after.getFullYear() + 2;
    for (let y = startYear; y <= endYear; y++) {
      [
        `${y}-01-01`,
        `${y}-05-01`,
        `${y}-05-08`,
        `${y}-07-14`,
        `${y}-08-15`,
        `${y}-11-01`,
        `${y}-11-11`,
        `${y}-12-25`,
      ].forEach((s) => set.exdate(new Date(`${s}T00:00:00.000Z`)));
    }

    const next = set.after(after, true);
    return next ? next : skipExcludedDates(new Date(fromDate), task);
  } catch {
    return skipExcludedDates(new Date(fromDate), task);
  }
}

/**
 * Calcule la prochaine date d'échéance pour une tâche
 * @param {Object} task - Tâche à traiter
 * @returns {Date} Prochaine date d'échéance
 */
function calculateNextDueDate(task) {
  const base = new Date();

  if (task.rrule) {
    return computeNextWithRRule(task, base);
  }

  const nextDate = new Date(base);
  switch (task.frequency) {
    case "daily":
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case "weekly":
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case "monthly":
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case "custom":
      nextDate.setDate(nextDate.getDate() + (task.customDays || 1));
      break;
    default:
      // Fréquence par défaut : hebdomadaire
      nextDate.setDate(nextDate.getDate() + 7);
  }

  return skipExcludedDates(nextDate, task);
}

module.exports = {
  isHolidayFrance,
  isExceptionDate,
  isExcluded,
  skipExcludedDates,
  nextByDayAfter,
  computeNextWithRRule,
  calculateNextDueDate,
  FRENCH_HOLIDAYS,
};
