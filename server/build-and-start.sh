#!/bin/bash

# Script de build et démarrage complet
echo "🚀 Build et démarrage de l'application Tâches Ménagères..."

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé. Veuillez l'installer depuis https://nodejs.org/${NC}"
    exit 1
fi

# Vérifier si npm est installé
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm n'est pas installé. Veuillez l'installer avec Node.js${NC}"
    exit 1
fi

# Aller à la racine du projet
cd "$(dirname "$0")/.."

echo -e "${BLUE}📦 Installation des dépendances Angular...${NC}"
npm install

echo -e "${BLUE}🔨 Construction de l'application Angular...${NC}"
npm run build -- --configuration=development

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erreur lors de la construction de l'application${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Application construite avec succès${NC}"

# Aller dans le dossier server
cd server

# Vérifier si les dépendances du serveur sont installées
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installation des dépendances du serveur...${NC}"
    npm install
fi

# Créer le dossier data s'il n'existe pas
if [ ! -d "data" ]; then
    echo -e "${BLUE}📁 Création du dossier data...${NC}"
    mkdir data
fi

# Démarrer le serveur
echo -e "${GREEN}🌐 Démarrage du serveur complet...${NC}"
echo -e "${YELLOW}📱 Application accessible sur :${NC}"
echo -e "${GREEN}   • Local : http://localhost:3001${NC}"
echo -e "${GREEN}   • Réseau : http://$(hostname -I | awk '{print $1}'):3001${NC}"
echo -e "${YELLOW}🔌 API disponible sur : http://localhost:3001/api${NC}"
echo -e "${YELLOW}🛑 Appuyez sur Ctrl+C pour arrêter le serveur${NC}"
echo ""

npm start 