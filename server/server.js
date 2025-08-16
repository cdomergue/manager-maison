const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs-extra");
const path = require("path");
const config = require("./config");
const categoriesRoutes = require("./routes/categories");

// Modules partagés
const { generateId, sanitizeString, validateName, formatDateISO, getUserId } = require("../shared/utils");
const { calculateNextDueDate } = require("../shared/dates");
const { ERROR_MESSAGES, DEFAULT_DATABASE_STRUCTURE } = require("../shared/constants");

const app = express();
const PORT = process.env.PORT || config.port;
const DB_PATH = path.join(__dirname, config.database.path);

// Chemin vers les fichiers statiques de l'application Angular
const STATIC_PATH = path.join(__dirname, "..", "dist", "gestion-maison", "browser");

// Middleware
app.use(cors(config.cors));
app.use(bodyParser.json({ limit: config.security.maxRequestSize }));

// Servir les fichiers statiques de l'application Angular
app.use(express.static(STATIC_PATH));

// Assurer que le dossier data existe
fs.ensureDirSync(path.dirname(DB_PATH));

// Initialiser la base de données si elle n'existe pas
if (!fs.existsSync(DB_PATH)) {
  fs.writeJsonSync(DB_PATH, DEFAULT_DATABASE_STRUCTURE);
}

// Fonction utilitaire pour lire la base de données
function readDatabase() {
  try {
    const data = fs.readJsonSync(DB_PATH);
    // Rétro-compatibilité: garantir les nouvelles clés
    if (!data.shoppingItems) data.shoppingItems = [];
    if (!data.shoppingList) data.shoppingList = [];
    if (!data.notes) data.notes = [];
    return data;
  } catch (error) {
    console.error("Erreur lors de la lecture de la base de données:", error);
    return { ...DEFAULT_DATABASE_STRUCTURE };
  }
}

// Fonction utilitaire pour écrire dans la base de données
function writeDatabase(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeJsonSync(DB_PATH, data, { spaces: 2 });
    return true;
  } catch (error) {
    console.error("Erreur lors de l'écriture dans la base de données:", error);
    return false;
  }
}

// Routes API

// Routes des catégories
app.use("/api/categories", categoriesRoutes);

// ================= LISTE DE COURSES =================
// GET /api/shopping/items - Récupérer le catalogue
app.get("/api/shopping/items", (req, res) => {
  try {
    const db = readDatabase();
    res.json(db.shoppingItems);
  } catch (error) {
    res.status(500).json({ error: ERROR_MESSAGES.SHOPPING_CATALOG_ERROR });
  }
});

// POST /api/shopping/items - Ajouter un item au catalogue
app.post("/api/shopping/items", (req, res) => {
  try {
    const db = readDatabase();
    const name = sanitizeString(req.body.name);
    const category = sanitizeString(req.body.category);
    if (!validateName(name)) return res.status(400).json({ error: ERROR_MESSAGES.SHOPPING_NAME_REQUIRED });

    const newItem = {
      id: generateId(),
      name,
      category: category || undefined,
    };
    db.shoppingItems.unshift(newItem);
    if (writeDatabase(db)) {
      res.status(201).json(newItem);
    } else {
      res.status(500).json({ error: ERROR_MESSAGES.SAVE_ERROR });
    }
  } catch (error) {
    res.status(400).json({ error: ERROR_MESSAGES.INVALID_DATA });
  }
});

// PUT /api/shopping/items/:id - Modifier un item du catalogue
app.put("/api/shopping/items/:id", (req, res) => {
  try {
    const db = readDatabase();
    const id = req.params.id;
    const itemIndex = db.shoppingItems.findIndex((i) => i.id === id);
    if (itemIndex === -1) return res.status(404).json({ error: "Item non trouvé" });

    const { name, category } = req.body;
    const sanitizedName = name !== undefined ? String(name).trim() : undefined;
    const sanitizedCategory = category !== undefined ? String(category).trim() : undefined;

    const updatedItem = {
      ...db.shoppingItems[itemIndex],
      name: sanitizedName !== undefined && sanitizedName !== "" ? sanitizedName : db.shoppingItems[itemIndex].name,
      category: sanitizedCategory !== undefined && sanitizedCategory !== "" ? sanitizedCategory : undefined,
    };

    db.shoppingItems[itemIndex] = updatedItem;

    // Propager le nouveau nom dans les entrées de la liste courante
    if (sanitizedName !== undefined && sanitizedName !== "") {
      db.shoppingList = db.shoppingList.map((e) => (e.itemId === id ? { ...e, name: updatedItem.name } : e));
    }

    if (writeDatabase(db)) return res.json(updatedItem);
    return res.status(500).json({ error: "Erreur lors de la sauvegarde" });
  } catch (error) {
    res.status(400).json({ error: "Données invalides" });
  }
});

// DELETE /api/shopping/items/:id - Supprimer un item du catalogue (et ses entrées associées)
app.delete("/api/shopping/items/:id", (req, res) => {
  try {
    const db = readDatabase();
    const id = req.params.id;
    db.shoppingItems = db.shoppingItems.filter((i) => i.id !== id);
    db.shoppingList = db.shoppingList.filter((e) => e.itemId !== id);
    if (writeDatabase(db)) return res.status(204).send();
    return res.status(500).json({ error: "Erreur lors de la suppression" });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// GET /api/shopping/list - Récupérer la liste courante
app.get("/api/shopping/list", (req, res) => {
  try {
    const db = readDatabase();
    res.json(db.shoppingList);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération de la liste" });
  }
});

// POST /api/shopping/list - Ajouter une entrée à la liste
app.post("/api/shopping/list", (req, res) => {
  try {
    const db = readDatabase();
    const { itemId, quantity } = req.body;
    const item = db.shoppingItems.find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: "Item non trouvé" });

    // Tenter d'agréger si une entrée non cochée existe déjà
    const existing = db.shoppingList.find((e) => e.itemId === itemId && !e.checked);
    if (existing) {
      existing.quantity = Math.max(1, (existing.quantity || 1) + (quantity || 1));
      if (writeDatabase(db)) return res.json(existing);
      return res.status(500).json({ error: "Erreur lors de la sauvegarde" });
    }

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      itemId: item.id,
      name: item.name,
      quantity: Math.max(1, quantity || 1),
      checked: false,
    };
    db.shoppingList.unshift(entry);
    if (writeDatabase(db)) return res.status(201).json(entry);
    return res.status(500).json({ error: "Erreur lors de la sauvegarde" });
  } catch (error) {
    res.status(400).json({ error: "Données invalides" });
  }
});

// PUT /api/shopping/list/:id - Mettre à jour quantité/checked
app.put("/api/shopping/list/:id", (req, res) => {
  try {
    const db = readDatabase();
    const idx = db.shoppingList.findIndex((e) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Entrée non trouvée" });

    const { quantity, checked } = req.body;
    if (quantity !== undefined) db.shoppingList[idx].quantity = Math.max(1, Number(quantity));
    if (checked !== undefined) db.shoppingList[idx].checked = !!checked;

    if (writeDatabase(db)) return res.json(db.shoppingList[idx]);
    return res.status(500).json({ error: "Erreur lors de la sauvegarde" });
  } catch (error) {
    res.status(400).json({ error: "Données invalides" });
  }
});

// DELETE /api/shopping/list/:id - Supprimer une entrée
app.delete("/api/shopping/list/:id", (req, res) => {
  try {
    const db = readDatabase();
    const before = db.shoppingList.length;
    db.shoppingList = db.shoppingList.filter((e) => e.id !== req.params.id);
    if (db.shoppingList.length === before) return res.status(404).json({ error: "Entrée non trouvée" });
    if (writeDatabase(db)) return res.status(204).send();
    return res.status(500).json({ error: "Erreur lors de la suppression" });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// POST /api/shopping/list/clear-checked - Retirer les cochés
app.post("/api/shopping/list/clear-checked", (req, res) => {
  try {
    const db = readDatabase();
    db.shoppingList = db.shoppingList.filter((e) => !e.checked);
    if (writeDatabase(db)) return res.status(204).send();
    return res.status(500).json({ error: "Erreur lors du nettoyage" });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors du nettoyage" });
  }
});

// DELETE /api/shopping/list - Vider la liste
app.delete("/api/shopping/list", (req, res) => {
  try {
    const db = readDatabase();
    db.shoppingList = [];
    if (writeDatabase(db)) return res.status(204).send();
    return res.status(500).json({ error: "Erreur lors du vidage" });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors du vidage" });
  }
});

// ================= NOTES =================
// GET /api/notes - Récupérer toutes les notes
app.get("/api/notes", (req, res) => {
  try {
    const db = readDatabase();
    res.json(db.notes || []);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des notes" });
  }
});

// GET /api/notes/:id
app.get("/api/notes/:id", (req, res) => {
  try {
    const db = readDatabase();
    const userId = req.header("X-User-Id");
    const note = (db.notes || []).find((n) => n.id === req.params.id);
    if (!note) return res.status(404).json({ error: "Note non trouvée" });
    if (userId && note.ownerId !== userId) {
      return res.status(403).json({ error: "Accès non autorisé" });
    }
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération de la note" });
  }
});

// POST /api/notes
app.post("/api/notes", (req, res) => {
  try {
    const db = readDatabase();
    const userId = req.header("X-User-Id");
    const { title, content } = req.body || {};
    const note = {
      id: generateId(),
      title: sanitizeString(title),
      content: content || "",
      ownerId: userId || "anonymous",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.notes.unshift(note);
    if (writeDatabase(db)) return res.status(201).json(note);
    return res.status(500).json({ error: "Erreur lors de la sauvegarde" });
  } catch (error) {
    res.status(400).json({ error: "Données invalides" });
  }
});

// PUT /api/notes/:id
app.put("/api/notes/:id", (req, res) => {
  try {
    const db = readDatabase();
    const userId = req.header("X-User-Id");
    const idx = (db.notes || []).findIndex((n) => n.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Note non trouvée" });
    const sharedWith = Array.isArray(db.notes[idx].sharedWith) ? db.notes[idx].sharedWith : [];
    const canEdit = !userId || db.notes[idx].ownerId === userId || sharedWith.includes(userId);
    if (!canEdit) return res.status(403).json({ error: "Accès non autorisé" });
    const { title, content } = req.body || {};
    db.notes[idx] = {
      ...db.notes[idx],
      title: title !== undefined ? (title || "").trim() : db.notes[idx].title,
      content: content !== undefined ? content : db.notes[idx].content,
      updatedAt: new Date().toISOString(),
    };
    if (writeDatabase(db)) return res.json(db.notes[idx]);
    return res.status(500).json({ error: "Erreur lors de la sauvegarde" });
  } catch (error) {
    res.status(400).json({ error: "Données invalides" });
  }
});

// DELETE /api/notes/:id
app.delete("/api/notes/:id", (req, res) => {
  try {
    const db = readDatabase();
    const userId = req.header("X-User-Id");
    const idx = (db.notes || []).findIndex((n) => n.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Note non trouvée" });
    if (userId && db.notes[idx].ownerId !== userId) return res.status(403).json({ error: "Accès non autorisé" });
    db.notes.splice(idx, 1);
    if (writeDatabase(db)) return res.status(204).send();
    return res.status(500).json({ error: "Erreur lors de la suppression" });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// partage supprimé

// GET /api/tasks - Récupérer toutes les tâches
app.get("/api/tasks", (req, res) => {
  try {
    const db = readDatabase();
    res.json(db.tasks);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des tâches" });
  }
});

// POST /api/tasks - Créer une nouvelle tâche
app.post("/api/tasks", (req, res) => {
  try {
    const db = readDatabase();
    const newTask = {
      ...req.body,
      id: generateId(),
      nextDueDate: formatDateISO(req.body.nextDueDate),
      lastCompleted: formatDateISO(req.body.lastCompleted),
      isActive: true,
    };

    db.tasks.push(newTask);

    if (writeDatabase(db)) {
      res.status(201).json(newTask);
    } else {
      res.status(500).json({ error: "Erreur lors de la sauvegarde" });
    }
  } catch (error) {
    res.status(400).json({ error: "Données invalides" });
  }
});

// PUT /api/tasks/:id - Mettre à jour une tâche
app.put("/api/tasks/:id", (req, res) => {
  try {
    const db = readDatabase();
    const taskIndex = db.tasks.findIndex((task) => task.id === req.params.id);

    if (taskIndex === -1) {
      return res.status(404).json({ error: "Tâche non trouvée" });
    }

    const updatedTask = {
      ...db.tasks[taskIndex],
      ...req.body,
      nextDueDate: req.body.nextDueDate
        ? new Date(req.body.nextDueDate).toISOString()
        : db.tasks[taskIndex].nextDueDate,
      lastCompleted: req.body.lastCompleted
        ? new Date(req.body.lastCompleted).toISOString()
        : db.tasks[taskIndex].lastCompleted,
    };

    db.tasks[taskIndex] = updatedTask;

    if (writeDatabase(db)) {
      res.json(updatedTask);
    } else {
      res.status(500).json({ error: "Erreur lors de la sauvegarde" });
    }
  } catch (error) {
    res.status(400).json({ error: "Données invalides" });
  }
});

// DELETE /api/tasks/:id - Supprimer une tâche
app.delete("/api/tasks/:id", (req, res) => {
  try {
    const db = readDatabase();
    const taskIndex = db.tasks.findIndex((task) => task.id === req.params.id);

    if (taskIndex === -1) {
      return res.status(404).json({ error: "Tâche non trouvée" });
    }

    db.tasks.splice(taskIndex, 1);

    if (writeDatabase(db)) {
      res.status(204).send();
    } else {
      res.status(500).json({ error: "Erreur lors de la suppression" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// POST /api/tasks/:id/complete - Marquer une tâche comme terminée
app.post("/api/tasks/:id/complete", (req, res) => {
  try {
    const db = readDatabase();
    const taskIndex = db.tasks.findIndex((task) => task.id === req.params.id);

    if (taskIndex === -1) {
      return res.status(404).json({ error: "Tâche non trouvée" });
    }

    const task = db.tasks[taskIndex];
    const nowIso = new Date().toISOString();
    const author = getUserId(req.headers) || task.assignee || "unknown";
    task.lastCompleted = nowIso;
    task.nextDueDate = calculateNextDueDate(task).toISOString();
    task.history = Array.isArray(task.history) ? task.history : [];
    task.history.push({ date: nowIso, author });
    task.isActive = true; // Réactiver la tâche

    if (writeDatabase(db)) {
      res.json(task);
    } else {
      res.status(500).json({ error: "Erreur lors de la sauvegarde" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

// GET /api/tasks/overdue - Récupérer les tâches en retard
app.get("/api/tasks/overdue", (req, res) => {
  try {
    const db = readDatabase();
    const now = new Date();
    const overdueTasks = db.tasks.filter((task) => task.isActive && new Date(task.nextDueDate) < now);
    res.json(overdueTasks);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des tâches en retard" });
  }
});

// GET /api/tasks/category/:category - Récupérer les tâches par catégorie
app.get("/api/tasks/category/:category", (req, res) => {
  try {
    const db = readDatabase();
    const filteredTasks = db.tasks.filter((task) => task.category === req.params.category);
    res.json(filteredTasks);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des tâches par catégorie" });
  }
});

// GET /api/status - Statut du serveur
app.get("/api/status", (req, res) => {
  try {
    const db = readDatabase();
    res.json({
      status: "OK",
      totalTasks: db.tasks.length,
      lastUpdated: db.lastUpdated,
      serverTime: new Date().toISOString(),
      staticFiles: fs.existsSync(STATIC_PATH) ? "Disponibles" : "Non trouvés",
    });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération du statut" });
  }
});

// Route pour servir l'application Angular (SPA)
app.get("*", (req, res) => {
  // Ne pas intercepter les routes API
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Route API non trouvée" });
  }

  // Servir index.html pour toutes les autres routes (SPA)
  const indexPath = path.join(STATIC_PATH, "index.html");
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

// Les fonctions de calcul de dates sont maintenant dans le module partagé shared/dates.js

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📁 Base de données: ${DB_PATH}`);
  console.log(`🌐 API disponible sur: http://localhost:${PORT}/api`);
});

module.exports = app;
