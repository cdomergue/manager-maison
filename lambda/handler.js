const AWS = require('aws-sdk');

// Configuration DynamoDB
const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || 'gestion-maison-tasks';

// Headers CORS pour toutes les réponses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

// Réponse standard
const response = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body)
});

// GET /api/status
exports.getStatus = async (event) => {
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