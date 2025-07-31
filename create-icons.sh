#!/bin/bash

# Script pour créer des icônes PWA simples
echo "🎨 Création des icônes PWA..."

# Créer le dossier icons s'il n'existe pas
mkdir -p public/icons

# Créer une icône SVG simple
cat > public/icons/icon.svg << 'EOF'
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#3B82F6"/>
  <text x="256" y="320" font-family="Arial, sans-serif" font-size="200" fill="white" text-anchor="middle">🏠</text>
</svg>
EOF

# Fonction pour créer une icône PNG à partir du SVG (si ImageMagick est disponible)
create_png_icon() {
    local size=$1
    if command -v convert &> /dev/null; then
        convert -background none -size ${size}x${size} public/icons/icon.svg public/icons/icon-${size}x${size}.png
        echo "✅ Icône ${size}x${size} créée"
    else
        echo "⚠️  ImageMagick non disponible, icône ${size}x${size} non créée"
    fi
}

# Créer les différentes tailles
create_png_icon 72
create_png_icon 96
create_png_icon 128
create_png_icon 144
create_png_icon 152
create_png_icon 192
create_png_icon 384
create_png_icon 512

echo "🎉 Icônes créées dans public/icons/"
ls -la public/icons/