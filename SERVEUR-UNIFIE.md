# 🚀 Serveur Unifié - Tâches Ménagères

Le serveur a été modifié pour servir à la fois l'API backend ET les fichiers statiques de l'application Angular. Plus besoin de lancer deux serveurs séparés !

## 🎯 Avantages

- ✅ **Un seul serveur** à lancer
- ✅ **Une seule URL** pour tout : `http://localhost:3001`
- ✅ **Configuration simplifiée** pour le partage
- ✅ **Déploiement plus simple**

## 🚀 Démarrage Rapide

### Option 1 : Script automatique (recommandé)
```bash
./server/build-and-start.sh
```

### Option 2 : Manuel
```bash
# 1. Construire l'application Angular
npm run build

# 2. Démarrer le serveur
cd server
npm start
```

### Option 3 : Mode développement
```bash
./server/dev-start.sh
```

## 🌐 Accès

Une fois le serveur démarré, tout est accessible sur **une seule URL** :

- **Application** : `http://localhost:3001`
- **API** : `http://localhost:3001/api`
- **Statut** : `http://localhost:3001/api/status`

## 🔧 Configuration pour le partage

### 1. Trouver votre IP locale
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig
```

### 2. Modifier la configuration
Éditer `server/config.js` :
```javascript
cors: {
  origin: [
    'http://localhost:3001',
    'http://VOTRE_IP:3001',      // Ex: http://192.168.1.100:3001
    'http://LAURENCE_IP:3001',   // Ex: http://192.168.1.101:3001
  ]
}
```

### 3. Accès depuis d'autres appareils
- **Votre ordinateur** : `http://localhost:3001`
- **Ordinateur de Laurence** : `http://VOTRE_IP:3001`
- **Mobiles/tablettes** : `http://VOTRE_IP:3001`

## 📁 Structure des fichiers

```
taches-menageres/
├── dist/                    # Application construite (généré)
│   └── taches-menageres/    # Fichiers statiques
├── server/
│   ├── server.js            # Serveur unifié
│   ├── config.js            # Configuration
│   ├── build-and-start.sh   # Script de build + démarrage
│   ├── dev-start.sh         # Script de développement
│   ├── start.sh             # Script de démarrage simple
│   └── data/                # Base de données
└── src/                     # Code source Angular
```

## 🔄 Scripts disponibles

### `./server/build-and-start.sh`
- ✅ Installe les dépendances
- ✅ Construit l'application Angular
- ✅ Démarre le serveur unifié
- ✅ Affiche les URLs d'accès

### `./server/dev-start.sh`
- ✅ Mode développement
- ✅ Surveillance des changements
- ✅ Redémarrage automatique
- ✅ Construction initiale

### `./server/start.sh`
- ✅ Démarrage simple (nécessite que l'app soit déjà construite)

## 🛠️ Développement

### Modifier l'application
1. Modifier les fichiers dans `src/`
2. Construire : `npm run build`
3. Le serveur servira automatiquement la nouvelle version

### Modifier le serveur
1. Modifier les fichiers dans `server/`
2. Redémarrer le serveur
3. Ou utiliser `npm run dev` pour le redémarrage automatique

## 📊 Monitoring

Le serveur fournit des informations sur l'état des fichiers statiques :

```json
{
  "status": "OK",
  "totalTasks": 5,
  "lastUpdated": "2024-01-15T10:30:00.000Z",
  "serverTime": "2024-01-15T10:30:00.000Z",
  "staticFiles": "Disponibles"
}
```

## 🚨 Dépannage

### L'application ne se charge pas
1. Vérifier que l'app est construite : `npm run build`
2. Vérifier que le dossier `dist/taches-menageres` existe
3. Redémarrer le serveur

### Erreur "Application non trouvée"
Le serveur affiche une page d'erreur avec les instructions pour construire l'application.

### Problèmes de CORS
- Vérifier la configuration dans `server/config.js`
- Ajouter les bonnes IPs dans la liste `origin`

## 🔒 Sécurité

Le serveur unifié est plus sécurisé car :
- ✅ Une seule exposition réseau
- ✅ Configuration CORS centralisée
- ✅ Pas de ports multiples à gérer

## 🎉 Résultat

Maintenant vous avez :
- **Un seul serveur** à lancer
- **Une seule URL** à partager avec Laurence
- **Une configuration simplifiée**
- **Un déploiement plus simple**

Plus besoin de gérer deux serveurs séparés ! 🎯 