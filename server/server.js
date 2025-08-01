const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const categoriesRoutes = require('./routes/categories');

const app = express();
const PORT = process.env.PORT || config.port;
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

// Routes des catégories
app.use('/api/categories', categoriesRoutes);

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
    task.lastCompleted = new Date().toISOString();
    task.nextDueDate = calculateNextDueDate(task);
    task.isActive = true; // Réactiver la tâche
    
    if (writeDatabase(db)) {
      res.json(task);
    } else {
      res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// GET /api/tasks/overdue - Récupérer les tâches en retard
app.get('/api/tasks/overdue', (req, res) => {
  try {
    const db = readDatabase();
    const now = new Date();
    const overdueTasks = db.tasks.filter(task => 
      task.isActive && new Date(task.nextDueDate) < now
    );
    res.json(overdueTasks);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des tâches en retard' });
  }
});

// GET /api/tasks/category/:category - Récupérer les tâches par catégorie
app.get('/api/tasks/category/:category', (req, res) => {
  try {
    const db = readDatabase();
    const filteredTasks = db.tasks.filter(task => task.category === req.params.category);
    res.json(filteredTasks);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des tâches par catégorie' });
  }
});

// GET /api/status - Statut du serveur
app.get('/api/status', (req, res) => {
  try {
    const db = readDatabase();
    res.json({
      status: 'OK',
      totalTasks: db.tasks.length,
      lastUpdated: db.lastUpdated,
      serverTime: new Date().toISOString(),
      staticFiles: fs.existsSync(STATIC_PATH) ? 'Disponibles' : 'Non trouvés'
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération du statut' });
  }
});



// Route pour servir l'application Angular (SPA)
app.get('*', (req, res) => {
  // Ne pas intercepter les routes API
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route API non trouvée' });
  }
  
  // Servir index.html pour toutes les autres routes (SPA)
  const indexPath = path.join(STATIC_PATH, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`
      <html>
        <head><title>Application non trouvée</title></head>
        <body>
          <h1>Application Angular non trouvée</h1>
          <p>Veuillez d'abord construire l'application :</p>
          <pre>npm run build</pre>
          <p>Puis redémarrer le serveur.</p>
        </body>
      </html>
    `);
  }
});

// Fonction pour calculer la prochaine date d'échéance
function calculateNextDueDate(task) {
  const now = new Date();
  const nextDate = new Date(now);
  
  switch (task.frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'custom':
      nextDate.setDate(nextDate.getDate() + (task.customDays || 1));
      break;
  }
  
  return nextDate.toISOString();
}

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📁 Base de données: ${DB_PATH}`);
  console.log(`🌐 API disponible sur: http://localhost:${PORT}/api`);
});

module.exports = app; 