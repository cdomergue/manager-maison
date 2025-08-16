# Modules Partagés

Ce dossier contient les modules partagés entre le serveur local (`server/server.js`) et les fonctions Lambda (`lambda/handler.js`).

## Structure

### `utils.js`

Fonctions utilitaires communes :

- `generateId()` : Génère un ID unique
- `sanitizeString(str)` : Nettoie et valide une chaîne
- `validateName(name)` : Valide qu'un nom n'est pas vide
- `validateQuantity(quantity, defaultValue)` : Valide et convertit une quantité
- `formatDateISO(date)` : Formate une date en ISO string
- `getUserId(headers)` : Récupère l'ID utilisateur depuis les headers
- `isDefined(value)` : Vérifie si une valeur est définie

### `dates.js`

Logique de calcul des dates :

- `calculateNextDueDate(task)` : Calcule la prochaine date d'échéance
- `computeNextWithRRule(task, fromDate)` : Calcule avec RRule
- `skipExcludedDates(date, task)` : Évite les dates exclues
- `isHolidayFrance(date)` : Vérifie les jours fériés français
- `isExceptionDate(date, exceptions)` : Vérifie les dates d'exception
- `isExcluded(date, task)` : Vérifie si une date est exclue
- `nextByDayAfter(from, byDays, includeToday)` : Trouve le prochain jour spécifique

### `constants.js`

Constantes partagées :

- `DEFAULT_CATEGORIES` : Catégories par défaut des tâches
- `ERROR_MESSAGES` : Messages d'erreur standardisés
- `DEFAULT_CORS_HEADERS` : Configuration CORS par défaut
- `DEFAULT_DATABASE_STRUCTURE` : Structure par défaut de la base de données

## Installation

```bash
cd shared
npm install
```

## Utilisation

```javascript
// Importation spécifique
const { generateId, calculateNextDueDate } = require("../shared/utils");
const { ERROR_MESSAGES } = require("../shared/constants");

// Ou importation complète
const shared = require("../shared");
```

## Avantages de la Refactorisation

1. **Réduction de la duplication** : Le code commun n'est plus dupliqué
2. **Maintenance facilitée** : Les modifications se font en un seul endroit
3. **Cohérence** : Même logique métier dans tous les environnements
4. **Tests simplifiés** : Les modules peuvent être testés indépendamment
5. **Évolutivité** : Facile d'ajouter de nouvelles fonctionnalités partagées
