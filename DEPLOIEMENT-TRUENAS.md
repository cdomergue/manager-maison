# 🏠 Guide de déploiement sur TrueNAS

## 📋 Prérequis

- TrueNAS SCALE ou CORE avec Docker/Container support
- Accès SSH ou interface web TrueNAS
- Réseau local configuré

## 🐳 Option 1 : Déploiement Docker (Recommandée)

### Étape 1 : Préparation des fichiers

1. **Cloner le projet sur votre TrueNAS :**
```bash
git clone <votre-repo> /mnt/pool/dataset/taches-menageres
cd /mnt/pool/dataset/taches-menageres
```

2. **Créer les dossiers nécessaires :**
```bash
mkdir -p data logs
chmod 755 data logs
```

### Étape 2 : Configuration Docker

1. **Construire l'image :**
```bash
docker build -t taches-menageres .
```

2. **Démarrer avec docker-compose :**
```bash
docker-compose up -d
```

### Étape 3 : Configuration réseau

1. **Accéder à l'application :**
   - URL : `http://IP-TRUENAS:3001`
   - Exemple : `http://192.168.1.100:3001`

2. **Configuration du pare-feu :**
   - Ouvrir le port 3001 sur TrueNAS
   - Configurer les règles de pare-feu si nécessaire

## 🔧 Option 2 : Déploiement direct Node.js

### Étape 1 : Installation Node.js

```bash
# Sur TrueNAS SCALE avec Apps
# Installer Node.js depuis l'App Store

# Ou installation manuelle
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Étape 2 : Déploiement de l'application

```bash
# Cloner le projet
git clone <votre-repo> /mnt/pool/dataset/taches-menageres
cd /mnt/pool/dataset/taches-menageres

# Installer les dépendances
npm install
cd server && npm install --production

# Construire l'application
npm run build

# Démarrer le serveur
cd server && npm start
```

### Étape 3 : Configuration systemd (pour auto-démarrage)

```bash
# Créer le service systemd
sudo nano /etc/systemd/system/taches-menageres.service
```

Contenu du service :
```ini
[Unit]
Description=Taches Menageres App
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/mnt/pool/dataset/taches-menageres/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Activer et démarrer le service
sudo systemctl enable taches-menageres
sudo systemctl start taches-menageres
```

## 🌐 Option 3 : Reverse Proxy avec Nginx

### Configuration Nginx

```nginx
server {
    listen 80;
    server_name taches.local;  # Votre nom de domaine local

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔒 Sécurité

### Configuration recommandée

1. **Pare-feu :**
   - Limiter l'accès au port 3001 au réseau local
   - Utiliser un reverse proxy pour HTTPS

2. **Authentification :**
   - Configurer l'authentification TrueNAS si nécessaire
   - Utiliser des certificats SSL pour HTTPS

3. **Sauvegarde :**
   - Configurer des sauvegardes automatiques du dossier `data/`
   - Utiliser les snapshots TrueNAS

## 📱 Accès mobile

### Configuration réseau local

1. **Trouver l'IP de votre TrueNAS :**
```bash
ifconfig | grep inet
```

2. **Accéder depuis mobile :**
   - URL : `http://IP-TRUENAS:3001`
   - Exemple : `http://192.168.1.100:3001`

3. **Ajouter à l'écran d'accueil :**
   - Ouvrir l'URL dans le navigateur mobile
   - Ajouter à l'écran d'accueil (PWA)

## 🔄 Mise à jour

### Avec Docker

```bash
cd /mnt/pool/dataset/taches-menageres
git pull
docker-compose down
docker-compose up -d --build
```

### Avec Node.js direct

```bash
cd /mnt/pool/dataset/taches-menageres
git pull
npm install
npm run build
sudo systemctl restart taches-menageres
```

## 🐛 Dépannage

### Logs Docker

```bash
docker-compose logs -f taches-menageres
```

### Logs systemd

```bash
sudo journalctl -u taches-menageres -f
```

### Vérification du statut

```bash
# Docker
docker ps | grep taches-menageres

# systemd
sudo systemctl status taches-menageres
```

## 📊 Monitoring

### Ressources utilisées

- **RAM :** ~100-200 MB
- **CPU :** Faible utilisation
- **Stockage :** ~50 MB + données utilisateur

### Surveillance

```bash
# Utilisation des ressources
docker stats taches-menageres

# Espace disque
df -h /mnt/pool/dataset/taches-menageres
```

## 🎯 Configuration avancée

### Variables d'environnement

Créer un fichier `.env` :
```env
NODE_ENV=production
PORT=3001
CORS_ORIGINS=http://192.168.1.0/24
LOG_LEVEL=info
```

### Optimisation des performances

1. **Cache Redis (optionnel) :**
   - Ajouter Redis pour le cache des sessions
   - Configuration dans `server/config.js`

2. **Compression :**
   - Activer la compression gzip
   - Optimiser les assets statiques

## 🚀 Démarrage rapide

```bash
# 1. Cloner le projet
git clone <votre-repo> /mnt/pool/dataset/taches-menageres
cd /mnt/pool/dataset/taches-menageres

# 2. Créer les dossiers
mkdir -p data logs

# 3. Démarrer avec Docker
docker-compose up -d

# 4. Accéder à l'application
# Ouvrir http://IP-TRUENAS:3001
```

Votre application est maintenant prête pour la production sur TrueNAS ! 🏠✨ 