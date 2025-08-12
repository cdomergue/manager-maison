const AWS = require('aws-sdk');

// Configuration DynamoDB
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || 'gestion-maison-tasks';
const CATEGORIES_TABLE_NAME = process.env.CATEGORIES_TABLE_NAME || 'gestion-maison-categories';
const SHOPPING_ITEMS_TABLE_NAME = process.env.SHOPPING_ITEMS_TABLE_NAME || 'gestion-maison-shopping-items';
const SHOPPING_LIST_TABLE_NAME = process.env.SHOPPING_LIST_TABLE_NAME || 'gestion-maison-shopping-list';
const NOTES_TABLE_NAME = process.env.NOTES_TABLE_NAME || 'gestion-maison-notes';

// Configuration spéciale
const YOU_KNOW_WHAT = '21cdf2c38551';

// Headers CORS pour toutes les réponses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Secret-Key,X-User-Id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

// Fonction de vérification d'accès
const authenticate = (event) => {
  const magicWord = event.headers['X-Secret-Key'] || event.headers['x-secret-key'];

  if (!magicWord || magicWord !== YOU_KNOW_WHAT) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({error: 'Unauthorized: Invalid or missing credentials'})
    };
  }

  return null; // Accès autorisé
};

// Réponse standard
const response = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body)
});

// GET /api/status
exports.getStatus = async (event) => {
  // Vérification d'accès
  const authError = authenticate(event);
  if (authError) return authError;

  try {
    // Compter les tâches
    const result = await dynamodb.scan({
      TableName: TABLE_NAME,
      Select: 'COUNT'
    }).promise();

    return response(200, {
      status: 'online',
      totalTasks: result.Count,
      lastUpdated: new Date().toISOString(),
      serverTime: new Date().toISOString(),
      environment: 'lambda'
    });
  } catch (error) {
    console.error('Error in getStatus:', error);
    return response(500, { error: 'Erreur lors de la récupération du statut' });
  }
};

// GET /api/tasks
exports.getTasks = async (event) => {
  // Vérification d'accès
  const authError = authenticate(event);
  if (authError) return authError;

  try {
    const result = await dynamodb.scan({
      TableName: TABLE_NAME
    }).promise();

    return response(200, result.Items || []);
  } catch (error) {
    console.error('Error in getTasks:', error);
    return response(500, { error: 'Erreur lors de la récupération des tâches' });
  }
};

// POST /api/tasks
exports.createTask = async (event) => {
  // Vérification d'accès
  const authError = authenticate(event);
  if (authError) return authError;

  try {
    const body = JSON.parse(event.body);

    const newTask = {
      ...body,
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      nextDueDate: new Date(body.nextDueDate).toISOString(),
      lastCompleted: body.lastCompleted ? new Date(body.lastCompleted).toISOString() : undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: newTask
    }).promise();

    return response(201, newTask);
  } catch (error) {
    console.error('Error in createTask:', error);
    return response(400, { error: 'Données invalides' });
  }
};

// PUT /api/tasks/:id
exports.updateTask = async (event) => {
  // Vérification d'accès
  const authError = authenticate(event);
  if (authError) return authError;

  try {
    const taskId = event.pathParameters.id;
    const body = JSON.parse(event.body);

    // Récupérer la tâche existante
    const existing = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { id: taskId }
    }).promise();

    if (!existing.Item) {
      return response(404, { error: 'Tâche non trouvée' });
    }

    const updatedTask = {
      ...existing.Item,
      ...body,
      id: taskId,
      nextDueDate: body.nextDueDate ? new Date(body.nextDueDate).toISOString() : existing.Item.nextDueDate,
      lastCompleted: body.lastCompleted ? new Date(body.lastCompleted).toISOString() : existing.Item.lastCompleted,
      updatedAt: new Date().toISOString()
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: updatedTask
    }).promise();

    return response(200, updatedTask);
  } catch (error) {
    console.error('Error in updateTask:', error);
    return response(400, { error: 'Données invalides' });
  }
};

// DELETE /api/tasks/:id
exports.deleteTask = async (event) => {
  // Vérification d'accès
  const authError = authenticate(event);
  if (authError) return authError;

  try {
    const taskId = event.pathParameters.id;

    await dynamodb.delete({
      TableName: TABLE_NAME,
      Key: { id: taskId }
    }).promise();

    return response(204, {});
  } catch (error) {
    console.error('Error in deleteTask:', error);
    return response(500, { error: 'Erreur lors de la suppression' });
  }
};

// POST /api/tasks/:id/complete
exports.completeTask = async (event) => {
  // Vérification d'accès
  const authError = authenticate(event);
  if (authError) return authError;

  try {
    const taskId = event.pathParameters.id;

    // Récupérer la tâche existante
    const existing = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { id: taskId }
    }).promise();

    if (!existing.Item) {
      return response(404, { error: 'Tâche non trouvée' });
    }

    const task = existing.Item;
    task.lastCompleted = new Date().toISOString();
    task.nextDueDate = calculateNextDueDate(task).toISOString();
    task.updatedAt = new Date().toISOString();
    task.isActive = true; // Réactiver la tâche

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: task
    }).promise();

    return response(200, task);
  } catch (error) {
    console.error('Error in completeTask:', error);
    return response(500, { error: 'Erreur lors de la mise à jour' });
  }
};

// OPTIONS pour CORS
exports.options = async (event) => {
  return response(200, {});
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
    console.error('Error in getNotes:', error);
    return response(500, { error: 'Erreur lors de la récupération des notes' });
  }
};

// GET /api/notes/:id
exports.getNote = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const userId = event.headers['X-User-Id'] || event.headers['x-user-id'];
    const id = event.pathParameters.id;
    const result = await dynamodb.get({ TableName: NOTES_TABLE_NAME, Key: { id } }).promise();
    const note = result.Item;
    if (!note) return response(404, { error: 'Note non trouvée' });
    if (note.ownerId !== userId) {
      return response(403, { error: 'Accès non autorisé' });
    }
    return response(200, note);
  } catch (error) {
    console.error('Error in getNote:', error);
    return response(500, { error: 'Erreur lors de la récupération de la note' });
  }
};

// POST /api/notes
exports.createNote = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const userId = event.headers['X-User-Id'] || event.headers['x-user-id'];
    const body = JSON.parse(event.body || '{}');
    const now = new Date().toISOString();
    const otherUsers = ['Christophe', 'Laurence'].filter(u => u !== userId);
    const newNote = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      title: (body.title || '').trim(),
      content: body.content || '',
      ownerId: userId,
      createdAt: now,
      updatedAt: now
    };
    await dynamodb.put({ TableName: NOTES_TABLE_NAME, Item: newNote }).promise();
    return response(201, newNote);
  } catch (error) {
    console.error('Error in createNote:', error);
    return response(400, { error: 'Données invalides' });
  }
};

// PUT /api/notes/:id
exports.updateNote = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const userId = event.headers['X-User-Id'] || event.headers['x-user-id'];
    const id = event.pathParameters.id;
    const body = JSON.parse(event.body || '{}');
    const existing = await dynamodb.get({ TableName: NOTES_TABLE_NAME, Key: { id } }).promise();
    if (!existing.Item) return response(404, { error: 'Note non trouvée' });
    const canEdit = existing.Item.ownerId === userId;
    if (!canEdit) return response(403, { error: 'Accès non autorisé' });
    const updated = {
      ...existing.Item,
      title: body.title !== undefined ? (body.title || '').trim() : existing.Item.title,
      content: body.content !== undefined ? body.content : existing.Item.content,
      // sharedWith modifiable via endpoint dédié de partage
      updatedAt: new Date().toISOString()
    };
    await dynamodb.put({ TableName: NOTES_TABLE_NAME, Item: updated }).promise();
    return response(200, updated);
  } catch (error) {
    console.error('Error in updateNote:', error);
    return response(400, { error: 'Données invalides' });
  }
};

// DELETE /api/notes/:id
exports.deleteNote = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const userId = event.headers['X-User-Id'] || event.headers['x-user-id'];
    const id = event.pathParameters.id;
    const existing = await dynamodb.get({ TableName: NOTES_TABLE_NAME, Key: { id } }).promise();
    if (!existing.Item) return response(404, { error: 'Note non trouvée' });
    if (existing.Item.ownerId !== userId) return response(403, { error: 'Accès non autorisé' });
    await dynamodb.delete({ TableName: NOTES_TABLE_NAME, Key: { id } }).promise();
    return response(204, {});
  } catch (error) {
    console.error('Error in deleteNote:', error);
    return response(500, { error: 'Erreur lors de la suppression' });
  }
};

// partage supprimé

// ========== GESTION LISTE DE COURSES ==========

// GET /api/shopping/items
exports.getShoppingItems = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const result = await dynamodb.scan({TableName: SHOPPING_ITEMS_TABLE_NAME}).promise();
    return response(200, result.Items || []);
  } catch (error) {
    console.error('Error in getShoppingItems:', error);
    return response(500, {error: 'Erreur lors de la récupération du catalogue'});
  }
};

// POST /api/shopping/items
exports.createShoppingItem = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const body = JSON.parse(event.body || '{}');
    const name = (body.name || '').trim();
    const category = (body.category || '').trim();
    if (!name) return response(400, {error: 'Nom requis'});
    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      name,
      category: category || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await dynamodb.put({TableName: SHOPPING_ITEMS_TABLE_NAME, Item: item}).promise();
    return response(201, item);
  } catch (error) {
    console.error('Error in createShoppingItem:', error);
    return response(400, {error: 'Données invalides'});
  }
};

// DELETE /api/shopping/items/:id
exports.deleteShoppingItem = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const id = event.pathParameters.id;
    await dynamodb.delete({TableName: SHOPPING_ITEMS_TABLE_NAME, Key: {id}}).promise();
    // Supprimer les entrées associées dans la liste
    const list = await dynamodb.scan({TableName: SHOPPING_LIST_TABLE_NAME}).promise();
    const toDelete = (list.Items || []).filter(e => e.itemId === id);
    for (const entry of toDelete) {
      await dynamodb.delete({TableName: SHOPPING_LIST_TABLE_NAME, Key: {id: entry.id}}).promise();
    }
    return response(204, {});
  } catch (error) {
    console.error('Error in deleteShoppingItem:', error);
    return response(500, {error: 'Erreur lors de la suppression'});
  }
};

// GET /api/shopping/list
exports.getShoppingList = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const result = await dynamodb.scan({TableName: SHOPPING_LIST_TABLE_NAME}).promise();
    return response(200, result.Items || []);
  } catch (error) {
    console.error('Error in getShoppingList:', error);
    return response(500, {error: 'Erreur lors de la récupération de la liste'});
  }
};

// POST /api/shopping/list
exports.addShoppingEntry = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const body = JSON.parse(event.body || '{}');
    const itemId = body.itemId;
    const quantity = Math.max(1, Number(body.quantity || 1));
    if (!itemId) return response(400, {error: 'itemId requis'});

    // Récupérer l'item
    const item = await dynamodb.get({TableName: SHOPPING_ITEMS_TABLE_NAME, Key: {id: itemId}}).promise();
    if (!item.Item) return response(404, {error: 'Item non trouvé'});

    // Tenter d'agréger une entrée non cochée existante
    const list = await dynamodb.scan({TableName: SHOPPING_LIST_TABLE_NAME}).promise();
    const existing = (list.Items || []).find(e => e.itemId === itemId && !e.checked);
    if (existing) {
      const updated = {
        ...existing,
        quantity: Math.max(1, (existing.quantity || 1) + quantity),
        updatedAt: new Date().toISOString()
      };
      await dynamodb.put({TableName: SHOPPING_LIST_TABLE_NAME, Item: updated}).promise();
      return response(200, updated);
    }

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      itemId: itemId,
      name: item.Item.name,
      quantity,
      checked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await dynamodb.put({TableName: SHOPPING_LIST_TABLE_NAME, Item: entry}).promise();
    return response(201, entry);
  } catch (error) {
    console.error('Error in addShoppingEntry:', error);
    return response(400, {error: 'Données invalides'});
  }
};

// PUT /api/shopping/list/:id
exports.updateShoppingEntry = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const id = event.pathParameters.id;
    const body = JSON.parse(event.body || '{}');
    const existing = await dynamodb.get({TableName: SHOPPING_LIST_TABLE_NAME, Key: {id}}).promise();
    if (!existing.Item) return response(404, {error: 'Entrée non trouvée'});

    const updated = {
      ...existing.Item,
      quantity: body.quantity !== undefined ? Math.max(1, Number(body.quantity)) : existing.Item.quantity,
      checked: body.checked !== undefined ? !!body.checked : existing.Item.checked,
      updatedAt: new Date().toISOString()
    };
    await dynamodb.put({TableName: SHOPPING_LIST_TABLE_NAME, Item: updated}).promise();
    return response(200, updated);
  } catch (error) {
    console.error('Error in updateShoppingEntry:', error);
    return response(400, {error: 'Données invalides'});
  }
};

// DELETE /api/shopping/list/:id
exports.deleteShoppingEntry = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const id = event.pathParameters.id;
    await dynamodb.delete({TableName: SHOPPING_LIST_TABLE_NAME, Key: {id}}).promise();
    return response(204, {});
  } catch (error) {
    console.error('Error in deleteShoppingEntry:', error);
    return response(500, {error: 'Erreur lors de la suppression'});
  }
};

// POST /api/shopping/list/clear-checked
exports.clearCheckedShoppingEntries = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const list = await dynamodb.scan({TableName: SHOPPING_LIST_TABLE_NAME}).promise();
    const toDelete = (list.Items || []).filter(e => e.checked);
    for (const entry of toDelete) {
      await dynamodb.delete({TableName: SHOPPING_LIST_TABLE_NAME, Key: {id: entry.id}}).promise();
    }
    return response(204, {});
  } catch (error) {
    console.error('Error in clearCheckedShoppingEntries:', error);
    return response(500, {error: 'Erreur lors du nettoyage'});
  }
};

// DELETE /api/shopping/list
exports.clearAllShoppingEntries = async (event) => {
  const authError = authenticate(event);
  if (authError) return authError;
  try {
    const list = await dynamodb.scan({TableName: SHOPPING_LIST_TABLE_NAME}).promise();
    for (const entry of (list.Items || [])) {
      await dynamodb.delete({TableName: SHOPPING_LIST_TABLE_NAME, Key: {id: entry.id}}).promise();
    }
    return response(204, {});
  } catch (error) {
    console.error('Error in clearAllShoppingEntries:', error);
    return response(500, {error: 'Erreur lors du vidage'});
  }
};

// ========== GESTION DES CATÉGORIES ==========

// Catégories par défaut
const DEFAULT_CATEGORIES = [
  {
    id: "cuisine",
    name: "Cuisine",
    description: "Tâches liées à la cuisine et à la préparation des repas",
    isDefault: true
  },
  {
    id: "menage",
    name: "Ménage",
    description: "Tâches de nettoyage et d'entretien de la maison",
    isDefault: true
  },
  {
    id: "linge",
    name: "Linge",
    description: "Tâches liées à la lessive et au repassage",
    isDefault: true
  },
  {
    id: "jardin",
    name: "Jardin",
    description: "Entretien du jardin et des plantes",
    isDefault: true
  },
  {
    id: "administratif",
    name: "Administratif",
    description: "Tâches administratives et paperasse",
    isDefault: true
  },
  {
    id: "chats",
    name: "Chats",
    description: "Soins et entretien des chats",
    isDefault: true
  },
  {
    id: "rangements",
    name: "Rangements",
    description: "Organisation et rangement de la maison",
    isDefault: true
  },
  {
    id: "autre",
    name: "Autre",
    description: "Autres tâches diverses",
    isDefault: true
  }
];

// Initialiser les catégories par défaut si la table est vide
async function initializeDefaultCategories() {
  try {
    const result = await dynamodb.scan({
      TableName: CATEGORIES_TABLE_NAME,
      Select: 'COUNT'
    }).promise();

    if (result.Count === 0) {
      // Insérer les catégories par défaut
      for (const category of DEFAULT_CATEGORIES) {
        await dynamodb.put({
          TableName: CATEGORIES_TABLE_NAME,
          Item: {
            ...category,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }).promise();
      }
    }
  } catch (error) {
    console.warn('Could not initialize default categories:', error);
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

    const result = await dynamodb.scan({
      TableName: CATEGORIES_TABLE_NAME
    }).promise();

    return response(200, result.Items || []);
  } catch (error) {
    console.error('Error in getCategories:', error);
    return response(500, {error: 'Erreur lors de la récupération des catégories'});
  }
};

// GET /api/categories/:id
exports.getCategory = async (event) => {
  // Vérification d'accès
  const authError = authenticate(event);
  if (authError) return authError;

  try {
    const categoryId = event.pathParameters.id;

    const result = await dynamodb.get({
      TableName: CATEGORIES_TABLE_NAME,
      Key: {id: categoryId}
    }).promise();

    if (!result.Item) {
      return response(404, {error: 'Catégorie non trouvée'});
    }

    return response(200, result.Item);
  } catch (error) {
    console.error('Error in getCategory:', error);
    return response(500, {error: 'Erreur lors de la récupération de la catégorie'});
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
      id: body.id || Date.now().toString(36) + Math.random().toString(36).substr(2),
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Vérifier si l'ID existe déjà
    const existing = await dynamodb.get({
      TableName: CATEGORIES_TABLE_NAME,
      Key: {id: newCategory.id}
    }).promise();

    if (existing.Item) {
      return response(400, {error: 'Une catégorie avec cet ID existe déjà'});
    }

    await dynamodb.put({
      TableName: CATEGORIES_TABLE_NAME,
      Item: newCategory
    }).promise();

    return response(201, newCategory);
  } catch (error) {
    console.error('Error in createCategory:', error);
    return response(400, {error: 'Données invalides'});
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
    const existing = await dynamodb.get({
      TableName: CATEGORIES_TABLE_NAME,
      Key: {id: categoryId}
    }).promise();

    if (!existing.Item) {
      return response(404, {error: 'Catégorie non trouvée'});
    }

    // Empêcher la modification de l'ID et préserver le statut isDefault
    const {id, ...updateData} = body;
    const isDefault = existing.Item.isDefault;

    const updatedCategory = {
      ...existing.Item,
      ...updateData,
      id: categoryId,
      isDefault,
      updatedAt: new Date().toISOString()
    };

    await dynamodb.put({
      TableName: CATEGORIES_TABLE_NAME,
      Item: updatedCategory
    }).promise();

    return response(200, updatedCategory);
  } catch (error) {
    console.error('Error in updateCategory:', error);
    return response(400, {error: 'Données invalides'});
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
    const existing = await dynamodb.get({
      TableName: CATEGORIES_TABLE_NAME,
      Key: {id: categoryId}
    }).promise();

    if (!existing.Item) {
      return response(404, {error: 'Catégorie non trouvée'});
    }

    // Empêcher la suppression des catégories par défaut
    if (existing.Item.isDefault) {
      return response(400, {error: 'Impossible de supprimer une catégorie par défaut'});
    }

    await dynamodb.delete({
      TableName: CATEGORIES_TABLE_NAME,
      Key: {id: categoryId}
    }).promise();

    return response(204, {});
  } catch (error) {
    console.error('Error in deleteCategory:', error);
    return response(500, {error: 'Erreur lors de la suppression'});
  }
};

// Fonction utilitaire pour calculer la prochaine date
function calculateNextDueDate(task) {
  const lastCompleted = new Date(task.lastCompleted);
  let nextDue = new Date(lastCompleted);

  switch (task.frequency) {
    case 'daily':
      nextDue.setDate(nextDue.getDate() + 1);
      break;
    case 'weekly':
      nextDue.setDate(nextDue.getDate() + 7);
      break;
    case 'monthly':
      nextDue.setMonth(nextDue.getMonth() + 1);
      break;
    case 'custom':
      nextDue.setDate(nextDue.getDate() + (task.customDays || 7));
      break;
    default:
      nextDue.setDate(nextDue.getDate() + 7);
  }

  return nextDue;
}
