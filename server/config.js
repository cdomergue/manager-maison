// Configuration du serveur Tâches Ménagères
const config = {
  // Port du serveur
  port: process.env.PORT || 3001,

  // Configuration CORS
  cors: {
    origin: [
      "http://localhost:3001", // Serveur principal
      "http://localhost:4200", // Angular dev server
      "http://localhost:3000", // Alternative port
      "http://127.0.0.1:3001",
      "http://127.0.0.1:4200",
      "http://127.0.0.1:3000",
      // Ajoutez ici les IPs de votre réseau local
      // 'http://192.168.1.100:3001',
      // 'http://192.168.1.101:3001',
    ],
    credentials: true,
  },

  // Configuration de la base de données
  database: {
    path: "./data/tasks.json",
    backupPath: "./data/backup/",
    maxBackups: 10,
  },

  // Configuration des logs
  logging: {
    level: process.env.LOG_LEVEL || "info",
    file: "./logs/server.log",
  },

  // Configuration de sécurité
  security: {
    maxRequestSize: "10mb",
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limite chaque IP à 100 requêtes par fenêtre
    },
  },
};

module.exports = config;
