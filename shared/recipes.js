/**
 * Fonctions utilitaires partagées pour la gestion des recettes
 */

/**
 * Valide une recette (côté serveur et lambda)
 */
function validateRecipePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== "object") {
    errors.push("Payload invalide");
    return { ok: false, errors };
  }
  const title = (payload.title || "").trim();
  if (!title) errors.push("Titre requis");

  const ingredients = Array.isArray(payload.ingredients) ? payload.ingredients : [];
  for (const ing of ingredients) {
    if (!ing || typeof ing !== "object" || !ing.itemId || !ing.name) {
      errors.push("Ingrédient invalide");
      break;
    }
    const qty = Number(ing.quantity || 0);
    if (!(qty > 0)) {
      errors.push("Quantité invalide");
      break;
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [] };
}

module.exports = { validateRecipePayload };
