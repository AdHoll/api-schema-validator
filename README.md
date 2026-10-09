# VivAPI Unified Validator

Validateur de schéma OpenAPI/YAML avec authentification OAuth2 (scope **B2B**/**B2C**).

*Lire ceci en [anglais](./README.en.md).*

L'outil permet de charger une spécification OpenAPI, de sélectionner des routes, d'appeler
une API réelle en s'authentifiant en OAuth2 (`client_credentials`), puis de **comparer les
réponses au schéma attendu** afin de détecter les écarts (champs requis manquants, champs non
documentés, champs optionnels non implémentés, valeurs `null` inattendues, etc.).

Une page « Statut des APIs » permet par ailleurs de tester rapidement la route de token OAuth2
de plusieurs environnements, en récupérant les identifiants depuis **Bitwarden** (via la CLI `bw`).

## Fonctionnalités

- **Analyse de spec OpenAPI** : extraction des routes, méthodes, paramètres `path`/`query`,
  requestBody JSON et génération automatique d'un squelette de corps.
- **Validation en batch** : authentification OAuth2 puis appel des routes sélectionnées, avec
  classement des écarts :
  - `errors` — champ **requis** manquant ou invalide (bloquant)
  - `warnings` — champ optionnel invalide (non bloquant)
  - `nullables` — valeur `null` alors qu'un type est attendu (non bloquant)
  - `undocumented` — champ présent dans la réponse mais absent du YAML (non bloquant)
  - `notImplemented` — champ optionnel du YAML absent de la réponse (non bloquant)
- **Bibliothèque de specs** embarquée (`spec-library/`), triée par version (sémantique).
- **Page Statut des APIs** : test de la route token OAuth2 par cible, identifiants résolus
  depuis Bitwarden (organisation + collection + nom d'entrée).
- **Journalisation** des appels dans `logs/`, avec masquage automatique des secrets
  (`client_secret`, `password`, `token`, `access_token`, `authorization`).

## Prérequis

- **Node.js** ≥ 18 (développé et testé avec Node 24, npm 11).
- Pour la page « Statut des APIs » : la **CLI Bitwarden** (`bw`) installée et accessible dans le `PATH`.
  ```bash
  npm install -g @bitwarden/cli
  ```

## Installation

```bash
npm install
```

## Configuration

Créez un fichier `.env` à la racine (non versionné) :

```env
# Environnement : development | production
NODE_ENV=development

# Port du serveur
PORT=3001
```

> En `production`, les certificats SSL sont vérifiés. En `development`, ils sont ignorés
> pour faciliter les tests sur des environnements internes.

### Cibles de la page Statut (`api-targets.json`)

Le fichier `api-targets.json` liste les APIs testables depuis la page Statut. Il ne contient
**aucun secret** — uniquement des références vers les entrées Bitwarden :

```json
{
  "targets": [
    {
      "id": "api-123",
      "label": "Mon API",
      "owner": "MonOrganisation",
      "collection": "MaCollection",
      "bwItemName": "Nom exact de l'entrée Bitwarden",
      "scope": "b2c",
      "tags": ["Dev"]
    }
  ]
}
```

Les identifiants (url / username / password) sont récupérés à la volée dans Bitwarden et
ne sont jamais stockés sur disque.

## Démarrage

```bash
# Développement (rechargement à chaud)
npm run dev

# Production
npm run build
npm start
```

Le serveur est ensuite disponible sur `http://localhost:3001` (ou le `PORT` configuré).

## Structure du projet

```
src/
  index.ts                 # Point d'entrée Express (statique + routeurs)
  routes/
    validator.ts           # Analyse de spec + validation en batch (OAuth2 + comparaison schéma)
    apiStatus.ts           # Page Statut : coffre Bitwarden + test des tokens
  services/
    yamlParser.ts          # Extraction des routes + validation AJV + diff réponse/schéma
    bitwarden.ts           # Accès à la CLI bw (unlock/lock, résolution org/collection/item)
public/                    # Front statique (index.html, status.html, etc.)
spec-library/              # Specs OpenAPI embarquées, versionnées
api-targets.json           # Cibles de la page Statut (sans secrets)
logs/                      # Journaux d'appels (générés, non versionnés)
uploads/                   # Fichiers temporaires d'upload (générés, non versionnés)
```

## Points d'API principaux

| Méthode | Route | Description |
|--------|-------|-------------|
| `GET`  | `/api/spec-versions` | Liste les versions de specs embarquées |
| `GET`  | `/api/spec/:filename` | Contenu brut d'une spec embarquée |
| `POST` | `/api/parse-routes` | Extrait les routes d'un YAML uploadé (champ `spec`) |
| `POST` | `/api/validate-batch` | Authentifie en OAuth2 et valide les routes sélectionnées |
| `GET`  | `/api/status/vault-status` | État du coffre Bitwarden |
| `POST` | `/api/status/unlock` | Déverrouille le coffre (master password) |
| `POST` | `/api/status/lock` | Verrouille le coffre |
| `GET`  | `/api/status/targets` | Liste les cibles configurées |
| `POST` | `/api/status/targets` | Met à jour les cibles |
| `POST` | `/api/status/test` | Teste le token OAuth2 des cibles (par `ids` ou `tags`) |

## Sécurité

- Le **master password** Bitwarden transite par STDIN, jamais en argument de ligne de commande,
  et n'est ni stocké ni logué.
- Seule la session Bitwarden (`BW_SESSION`) est gardée **en mémoire** avec une expiration courte
  (15 min), jamais écrite sur disque.
- Les secrets sont **masqués** dans les journaux d'appels.
- La lecture des specs embarquées est protégée contre la traversée de répertoire.

## Notes

- `node_modules/`, `dist/`, `.env`, `logs/` et `uploads/` sont volontairement exclus du dépôt
  (voir `.gitignore`).
