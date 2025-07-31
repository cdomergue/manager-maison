# Serveur Backend - Tâches Ménagères

Ce serveur Node.js fournit une API REST pour l'application Tâches Ménagères, permettant le partage des tâches entre plusieurs utilisateurs via une base de données JSON locale.

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
   
   # Mode production
   npm start
   ```

Le serveur sera accessible sur `http://localhost:3001`

## 📁 Structure des fichiers

```
server/
├── server.js          # Serveur principal
├── package.json       # Dépendances
├── data/              # Base de données JSON
│   └── tasks.json     # Fichier de données
└── README.md          # Ce fichier
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

### Exemple de configuration

```bash
# .env
PORT=3001
```

## 🌐 Déploiement local

Pour utiliser le serveur dans votre réseau local :

1. **Démarrer le serveur :**
   ```bash
   npm start
   ```

2. **Configurer l'application Angular :**
   Modifier l'URL de l'API dans `src/app/services/api.service.ts` :
   ```typescript
   private readonly API_BASE_URL = 'http://VOTRE_IP_LOCALE:3001/api';
   ```

3. **Accéder depuis d'autres appareils :**
   - Ordinateur : `http://VOTRE_IP_LOCALE:3001`
   - Mobile : `http://VOTRE_IP_LOCALE:3001`

## 🔒 Sécurité

⚠️ **Attention :** Ce serveur est conçu pour un usage local et familial. Il n'inclut pas de mécanismes de sécurité avancés.

### Recommandations pour un usage en réseau local :

1. **Pare-feu :** Limiter l'accès au port 3001
2. **Réseau privé :** Utiliser un réseau WiFi privé
3. **Sauvegarde :** Sauvegarder régulièrement `data/tasks.json`

## 🛠️ Développement

### Structure du code

- **server.js** : Configuration Express et routes API
- **Middleware** : CORS, body-parser
- **Utilitaires** : Fonctions de lecture/écriture de la base de données

### Ajouter de nouvelles fonctionnalités

1. Ajouter la route dans `server.js`
2. Implémenter la logique métier
3. Tester avec l'application Angular

## 📊 Monitoring

Le serveur fournit des informations de statut via `/api/status` :

- Nombre total de tâches
- Dernière mise à jour
- Heure du serveur

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
- Vérifier l'URL de l'API dans `api.service.ts`
- Vérifier que le serveur est démarré
- Vérifier les paramètres CORS

### Erreurs de base de données
- Vérifier les permissions du fichier `data/tasks.json`
- Vérifier la syntaxe JSON
- Restaurer depuis une sauvegarde si nécessaire 