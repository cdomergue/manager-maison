/**
 * Utilitaires partagés entre le serveur local et les fonctions Lambda
 */

/**
 * Génère un ID unique
 * @returns {string} ID unique
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Nettoie et valide une chaîne de caractères
 * @param {string} str - Chaîne à nettoyer
 * @returns {string} Chaîne nettoyée
 */
function sanitizeString(str) {
  return typeof str === "string" ? str.trim() : "";
}

/**
 * Valide qu'un nom n'est pas vide
 * @param {string} name - Nom à valider
 * @returns {boolean} True si valide
 */
function validateName(name) {
  return sanitizeString(name) !== "";
}

/**
 * Valide et convertit une quantité
 * @param {any} quantity - Quantité à valider
 * @param {number} defaultValue - Valeur par défaut
 * @returns {number} Quantité validée
 */
function validateQuantity(quantity, defaultValue = 1) {
  const num = Number(quantity);
  return isNaN(num) ? defaultValue : Math.max(1, num);
}

/**
 * Formate une date en ISO string
 * @param {Date|string} date - Date à formater
 * @returns {string} Date formatée en ISO
 */
function formatDateISO(date) {
  if (!date) return undefined;
  return new Date(date).toISOString();
}

/**
 * Récupère l'ID utilisateur depuis les headers
 * @param {Object} headers - Headers de la requête
 * @returns {string} ID utilisateur ou 'unknown'
 */
function getUserId(headers) {
  return headers["X-User-Id"] || headers["x-user-id"] || "unknown";
}

/**
 * Vérifie si une valeur est définie (différente d'undefined)
 * @param {any} value - Valeur à vérifier
 * @returns {boolean} True si définie
 */
function isDefined(value) {
  return value !== undefined;
}

module.exports = {
  generateId,
  sanitizeString,
  validateName,
  validateQuantity,
  formatDateISO,
  getUserId,
  isDefined,
};
