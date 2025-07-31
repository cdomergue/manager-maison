#!/bin/bash

# Script de déploiement AWS Lambda + API Gateway
echo "⚡ Déploiement AWS Lambda + API Gateway"
echo "======================================"

# Configuration
STACK_NAME="gestion-maison-backend"
S3_BUCKET="gestion-maison-sam-artifacts"
AWS_REGION="eu-west-1"

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
sam build

# Déploiement
log_info "Déploiement de la stack CloudFormation..."
sam deploy \
    --stack-name $STACK_NAME \
    --s3-bucket $S3_BUCKET \
    --region $AWS_REGION \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        ParameterKey=Environment,ParameterValue=production

if [ $? -eq 0 ]; then
    log_info "Déploiement réussi ! ✅"
    
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
    exit 1
fi