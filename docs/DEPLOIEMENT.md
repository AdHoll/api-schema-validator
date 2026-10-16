# Déploiement — Exécutable Windows autonome

Ce guide explique comment **packager** l'application en un exécutable Windows unique
(`.exe`), le **distribuer**, et comment les utilisateurs s'en servent — sans installer
Node.js ni aucune dépendance.

L'exécutable embarque le runtime Node, le serveur compilé, l'interface web (`public/`) et
la bibliothèque de specs (`spec-library/`). Au lancement, il démarre le serveur local et
ouvre automatiquement le navigateur par défaut sur l'application.

---

## 1. Générer l'exécutable (poste de build)

Prérequis sur le poste qui fabrique l'exe :
- **Node.js ≥ 18** et **npm**
- les dépendances installées : `npm install`

Commande de packaging (cible Windows 64 bits) :

```bash
npm run package
```

Cela effectue deux étapes :
1. `npm run build` — compile le TypeScript (`src/` → `dist/`).
2. `pkg` — produit l'exécutable dans **`release/VivAPI-Validator.exe`**.

> Pour générer en plus les binaires macOS et Linux : `npm run package:all`
> (les exécutables sont déposés dans `release/`).

La première exécution de `pkg` télécharge les bases Node correspondant aux cibles ; les
suivantes sont plus rapides (cache local).

---

## 2. Distribuer

L'exécutable est **autonome** : il suffit de partager le fichier
`release/VivAPI-Validator.exe` (copie réseau, clé USB, etc.).

Fichiers créés **à côté de l'exe** au premier lancement (ne pas les embarquer dans l'exe) :

| Élément            | Rôle                                                              |
|--------------------|-------------------------------------------------------------------|
| `logs/`            | journaux des appels API (un fichier par jour)                     |
| `uploads/`         | fichiers temporaires d'analyse de spec                            |
| `api-targets.json` | cibles de la page « Statut des APIs » (aucun secret ; optionnel)  |

> Il est donc recommandé de placer l'exe dans **son propre dossier** (ex:
> `VivAPI-Validator/VivAPI-Validator.exe`), afin que ces éléments restent rangés.

Ce qui est **embarqué dans l'exe** (lecture seule, rien à copier) : l'interface web et la
bibliothèque de specs `spec-library/`.

---

## 3. Utiliser (poste utilisateur)

1. Double-cliquer sur `VivAPI-Validator.exe`.
2. Une fenêtre console s'ouvre (le serveur) et le **navigateur par défaut** s'ouvre sur
   `http://localhost:3001`.
3. Pour quitter : fermer la fenêtre console.

Aucune installation n'est requise. Si le port 3001 est déjà pris, voir la variable
`PORT` ci-dessous.

### Variables d'environnement (optionnelles)

On peut lancer l'exe depuis un terminal en définissant des variables :

| Variable        | Effet                                                                  |
|-----------------|------------------------------------------------------------------------|
| `PORT`          | port d'écoute (défaut : `3001`)                                        |
| `NODE_ENV`      | `production` (vérifie les certificats SSL) ou `development` (les ignore)|
| `OPEN_BROWSER`  | `0` pour **ne pas** ouvrir le navigateur au lancement                   |

Exemple (PowerShell) :

```powershell
$env:PORT=4000; .\VivAPI-Validator.exe
```

---

## 4. Sécurité — stockage du Client Secret

L'application permet de **mémoriser le Client Secret** pour éviter de le re-saisir, via la
case « Mémoriser le secret (chiffré, hors prod) » de la section Authentification.

Comportement selon l'**environnement** choisi (sélecteur dev / préprod / prod) :

- **dev / préprod** : si la case est cochée, le secret est **chiffré** (WebCrypto AES-GCM)
  avant d'être stocké dans le `localStorage` du navigateur. Il est déchiffré et re-rempli
  lorsqu'on recharge la cible depuis l'historique.
- **production** : le secret n'est **jamais** mémorisé — la case est masquée et la saisie
  est obligatoire à chaque session.

> ⚠️ **Portée de la protection.** Le chiffrement local est une **obfuscation** : la clé est
> dérivée d'une phrase fixe embarquée dans l'application. Le secret n'apparaît donc pas en
> clair dans le `localStorage`, mais une personne ayant accès au poste peut théoriquement le
> déchiffrer. Ce n'est **pas** un coffre-fort. Pour une vraie gestion de secrets, utiliser
> Bitwarden (page « Statut des APIs ») — intégration à venir côté validateur.

Par ailleurs, les journaux (`logs/`) **masquent automatiquement** les valeurs sensibles
(`client_secret`, `password`, `token`, `access_token`, `authorization`).

---

## 5. Dépannage

- **Le navigateur ne s'ouvre pas** : ouvrir manuellement `http://localhost:3001`.
- **Port déjà utilisé** : relancer avec `PORT` différent (voir ci-dessus).
- **Antivirus / SmartScreen** bloque l'exe : les binaires `pkg` non signés peuvent déclencher
  un avertissement Windows. Autoriser l'exécution, ou signer l'exe avec un certificat interne.
- **Les specs n'apparaissent pas** : la bibliothèque est embarquée dans l'exe ; régénérer
  l'exe après avoir ajouté des fichiers dans `spec-library/`.
