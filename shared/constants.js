/**
 * Constantes partagées entre le serveur local et les fonctions Lambda
 */

/**
 * Catégories par défaut pour les tâches
 */
const DEFAULT_CATEGORIES = [
  {
    id: "cuisine",
    name: "Cuisine",
    description: "Tâches liées à la cuisine et à la préparation des repas",
    isDefault: true,
  },
  {
    id: "menage",
    name: "Ménage",
    description: "Tâches de nettoyage et d'entretien de la maison",
    isDefault: true,
  },
  {
    id: "linge",
    name: "Linge",
    description: "Tâches liées à la lessive et au repassage",
    isDefault: true,
  },
  {
    id: "jardin",
    name: "Jardin",
    description: "Entretien du jardin et des plantes",
    isDefault: true,
  },
  {
    id: "administratif",
    name: "Administratif",
    description: "Tâches administratives et paperasse",
    isDefault: true,
  },
  {
    id: "chats",
    name: "Chats",
    description: "Soins et entretien des chats",
    isDefault: true,
  },
  {
    id: "rangements",
    name: "Rangements",
    description: "Organisation et rangement de la maison",
    isDefault: true,
  },
  {
    id: "autre",
    name: "Autre",
    description: "Autres tâches diverses",
    isDefault: true,
  },
];

/**
 * Messages d'erreur standardisés
 */
const ERROR_MESSAGES = {
  // Erreurs génériques
  INVALID_DATA: "Données invalides",
  UNAUTHORIZED: "Accès non autorisé",
  NOT_FOUND: "Ressource non trouvée",
  SAVE_ERROR: "Erreur lors de la sauvegarde",
  DELETE_ERROR: "Erreur lors de la suppression",
  RETRIEVE_ERROR: "Erreur lors de la récupération",

  // Erreurs spécifiques aux tâches
  TASK_NOT_FOUND: "Tâche non trouvée",
  TASK_SAVE_ERROR: "Erreur lors de la sauvegarde de la tâche",
  TASK_DELETE_ERROR: "Erreur lors de la suppression de la tâche",
  TASK_RETRIEVE_ERROR: "Erreur lors de la récupération des tâches",
  TASK_UPDATE_ERROR: "Erreur lors de la mise à jour",
  OVERDUE_TASKS_ERROR: "Erreur lors de la récupération des tâches en retard",
  CATEGORY_TASKS_ERROR: "Erreur lors de la récupération des tâches par catégorie",

  // Erreurs spécifiques aux notes
  NOTE_NOT_FOUND: "Note non trouvée",
  NOTE_SAVE_ERROR: "Erreur lors de la sauvegarde de la note",
  NOTE_DELETE_ERROR: "Erreur lors de la suppression de la note",
  NOTE_RETRIEVE_ERROR: "Erreur lors de la récupération des notes",

  // Erreurs spécifiques aux catégories
  CATEGORY_NOT_FOUND: "Catégorie non trouvée",
  CATEGORY_EXISTS: "Une catégorie avec cet ID existe déjà",
  CATEGORY_DELETE_DEFAULT: "Impossible de supprimer une catégorie par défaut",
  CATEGORY_SAVE_ERROR: "Erreur lors de la sauvegarde de la catégorie",
  CATEGORY_DELETE_ERROR: "Erreur lors de la suppression de la catégorie",
  CATEGORY_RETRIEVE_ERROR: "Erreur lors de la récupération des catégories",

  // Erreurs spécifiques à la liste de courses
  SHOPPING_ITEM_NOT_FOUND: "Item non trouvé",
  SHOPPING_ENTRY_NOT_FOUND: "Entrée non trouvée",
  SHOPPING_NAME_REQUIRED: "Nom requis",
  SHOPPING_ITEMID_REQUIRED: "itemId requis",
  SHOPPING_CATALOG_ERROR: "Erreur lors de la récupération du catalogue",
  SHOPPING_LIST_ERROR: "Erreur lors de la récupération de la liste",
  SHOPPING_CLEAR_ERROR: "Erreur lors du nettoyage",
  SHOPPING_EMPTY_ERROR: "Erreur lors du vidage",

  // Erreurs spécifiques aux recettes
  RECIPE_NOT_FOUND: "Recette non trouvée",
  RECIPE_SAVE_ERROR: "Erreur lors de la sauvegarde de la recette",
  RECIPE_DELETE_ERROR: "Erreur lors de la suppression de la recette",
  RECIPE_RETRIEVE_ERROR: "Erreur lors de la récupération des recettes",
  RECIPE_INVALID_INGREDIENT: "Ingrédient invalide dans la recette",

  // Erreurs spécifiques aux notes avec rappels
  REMINDER_NOTE_NOT_FOUND: "Note avec rappel non trouvée",
  REMINDER_NOTE_SAVE_ERROR: "Erreur lors de la sauvegarde de la note avec rappel",
  REMINDER_NOTE_DELETE_ERROR: "Erreur lors de la suppression de la note avec rappel",
  REMINDER_NOTE_RETRIEVE_ERROR: "Erreur lors de la récupération des notes avec rappels",
  REMINDER_INVALID_DATE: "Date de rappel invalide",
  REMINDER_INVALID_TIME: "Heure de rappel invalide",
  REMINDER_PAST_DATE: "La date de rappel doit être dans le futur",
  REMINDER_INVALID_RECURRENCE: "Règle de récurrence invalide",

  // Erreurs spécifiques aux tokens de notification
  NOTIFICATION_TOKEN_INVALID: "Token de notification invalide",
  NOTIFICATION_TOKEN_SAVE_ERROR: "Erreur lors de l'enregistrement du token",
  NOTIFICATION_TOKEN_DELETE_ERROR: "Erreur lors de la suppression du token",
  NOTIFICATION_TOKEN_RETRIEVE_ERROR: "Erreur lors de la récupération des tokens",
  NOTIFICATION_SEND_ERROR: "Erreur lors de l'envoi de la notification",

  // Erreurs serveur
  STATUS_ERROR: "Erreur lors de la récupération du statut",
  API_ROUTE_NOT_FOUND: "Route API non trouvée",
};

/**
 * Configuration CORS par défaut
 */
const DEFAULT_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Secret-Key,X-User-Id",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400", // Cache preflight pour 24h
};

/**
 * Structure par défaut de la base de données
 */
const DEFAULT_DATABASE_STRUCTURE = {
  tasks: [],
  shoppingItems: [],
  shoppingList: [],
  notes: [],
  recipes: [],
  lastUpdated: new Date().toISOString(),
};

module.exports = {
  DEFAULT_CATEGORIES,
  ERROR_MESSAGES,
  DEFAULT_CORS_HEADERS,
  DEFAULT_DATABASE_STRUCTURE,
};
