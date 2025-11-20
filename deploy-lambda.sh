#!/bin/bash

# Script de déploiement AWS Lambda + API Gateway
echo "⚡ Déploiement AWS Lambda + API Gateway"
echo "======================================"

# Configuration
STACK_NAME="gestion-maison-backend"
S3_BUCKET="gestion-maison-sam-artifacts-eu-west-3"
AWS_REGION="eu-west-3"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier les prérequis
log_info "Vérification des prérequis..."

if ! command -v aws &> /dev/null; then
    log_error "AWS CLI non installé. Installez-le d'abord."
    exit 1
fi

if ! command -v sam &> /dev/null; then
    log_error "AWS SAM CLI non installé. Installez-le d'abord."
    echo "Installation: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

# Créer le bucket S3 pour SAM
log_info "Création du bucket S3 pour les artifacts..."
aws s3 mb s3://$S3_BUCKET --region $AWS_REGION 2>/dev/null || log_warn "Bucket déjà existant"

# Build SAM
log_info "Construction du package SAM..."

# --- Préparer le module partagé pour la lambda (sans dupliquer le code) ---
SHARED_VERSION=$(node -p "require('./shared/package.json').version" 2>/dev/null)
if [ -z "$SHARED_VERSION" ]; then
  # Fallback sans node -p
  SHARED_VERSION=$(grep -m1 '"version"' shared/package.json | sed -E 's/.*"version"\s*:\s*"([^"]+)".*/\1/')
fi

log_info "Packaging du module shared (version ${SHARED_VERSION})..."
pushd shared >/dev/null || { log_error "Dossier shared introuvable"; exit 1; }
npm pack --silent || { log_error "npm pack a échoué pour shared/"; popd >/dev/null; exit 1; }
TARBALL=$(ls -t taches-menageres-shared-*.tgz | head -1)
popd >/dev/null

if [ ! -f "shared/$TARBALL" ]; then
  log_error "Tarball du module shared introuvable"
  exit 1
fi

log_info "Copie du tarball $TARBALL dans lambda/"
cp "shared/$TARBALL" lambda/ || { log_error "Impossible de copier le tarball dans lambda/"; exit 1; }

# Sauvegarder et réécrire temporairement la dépendance dans lambda/package.json
LAMBDA_PKG=lambda/package.json
LAMBDA_PKG_BAK=lambda/package.json.bak
cp "$LAMBDA_PKG" "$LAMBDA_PKG_BAK" || { log_error "Impossible de sauvegarder lambda/package.json"; exit 1; }

log_info "Remplacement temporaire de la dépendance taches-menageres-shared par le tarball local"
node - <<'EOS'
const fs = require('fs');
const path = 'lambda/package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
if (pkg.dependencies['taches-menageres-shared']) {
  const tar = fs.readdirSync('lambda').find(f => /^taches-menageres-shared-.*\.tgz$/.test(f));
  if (!tar) {
    console.error('Tarball introuvable dans lambda/');
    process.exit(1);
  }
  pkg.dependencies['taches-menageres-shared'] = `file:./${tar}`;
}
fs.writeFileSync(path, JSON.stringify(pkg, null, 2));
EOS
if [ $? -ne 0 ]; then
  log_error "Echec de la mise à jour temporaire de lambda/package.json"; mv "$LAMBDA_PKG_BAK" "$LAMBDA_PKG"; exit 1
fi

log_info "Installation des dépendances dans lambda/"
(cd lambda && npm install --silent) || { log_error "npm install a échoué dans lambda/"; mv "$LAMBDA_PKG_BAK" "$LAMBDA_PKG"; rm -f "lambda/$TARBALL"; exit 1; }

# Build SAM (après avoir préparé les deps)
sam build || { log_error "sam build a échoué"; mv "$LAMBDA_PKG_BAK" "$LAMBDA_PKG"; rm -f "lambda/$TARBALL"; exit 1; }

# Déploiement
log_info "Déploiement de la stack CloudFormation..."
sam deploy \
    --stack-name $STACK_NAME \
    --s3-bucket $S3_BUCKET \
    --region $AWS_REGION \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        Environment=production \
        VapidSubject="$VAPID_SUBJECT" \
        VapidPublicKey="$VAPID_PUBLIC_KEY" \
        VapidPrivateKey="$VAPID_PRIVATE_KEY"

if [ $? -eq 0 ]; then
    log_info "Déploiement réussi ! ✅"
    # Nettoyage et restauration
    mv "$LAMBDA_PKG_BAK" "$LAMBDA_PKG" 2>/dev/null || true
    rm -f "lambda/$TARBALL" 2>/dev/null || true
    rm -f "shared/$TARBALL" 2>/dev/null || true

    # Récupérer l'URL de l'API
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $AWS_REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
        --output text)

    log_info "🌐 URL de votre API: $API_URL"
    log_info "📝 Notez cette URL pour la configuration d'Amplify"

    echo ""
    echo "🔧 Prochaines étapes :"
    echo "1. Notez l'URL API: $API_URL"
    echo "2. Configurez cette URL dans votre app Angular"
    echo "3. Redéployez sur Amplify"
    echo "4. Votre PWA sera complètement fonctionnelle !"

else
    log_error "Échec du déploiement"
    # Restauration en cas d'erreur
    mv "$LAMBDA_PKG_BAK" "$LAMBDA_PKG" 2>/dev/null || true
    rm -f "lambda/$TARBALL" 2>/dev/null || true
    exit 1
fi
