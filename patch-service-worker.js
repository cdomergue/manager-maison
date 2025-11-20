#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

console.log("Patch du service worker Angular pour intégrer sw-custom.js...");

// Trouver le dossier de build (dist/gestion-maison ou dist/taches-menageres)
const distDirs = ["dist/gestion-maison", "dist/taches-menageres"];
let swPath = null;

for (const dir of distDirs) {
  const potentialPath = path.join(__dirname, dir, "browser", "ngsw-worker.js");
  if (fs.existsSync(potentialPath)) {
    swPath = potentialPath;
    break;
  }
}

if (!swPath) {
  console.error("ERREUR: ngsw-worker.js non trouvé dans dist/");
  console.error("Assurez-vous d'avoir exécuté 'ng build' d'abord");
  process.exit(1);
}

// Lire le service worker Angular généré
let swContent = fs.readFileSync(swPath, "utf8");

// Vérifier si le patch a déjà été appliqué
if (swContent.includes("sw-custom.js")) {
  console.log("Le service worker a déjà été patché");
  process.exit(0);
}

// Ajouter l'import de sw-custom.js au début du fichier
// On cherche la fin de la déclaration du scope ou le début du code principal
const importStatement =
  "\n// Import du service worker personnalisé pour les notifications\nimportScripts('./sw-custom.js');\n";

// Insérer après la première ligne ou après les imports existants
// On cherche un bon endroit pour insérer (après les commentaires initiaux)
const lines = swContent.split("\n");
let insertIndex = 0;

// Trouver la première ligne non vide et non commentaire
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line && !line.startsWith("//") && !line.startsWith("/*")) {
    insertIndex = i;
    break;
  }
}

// Insérer l'import
lines.splice(insertIndex, 0, importStatement.trim());
swContent = lines.join("\n");

// Écrire le service worker patché
fs.writeFileSync(swPath, swContent, "utf8");

console.log("Service worker patché avec succès !");
console.log("sw-custom.js sera maintenant chargé avec le service worker Angular");
