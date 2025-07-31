# 🏠 Système de Base de Données Locale - Tâches Ménagères

Ce projet a été étendu avec un serveur backend Node.js pour permettre le partage des tâches entre vous et Laurence via une base de données JSON locale.

## 🎯 Objectif

Permettre à plusieurs utilisateurs (vous et Laurence) de partager et synchroniser les tâches ménagères via un serveur local dans votre maison.

## 🏗️ Architecture

```
┌─────────────────┐    HTTP/JSON    ┌─────────────────┐
│   Application   │ ◄─────────────► │   Serveur       │
│   Angular       │                 │   Node.js       │
│   (Frontend)    │                 │   (Backend)     │
└─────────────────┘                 └─────────────────┘
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │   Base de       │
                                    │   données       │
                                    │   JSON          │
                                    │   (data/tasks.json)
                                    └─────────────────┘
```

## 🚀 Installation Rapide

### 1. Installer le serveur
```bash
cd server
npm install
```

### 2. Démarrer le serveur
```bash
# Option 1: Script automatique
./start.sh

# Option 2: Manuel
npm start
```

### 3. Configurer l'application Angular
L'application détecte automatiquement le serveur et bascule entre :
- **Mode serveur** : Quand le serveur est accessible
- **Mode local** : Quand le serveur est indisponible

## 🌐 Utilisation en Réseau Local

### Configuration pour le partage

1. **Trouver votre IP locale :**
   ```bash
   # Sur macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Sur Windows
   ipconfig
   ```

2. **Modifier la configuration du serveur :**
   Éditer `server/config.js` et ajouter vos IPs locales :
   ```javascript
   cors: {
     origin: [
       'http://localhost:4200',
       'http://VOTRE_IP:4200',  // Ex: http://192.168.1.100:4200
       'http://LAURENCE_IP:4200', // Ex: http://192.168.1.101:4200
     ]
   }
   ```

3. **Modifier l'URL de l'API :**
   Dans `src/app/services/api.service.ts` :
   ```typescript
   private readonly API_BASE_URL = 'http://VOTRE_IP:3001/api';
   ```

### Accès depuis différents appareils

- **Votre ordinateur :** `http://localhost:4200`
- **Ordinateur de Laurence :** `http://VOTRE_IP:4200`
- **Mobiles/tablettes :** `http://VOTRE_IP:4200`

## 📊 Fonctionnalités

### ✅ Synchronisation en temps réel
- Les tâches sont partagées instantanément entre tous les utilisateurs
- Modifications, ajouts et suppressions synchronisés
- Historique des complétions partagé

### 🔄 Mode dégradé automatique
- Si le serveur est indisponible, l'app fonctionne en mode local
- Les données sont sauvegardées localement
- Reconnexion automatique quand le serveur revient

### 📈 Monitoring
- Statut de connexion en temps réel
- Nombre de tâches totales
- Dernière synchronisation
- Heure du serveur

### 🛡️ Sécurité locale
- Serveur accessible uniquement sur votre réseau local
- Pas d'accès Internet requis
- Données stockées localement

## 📁 Structure des fichiers

```
taches-menageres/
├── src/                    # Application Angular
│   └── app/
│       ├── services/
│       │   ├── api.service.ts      # Service API
│       │   ├── task.service.ts     # Service tâches (modifié)
│       │   └── storage.service.ts  # Service stockage local
│       └── components/
│           └── settings/           # Composant paramètres (modifié)
├── server/                 # Serveur backend
│   ├── server.js           # Serveur principal
│   ├── config.js           # Configuration
│   ├── package.json        # Dépendances
│   ├── start.sh            # Script de démarrage
│   ├── data/               # Base de données
│   │   └── tasks.json      # Fichier de données
│   └── README.md           # Documentation serveur
└── README-SERVEUR.md       # Ce fichier
```

## 🔧 Configuration Avancée

### Variables d'environnement
```bash
# .env
PORT=3001
LOG_LEVEL=info
```

### Sauvegarde automatique
Le serveur sauvegarde automatiquement les données dans `data/tasks.json`

### Logs
Les logs sont disponibles dans la console du serveur

## 🚨 Dépannage

### Le serveur ne démarre pas
```bash
# Vérifier Node.js
node --version

# Vérifier les dépendances
cd server
npm install

# Vérifier le port
lsof -i :3001
```

### L'application ne se connecte pas
1. Vérifier que le serveur est démarré
2. Vérifier l'URL dans `api.service.ts`
3. Vérifier les paramètres CORS dans `config.js`
4. Vérifier le pare-feu

### Problèmes de synchronisation
1. Vérifier la connexion réseau
2. Redémarrer le serveur
3. Vérifier les permissions du fichier `data/tasks.json`

## 🔄 Migration des données existantes

Si vous avez déjà des tâches dans le localStorage :

1. **Exporter depuis l'ancienne version :**
   - Aller dans Paramètres
   - Exporter les données

2. **Importer dans le nouveau système :**
   - Démarrer le serveur
   - Les données seront automatiquement synchronisées

## 📱 Utilisation Mobile

L'application fonctionne parfaitement sur mobile :
- PWA (Progressive Web App)
- Installation possible sur l'écran d'accueil
- Fonctionnement hors ligne
- Synchronisation automatique

## 🔒 Sécurité

### Recommandations pour un usage familial :
1. **Réseau privé** : Utiliser votre WiFi privé
2. **Pare-feu** : Limiter l'accès au port 3001
3. **Sauvegarde** : Sauvegarder régulièrement `data/tasks.json`
4. **Mise à jour** : Maintenir Node.js à jour

### Ce qui est sécurisé :
- ✅ Données stockées localement
- ✅ Pas d'accès Internet
- ✅ Contrôle total sur les données
- ✅ Pas de tiers impliqués

## 🎉 Avantages

### Pour vous et Laurence :
- **Partage en temps réel** des tâches
- **Synchronisation automatique** des modifications
- **Historique partagé** des complétions
- **Notifications synchronisées**
- **Pas de dépendance Internet**

### Technique :
- **Performance** : Base de données JSON rapide
- **Simplicité** : Pas de base de données complexe
- **Portabilité** : Facile à déplacer/sauvegarder
- **Fiabilité** : Mode dégradé automatique

## 🚀 Prochaines étapes

1. **Tester le serveur** localement
2. **Configurer le réseau** pour le partage
3. **Former Laurence** à l'utilisation
4. **Sauvegarder régulièrement** les données
5. **Monitorer** les performances

---

**🎯 Objectif atteint :** Vous pouvez maintenant partager vos tâches ménagères avec Laurence via votre serveur local ! 