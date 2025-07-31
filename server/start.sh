#!/bin/bash

# Script de démarrage du serveur Tâches Ménagères
echo "🚀 Démarrage du serveur Tâches Ménagères..."

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez l'installer depuis https://nodejs.org/"
    exit 1
fi

# Vérifier si npm est installé
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé. Veuillez l'installer avec Node.js"
    exit 1
fi

# Vérifier si les dépendances sont installées
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
fi

# Créer le dossier data s'il n'existe pas
if [ ! -d "data" ]; then
    echo "📁 Création du dossier data..."
    mkdir data
fi

# Démarrer le serveur
echo "🌐 Démarrage du serveur sur http://localhost:3001"
echo "📊 API disponible sur http://localhost:3001/api"
echo "🛑 Appuyez sur Ctrl+C pour arrêter le serveur"
echo ""

npm start 