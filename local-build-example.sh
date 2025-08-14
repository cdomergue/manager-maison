#!/bin/bash

# Exemple de script pour tester le build en local
# Remplacez l'URL par votre vraie URL d'API

export API_URL="https://votre-api-endpoint.execute-api.region.amazonaws.com/prod/api"

echo "Test du build avec l'URL configurée..."
npm run build:config
