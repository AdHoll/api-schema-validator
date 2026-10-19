# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/) (SemVer).

## [1.2.0] - 2026-10-19

### Ajouté
- **Système de profils et de droits** (garde-fou côté client) : 5 profils — super admin,
  sous admin, développeur, QA, support. Connexion par mot de passe (haché SHA-256) avec
  question de récupération ; définition du super admin au premier lancement.
- **Page Administration** (super/sous admin) : matrice des droits par profil
  (specs, routes, scénarios, environnements), gestion des cibles API (ajout, **édition**,
  suppression), mots de passe des profils avec **indicateur « défini / non défini »**,
  import/export de la configuration.
  - Boutons **« tout cocher / tout décocher »** par section et, pour les routes, bascule
    **par méthode HTTP et par profil**.
  - **Sections repliables** (état mémorisé).
- **Connexion persistante 30 jours** (localStorage), conservée d'un onglet à l'autre.
- **Sélecteur de cibles API** (remplace la saisie d'URL libre) ; secret jamais stocké en prod.
- **Documentation : onglet « Swagger »** — vue de la spécification OpenAPI en **lecture seule**
  (endpoints par tag, méthodes colorées, paramètres, corps, réponses, schémas dépliables),
  sans aucun appel. Nouvel endpoint `GET /api/spec-parsed/:filename`.

### Modifié
- **Scénarios d'achat fusionnés** : les parcours « login » et « création de compte » sont
  réunis en un seul scénario (Achat complet, Achat produit, Panier seul, Panier seul par
  familyCode), avec une **case « Créer un compte »**. Les champs identifiant/mot de passe
  sont masqués lorsque cette case est cochée.
- **Validateur grisé hors connexion** (invite à se connecter) ; onglet « Administration »
  visible uniquement pour les administrateurs.
- **Page « Statut des APIs » mise en stand-by** et masquée de la navigation.

## [1.1.0] - 2026-10-15

### Ajouté
- **Scénarios d'achat** : trois modes d'exécution — **auto**, **semi-auto** (déroulé du
  catalogue avec choix à chaque étape) et **manuel**.
- **Parcours multi-familles** en mode auto : exploration récursive de toutes les familles
  parentes et enfants pour trouver un produit de la typologie demandée (open / daté / horodaté).
- **Scénarios « Panier seul »** (checkCart only, aucune vente créée), avec option de
  **suppression du panier** (`removeCart`) et re-vérification du panier après connexion (B2C).
- **Sélecteur d'environnement** (dev / préprod / prod) :
  - filtrage et réordonnancement des scénarios selon l'environnement ;
  - modale d'avertissement avant un scénario créant une vente (préprod) ;
  - vérification de cohérence URL / typologie.
- **Historique des 5 derniers tests** par cible, avec **favoris** (max 5, non écrasés),
  **export** et **import** de jeux de test (JSON).
- **Mémorisation chiffrée** du Client Secret (AES-GCM) en dev/préprod ; jamais en production.
- **Exécutable Windows autonome** (via `pkg`) : démarre le serveur et ouvre le navigateur,
  sans installation. Scripts `npm run package` / `package:all`. Voir `docs/DEPLOIEMENT.md`.
- Console API : affichage du **corps de la requête** en plus de la réponse.
- Persistance de la **sélection de routes** (mode manuel) par cible.
- Surlignage des champs d'authentification renseignés ; en-têtes uniformisés sur toutes les pages.

### Modifié
- Section « Paramètres des routes » et « Corps des requêtes » limitées aux routes sélectionnées.
- Les non-conformités de **pattern/format** sur une valeur présente, et les champs manquants
  **non requis** sur une réponse 2xx, sont classés en **avertissement** (non bloquant) et non
  plus en erreur ; nouvelle catégorie « conforme avec avertissements ».
- Messages de validation enrichis de la **valeur reçue** ; détail complet consultable
  (requête, réponse, erreurs, avertissements).
- Import de spec manuel masqué ; dernière version de la bibliothèque présélectionnée.

### Corrigé
- Chemins d'assets/données compatibles avec l'exécutable packagé.
- Rafraîchissement du picto de statut dans le sélecteur de scénarios.
- Divers correctifs d'ordre et d'affichage des étapes d'achat (B2C/B2B).

## [1.0.0] - 2026-09

### Ajouté
- Validateur de schéma OpenAPI/YAML avec authentification OAuth2 (`client_credentials`,
  scopes B2B/B2C) et comparaison des réponses au schéma attendu.
- Bibliothèque de specs embarquée (`spec-library/`), triée par version.
- Page « Statut des APIs » (test de la route token, identifiants via Bitwarden).
- Journalisation des appels avec masquage des secrets.
- Internationalisation FR / EN / IT / ES, page Documentation des flux.

[1.2.0]: https://github.com/AdHoll/api-schema-validator/releases/tag/v1.2.0
[1.1.0]: https://github.com/AdHoll/api-schema-validator/releases/tag/v1.1.0
[1.0.0]: https://github.com/AdHoll/api-schema-validator/releases/tag/v1.0.0
