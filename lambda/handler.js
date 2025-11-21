const AWS = require("aws-sdk");
const webpush = require("web-push");

// Modules partagés packagés
const {
  generateId,
  sanitizeString,
  DEFAULT_CATEGORIES,
  ERROR_MESSAGES,
  DEFAULT_CORS_HEADERS,
  isValidNotificationToken,
  isValidRecurrenceRule,
  calculateNextReminderDate,
  shouldTriggerReminder,
  REMINDER_STATUS,
} = require("taches-menageres-shared");

// Configuration DynamoDB et SNS
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

const CATEGORIES_TABLE_NAME = process.env.CATEGORIES_TABLE_NAME || "gestion-maison-categories";
const SHOPPING_ITEMS_TABLE_NAME = process.env.SHOPPING_ITEMS_TABLE_NAME || "gestion-maison-shopping-items";
const SHOPPING_LIST_TABLE_NAME = process.env.SHOPPING_LIST_TABLE_NAME || "gestion-maison-shopping-list";
const NOTES_TABLE_NAME = process.env.NOTES_TABLE_NAME || "gestion-maison-notes";
const RECIPES_TABLE_NAME = process.env.RECIPES_TABLE_NAME || "gestion-maison-recipes";
const REMINDER_NOTES_TABLE_NAME = process.env.REMINDER_NOTES_TABLE_NAME || "gestion-maison-reminder-notes";
const NOTIFICATION_TOKENS_TABLE_NAME =
  process.env.NOTIFICATION_TOKENS_TABLE_NAME || "gestion-maison-notification-tokens";

const REMINDERS_TOPIC_ARN = process.env.REMINDERS_TOPIC_ARN;

// Configuration VAPID unique au démarrage
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:kricridom@gmail.com",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    console.log("VAPID details configured successfully");
  } catch (err) {
    console.error("Failed to set VAPID details:", err);
  }
}

// Configuration spéciale
const YOU_KNOW_WHAT = "21cdf2c38551";

// Headers CORS pour toutes les réponses
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
  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Credentials": "false",
    },
    body: JSON.stringify({ message: "CORS preflight response" }),
  };
};

// ========== GESTION DES NOTES ==========

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
      updatedAt: new Date().toISOString(),
    };
    await dynamodb.put({ TableName: NOTES_TABLE_NAME, Item: updated }).promise();
    return response(200, updated);
  } catch (error) {
    console.error("Error in updateNote:", error);
    return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
  }
};

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

// ========== GESTION LISTE DE COURSES ==========

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

exports.deleteShoppingItem = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const id = event.pathParameters.id;
    await dynamodb.delete({ TableName: SHOPPING_ITEMS_TABLE_NAME, Key: { id } }).promise();
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

exports.addShoppingEntry = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const body = JSON.parse(event.body || "{}");
    const itemId = body.itemId;
    const quantity = Math.max(1, Number(body.quantity || 1));
    if (!itemId) return response(400, { error: "itemId requis" });

    const item = await dynamodb.get({ TableName: SHOPPING_ITEMS_TABLE_NAME, Key: { id: itemId } }).promise();
    if (!item.Item) return response(404, { error: "Item non trouvé" });

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

async function initializeDefaultCategories() {
  try {
    const result = await dynamodb
      .scan({
        TableName: CATEGORIES_TABLE_NAME,
        Select: "COUNT",
      })
      .promise();

    if (result.Count === 0) {
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

exports.getCategories = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;

  try {
    await initializeDefaultCategories();
    const result = await dynamodb.scan({ TableName: CATEGORIES_TABLE_NAME }).promise();
    return response(200, result.Items || []);
  } catch (error) {
    console.error("Error in getCategories:", error);
    return response(500, { error: "Erreur lors de la récupération des catégories" });
  }
};

exports.getCategory = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const categoryId = event.pathParameters.id;
    const result = await dynamodb.get({ TableName: CATEGORIES_TABLE_NAME, Key: { id: categoryId } }).promise();
    if (!result.Item) {
      return response(404, { error: "Catégorie non trouvée" });
    }
    return response(200, result.Item);
  } catch (error) {
    console.error("Error in getCategory:", error);
    return response(500, { error: "Erreur lors de la récupération de la catégorie" });
  }
};

exports.createCategory = async (event) => {
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
    const existing = await dynamodb.get({ TableName: CATEGORIES_TABLE_NAME, Key: { id: newCategory.id } }).promise();
    if (existing.Item) {
      return response(400, { error: "Une catégorie avec cet ID existe déjà" });
    }
    await dynamodb.put({ TableName: CATEGORIES_TABLE_NAME, Item: newCategory }).promise();
    return response(201, newCategory);
  } catch (error) {
    console.error("Error in createCategory:", error);
    return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
  }
};

exports.updateCategory = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const categoryId = event.pathParameters.id;
    const body = JSON.parse(event.body);
    const existing = await dynamodb.get({ TableName: CATEGORIES_TABLE_NAME, Key: { id: categoryId } }).promise();
    if (!existing.Item) {
      return response(404, { error: "Catégorie non trouvée" });
    }
    const { id, ...updateData } = body;
    const isDefault = existing.Item.isDefault;
    const updatedCategory = {
      ...existing.Item,
      ...updateData,
      id: categoryId,
      isDefault,
      updatedAt: new Date().toISOString(),
    };
    await dynamodb.put({ TableName: CATEGORIES_TABLE_NAME, Item: updatedCategory }).promise();
    return response(200, updatedCategory);
  } catch (error) {
    console.error("Error in updateCategory:", error);
    return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
  }
};

exports.deleteCategory = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const categoryId = event.pathParameters.id;
    const existing = await dynamodb.get({ TableName: CATEGORIES_TABLE_NAME, Key: { id: categoryId } }).promise();
    if (!existing.Item) {
      return response(404, { error: "Catégorie non trouvée" });
    }
    if (existing.Item.isDefault) {
      return response(400, { error: "Impossible de supprimer une catégorie par défaut" });
    }
    await dynamodb.delete({ TableName: CATEGORIES_TABLE_NAME, Key: { id: categoryId } }).promise();
    return response(204, {});
  } catch (error) {
    console.error("Error in deleteCategory:", error);
    return response(500, { error: "Erreur lors de la suppression" });
  }
};

// ========== GESTION DES RECETTES ==========

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
      platform,
      createdAt: now,
      updatedAt: now,
    };

    await dynamodb.put({ TableName: NOTIFICATION_TOKENS_TABLE_NAME, Item: tokenRecord }).promise();
    return response(201, { message: "Token enregistré avec succès" });
  } catch (error) {
    console.error("Error in registerNotificationToken:", error);
    return response(500, { error: ERROR_MESSAGES.NOTIFICATION_TOKEN_SAVE_ERROR });
  }
};

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

    await dynamodb.delete({ TableName: NOTIFICATION_TOKENS_TABLE_NAME, Key: { userId, deviceId } }).promise();
    return response(204, {});
  } catch (error) {
    console.error("Error in unregisterNotificationToken:", error);
    return response(500, { error: ERROR_MESSAGES.NOTIFICATION_TOKEN_DELETE_ERROR });
  }
};

exports.getNotificationTokens = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const userId = event.headers["X-User-Id"] || event.headers["x-user-id"];
    const result = await dynamodb
      .query({
        TableName: NOTIFICATION_TOKENS_TABLE_NAME,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": userId },
      })
      .promise();
    return response(200, result.Items || []);
  } catch (error) {
    console.error("Error in getNotificationTokens:", error);
    return response(500, { error: ERROR_MESSAGES.NOTIFICATION_TOKEN_RETRIEVE_ERROR });
  }
};

// ========== GESTION DES NOTES AVEC RAPPELS ==========

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

exports.createReminderNote = async (event) => {
  console.log("Incoming event headers:", JSON.stringify(event.headers));
  const authError = authenticate(event);
  if (authError) {
    console.warn("Authentication failed for createReminderNote");
    return authError;
  }

  try {
    const userId = event.headers["X-User-Id"] || event.headers["x-user-id"];
    if (!userId) console.warn("Error: Missing X-User-Id header");

    let body;
    try {
      body = JSON.parse(event.body || "{}");
      console.log("Parsed Payload:", JSON.stringify(body));
    } catch (e) {
      console.error("Error parsing JSON body:", e);
      return response(400, { error: "Invalid JSON format" });
    }

    const { title, content, reminderDate, reminderTime, isRecurring, recurrenceRule } = body;

    if (!title || !title.trim()) {
      console.warn(`Validation Error: Title is missing or empty. Received: "${title}"`);
      return response(400, { error: ERROR_MESSAGES.INVALID_DATA });
    }

    if (!reminderDate || !reminderTime) {
      console.warn(`Validation Error: Missing date fields. Date: ${reminderDate}, Time: ${reminderTime}`);
      return response(400, { error: ERROR_MESSAGES.REMINDER_INVALID_DATE });
    }

    const reminderDateTime = new Date(`${reminderDate}T${reminderTime}`);
    const currentTime = new Date();
    const oneHourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000);

    if (isNaN(reminderDateTime.getTime()) || reminderDateTime < oneHourAgo) {
      console.warn("Validation Error: Date logic failed.", {
        inputDate: `${reminderDate}T${reminderTime}`,
        parsedDate: reminderDateTime.toISOString(),
        serverCurrentTime: currentTime.toISOString(),
        thresholdTime: oneHourAgo.toISOString(),
        isInvalidDate: isNaN(reminderDateTime.getTime()),
        isPast: reminderDateTime < oneHourAgo,
      });
      return response(400, { error: ERROR_MESSAGES.REMINDER_PAST_DATE });
    }

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
    console.error("CRITICAL Error in createReminderNote:", error, error.stack);
    return response(400, { error: ERROR_MESSAGES.REMINDER_NOTE_SAVE_ERROR, details: error.message });
  }
};

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

    const newDate = body.reminderDate || existing.Item.reminderDate;
    const newTime = body.reminderTime || existing.Item.reminderTime;
    const reminderDateTime = new Date(`${newDate}T${newTime}`);

    if (isNaN(reminderDateTime.getTime()) || reminderDateTime <= new Date()) {
      return response(400, { error: ERROR_MESSAGES.REMINDER_PAST_DATE });
    }

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
      status: REMINDER_STATUS.ACTIVE,
      updatedAt: new Date().toISOString(),
    };

    await dynamodb.put({ TableName: REMINDER_NOTES_TABLE_NAME, Item: updated }).promise();
    return response(200, updated);
  } catch (error) {
    console.error("Error in updateReminderNote:", error);
    return response(400, { error: ERROR_MESSAGES.REMINDER_NOTE_SAVE_ERROR });
  }
};

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
    console.log("Current time (ISO):", now.toISOString());
    const now = new Date();

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
      console.log("Reminder:", reminder);
      if (shouldTriggerReminder(reminder, now)) {
        console.log(`Triggering reminder: ${reminder.id}`);

        // 1. Envoi SNS pour déclencher la notification push (découplé)
        const snsPayload = {
          reminderId: reminder.id,
          title: reminder.title,
          content: reminder.content,
          type: "REMINDER_ALERT",
        };

        try {
          await sns
            .publish({
              TopicArn: REMINDERS_TOPIC_ARN,
              Message: JSON.stringify(snsPayload),
              MessageAttributes: {
                type: {
                  DataType: "String",
                  StringValue: "REMINDER",
                },
              },
            })
            .promise();
          console.log(`Event published to SNS for reminder ${reminder.id}`);
        } catch (snsError) {
          console.error(`Failed to publish SNS for reminder ${reminder.id}`, snsError);
        }

        // 2. Mettre à jour le statut de la note (Récurrence ou Terminé)
        if (reminder.isRecurring) {
          const nextDate = calculateNextReminderDate(
            `${reminder.reminderDate}T${reminder.reminderTime}`,
            reminder.recurrenceRule,
          );

          if (nextDate) {
            const [newDate, newTime] = nextDate.split("T");
            await dynamodb
              .update({
                TableName: REMINDER_NOTES_TABLE_NAME,
                Key: { id: reminder.id },
                UpdateExpression: "SET reminderDate = :date, reminderTime = :time, updatedAt = :now",
                ExpressionAttributeValues: {
                  ":date": newDate,
                  ":time": newTime.substring(0, 5),
                  ":now": new Date().toISOString(),
                },
              })
              .promise();
            console.log(`Updated recurring reminder ${reminder.id} to next date: ${nextDate}`);
          } else {
            await dynamodb
              .update({
                TableName: REMINDER_NOTES_TABLE_NAME,
                Key: { id: reminder.id },
                UpdateExpression: "SET #status = :triggered, updatedAt = :now",
                ExpressionAttributeNames: { "#status": "status" },
                ExpressionAttributeValues: {
                  ":triggered": REMINDER_STATUS.TRIGGERED,
                  ":now": new Date().toISOString(),
                },
              })
              .promise();
            console.log(`Recurring reminder ${reminder.id} has ended`);
          }
        } else {
          await dynamodb
            .update({
              TableName: REMINDER_NOTES_TABLE_NAME,
              Key: { id: reminder.id },
              UpdateExpression: "SET #status = :triggered, updatedAt = :now",
              ExpressionAttributeNames: { "#status": "status" },
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
      body: JSON.stringify({ message: "Reminders processed" }),
    };
  } catch (error) {
    console.error("Error in triggerReminders:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to trigger reminders" }),
    };
  }
};

// NOUVELLE FONCTION : CONSOMMATEUR SNS -> WEB PUSH
exports.sendNotification = async (event) => {
  const tokensTableName = NOTIFICATION_TOKENS_TABLE_NAME;

  for (const record of event.Records) {
    let snsMessage;
    try {
      snsMessage = JSON.parse(record.Sns.Message);
      console.log("Processing SNS Message:", snsMessage);
    } catch (e) {
      console.error("Error parsing SNS message:", e);
      continue;
    }

    try {
      // Récupérer les tokens
      const tokensResult = await dynamodb.scan({ TableName: tokensTableName }).promise();
      const tokens = tokensResult.Items || [];

      if (tokens.length === 0) {
        console.log("No devices registered for notification.");
        continue;
      }

      console.log(`Preparing to send to ${tokens.length} devices.`);
      console.log("Tokens found:", JSON.stringify(tokens.map((t) => ({ userId: t.userId, deviceId: t.deviceId }))));

      const payload = JSON.stringify({
        title: snsMessage.title || "Rappel Maison",
        body: snsMessage.content || "Vous avez un nouveau rappel",
        icon: "/icons/android/android-launchericon-192-192.png",
        badge: "/icons/android/android-launchericon-72-72.png",
        data: {
          reminderId: snsMessage.reminderId,
          url: "/",
        },
      });

      const sendPromises = tokens.map(async (tokenRecord) => {
        let subscription;
        try {
          subscription = typeof tokenRecord.token === "string" ? JSON.parse(tokenRecord.token) : tokenRecord.token;
        } catch (e) {
          console.error("Invalid token format for user", tokenRecord.userId, e);
          return;
        }

        try {
          await webpush.sendNotification(subscription, payload);
          console.log(`Notification sent to device ${tokenRecord.deviceId}`);
        } catch (err) {
          console.error(`Error sending to ${tokenRecord.deviceId}:`, err.statusCode);
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`Subscription expired for ${tokenRecord.deviceId}, deleting.`);
            await dynamodb
              .delete({
                TableName: tokensTableName,
                Key: {
                  userId: tokenRecord.userId,
                  deviceId: tokenRecord.deviceId,
                },
              })
              .promise();
          }
        }
      });

      await Promise.all(sendPromises);
    } catch (error) {
      console.error("Critical error in sendNotification loop:", error);
    }
  }

  return { status: "Success" };
};
