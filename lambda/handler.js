const AWS = require("aws-sdk");

// Modules partagés packagés
const {
  generateId,
  sanitizeString,
  formatDateISO,
  getUserId,
  calculateNextDueDate,
  DEFAULT_CATEGORIES,
  ERROR_MESSAGES,
  DEFAULT_CORS_HEADERS,
  isValidNotificationToken,
  isValidRecurrenceRule,
  createReminderNotificationPayload,
  calculateNextReminderDate,
  shouldTriggerReminder,
  REMINDER_STATUS,
} = require("taches-menageres-shared");

// Configuration DynamoDB
const dynamodb = new AWS.DynamoDB.DocumentClient();
const CATEGORIES_TABLE_NAME = process.env.CATEGORIES_TABLE_NAME || "gestion-maison-categories";
const SHOPPING_ITEMS_TABLE_NAME = process.env.SHOPPING_ITEMS_TABLE_NAME || "gestion-maison-shopping-items";
const SHOPPING_LIST_TABLE_NAME = process.env.SHOPPING_LIST_TABLE_NAME || "gestion-maison-shopping-list";
const NOTES_TABLE_NAME = process.env.NOTES_TABLE_NAME || "gestion-maison-notes";
const RECIPES_TABLE_NAME = process.env.RECIPES_TABLE_NAME || "gestion-maison-recipes";
const REMINDER_NOTES_TABLE_NAME = process.env.REMINDER_NOTES_TABLE_NAME || "gestion-maison-reminder-notes";
const NOTIFICATION_TOKENS_TABLE_NAME =
  process.env.NOTIFICATION_TOKENS_TABLE_NAME || "gestion-maison-notification-tokens";

// Configuration spéciale
const YOU_KNOW_WHAT = "21cdf2c38551";

// Headers CORS pour toutes les réponses
// Note: Les en-têtes CORS principaux sont configurés dans API Gateway (template.yaml)
// Nous ajoutons seulement les en-têtes spécifiques nécessaires ici
const corsHeaders = DEFAULT_CORS_HEADERS;

// Fonction de vérification d'accès
const authenticate = (event) => {
  const magicWord = event.headers["X-Secret-Key"] || event.headers["x-secret-key"];

  if (!magicWord || magicWord !== YOU_KNOW_WHAT) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Unauthorized: Invalid or missing credentials" }),
    };
  }

  return null; // Accès autorisé
};

// Réponse standard
const response = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

// GET /api/status
exports.getStatus = async (event) => {
  // Vérification d'accès
  const authError = authenticate(event);
  if (authError) return authError;

  try {
    return response(200, {
      status: "online",
      lastUpdated: new Date().toISOString(),
      serverTime: new Date().toISOString(),
      environment: "lambda",
    });
  } catch (error) {
    console.error("Error in getStatus:", error);
    return response(500, { error: ERROR_MESSAGES.STATUS_ERROR });
  }
};

// OPTIONS pour CORS - Gestion des requêtes preflight
exports.options = async (event) => {
  // Retourner une réponse OPTIONS complète pour les requêtes preflight
  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Credentials": "false", // Explicitement false pour * origin
    },
    body: JSON.stringify({ message: "CORS preflight response" }),
  };
};

// ========== GESTION DES NOTES ==========

// GET /api/notes
exports.getNotes = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const result = await dynamodb.scan({ TableName: NOTES_TABLE_NAME }).promise();
    return response(200, result.Items || []);
  } catch (error) {
    console.error("Error in getNotes:", error);
    return response(500, { error: "Erreur lors de la récupération des notes" });
  }
};

// GET /api/notes/:id
exports.getNote = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const userId = event.headers["X-User-Id"] || event.headers["x-user-id"];
    const id = event.pathParameters.id;
    const result = await dynamodb.get({ TableName: NOTES_TABLE_NAME, Key: { id } }).promise();
    const note = result.Item;
    if (!note) return response(404, { error: "Note non trouvée" });
    if (note.ownerId !== userId) {
      return response(403, { error: "Accès non autorisé" });
    }
    return response(200, note);
  } catch (error) {
    console.error("Error in getNote:", error);
    return response(500, { error: "Erreur lors de la récupération de la note" });
  }
};

// POST /api/notes
exports.createNote = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const userId = event.headers["X-User-Id"] || event.headers["x-user-id"];
    const body = JSON.parse(event.body || "{}");
    const now = new Date().toISOString();
    const newNote = {
      id: generateId(),
      title: sanitizeString(body.title),
      content: body.content || "",
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
    };
    await dynamodb.put({ TableName: NOTES_TABLE_NAME, Item: newNote }).promise();
    return response(201, newNote);
  } catch (error) {
    console.error("Error in createNote:", error);
    return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
  }
};

// PUT /api/notes/:id
exports.updateNote = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const userId = event.headers["X-User-Id"] || event.headers["x-user-id"];
    const id = event.pathParameters.id;
    const body = JSON.parse(event.body || "{}");
    const existing = await dynamodb.get({ TableName: NOTES_TABLE_NAME, Key: { id } }).promise();
    if (!existing.Item) return response(404, { error: "Note non trouvée" });
    const canEdit = existing.Item.ownerId === userId;
    if (!canEdit) return response(403, { error: "Accès non autorisé" });
    const updated = {
      ...existing.Item,
      title: body.title !== undefined ? (body.title || "").trim() : existing.Item.title,
      content: body.content !== undefined ? body.content : existing.Item.content,
      // sharedWith modifiable via endpoint dédié de partage
      updatedAt: new Date().toISOString(),
    };
    await dynamodb.put({ TableName: NOTES_TABLE_NAME, Item: updated }).promise();
    return response(200, updated);
  } catch (error) {
    console.error("Error in updateNote:", error);
    return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
  }
};

// DELETE /api/notes/:id
exports.deleteNote = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const userId = event.headers["X-User-Id"] || event.headers["x-user-id"];
    const id = event.pathParameters.id;
    const existing = await dynamodb.get({ TableName: NOTES_TABLE_NAME, Key: { id } }).promise();
    if (!existing.Item) return response(404, { error: "Note non trouvée" });
    if (existing.Item.ownerId !== userId) return response(403, { error: "Accès non autorisé" });
    await dynamodb.delete({ TableName: NOTES_TABLE_NAME, Key: { id } }).promise();
    return response(204, {});
  } catch (error) {
    console.error("Error in deleteNote:", error);
    return response(500, { error: "Erreur lors de la suppression" });
  }
};

// partage supprimé

// ========== GESTION LISTE DE COURSES ==========

// GET /api/shopping/items
exports.getShoppingItems = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const result = await dynamodb.scan({ TableName: SHOPPING_ITEMS_TABLE_NAME }).promise();
    return response(200, result.Items || []);
  } catch (error) {
    console.error("Error in getShoppingItems:", error);
    return response(500, { error: "Erreur lors de la récupération du catalogue" });
  }
};

// POST /api/shopping/items
exports.createShoppingItem = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const body = JSON.parse(event.body || "{}");
    const name = (body.name || "").trim();
    const category = (body.category || "").trim();
    if (!name) return response(400, { error: "Nom requis" });
    const item = {
      id: generateId(),
      name,
      category: category || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await dynamodb.put({ TableName: SHOPPING_ITEMS_TABLE_NAME, Item: item }).promise();
    return response(201, item);
  } catch (error) {
    console.error("Error in createShoppingItem:", error);
    return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
  }
};

// DELETE /api/shopping/items/:id
exports.deleteShoppingItem = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const id = event.pathParameters.id;
    await dynamodb.delete({ TableName: SHOPPING_ITEMS_TABLE_NAME, Key: { id } }).promise();
    // Supprimer les entrées associées dans la liste
    const list = await dynamodb.scan({ TableName: SHOPPING_LIST_TABLE_NAME }).promise();
    const toDelete = (list.Items || []).filter((e) => e.itemId === id);
    for (const entry of toDelete) {
      await dynamodb.delete({ TableName: SHOPPING_LIST_TABLE_NAME, Key: { id: entry.id } }).promise();
    }
    return response(204, {});
  } catch (error) {
    console.error("Error in deleteShoppingItem:", error);
    return response(500, { error: "Erreur lors de la suppression" });
  }
};

// PUT /api/shopping/items/:id
exports.updateShoppingItem = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const id = event.pathParameters.id;
    const body = JSON.parse(event.body || "{}");
    const existing = await dynamodb.get({ TableName: SHOPPING_ITEMS_TABLE_NAME, Key: { id } }).promise();
    if (!existing.Item) return response(404, { error: "Item non trouvé" });

    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const category = body.category !== undefined ? String(body.category).trim() : undefined;

    const updated = {
      ...existing.Item,
      name: name !== undefined && name !== "" ? name : existing.Item.name,
      category: category !== undefined && category !== "" ? category : undefined,
      updatedAt: new Date().toISOString(),
    };

    await dynamodb.put({ TableName: SHOPPING_ITEMS_TABLE_NAME, Item: updated }).promise();

    // Propager le nouveau nom dans les entrées de la liste
    if (name !== undefined && name !== "") {
      const list = await dynamodb.scan({ TableName: SHOPPING_LIST_TABLE_NAME }).promise();
      const related = (list.Items || []).filter((e) => e.itemId === id);
      for (const entry of related) {
        const updatedEntry = { ...entry, name: updated.name, updatedAt: new Date().toISOString() };
        await dynamodb.put({ TableName: SHOPPING_LIST_TABLE_NAME, Item: updatedEntry }).promise();
      }
    }

    return response(200, updated);
  } catch (error) {
    console.error("Error in updateShoppingItem:", error);
    return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
  }
};

// GET /api/shopping/list
exports.getShoppingList = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const result = await dynamodb.scan({ TableName: SHOPPING_LIST_TABLE_NAME }).promise();
    return response(200, result.Items || []);
  } catch (error) {
    console.error("Error in getShoppingList:", error);
    return response(500, { error: "Erreur lors de la récupération de la liste" });
  }
};

// POST /api/shopping/list
exports.addShoppingEntry = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const body = JSON.parse(event.body || "{}");
    const itemId = body.itemId;
    const quantity = Math.max(1, Number(body.quantity || 1));
    if (!itemId) return response(400, { error: "itemId requis" });

    // Récupérer l'item
    const item = await dynamodb.get({ TableName: SHOPPING_ITEMS_TABLE_NAME, Key: { id: itemId } }).promise();
    if (!item.Item) return response(404, { error: "Item non trouvé" });

    // Tenter d'agréger une entrée non cochée existante
    const list = await dynamodb.scan({ TableName: SHOPPING_LIST_TABLE_NAME }).promise();
    const existing = (list.Items || []).find((e) => e.itemId === itemId && !e.checked);
    if (existing) {
      const updated = {
        ...existing,
        quantity: Math.max(1, (existing.quantity || 1) + quantity),
        updatedAt: new Date().toISOString(),
      };
      await dynamodb.put({ TableName: SHOPPING_LIST_TABLE_NAME, Item: updated }).promise();
      return response(200, updated);
    }

    const entry = {
      id: generateId(),
      itemId: itemId,
      name: item.Item.name,
      quantity,
      checked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await dynamodb.put({ TableName: SHOPPING_LIST_TABLE_NAME, Item: entry }).promise();
    return response(201, entry);
  } catch (error) {
    console.error("Error in addShoppingEntry:", error);
    return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
  }
};

// PUT /api/shopping/list/:id
exports.updateShoppingEntry = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const id = event.pathParameters.id;
    const body = JSON.parse(event.body || "{}");
    const existing = await dynamodb.get({ TableName: SHOPPING_LIST_TABLE_NAME, Key: { id } }).promise();
    if (!existing.Item) return response(404, { error: "Entrée non trouvée" });

    const updated = {
      ...existing.Item,
      quantity: body.quantity !== undefined ? Math.max(1, Number(body.quantity)) : existing.Item.quantity,
      checked: body.checked !== undefined ? !!body.checked : existing.Item.checked,
      updatedAt: new Date().toISOString(),
    };
    await dynamodb.put({ TableName: SHOPPING_LIST_TABLE_NAME, Item: updated }).promise();
    return response(200, updated);
  } catch (error) {
    console.error("Error in updateShoppingEntry:", error);
    return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
  }
};

// DELETE /api/shopping/list/:id
exports.deleteShoppingEntry = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const id = event.pathParameters.id;
    await dynamodb.delete({ TableName: SHOPPING_LIST_TABLE_NAME, Key: { id } }).promise();
    return response(204, {});
  } catch (error) {
    console.error("Error in deleteShoppingEntry:", error);
    return response(500, { error: "Erreur lors de la suppression" });
  }
};

// POST /api/shopping/list/clear-checked
exports.clearCheckedShoppingEntries = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const list = await dynamodb.scan({ TableName: SHOPPING_LIST_TABLE_NAME }).promise();
    const toDelete = (list.Items || []).filter((e) => e.checked);
    for (const entry of toDelete) {
      await dynamodb.delete({ TableName: SHOPPING_LIST_TABLE_NAME, Key: { id: entry.id } }).promise();
    }
    return response(204, {});
  } catch (error) {
    console.error("Error in clearCheckedShoppingEntries:", error);
    return response(500, { error: "Erreur lors du nettoyage" });
  }
};

// DELETE /api/shopping/list
exports.clearAllShoppingEntries = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const list = await dynamodb.scan({ TableName: SHOPPING_LIST_TABLE_NAME }).promise();
    for (const entry of list.Items || []) {
      await dynamodb.delete({ TableName: SHOPPING_LIST_TABLE_NAME, Key: { id: entry.id } }).promise();
    }
    return response(204, {});
  } catch (error) {
    console.error("Error in clearAllShoppingEntries:", error);
    return response(500, { error: "Erreur lors du vidage" });
  }
};

// ========== GESTION DES CATÉGORIES ==========

// Initialiser les catégories par défaut si la table est vide
async function initializeDefaultCategories() {
  try {
    const result = await dynamodb
      .scan({
        TableName: CATEGORIES_TABLE_NAME,
        Select: "COUNT",
      })
      .promise();

    if (result.Count === 0) {
      // Insérer les catégories par défaut
      for (const category of DEFAULT_CATEGORIES) {
        await dynamodb
          .put({
            TableName: CATEGORIES_TABLE_NAME,
            Item: {
              ...category,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          })
          .promise();
      }
    }
  } catch (error) {
    console.warn("Could not initialize default categories:", error);
  }
}

// GET /api/categories
exports.getCategories = async (event) => {
  // Vérification d'accès
  const authError = authenticate(event);
  if (authError) return authError;

  try {
    // Initialiser les catégories par défaut si nécessaire
    await initializeDefaultCategories();

    const result = await dynamodb
      .scan({
        TableName: CATEGORIES_TABLE_NAME,
      })
      .promise();

    return response(200, result.Items || []);
  } catch (error) {
    console.error("Error in getCategories:", error);
    return response(500, { error: "Erreur lors de la récupération des catégories" });
  }
};

// GET /api/categories/:id
exports.getCategory = async (event) => {
  // Vérification d'accès
  const authError = authenticate(event);
  if (authError) return authError;

  try {
    const categoryId = event.pathParameters.id;

    const result = await dynamodb
      .get({
        TableName: CATEGORIES_TABLE_NAME,
        Key: { id: categoryId },
      })
      .promise();

    if (!result.Item) {
      return response(404, { error: "Catégorie non trouvée" });
    }

    return response(200, result.Item);
  } catch (error) {
    console.error("Error in getCategory:", error);
    return response(500, { error: "Erreur lors de la récupération de la catégorie" });
  }
};

// POST /api/categories
exports.createCategory = async (event) => {
  // Vérification d'accès
  const authError = authenticate(event);
  if (authError) return authError;

  try {
    const body = JSON.parse(event.body);

    const newCategory = {
      ...body,
      id: body.id || generateId(),
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Vérifier si l'ID existe déjà
    const existing = await dynamodb
      .get({
        TableName: CATEGORIES_TABLE_NAME,
        Key: { id: newCategory.id },
      })
      .promise();

    if (existing.Item) {
      return response(400, { error: "Une catégorie avec cet ID existe déjà" });
    }

    await dynamodb
      .put({
        TableName: CATEGORIES_TABLE_NAME,
        Item: newCategory,
      })
      .promise();

    return response(201, newCategory);
  } catch (error) {
    console.error("Error in createCategory:", error);
    return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
  }
};

// PUT /api/categories/:id
exports.updateCategory = async (event) => {
  // Vérification d'accès
  const authError = authenticate(event);
  if (authError) return authError;

  try {
    const categoryId = event.pathParameters.id;
    const body = JSON.parse(event.body);

    // Récupérer la catégorie existante
    const existing = await dynamodb
      .get({
        TableName: CATEGORIES_TABLE_NAME,
        Key: { id: categoryId },
      })
      .promise();

    if (!existing.Item) {
      return response(404, { error: "Catégorie non trouvée" });
    }

    // Empêcher la modification de l'ID et préserver le statut isDefault
    const { id, ...updateData } = body;
    const isDefault = existing.Item.isDefault;

    const updatedCategory = {
      ...existing.Item,
      ...updateData,
      id: categoryId,
      isDefault,
      updatedAt: new Date().toISOString(),
    };

    await dynamodb
      .put({
        TableName: CATEGORIES_TABLE_NAME,
        Item: updatedCategory,
      })
      .promise();

    return response(200, updatedCategory);
  } catch (error) {
    console.error("Error in updateCategory:", error);
    return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
  }
};

// DELETE /api/categories/:id
exports.deleteCategory = async (event) => {
  // Vérification d'accès
  const authError = authenticate(event);
  if (authError) return authError;

  try {
    const categoryId = event.pathParameters.id;

    // Récupérer la catégorie pour vérifier si elle est par défaut
    const existing = await dynamodb
      .get({
        TableName: CATEGORIES_TABLE_NAME,
        Key: { id: categoryId },
      })
      .promise();

    if (!existing.Item) {
      return response(404, { error: "Catégorie non trouvée" });
    }

    // Empêcher la suppression des catégories par défaut
    if (existing.Item.isDefault) {
      return response(400, { error: "Impossible de supprimer une catégorie par défaut" });
    }

    await dynamodb
      .delete({
        TableName: CATEGORIES_TABLE_NAME,
        Key: { id: categoryId },
      })
      .promise();

    return response(204, {});
  } catch (error) {
    console.error("Error in deleteCategory:", error);
    return response(500, { error: "Erreur lors de la suppression" });
  }
};

// Les fonctions de calcul de dates sont maintenant dans le module partagé shared/dates.js

// ========== GESTION DES RECETTES ==========

// GET /api/recipes
exports.getRecipes = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const result = await dynamodb.scan({ TableName: RECIPES_TABLE_NAME }).promise();
    return response(200, result.Items || []);
  } catch (error) {
    console.error("Error in getRecipes:", error);
    return response(500, { error: ERROR_MESSAGES.RECIPE_RETRIEVE_ERROR });
  }
};

// POST /api/recipes
exports.createRecipe = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const userId = event.headers["X-User-Id"] || event.headers["x-user-id"];
    const body = JSON.parse(event.body || "{}");
    const ingredients = Array.isArray(body.ingredients) ? body.ingredients : [];
    for (const ing of ingredients) {
      if (!ing || !ing.itemId || !ing.name || !(Number(ing.quantity) > 0)) {
        return response(400, { error: ERROR_MESSAGES.RECIPE_INVALID_INGREDIENT });
      }
    }
    const now = new Date().toISOString();
    const recipe = {
      id: generateId(),
      title: sanitizeString(body.title),
      description: body.description || "",
      ingredients,
      servings: body.servings || undefined,
      prepTime: body.prepTime || undefined,
      cookTime: body.cookTime || undefined,
      category: body.category || undefined,
      ownerId: userId || "anonymous",
      createdAt: now,
      updatedAt: now,
    };
    await dynamodb.put({ TableName: RECIPES_TABLE_NAME, Item: recipe }).promise();
    return response(201, recipe);
  } catch (error) {
    console.error("Error in createRecipe:", error);
    return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
  }
};

// PUT /api/recipes/:id
exports.updateRecipe = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const id = event.pathParameters.id;
    const body = JSON.parse(event.body || "{}");
    const existing = await dynamodb.get({ TableName: RECIPES_TABLE_NAME, Key: { id } }).promise();
    if (!existing.Item) return response(404, { error: ERROR_MESSAGES.RECIPE_NOT_FOUND });
    if (body.ingredients) {
      if (!Array.isArray(body.ingredients)) return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
      for (const ing of body.ingredients) {
        if (!ing || !ing.itemId || !ing.name || !(Number(ing.quantity) > 0)) {
          return response(400, { error: ERROR_MESSAGES.RECIPE_INVALID_INGREDIENT });
        }
      }
    }
    const updated = {
      ...existing.Item,
      title: body.title !== undefined ? sanitizeString(body.title) : existing.Item.title,
      description: body.description !== undefined ? body.description : existing.Item.description,
      ingredients: body.ingredients !== undefined ? body.ingredients : existing.Item.ingredients,
      servings: body.servings !== undefined ? body.servings : existing.Item.servings,
      prepTime: body.prepTime !== undefined ? body.prepTime : existing.Item.prepTime,
      cookTime: body.cookTime !== undefined ? body.cookTime : existing.Item.cookTime,
      category: body.category !== undefined ? body.category : existing.Item.category,
      updatedAt: new Date().toISOString(),
    };
    await dynamodb.put({ TableName: RECIPES_TABLE_NAME, Item: updated }).promise();
    return response(200, updated);
  } catch (error) {
    console.error("Error in updateRecipe:", error);
    return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
  }
};

// DELETE /api/recipes/:id
exports.deleteRecipe = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const id = event.pathParameters.id;
    await dynamodb.delete({ TableName: RECIPES_TABLE_NAME, Key: { id } }).promise();
    return response(204, {});
  } catch (error) {
    console.error("Error in deleteRecipe:", error);
    return response(500, { error: ERROR_MESSAGES.RECIPE_DELETE_ERROR });
  }
};

// ========== GESTION DES TOKENS DE NOTIFICATION ==========

// POST /api/notifications/register
exports.registerNotificationToken = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const userId = event.headers["X-User-Id"] || event.headers["x-user-id"];
    const body = JSON.parse(event.body || "{}");
    const { token, deviceId, platform } = body;

    if (!isValidNotificationToken(token)) {
      return response(400, { error: ERROR_MESSAGES.NOTIFICATION_TOKEN_INVALID });
    }

    if (!deviceId || !platform) {
      return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
    }

    const now = new Date().toISOString();
    const tokenRecord = {
      userId,
      deviceId,
      token,
      platform, // 'web', 'android', 'ios'
      createdAt: now,
      updatedAt: now,
    };

    // Utiliser deviceId comme clé pour éviter les doublons
    await dynamodb
      .put({
        TableName: NOTIFICATION_TOKENS_TABLE_NAME,
        Item: tokenRecord,
      })
      .promise();

    return response(201, { message: "Token enregistré avec succès" });
  } catch (error) {
    console.error("Error in registerNotificationToken:", error);
    return response(500, { error: ERROR_MESSAGES.NOTIFICATION_TOKEN_SAVE_ERROR });
  }
};

// DELETE /api/notifications/unregister
exports.unregisterNotificationToken = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const userId = event.headers["X-User-Id"] || event.headers["x-user-id"];
    const body = JSON.parse(event.body || "{}");
    const { deviceId } = body;

    if (!deviceId) {
      return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
    }

    await dynamodb
      .delete({
        TableName: NOTIFICATION_TOKENS_TABLE_NAME,
        Key: { userId, deviceId },
      })
      .promise();

    return response(204, {});
  } catch (error) {
    console.error("Error in unregisterNotificationToken:", error);
    return response(500, { error: ERROR_MESSAGES.NOTIFICATION_TOKEN_DELETE_ERROR });
  }
};

// GET /api/notifications/tokens
exports.getNotificationTokens = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const userId = event.headers["X-User-Id"] || event.headers["x-user-id"];

    const result = await dynamodb
      .query({
        TableName: NOTIFICATION_TOKENS_TABLE_NAME,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      })
      .promise();

    return response(200, result.Items || []);
  } catch (error) {
    console.error("Error in getNotificationTokens:", error);
    return response(500, { error: ERROR_MESSAGES.NOTIFICATION_TOKEN_RETRIEVE_ERROR });
  }
};

// ========== GESTION DES NOTES AVEC RAPPELS ==========

// GET /api/reminder-notes
exports.getReminderNotes = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const result = await dynamodb.scan({ TableName: REMINDER_NOTES_TABLE_NAME }).promise();
    return response(200, result.Items || []);
  } catch (error) {
    console.error("Error in getReminderNotes:", error);
    return response(500, { error: ERROR_MESSAGES.REMINDER_NOTE_RETRIEVE_ERROR });
  }
};

// POST /api/reminder-notes
exports.createReminderNote = async (event) => {
  // 1. Log initial pour voir les headers et le raw body (utile pour debug l'encodage ou les headers manquants)
  console.log("Incoming event headers:", JSON.stringify(event.headers));

  const authError = authenticate(event);
  if (authError) {
    console.warn("Authentication failed for createReminderNote");
    return authError;
  }

  try {
    // Normalisation des headers (minuscules/majuscules)
    const userId = event.headers["X-User-Id"] || event.headers["x-user-id"];

    if (!userId) {
      console.warn("Error: Missing X-User-Id header");
    }

    // 2. Log du body parsé pour vérifier ce qui arrive vraiment
    let body;
    try {
      body = JSON.parse(event.body || "{}");
      console.log("Parsed Payload:", JSON.stringify(body));
    } catch (e) {
      console.error("Error parsing JSON body:", e);
      return response(400, { error: "Invalid JSON format" });
    }

    const { title, content, reminderDate, reminderTime, isRecurring, recurrenceRule } = body;

    // Validation Titre
    if (!title || !title.trim()) {
      console.warn(`Validation Error: Title is missing or empty. Received: "${title}"`);
      return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
    }

    // Validation Présence Date/Heure
    if (!reminderDate || !reminderTime) {
      console.warn(`Validation Error: Missing date fields. Date: ${reminderDate}, Time: ${reminderTime}`);
      return response(400, { error: ERROR_MESSAGES.REMINDER_INVALID_DATE });
    }

    // Vérification Date Future
    const reminderDateTime = new Date(`${reminderDate}T${reminderTime}`);
    const currentTime = new Date();
    const oneHourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000);

    // 3. Log critique pour les dates (souvent la cause des problèmes de timezone)
    if (isNaN(reminderDateTime.getTime()) || reminderDateTime < oneHourAgo) {
      console.warn("Validation Error: Date logic failed.", {
        inputDate: `${reminderDate}T${reminderTime}`,
        parsedDate: reminderDateTime.toISOString(), // Vérifie si ISO correspond à ce que tu attends
        serverCurrentTime: currentTime.toISOString(),
        thresholdTime: oneHourAgo.toISOString(),
        isInvalidDate: isNaN(reminderDateTime.getTime()),
        isPast: reminderDateTime < oneHourAgo,
      });
      return response(400, { error: ERROR_MESSAGES.REMINDER_PAST_DATE });
    }

    // Valider la règle de récurrence
    if (isRecurring && !isValidRecurrenceRule(recurrenceRule)) {
      console.warn(`Validation Error: Invalid recurrence rule. Rule received: ${recurrenceRule}`);
      return response(400, { error: ERROR_MESSAGES.REMINDER_INVALID_RECURRENCE });
    }

    const now = new Date().toISOString();
    const reminderNote = {
      id: generateId(),
      title: sanitizeString(title),
      content: content || "",
      ownerId: userId,
      reminderDate,
      reminderTime,
      isRecurring: !!isRecurring,
      recurrenceRule: isRecurring ? recurrenceRule : undefined,
      status: REMINDER_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now,
    };

    console.log("Saving reminder note to DynamoDB:", JSON.stringify(reminderNote));

    await dynamodb.put({ TableName: REMINDER_NOTES_TABLE_NAME, Item: reminderNote }).promise();

    return response(201, reminderNote);
  } catch (error) {
    // Log complet de l'erreur système (DynamoDB ou autre)
    console.error("CRITICAL Error in createReminderNote:", error, error.stack);

    // Note: Retourner 400 ici masque souvent des 500 réels.
    // Si c'est une erreur DynamoDB, c'est probablement technique, pas une erreur utilisateur.
    return response(400, { error: ERROR_MESSAGES.REMINDER_NOTE_SAVE_ERROR, details: error.message });
  }
};

// PUT /api/reminder-notes/:id
exports.updateReminderNote = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const userId = event.headers["X-User-Id"] || event.headers["x-user-id"];
    const id = event.pathParameters.id;
    const body = JSON.parse(event.body || "{}");

    const existing = await dynamodb.get({ TableName: REMINDER_NOTES_TABLE_NAME, Key: { id } }).promise();
    if (!existing.Item) {
      return response(404, { error: ERROR_MESSAGES.REMINDER_NOTE_NOT_FOUND });
    }

    if (existing.Item.ownerId !== userId) {
      return response(403, { error: ERROR_MESSAGES.UNAUTHORIZED });
    }

    // Si on modifie la date/heure, vérifier qu'elle est dans le futur
    const newDate = body.reminderDate || existing.Item.reminderDate;
    const newTime = body.reminderTime || existing.Item.reminderTime;
    const reminderDateTime = new Date(`${newDate}T${newTime}`);

    if (isNaN(reminderDateTime.getTime()) || reminderDateTime <= new Date()) {
      return response(400, { error: ERROR_MESSAGES.REMINDER_PAST_DATE });
    }

    // Valider la règle de récurrence si modifiée
    const newIsRecurring = body.isRecurring !== undefined ? body.isRecurring : existing.Item.isRecurring;
    const newRecurrenceRule = body.recurrenceRule || existing.Item.recurrenceRule;

    if (newIsRecurring && !isValidRecurrenceRule(newRecurrenceRule)) {
      return response(400, { error: ERROR_MESSAGES.REMINDER_INVALID_RECURRENCE });
    }

    const updated = {
      ...existing.Item,
      title: body.title !== undefined ? sanitizeString(body.title) : existing.Item.title,
      content: body.content !== undefined ? body.content : existing.Item.content,
      reminderDate: newDate,
      reminderTime: newTime,
      isRecurring: newIsRecurring,
      recurrenceRule: newIsRecurring ? newRecurrenceRule : undefined,
      status: REMINDER_STATUS.ACTIVE, // Réactiver si modifié
      updatedAt: new Date().toISOString(),
    };

    await dynamodb.put({ TableName: REMINDER_NOTES_TABLE_NAME, Item: updated }).promise();
    return response(200, updated);
  } catch (error) {
    console.error("Error in updateReminderNote:", error);
    return response(400, { error: ERROR_MESSAGES.REMINDER_NOTE_SAVE_ERROR });
  }
};

// DELETE /api/reminder-notes/:id
exports.deleteReminderNote = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const userId = event.headers["X-User-Id"] || event.headers["x-user-id"];
    const id = event.pathParameters.id;

    const existing = await dynamodb.get({ TableName: REMINDER_NOTES_TABLE_NAME, Key: { id } }).promise();
    if (!existing.Item) {
      return response(404, { error: ERROR_MESSAGES.REMINDER_NOTE_NOT_FOUND });
    }

    if (existing.Item.ownerId !== userId) {
      return response(403, { error: ERROR_MESSAGES.UNAUTHORIZED });
    }

    await dynamodb.delete({ TableName: REMINDER_NOTES_TABLE_NAME, Key: { id } }).promise();
    return response(204, {});
  } catch (error) {
    console.error("Error in deleteReminderNote:", error);
    return response(500, { error: ERROR_MESSAGES.REMINDER_NOTE_DELETE_ERROR });
  }
};

// Fonction déclenchée par EventBridge pour vérifier et envoyer les rappels
exports.triggerReminders = async (event) => {
  try {
    console.log("Checking for reminders to trigger...");
    const now = new Date();

    // Récupérer toutes les notes avec rappels actifs
    const result = await dynamodb
      .scan({
        TableName: REMINDER_NOTES_TABLE_NAME,
        FilterExpression: "#status = :active",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":active": REMINDER_STATUS.ACTIVE,
        },
      })
      .promise();

    const reminders = result.Items || [];
    console.log(`Found ${reminders.length} active reminders`);

    for (const reminder of reminders) {
      if (shouldTriggerReminder(reminder, now)) {
        console.log(`Triggering reminder: ${reminder.id}`);

        // Récupérer tous les tokens de notification
        const tokensResult = await dynamodb.scan({ TableName: NOTIFICATION_TOKENS_TABLE_NAME }).promise();
        const tokens = tokensResult.Items || [];

        // Créer le payload de notification
        const notificationPayload = createReminderNotificationPayload(reminder);

        // Envoyer la notification à tous les appareils enregistrés
        // Note: Ici on devrait utiliser SNS ou Firebase Cloud Messaging
        // Pour l'instant, on log juste
        console.log(`Would send notification to ${tokens.length} devices:`, notificationPayload);

        // TODO: Implémenter l'envoi réel via SNS/FCM
        // await sendPushNotification(tokens, notificationPayload);

        // Mettre à jour le statut de la note
        if (reminder.isRecurring) {
          // Calculer la prochaine date de rappel
          const nextDate = calculateNextReminderDate(
            `${reminder.reminderDate}T${reminder.reminderTime}`,
            reminder.recurrenceRule,
          );

          if (nextDate) {
            // Mettre à jour avec la nouvelle date
            const [newDate, newTime] = nextDate.split("T");
            await dynamodb
              .update({
                TableName: REMINDER_NOTES_TABLE_NAME,
                Key: { id: reminder.id },
                UpdateExpression: "SET reminderDate = :date, reminderTime = :time, updatedAt = :now",
                ExpressionAttributeValues: {
                  ":date": newDate,
                  ":time": newTime.substring(0, 5), // HH:mm
                  ":now": new Date().toISOString(),
                },
              })
              .promise();
            console.log(`Updated recurring reminder ${reminder.id} to next date: ${nextDate}`);
          } else {
            // Fin de la récurrence
            await dynamodb
              .update({
                TableName: REMINDER_NOTES_TABLE_NAME,
                Key: { id: reminder.id },
                UpdateExpression: "SET #status = :triggered, updatedAt = :now",
                ExpressionAttributeNames: {
                  "#status": "status",
                },
                ExpressionAttributeValues: {
                  ":triggered": REMINDER_STATUS.TRIGGERED,
                  ":now": new Date().toISOString(),
                },
              })
              .promise();
            console.log(`Recurring reminder ${reminder.id} has ended`);
          }
        } else {
          // Rappel ponctuel, marquer comme déclenché
          await dynamodb
            .update({
              TableName: REMINDER_NOTES_TABLE_NAME,
              Key: { id: reminder.id },
              UpdateExpression: "SET #status = :triggered, updatedAt = :now",
              ExpressionAttributeNames: {
                "#status": "status",
              },
              ExpressionAttributeValues: {
                ":triggered": REMINDER_STATUS.TRIGGERED,
                ":now": new Date().toISOString(),
              },
            })
            .promise();
          console.log(`Marked reminder ${reminder.id} as triggered`);
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Reminders checked successfully" }),
    };
  } catch (error) {
    console.error("Error in triggerReminders:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to trigger reminders" }),
    };
  }
};
