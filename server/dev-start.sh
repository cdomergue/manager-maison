#!/bin/bash

# Script de développement avec surveillance des changements
echo "🔄 Mode développement - Surveillance des changements..."

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

# Aller à la racine du projet
cd "$(dirname "$0")/.."

# Vérifier si les dépendances sont installées
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installation des dépendances Angular...${NC}"
    npm install
fi

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

# Construire l'application une première fois
echo -e "${BLUE}🔨 Construction initiale de l'application...${NC}"
cd ..
npm run build
cd server

echo -e "${GREEN}🌐 Démarrage du serveur en mode développement...${NC}"
echo -e "${YELLOW}📱 Application accessible sur : http://localhost:3001${NC}"
echo -e "${YELLOW}🔄 Le serveur se redémarrera automatiquement lors des changements${NC}"
echo -e "${YELLOW}🛑 Appuyez sur Ctrl+C pour arrêter${NC}"
echo ""

# Démarrer le serveur en mode développement
npm run dev 