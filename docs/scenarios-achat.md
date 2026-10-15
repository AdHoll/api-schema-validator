# Scénarios d'achat automatisés & internationalisation

Ce document décrit les fonctionnalités ajoutées à l'outil **VivAPI Unified Validator** :
l'internationalisation (i18n), la page Documentation, et surtout les **scénarios de test
d'achat** qui rejouent un parcours de vente complet contre l'API backoffice unified.

> **Schémas visuels** (en anglais) :
> - [`scenario-auth-order.svg`](./scenario-auth-order.svg) — ordre d'authentification B2B vs B2C
> - [`scenario-offer-types.svg`](./scenario-offer-types.svg) — les 5 modes de typologie d'offre
> - [`scenario-purchase-cycle.svg`](./scenario-purchase-cycle.svg) — cycle d'achat et chaînage de données

---

## 1. Vue d'ensemble

Un **scénario** enchaîne automatiquement des appels à l'API backoffice, en réinjectant la
donnée d'une réponse dans l'appel suivant (le même principe que le schéma de flux documenté
dans [`flux-api-backoffice.md`](./flux-api-backoffice.md)). Quatre scénarios d'achat sont
disponibles, construits à partir d'une fabrique commune :

| Scénario | Point de départ | Authentification |
|----------|-----------------|------------------|
| Achat complet (login) | Famille de regroupement (`findParentFamilies`) | Login compte existant |
| Achat complet (création de compte) | Famille de regroupement | Création de compte puis login |
| Achat produit (familyCode fourni, login) | `familyCode` saisi | Login compte existant |
| Achat produit (familyCode fourni, création de compte) | `familyCode` saisi | Création de compte puis login |

La seule différence entre les deux premiers et les deux derniers est le **point de départ**
du catalogue (famille de regroupement à explorer vs code famille fourni directement).

---

## 2. Séquence d'achat et chaînage de données

Chaque scénario réalise, pour l'offre/produit sélectionné :

```
token → [auth] → catalogue (offre → produit) → checkCart → [auth B2C] → beginOrderTrans → confirmOrderTrans (EMULATEPAY)
```

Routes backoffice impliquées et données qui circulent :

| Étape | Route | Donnée produite ⮑ réutilisée |
|-------|-------|------------------------------|
| Connexion | `POST /api/v1/auth/signin` | `accountCode` |
| Lecture compte | `GET /api/v1/account/readAccount` | — (validation) |
| Offres par famille | `GET /api/v1/offer/findOfferCodesByFamily` | `offerCode` |
| Date / calendrier | `GET /api/v1/offer/findFirstAvailableDate`, `GET /api/v1/performance/findCalendarDays` | `date` |
| Performance | `GET /api/v1/performance/findPerformanceByDay` | `performanceCode`, `performanceDate` |
| Produits | `GET /api/v1/product/findProductCodes` | `productCode` |
| Panier | `POST /api/v1/cart/checkCart` | `cartCode`, `total` |
| Transaction | `POST /api/v1/order/beginOrderTrans` | `orderCode` |
| Confirmation | `POST /api/v1/order/confirmOrderTrans` | commande finale |

Le paiement utilise le mode émulé **`EMULATEPAY`** (environnement de test), avec un
`PaymentApplied` du montant total : `{ paymentCode: "EMULATEPAY", amount: { value, currency }, paymentDate }`.

---

## 3. Ordre d'authentification : B2B vs B2C

L'ordre du `signin` (et de la création de compte) dépend du **scope** choisi dans le bloc
d'authentification OAuth2 :

- **B2B** : authentification **avant** le parcours d'achat (login → catalogue → panier → …).
- **B2C** : authentification **après le premier `checkCart`** (parcours e-commerce classique :
  on remplit le panier anonymement, puis on s'identifie). L'authentification est réalisée
  **une seule fois** par exécution ; l'`accountCode` obtenu est réutilisé pour les ventes
  suivantes (modes multi-ventes).

Le `checkCart` ne requiert pas d'être authentifié (seul le token OAuth2 suffit), ce qui rend
l'ordre B2C possible. Voir [`scenario-auth-order.svg`](./scenario-auth-order.svg).

---

## 4. Typologies d'offre (5 modes)

À la sélection d'un scénario, un champ **« Typologie d'offre »** propose 5 modes. L'outil
classe automatiquement chaque offre de la famille :

- **open** : offre sans performance (`findPerformanceByDay` → 404).
- **daté** : offre avec performance « journée » (`isFullDay = true`).
- **horodaté** : offre avec performance à créneau (`isFullDay = false`).

| Mode | Comportement | Si type absent |
|------|--------------|----------------|
| Produit open | 1 vente d'une offre open | Arrêt du flow (message explicite) |
| Produit daté | 1 vente d'une offre datée | Arrêt du flow |
| Produit horodaté | 1 vente d'une offre horodatée | Arrêt du flow |
| Un de chaque type présent | Jusqu'à 3 ventes (une par type trouvé) | Continue ; récap des types manquants à la fin |
| Vente complexe | 1 seule vente, panier avec 1 article de chaque type présent | Vente des types présents ; récap des manquants |

Voir [`scenario-offer-types.svg`](./scenario-offer-types.svg).

Le panier accepte plusieurs articles de typologies différentes dans une seule transaction
(validé en environnement de dev) : un item « open » est `{ item: { productCode, quantity } }`,
un item daté/horodaté ajoute `performanceCodes: [{ code, date }]`.

---

## 5. Génération automatique de données client

Pour la **création de compte**, les données client sont générées automatiquement via un
générateur maison (`generateFakeCustomer`). Dans les corps de requête, on utilise des
placeholders `{{@champ}}` résolus côté client avant l'envoi :
`{{@firstName}}`, `{{@lastName}}`, `{{@email}}`, `{{@address}}`, `{{@country}}`, `{{@phone}}`,
`{{@login}}`, `{{@password}}`.

Les valeurs sont stables pour toute la durée d'une exécution (le login/mot de passe généré
au `createAccount` servent au `signin` qui suit).

`createAccount` utilise le masque de saisie (`fields[{ fieldCode, value }]`). Les `fieldCode`
validés sur l'environnement de dev B2C web sont : `1` = prénom, `3` = nom, `21` = email,
`548` = username (login), `549` = password. **Ces codes dépendent de la configuration du
tenant** et peuvent devoir être ajustés sur un autre environnement.

---

## 6. Rejeu d'une étape échouée

Si une étape plante (y compris la dernière), un bouton **« Rejouer l'étape échouée »**
apparaît. Il relance le scénario **exactement à l'étape fautive**, en conservant tout le
contexte accumulé (valeurs collectées, données générées, choix de branche, résultats des
étapes précédentes). Utile pour un échec transitoire ou après correction côté environnement.

En mode **manuel**, le mécanisme existant permet en plus d'éditer les paramètres avant de
réessayer l'étape.

---

## 7. Internationalisation (i18n)

L'interface est traduite en **4 langues** : français, anglais, italien, espagnol.

- Socle : `public/i18n.js` — dictionnaire centralisé, application via les attributs
  `data-i18n` / `data-i18n-attr`, résolution JS via `I18n.t(clé, vars)`, persistance du choix
  dans `localStorage`, et un sélecteur de langue injecté dans le header de chaque page.
- Couverture : les trois pages (Validateur, Statut des APIs, Documentation), y compris les
  textes générés dynamiquement (console, résultats, scénarios, messages d'erreur).
- Les traductions IT/ES ont été produites automatiquement et méritent une relecture par un
  locuteur natif.

---

## 8. Limites connues

- Le parcours **B2B** de bout en bout n'a pas encore été validé en réel (identifiants b2b non
  disponibles au moment de l'implémentation). Le chemin B2B est néanmoins resté inchangé.
- Les `fieldCode` de `createAccount` sont ceux de l'environnement de dev et peuvent varier
  selon le tenant.
- Chaque exécution peut créer des commandes réelles sur l'environnement cible (jusqu'à 3 pour
  le mode « un de chaque type »).
