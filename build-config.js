#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Lire l'URL de l'API depuis les variables d'environnement
const API_URL = process.env.API_URL;

console.log("Configuration du build...");

if (!API_URL) {
  console.error("ERREUR: La variable d'environnement API_URL n'est pas définie");
  console.error("Veuillez configurer API_URL dans AWS Amplify ou votre environnement local");
  process.exit(1);
}

console.log("API_URL configurée:", API_URL.substring(0, 20) + "...");

// Chemin vers le fichier d'environnement de production
const envProdPath = path.join(__dirname, "src/environments/environment.prod.ts");

// Lire le fichier d'environnement de production
const envProdContent = fs.readFileSync(envProdPath, "utf8");

// Remplacer le placeholder par la vraie URL avec le préfixe /api
// Si l'URL se termine par '/', on l'enlève avant d'ajouter '/api'
const cleanApiUrl = API_URL.endsWith("/") ? API_URL.slice(0, -1) : API_URL;
const fullApiUrl = `${cleanApiUrl}/api`;
const updatedContent = envProdContent.replace("API_URL_TO_BE_REPLACED", fullApiUrl);

// Écrire le fichier mis à jour
fs.writeFileSync(envProdPath, updatedContent);

console.log("Fichier environment.prod.ts mis à jour avec l'URL de l'API");
