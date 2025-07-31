#!/bin/bash

# Script de déploiement pour TrueNAS (Version sudo)
# Usage: sudo ./deploy-truenas-sudo.sh

set -e

echo "🏠 Déploiement de Gestion de la Maison sur TrueNAS (Version Sudo)"
echo "================================================================="

# Configuration - utiliser le répertoire courant
APP_NAME="gestion-maison"
APP_PORT="3001"
DATA_DIR="$(pwd)"
DOCKER_IMAGE="gestion-maison"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
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
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    # Vérifier Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker n'est pas installé. Veuillez l'installer d'abord."
        exit 1
    fi
    
    log_info "Docker trouvé ✓"
    log_info "Prérequis vérifiés ✓"
}

# Vérifier les fichiers essentiels
check_files() {
    log_info "Vérification des fichiers..."
    
    # Vérifier que le Dockerfile existe
    if [ ! -f "Dockerfile" ]; then
        log_error "Dockerfile non trouvé dans $(pwd)"
        log_error "Fichiers présents :"
        ls -la
        exit 1
    fi
    
    # Vérifier package.json
    if [ ! -f "package.json" ]; then
        log_error "package.json non trouvé"
        exit 1
    fi
    
    log_info "Fichiers essentiels trouvés ✓"
}

# Créer les dossiers nécessaires (sans chmod)
create_directories() {
    log_info "Création des dossiers..."
    
    # Créer les dossiers sans changer les permissions
    mkdir -p "$DATA_DIR/data" 2>/dev/null || log_warn "Dossier data déjà existant"
    mkdir -p "$DATA_DIR/logs" 2>/dev/null || log_warn "Dossier logs déjà existant"
    
    # Vérifier que les dossiers existent
    if [ -d "$DATA_DIR/data" ] && [ -d "$DATA_DIR/logs" ]; then
        log_info "Dossiers créés ✓"
    else
        log_error "Impossible de créer les dossiers. Vérifiez les permissions."
        exit 1
    fi
}

# Déploiement Docker simple
deploy_docker() {
    log_info "Déploiement avec Docker..."
    
    # Arrêter le conteneur existant s'il existe
    if docker ps -q -f name="$APP_NAME" | grep -q .; then
        log_info "Arrêt du conteneur existant..."
        docker stop "$APP_NAME" || true
        docker rm "$APP_NAME" || true
    fi
    
    # Supprimer l'image existante
    if docker images -q "$DOCKER_IMAGE" | grep -q .; then
        log_info "Suppression de l'image existante..."
        docker rmi "$DOCKER_IMAGE" || true
    fi
    
    # Construire l'image
    log_info "Construction de l'image Docker..."
    log_info "Répertoire de travail : $(pwd)"
    docker build -t "$DOCKER_IMAGE" .
    
    # Démarrer le conteneur
    log_info "Démarrage du conteneur..."
    docker run -d \
        --name "$APP_NAME" \
        --restart unless-stopped \
        -p "$APP_PORT:$APP_PORT" \
        -p "3443:3443" \
        -v "$DATA_DIR/data:/app/server/data" \
        -v "$DATA_DIR/logs:/app/logs" \
        -e NODE_ENV=production \
        -e PORT="$APP_PORT" \
        "$DOCKER_IMAGE"
    
    log_info "Déploiement Docker terminé ✓"
}

# Configuration réseau
configure_network() {
    log_info "Configuration réseau..."
    
    # Trouver l'IP de TrueNAS
    NAS_IP=$(hostname -I | awk '{print $1}')
    
    log_info "IP de TrueNAS détectée: $NAS_IP"
    log_info "URL d'accès: http://$NAS_IP:$APP_PORT"
    
    # Vérifier si le port est ouvert
    if command -v netstat &> /dev/null; then
        if netstat -tlnp | grep -q ":$APP_PORT "; then
            log_info "Port $APP_PORT est ouvert ✓"
        else
            log_warn "Port $APP_PORT n'est pas ouvert. Vérifiez votre pare-feu."
        fi
    fi
}

# Vérification du déploiement
verify_deployment() {
    log_info "Vérification du déploiement..."
    
    sleep 5
    
    # Vérifier si le conteneur fonctionne
    if docker ps | grep -q "$APP_NAME"; then
        log_info "Conteneur en cours d'exécution ✓"
    else
        log_error "Conteneur non démarré. Vérifiez les logs."
        docker logs "$APP_NAME"
        return 1
    fi
    
    # Vérifier si l'application répond
    if curl -s "http://localhost:$APP_PORT/api/status" > /dev/null; then
        log_info "Application accessible ✓"
    else
        log_warn "Application non accessible immédiatement. Vérifiez les logs."
        docker logs "$APP_NAME"
    fi
    
    # Afficher les logs récents
    log_info "Logs récents:"
    docker logs --tail=10 "$APP_NAME"
}

# Fonction principale
main() {
    check_prerequisites
    check_files
    create_directories
    deploy_docker
    configure_network
    verify_deployment
    
    log_info "Déploiement terminé avec succès ! 🎉"
    log_info "Accédez à votre application: http://$(hostname -I | awk '{print $1}'):$APP_PORT"
}

# Exécuter le script
main "$@" 