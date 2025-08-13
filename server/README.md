# Serveur Unifié - Tâches Ménagères

Ce serveur Node.js unifié fournit à la fois les fichiers statiques de l'application Angular et l'API REST pour le développement local. Il permet le partage des tâches entre plusieurs utilisateurs via une base de données JSON locale.

## 🚀 Installation

1. **Installer les dépendances :**

   ```bash
   cd server
   npm install
   ```

2. **Démarrer le serveur :**

   ```bash
   # Mode développement (avec redémarrage automatique)
   npm run dev

   # Mode production local
   npm run build-and-start
   ```

Le serveur sera accessible sur `http://localhost:3001`

## 📁 Structure des fichiers

```
server/
├── server.js          # Serveur principal
├── server-https.js    # Version HTTPS du serveur
├── config.js         # Configuration
├── package.json      # Dépendances
├── data/             # Base de données JSON
│   └── tasks.json    # Fichier de données
├── build-and-start.sh # Script de build et démarrage
├── dev-start.sh      # Script de développement
├── generate-certs.sh # Génération des certificats HTTPS
└── README.md         # Ce fichier
```

## 🔌 API Endpoints

### Tâches

- `GET /api/tasks` - Récupérer toutes les tâches
- `POST /api/tasks` - Créer une nouvelle tâche
- `PUT /api/tasks/:id` - Mettre à jour une tâche
- `DELETE /api/tasks/:id` - Supprimer une tâche
- `POST /api/tasks/:id/complete` - Marquer une tâche comme terminée

### Requêtes spécialisées

- `GET /api/tasks/overdue` - Récupérer les tâches en retard
- `GET /api/tasks/category/:category` - Récupérer les tâches par catégorie

### Statut

- `GET /api/status` - Statut du serveur et informations

## 💾 Base de données

La base de données est stockée dans `data/tasks.json` avec la structure suivante :

```json
{
  "tasks": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "frequency": "daily|weekly|monthly|custom",
      "customDays": "number",
      "nextDueDate": "ISO string",
      "lastCompleted": "ISO string",
      "isActive": "boolean",
      "category": "string",
      "priority": "low|medium|high"
    }
  ],
  "lastUpdated": "ISO string"
}
```

## 🔧 Configuration

### Variables d'environnement

- `PORT` : Port du serveur (défaut: 3001)
- `HTTPS` : Activer le mode HTTPS (défaut: false)

### Exemple de configuration

```bash
# .env
PORT=3001
HTTPS=false
```

## 🛠️ Développement

### Modes de fonctionnement

1. **Mode développement :**
   - Serveur API sur port 3001
   - Angular CLI sur port 4200
   - Hot reload pour le frontend et le backend

2. **Mode production local :**
   - Serveur unifié sur port 3001
   - Sert les fichiers statiques et l'API
   - Nécessite un build Angular préalable

### Scripts disponibles

- `npm run dev` : Mode développement avec redémarrage automatique
- `npm run build-and-start` : Build Angular + démarrage serveur unifié
- `npm run generate-certs` : Génère des certificats pour HTTPS

## 🔒 Sécurité

⚠️ **Attention :** Ce serveur est conçu pour le développement local. En production, utilisez AWS Lambda et Amplify.

### Recommandations pour le développement :

1. **HTTPS :** Utilisez le mode HTTPS pour tester les fonctionnalités PWA
2. **Sauvegarde :** Sauvegardez régulièrement `data/tasks.json`

## 📊 Monitoring

Le serveur fournit des informations de statut via `/api/status` :

- Nombre total de tâches
- Dernière mise à jour
- Heure du serveur
- Mode de fonctionnement (dev/prod)

## 🔄 Synchronisation

L'application Angular bascule automatiquement entre :

- **Mode serveur** : Quand le serveur est accessible
- **Mode local** : Quand le serveur est indisponible

Les données sont synchronisées en temps réel entre tous les utilisateurs connectés au serveur.

## 🚨 Dépannage

### Le serveur ne démarre pas

- Vérifier que le port 3001 est libre
- Vérifier les permissions du dossier `data/`

### L'application ne se connecte pas

- Vérifier que le serveur est démarré
- Vérifier les paramètres CORS
- En HTTPS, vérifier les certificats

### Erreurs de base de données

- Vérifier les permissions du fichier `data/tasks.json`
- Vérifier la syntaxe JSON
- Restaurer depuis une sauvegarde si nécessaire
