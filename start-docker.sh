#!/bin/sh

# Script de démarrage pour Docker
echo "🚀 Démarrage de l'application Tâches Ménagères..."

# Vérifier que l'application est construite
if [ ! -d "dist/taches-menageres" ]; then
    echo "📦 Construction de l'application Angular..."
    npm run build
fi

# Démarrer le serveur
echo "🌐 Démarrage du serveur Node.js..."
cd server
node server.js 