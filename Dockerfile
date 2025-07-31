# Dockerfile pour l'application Gestion de la Maison
FROM node:20-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de configuration
COPY package*.json ./
COPY angular.json ./
COPY tsconfig*.json ./

# Installer les dépendances Angular
RUN npm install

# Copier le code source
COPY src/ ./src/
COPY public/ ./public/
COPY ngsw-config.json ./

    # Construire l'application Angular en production
    RUN npm run build -- --configuration=production

# Installer les dépendances du serveur
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --production

# Copier les fichiers du serveur
COPY server/ ./

# Installer OpenSSL et générer les certificats SSL avec les bonnes extensions
RUN apk add --no-cache openssl && \
    mkdir -p certs && \
    openssl genrsa -out certs/key.pem 2048 && \
    echo "[req]" > certs/openssl.cnf && \
    echo "distinguished_name = req_distinguished_name" >> certs/openssl.cnf && \
    echo "req_extensions = v3_req" >> certs/openssl.cnf && \
    echo "prompt = no" >> certs/openssl.cnf && \
    echo "" >> certs/openssl.cnf && \
    echo "[req_distinguished_name]" >> certs/openssl.cnf && \
    echo "C = FR" >> certs/openssl.cnf && \
    echo "ST = France" >> certs/openssl.cnf && \
    echo "L = Paris" >> certs/openssl.cnf && \
    echo "O = GestionMaison" >> certs/openssl.cnf && \
    echo "CN = 192.168.1.96" >> certs/openssl.cnf && \
    echo "" >> certs/openssl.cnf && \
    echo "[v3_req]" >> certs/openssl.cnf && \
    echo "basicConstraints = CA:FALSE" >> certs/openssl.cnf && \
    echo "keyUsage = critical, digitalSignature, keyEncipherment" >> certs/openssl.cnf && \
    echo "extendedKeyUsage = critical, serverAuth" >> certs/openssl.cnf && \
    echo "subjectAltName = @alt_names" >> certs/openssl.cnf && \
    echo "" >> certs/openssl.cnf && \
    echo "[alt_names]" >> certs/openssl.cnf && \
    echo "DNS.1 = localhost" >> certs/openssl.cnf && \
    echo "DNS.2 = 192.168.1.96" >> certs/openssl.cnf && \
    echo "IP.1 = 192.168.1.96" >> certs/openssl.cnf && \
    echo "IP.2 = 127.0.0.1" >> certs/openssl.cnf && \
    openssl req -new -x509 -key certs/key.pem -out certs/cert.pem -days 365 \
    -config certs/openssl.cnf -extensions v3_req

# Créer le dossier de données
RUN mkdir -p data

# Exposer le port
EXPOSE 3001

# Script de démarrage
COPY start-docker.sh /app/
RUN chmod +x /app/start-docker.sh

# Commande par défaut
CMD ["node", "server-https.js"] 