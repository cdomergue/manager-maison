# Configuration des Variables d'Environnement

Ce projet utilise désormais des variables d'environnement pour masquer l'URL de l'API et éviter qu'elle ne soit exposée dans le code source.

## Structure des Fichiers

### Fichiers d'Environnement

- `src/environments/environment.ts` - Configuration de développement (localhost)
- `src/environments/environment.prod.ts` - Configuration de production (avec placeholder)
- `src/environments/environment.prod.local.ts` - Configuration locale avec vraie API (**NON VERSIONNÉE**)

### Scripts de Configuration

- `build-config.js` - Script qui remplace l'URL de l'API lors du build sur AWS Amplify (ne contient aucune URL en dur)

## Configuration AWS Amplify

### Variables d'Environnement à Configurer

Dans la console AWS Amplify, ajoutez la variable d'environnement suivante :

```
API_URL = votre.api.aws
```

### Processus de Déploiement

1. AWS Amplify exécute `npm ci`
2. AWS Amplify exécute `node build-config.js` qui :
   - Lit la variable d'environnement `API_URL`
   - Remplace le placeholder dans `environment.prod.ts`
3. AWS Amplify exécute `npm run build`

## Commandes de Développement

### Développement Local (API locale)

```bash
npm start
# Utilise l'API locale sur /api
```

### Développement Local (API de production)

```bash
npm run start:prod-api
# Utilise l'API de production (nécessite le fichier environment.prod.local.ts)
```

### Build de Production

```bash
npm run build
# Build normal (URL sera remplacée par Amplify)

npm run build:config
# Build local avec remplacement de l'URL via variable d'environnement API_URL

# Ou avec variable d'environnement :
API_URL="https://votre-api.amazonaws.com/prod/api" npm run build:config
```

### Test Local du Build

```bash
# Copiez le script d'exemple et modifiez l'URL
cp local-build-example.sh local-build.sh
# Editez local-build.sh avec votre vraie URL
# Puis exécutez :
./local-build.sh
```

## Sécurité

- ✅ L'URL de l'API n'est plus exposée dans aucun fichier versionné
- ✅ Le fichier `environment.prod.local.ts` est ignoré par Git
- ✅ Le script `build-config.js` ne contient aucune URL en dur
- ✅ L'URL est injectée uniquement via les variables d'environnement AWS Amplify
- ✅ Le build échoue si la variable d'environnement n'est pas définie

## Migration Effectuée

✅ Création des fichiers d'environnement  
✅ Modification du service API pour utiliser `environment.apiUrl`  
✅ Configuration d'Angular pour les remplacements de fichiers  
✅ Script de build pour AWS Amplify  
✅ Ajout des fichiers sensibles au .gitignore  
✅ Configurations de développement additionnelles

## Prochaines Étapes

Pour configurer AWS Amplify :

1. Allez dans la console AWS Amplify
2. Sélectionnez votre application
3. Allez dans "Environment variables"
4. Ajoutez `API_URL` avec la valeur de votre endpoint Lambda
5. Redéployez l'application

L'URL ne sera plus visible dans le code source lors des prochains commits.
