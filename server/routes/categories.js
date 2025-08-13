const express = require("express");
const router = express.Router();
const { readCategories, writeCategories } = require("../data/db");

// GET /api/categories - Récupérer toutes les catégories
router.get("/", (req, res) => {
  try {
    const { categories } = readCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des catégories" });
  }
});

// GET /api/categories/:id - Récupérer une catégorie spécifique
router.get("/:id", (req, res) => {
  try {
    const { categories } = readCategories();
    const category = categories.find((cat) => cat.id === req.params.id);

    if (!category) {
      return res.status(404).json({ error: "Catégorie non trouvée" });
    }

    res.json(category);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération de la catégorie" });
  }
});

// POST /api/categories - Créer une nouvelle catégorie
router.post("/", (req, res) => {
  try {
    const { categories } = readCategories();
    const newCategory = {
      ...req.body,
      id: req.body.id || Date.now().toString(36) + Math.random().toString(36).substr(2),
      isDefault: false,
    };

    // Vérifier si l'ID existe déjà
    if (categories.some((cat) => cat.id === newCategory.id)) {
      return res.status(400).json({ error: "Une catégorie avec cet ID existe déjà" });
    }

    categories.push(newCategory);

    if (writeCategories({ categories })) {
      res.status(201).json(newCategory);
    } else {
      res.status(500).json({ error: "Erreur lors de la sauvegarde" });
    }
  } catch (error) {
    res.status(400).json({ error: "Données invalides" });
  }
});

// PUT /api/categories/:id - Mettre à jour une catégorie
router.put("/:id", (req, res) => {
  try {
    const { categories } = readCategories();
    const categoryIndex = categories.findIndex((cat) => cat.id === req.params.id);

    if (categoryIndex === -1) {
      return res.status(404).json({ error: "Catégorie non trouvée" });
    }

    // Empêcher la modification de l'ID
    const { id, ...updateData } = req.body;

    // Préserver le statut isDefault si c'est une catégorie par défaut
    const isDefault = categories[categoryIndex].isDefault;

    const updatedCategory = {
      ...categories[categoryIndex],
      ...updateData,
      id: req.params.id,
      isDefault,
    };

    categories[categoryIndex] = updatedCategory;

    if (writeCategories({ categories })) {
      res.json(updatedCategory);
    } else {
      res.status(500).json({ error: "Erreur lors de la sauvegarde" });
    }
  } catch (error) {
    res.status(400).json({ error: "Données invalides" });
  }
});

// DELETE /api/categories/:id - Supprimer une catégorie
router.delete("/:id", (req, res) => {
  try {
    const { categories } = readCategories();
    const categoryIndex = categories.findIndex((cat) => cat.id === req.params.id);

    if (categoryIndex === -1) {
      return res.status(404).json({ error: "Catégorie non trouvée" });
    }

    // Empêcher la suppression des catégories par défaut
    if (categories[categoryIndex].isDefault) {
      return res.status(400).json({ error: "Impossible de supprimer une catégorie par défaut" });
    }

    categories.splice(categoryIndex, 1);

    if (writeCategories({ categories })) {
      res.status(204).send();
    } else {
      res.status(500).json({ error: "Erreur lors de la suppression" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

module.exports = router;
