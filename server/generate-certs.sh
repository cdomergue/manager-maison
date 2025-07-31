#!/bin/bash

# Script pour générer les certificats SSL auto-signés
# Usage: ./generate-certs.sh

echo "🔐 Génération des certificats SSL auto-signés..."

# Créer le dossier certs
mkdir -p certs

# Générer la clé privée
openssl genrsa -out certs/key.pem 2048

# Générer le certificat auto-signé
openssl req -new -x509 -key certs/key.pem -out certs/cert.pem -days 365 -subj "/C=FR/ST=France/L=Paris/O=TachesMenageres/CN=localhost"

echo "✅ Certificats générés avec succès !"
echo "📁 Fichiers créés :"
echo "  - certs/key.pem (clé privée)"
echo "  - certs/cert.pem (certificat)"
echo ""
echo "⚠️  Note : Ces certificats sont auto-signés et généreront un avertissement de sécurité."
echo "   Pour la production, utilisez des certificats signés par une autorité de certification." 