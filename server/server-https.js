const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const config = require('./config');

const app = express();
const PORT = config.port;
const HTTPS_PORT = 3443; // Port HTTPS
const DB_PATH = path.join(__dirname, config.database.path);

// Chemin vers les fichiers statiques de l'application Angular
const STATIC_PATH = path.join(__dirname, '..', 'dist', 'gestion-maison', 'browser');

// Middleware
app.use(cors(config.cors));
app.use(bodyParser.json({ limit: config.security.maxRequestSize }));

// Servir les fichiers statiques de l'application Angular
app.use(express.static(STATIC_PATH));

// Assurer que le dossier data existe
fs.ensureDirSync(path.dirname(DB_PATH));

// Initialiser la base de données si elle n'existe pas
if (!fs.existsSync(DB_PATH)) {
  fs.writeJsonSync(DB_PATH, {
    tasks: [],
    lastUpdated: new Date().toISOString()
  });
}

// Fonction utilitaire pour lire la base de données
function readDatabase() {
  try {
    return fs.readJsonSync(DB_PATH);
  } catch (error) {
    console.error('Erreur lors de la lecture de la base de données:', error);
    return { tasks: [], lastUpdated: new Date().toISOString() };
  }
}

// Fonction utilitaire pour écrire dans la base de données
function writeDatabase(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeJsonSync(DB_PATH, data, { spaces: 2 });
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'écriture dans la base de données:', error);
    return false;
  }
}

// Routes API

// GET /api/status - Statut du serveur
app.get('/api/status', (req, res) => {
  try {
    const db = readDatabase();
    res.json({
      status: 'online',
      totalTasks: db.tasks.length,
      lastUpdated: db.lastUpdated,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération du statut' });
  }
});

// GET /api/tasks - Récupérer toutes les tâches
app.get('/api/tasks', (req, res) => {
  try {
    const db = readDatabase();
    res.json(db.tasks);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des tâches' });
  }
});

// POST /api/tasks - Créer une nouvelle tâche
app.post('/api/tasks', (req, res) => {
  try {
    const db = readDatabase();
    const newTask = {
      ...req.body,
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      nextDueDate: new Date(req.body.nextDueDate).toISOString(),
      lastCompleted: req.body.lastCompleted ? new Date(req.body.lastCompleted).toISOString() : undefined,
      isActive: true
    };
    
    db.tasks.push(newTask);
    
    if (writeDatabase(db)) {
      res.status(201).json(newTask);
    } else {
      res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
    }
  } catch (error) {
    res.status(400).json({ error: 'Données invalides' });
  }
});

// PUT /api/tasks/:id - Mettre à jour une tâche
app.put('/api/tasks/:id', (req, res) => {
  try {
    const db = readDatabase();
    const taskIndex = db.tasks.findIndex(task => task.id === req.params.id);
    
    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }
    
    const updatedTask = {
      ...db.tasks[taskIndex],
      ...req.body,
      id: req.params.id,
      nextDueDate: req.body.nextDueDate ? new Date(req.body.nextDueDate).toISOString() : db.tasks[taskIndex].nextDueDate,
      lastCompleted: req.body.lastCompleted ? new Date(req.body.lastCompleted).toISOString() : db.tasks[taskIndex].lastCompleted
    };
    
    db.tasks[taskIndex] = updatedTask;
    
    if (writeDatabase(db)) {
      res.json(updatedTask);
    } else {
      res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
    }
  } catch (error) {
    res.status(400).json({ error: 'Données invalides' });
  }
});

// DELETE /api/tasks/:id - Supprimer une tâche
app.delete('/api/tasks/:id', (req, res) => {
  try {
    const db = readDatabase();
    const taskIndex = db.tasks.findIndex(task => task.id === req.params.id);
    
    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }
    
    db.tasks.splice(taskIndex, 1);
    
    if (writeDatabase(db)) {
      res.status(204).send();
    } else {
      res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// POST /api/tasks/:id/complete - Marquer une tâche comme terminée
app.post('/api/tasks/:id/complete', (req, res) => {
  try {
    const db = readDatabase();
    const taskIndex = db.tasks.findIndex(task => task.id === req.params.id);
    
    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }
    
    const task = db.tasks[taskIndex];
    const nowIso = new Date().toISOString();
    const author = req.header('X-User-Id') || task.assignee || 'unknown';
    task.lastCompleted = nowIso;
    task.nextDueDate = calculateNextDueDate(task).toISOString();
    task.history = Array.isArray(task.history) ? task.history : [];
    task.history.push({ date: nowIso, author });
    
    if (writeDatabase(db)) {
      res.json(task);
    } else {
      res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// Route pour servir l'application Angular (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(STATIC_PATH, 'index.html'));
});

// Fonction pour calculer la prochaine date d'échéance
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

// Certificats auto-signés pour le développement
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem'))
};

// Démarrer le serveur HTTPS
https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
  console.log(`🚀 Serveur HTTPS démarré sur le port ${HTTPS_PORT}`);
  console.log(`📱 Application accessible sur: https://localhost:${HTTPS_PORT}`);
  console.log(`🔒 HTTPS activé pour les notifications push`);
});

// Démarrer aussi le serveur HTTP pour la compatibilité
app.listen(PORT, () => {
  console.log(`🌐 Serveur HTTP démarré sur le port ${PORT}`);
  console.log(`📱 Application accessible sur: http://localhost:${PORT}`);
}); 