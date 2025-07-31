#!/bin/bash

# Script pour télécharger et configurer le projet sur TrueNAS
# Usage: ./setup-truenas.sh

set -e

echo "🏠 Configuration du projet Tâches Ménagères sur TrueNAS"
echo "====================================================="

# Configuration
PROJECT_DIR="/mnt/SSD/dev/manager-maison"
GIT_REPO="https://github.com/votre-username/taches-menageres.git"

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
    
    # Vérifier Git
    if ! command -v git &> /dev/null; then
        log_error "Git n'est pas installé. Veuillez l'installer d'abord."
        exit 1
    fi
    
    # Vérifier Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker n'est pas installé. Veuillez l'installer d'abord."
        exit 1
    fi
    
    log_info "Prérequis vérifiés ✓"
}

# Télécharger le projet
download_project() {
    log_info "Téléchargement du projet..."
    
    # Créer le dossier si nécessaire
    mkdir -p "$PROJECT_DIR"
    cd "$PROJECT_DIR"
    
    # Cloner le projet
    if [ -d ".git" ]; then
        log_info "Projet déjà présent, mise à jour..."
        git pull
    else
        log_info "Clonage du projet..."
        git clone "$GIT_REPO" .
    fi
    
    log_info "Projet téléchargé ✓"
}

# Vérifier les fichiers essentiels
check_files() {
    log_info "Vérification des fichiers essentiels..."
    
    cd "$PROJECT_DIR"
    
    # Liste des fichiers requis
    required_files=(
        "Dockerfile"
        "package.json"
        "angular.json"
        "src/"
        "server/"
        "deploy-truenas-fixed.sh"
    )
    
    missing_files=()
    
    for file in "${required_files[@]}"; do
        if [ ! -e "$file" ]; then
            missing_files+=("$file")
        fi
    done
    
    if [ ${#missing_files[@]} -eq 0 ]; then
        log_info "Tous les fichiers sont présents ✓"
    else
        log_error "Fichiers manquants :"
        for file in "${missing_files[@]}"; do
            echo "  - $file"
        done
        log_error "Veuillez copier tous les fichiers du projet."
        exit 1
    fi
}

# Rendre les scripts exécutables
make_executable() {
    log_info "Configuration des permissions..."
    
    cd "$PROJECT_DIR"
    
    chmod +x deploy-truenas-fixed.sh 2>/dev/null || log_warn "Script deploy-truenas-fixed.sh non trouvé"
    chmod +x deploy-truenas-simple.sh 2>/dev/null || log_warn "Script deploy-truenas-simple.sh non trouvé"
    chmod +x start-docker.sh 2>/dev/null || log_warn "Script start-docker.sh non trouvé"
    
    log_info "Permissions configurées ✓"
}

# Fonction principale
main() {
    check_prerequisites
    download_project
    check_files
    make_executable
    
    log_info "Configuration terminée ! 🎉"
    log_info "Vous pouvez maintenant lancer : ./deploy-truenas-fixed.sh"
}

# Exécuter le script
main "$@" 