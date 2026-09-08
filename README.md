# Gestion Maison (Taches Ménagères)

Application de gestion de tâches ménagères, liste de courses, notes et recettes.

## Architecture

Le projet utilise une architecture serverless moderne :

- **Frontend** : Angular (hébergé sur AWS Amplify)
- **Backend** : AWS Lambda + API Gateway + DynamoDB
- **Stockage** :
  - **Cloud** : DynamoDB (via Lambda) pour la persistance des données partagées.
  - **Local** : LocalStorage pour le fonctionnement hors ligne et le fallback en cas d'indisponibilité du réseau.

## Prérequis

- Node.js (>= 20.0.0)
- NPM (>= 10.0.0)
- Angular CLI (`npm install -g @angular/cli`)

## Installation

```bash
npm install
```

## Développement Local

Pour lancer l'application en mode développement :

```bash
npm start
```

ou

```bash
ng serve
```

L'application sera accessible sur `http://localhost:4200/`.

### Configuration de l'environnement

- `src/environments/environment.ts` : Configuration de développement par défaut.
- `src/environments/environment.prod.ts` : Configuration de production (utilisée par le build Amplify).
- `src/environments/environment.prod.local.ts` : Configuration locale pointant vers l'API de production (pour tests spécifiques).

## Build

Pour construire l'application pour la production :

```bash
npm run build
```

Les fichiers compilés seront générés dans le dossier `dist/`.

## Déploiement

### Frontend

Le frontend est configuré pour être déployé automatiquement via **AWS Amplify** à chaque push sur la branche principale (`main` ou `master`).

### Backend (Lambda)

Le code backend se trouve dans le dossier `lambda/`. Il contient le handler unique pour toutes les fonctions API.

Pour déployer les mises à jour de la Lambda, il est nécessaire de charger les variables d'environnement secrètes (VAPID keys) avant de lancer le script.

1. Créez un fichier `secret` à la racine du projet (s'il n'existe pas) avec le contenu suivant :

   ```bash
   export VAPID_SUBJECT="mailto:votre-email@example.com"
   export VAPID_PUBLIC_KEY="votre-cle-publique"
   export VAPID_PRIVATE_KEY="votre-cle-privee"
   ```

2. Lancez le déploiement en sourçant ce fichier :

```bash
source secret && ./deploy-lambda.sh
```

Ce script met à jour le code de la fonction Lambda sur AWS.

## Tests

### Tests Unitaires

```bash
npm test
```

## Qualité du Code

### Linting

```bash
npm run lint
```

### Formatage

```bash
npm run format
```

## Notifications

L'application utilise un système de notifications push pour les rappels de tâches.

### Architecture

- **Service Worker** : `src/sw-custom.js` gère la réception des notifications push en arrière-plan et leur affichage.
- **Backend** : AWS Lambda utilise la bibliothèque `web-push` pour envoyer les notifications via le protocole VAPID.
- **Amazon SNS** : Utilisé pour orchestrer l'envoi de messages (si configuré) ou pour des notifications système.

### Flux

1. L'utilisateur autorise les notifications dans le navigateur.
2. Le Service Worker génère un token d'abonnement (PushSubscription).
3. Ce token est envoyé au backend et stocké dans DynamoDB (`NOTIFICATION_TOKENS_TABLE_NAME`).
4. La Lambda vérifie périodiquement les rappels à envoyer et utilise ces tokens pour pusher les notifications.

### Carnet BB

L’onglet `/bb` partage les événements bébé avec les personnes ayant accès à la maison.
Les dates sont stockées en UTC et affichées en heure locale, du plus récent au plus ancien.
Les quantités de biberon (ml), durées de tétée (minutes) et notes sont facultatives ;
le texte est obligatoire pour « Divers ». Vomissement et régurgitation sont distincts.
« Soin » et « Bain » disposent de la date et de la note communes. Une seule option « Tétée »
est proposée, sans distinction de côté.

Les routes `GET/POST /api/baby-events` utilisent l’accès commun existant de l’API.
La table DynamoDB `BabyEventsTable`, ses permissions et les fonctions Lambda sont déclarées
avec les autres ressources dans `template.yaml`. Son contenu est conservé en cas de suppression de la pile.
L’historique chargé est mis en cache localement pour consultation ; les ajouts nécessitent une connexion,
et une erreur d’enregistrement conserve le formulaire. Utiliser « Actualiser » pour les ajouts des autres appareils.
La fonctionnalité nécessite une mise à jour du backend SAM et du frontend pour être disponible en production.

Tests ciblés : `npm test --prefix lambda` et
`npm test -- --watch=false --browsers=ChromeHeadless --include='src/app/**/*baby-log*.spec.ts'`.
