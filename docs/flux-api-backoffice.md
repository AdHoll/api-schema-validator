# Flux d'utilisation des routes API backoffice par parcours front

**Source API** : `unified-backoffice-api.yaml` **v1.11.16** (repo `web3-common-main`, module `back-end/apibosweb`).
**Rôle du back-end** : BFF. Il expose l'API `web3-fe.yaml` au front et **consomme** l'API unified-backoffice.

Chaîne d'appel interne pour chaque opération :
`Front → *ApiController → <Action>.exec() → CallXxx → GateXxx → <Api généré> → route backoffice`

> **Vue d'ensemble visuelle** : voir [`flux-api-backoffice.svg`](./flux-api-backoffice.svg) (carte unique de tous les parcours et du chaînage de données).

> **Convention des diagrammes** : chaque flèche vers « BO » est une route backoffice réelle (méthode + chemin).
> Les annotations `⮑ data` indiquent **la donnée d'une réponse réinjectée dans l'appel suivant**.

---

## 0. Préalable commun à TOUS les appels — le token

Avant tout appel métier, le back obtient (et met en cache) un token OAuth2 sur le serveur d'autorisation (spec séparée `authorization-server-api`).

```mermaid
sequenceDiagram
    autonumber
    participant BE as apibosweb (BFF)
    participant AUTH as Authorization Server
    participant BO as Unified Backoffice

    BE->>AUTH: POST /api/v1/security/token<br/>(client_id, client_secret, scope, grant_type=client_credentials)
    AUTH-->>BE: TokenResDTO { accessToken, expiresIn }
    Note over BE: accessToken mis en cache par portail<br/>⮑ injecté en Bearer sur CHAQUE appel BO
    BE->>BO: (tout appel suivant) Authorization: Bearer {accessToken}
    Note over BE,BO: Sur 401 → removeToken + régénération (RELOGIN_ATTEMPTS=2)
```

Chaînage : `token.accessToken` ⮑ en-tête `Authorization` de tous les appels ci-dessous. Implémenté dans `ApiClientFactory.getSecurityToken` + `GateUnified.callBO`.

---

## 1. Authentification (login)

Flow front : `POST /signin` → `AuthenticationApiController.signin` → `Signin.exec` → `CallAuth.signin`.

```mermaid
sequenceDiagram
    autonumber
    participant FE as Front
    participant BE as apibosweb
    participant BO as Unified Backoffice

    FE->>BE: POST /signin (username, password, accountCategory)
    BE->>BO: POST /api/v1/auth/signin (username, password)
    BO-->>BE: SigninResSTO { accountCode }
    Note over BE: ⮑ accountCode
    BE->>BO: GET /api/v1/account/readAccount?accountCode={accountCode}
    BO-->>BE: AccountResSTO { account... }
    BE-->>FE: SignInResponseWrapper (session + profil)
```

**Chaînage** : `signin.accountCode` ⮑ `readAccount(accountCode)`. (`CallAuth.signin`, lignes ~57-66.)

Réinitialisation mot de passe (hors login) :
`searchLoginAccount` ⮑ `accountCode` ⮑ `POST /auth/resetPassword` → `temporaryPassword` (déchiffré).

---

## 2. Consultation du catalogue (familles → offres → produits)

Flow front : `GET /parentFamilies`, `/families`, `/sellitems` → contrôleurs `FamilyApiController` / `SellItemApiController` / `ProductApiController`.

```mermaid
sequenceDiagram
    autonumber
    participant FE as Front
    participant BE as apibosweb
    participant BO as Unified Backoffice

    FE->>BE: GET /parentFamilies / /families
    BE->>BO: GET /api/v1/family/findParentFamilies (code[], accountCode)
    BO-->>BE: familles
    BE->>BO: GET /api/v1/family/readFamily (locale[], code[])
    BO-->>BE: détails familles
    Note over BE: ⮑ familyCodes

    FE->>BE: GET /sellitems (sélection famille)
    BE->>BO: GET /api/v1/offer/findOfferCodesByFamily (familyCodes[], accountCode, organizationAccountCode)
    BO-->>BE: FindOfferCodesByFamilyResSTO { families[].offerCode }
    Note over BE: ⮑ offerCode
    BE->>BO: GET /api/v1/offer/readOffer (locale[], offerCodes[])
    BO-->>BE: détails offres

    BE->>BO: GET /api/v1/product/findProductCodes (offerCode[, performanceCode])
    BO-->>BE: FindProductCodesResSTO { productCodes }
    Note over BE: ⮑ productCodes
    BE->>BO: GET /api/v1/product/readProduct (locale[], productCodes[])
    BO-->>BE: détails produits + prix
    BE-->>FE: catalogue consolidé
```

**Chaînage** :
`findParentFamilies/readFamily.familyCode` ⮑ `findOfferCodesByFamily` → `offerCode` ⮑ `readOffer` **et** `findProductCodes` → `productCodes` ⮑ `readProduct`.

---

## 3. Calendrier de disponibilité (jours → créneaux → quotas)

Flow front : `GET /events/calendar`, `POST /dayPerformance`, `GET /performances/{ak}` → `SellItemApiController` → `CallPerformance`.

```mermaid
sequenceDiagram
    autonumber
    participant FE as Front
    participant BE as apibosweb
    participant BO as Unified Backoffice

    opt dateFrom absent
        BE->>BO: GET /api/v1/offer/findFirstAvailableDate (offerCode, productCode, themeCode)
        BO-->>BE: { date }
        Note over BE: ⮑ date → sert de dateFrom
    end
    FE->>BE: consultation calendrier (offre choisie)
    BE->>BO: GET /api/v1/performance/findCalendarDays (dateFrom, dateTo, offerCode, accountCode, productCodes)
    BO-->>BE: FindCalendarDaysResSTO { days[].date }
    Note over BE: ⮑ date (jour choisi)
    BE->>BO: GET /api/v1/performance/findPerformanceByDay (date, offerCode, productCodes, ...)
    BO-->>BE: { performances[].performanceCode }
    Note over BE: ⮑ performanceCode
    BE->>BO: GET /api/v1/performance/findQuotaByPerformance (offerCode, performanceCode)
    BO-->>BE: { quotas[] }
    BE-->>FE: disponibilités (jours / créneaux / quotas)
```

**Chaînage (le plus profond du projet)** :
`findFirstAvailableDate.date` ⮑ `findCalendarDays.dateFrom` → `days[].date` ⮑ `findPerformanceByDay.date` → `performances[].performanceCode` ⮑ `findQuotaByPerformance(offerCode, performanceCode)`.
(`CallPerformance.searchCalendarAvailability` / `GatePerformance`.)

---

## 4. Tunnel d'achat (panier → commande → paiement → confirmation)

C'est le parcours central. Flow front : `/upSell`, `/crossSell`, `/checkBasket`, `/checkout`, puis `/payments/...`, puis `/confirmedOrder`.

```mermaid
sequenceDiagram
    autonumber
    participant FE as Front
    participant BE as apibosweb
    participant BO as Unified Backoffice
    participant PSP as PSP (paiement)

    Note over FE,BO: (option places numérotées) holdSeat avant panier
    FE->>BE: POST /holdSeat
    BE->>BO: POST /api/v1/seat/bestSeat
    BO-->>BE: places verrouillées

    FE->>BE: POST /upSell / /crossSell
    BE->>BO: POST /api/v1/sell/upSell  (puis /sell/crossSell)
    BO-->>BE: articles proposés

    FE->>BE: POST /checkBasket (shopCart, cartCode)
    BE->>BO: POST /api/v1/cart/checkCart (shopCart, cartCode, organizationAccountCode)
    BO-->>BE: CheckCartResSTO { preOrder } (pricing recalculé)
    Note over BE: cartCode = pivot du panier

    FE->>BE: POST /checkout (shopCart, delivery, cypherCartCode)
    BE->>BO: POST /api/v1/order/beginOrderTrans (shopCart.cartCode, coupons, reservationOwnerCode)
    BO-->>BE: BeginOrderTransResSTO { orderCode, publicOrderCode, preOrder }
    Note over BE: ⮑ orderCode (clé de la transaction)
    BE-->>FE: CheckoutResponse (paymentRef = orderCode)

    FE->>BE: POST /payments/{psp}/orders|sessions (paymentRef)
    BE->>PSP: create session / order
    PSP-->>FE: paiement (redirection ou SDK)
    FE->>BE: POST /payments/{psp}/capture (ou notification S2S)
    Note over BE: paymentTrx.saleAk = orderCode
    BE->>BO: POST /api/v1/order/confirmOrderTrans (orderCode, payments[])
    BO-->>BE: ConfirmOrderTransResSTO (vente confirmée)

    FE->>BE: GET /confirmedOrder
    BE->>BO: GET /api/v1/order/readOrderDetails (orderCode[], askTicketHolderInfo)
    BO-->>BE: détails commande
    BE-->>FE: confirmation
```

**Chaînages clés** :
1. `cartCode` (produit/chiffré au checkout) ⮑ `checkCart.shopCart.cartCode` **et** `beginOrderTrans.shopCart.cartCode`.
2. `beginOrderTrans.orderCode` (= `paymentTrx.saleAk`) ⮑ `confirmOrderTrans.orderCode`. (`CallOrder.checkout` ~246-300 et `closeOrder` ~335-345.)
3. `orderCode` ⮑ `readOrderDetails(orderCode[])` pour la confirmation.

> Annulation avant paiement : `POST /order/cancelOrderTrans(orderCode)` et/ou `DELETE /cart/removeCart?cartCode={cartCode}`.

---

## 5. Variante : upgrade / renouvellement de billets

Flow front : `/tickets/tryUpgrade` → `/tickets/upgrade` (idem renew). Même logique que le tunnel, avec `cypherCartCode` déchiffré.

```mermaid
sequenceDiagram
    autonumber
    participant FE as Front
    participant BE as apibosweb
    participant BO as Unified Backoffice

    FE->>BE: POST /tickets/tryUpgrade (cypherCartCode)
    BE->>BO: POST /api/v1/cart/tryExchange (shopCart)
    BO-->>BE: TryExchangeResSTO { preOrder } (simulation)
    FE->>BE: POST /tickets/upgrade (cypherCartCode)
    Note over BE: ⮑ cartCode = decrypt(cypherCartCode)
    BE->>BO: POST /api/v1/order/exchangeTrans (shopCart.cartCode, reservationOwnerCode)
    BO-->>BE: { orderCode, publicOrderCode, preOrder }
    Note over BE: ⮑ orderCode → paiement → confirmOrderTrans
```

**Chaînage** : `cypherCartCode` ⮑ (déchiffré) `cartCode` ⮑ `exchangeTrans`/`renewalTrans` → `orderCode` ⮑ même suite paiement + `confirmOrderTrans` qu'au flow 4. (Renew utilise `POST /order/renewalTrans`.)

---

## 6. Espace client (compte, commandes, allocations)

Flow front : `UserApiController` (`/account`, `/account/orders`, `/account/createAllocation`...).

```mermaid
sequenceDiagram
    autonumber
    participant FE as Front
    participant BE as apibosweb
    participant BO as Unified Backoffice

    FE->>BE: GET /account
    BE->>BO: GET /api/v1/account/readAccount (accountCode)
    BO-->>BE: profil
    FE->>BE: POST /account/orders
    BE->>BO: POST /api/v1/order/searchOrder (accountCode, dates, statut, pagination)
    BO-->>BE: commandes

    Note over FE,BO: Allocation (transfert de billets)
    FE->>BE: POST /account/tickets/not-allocated
    BE->>BO: POST /api/v1/account/searchNotAllocatedTickets
    BO-->>BE: tickets non alloués
    Note over BE: ⮑ ticketCodes
    FE->>BE: POST /account/createAllocation
    BE->>BO: POST /api/v1/account/createAllocation (ticketCodes, destinataire)
    BO-->>BE: allocation créée
    FE->>BE: POST /account/tickets/allocated
    BE->>BO: POST /api/v1/account/searchAllocations
    BO-->>BE: allocations
```

**Chaînage** : `searchNotAllocatedTickets.ticketCodes` ⮑ `createAllocation`.
`readAccount.accountCode` ⮑ `searchOrder(accountCode)`.

---

## 7. Documents / billets (après commande confirmée)

Flow front : `FileApiController` (`/downloads/ticket/pdf`, `/downloads/order/document`...).

```mermaid
sequenceDiagram
    autonumber
    participant FE as Front
    participant BE as apibosweb
    participant BO as Unified Backoffice

    Note over BE: pré-requis : commande confirmée (orderCode / saleAk)
    FE->>BE: GET /downloads/order/document (cypherSaleAk)
    Note over BE: ⮑ saleAk = decrypt(cypherSaleAk)
    BE->>BO: GET /api/v1/document/generateDocument (saleAk)
    BO-->>BE: document base64
    BE-->>FE: PDF / wallet / zip
    FE->>BE: GET /downloads/ticket/pdf
    BE->>BO: GET /api/v1/ticket/generatePDF (mediaCode)
    BO-->>BE: PDF billet
```

**Chaînage** : `confirmOrderTrans/searchOrder` fournit `saleAk`/`mediaCode` ⮑ `generateDocument(saleAk)` / `generatePDF(mediaCode)`.

---

## Synthèse — séquence nominale d'achat de bout en bout

```mermaid
flowchart TD
    T["POST /security/token<br/>⮑ accessToken (Bearer global)"]:::infra
    S["POST /auth/signin<br/>⮑ accountCode"]:::auth
    RA["GET /account/readAccount<br/>(accountCode)"]:::auth
    F["GET /family/findParentFamilies + readFamily<br/>⮑ familyCode"]:::cat
    O["GET /offer/findOfferCodesByFamily<br/>⮑ offerCode"]:::cat
    P["GET /product/findProductCodes + readProduct<br/>⮑ productCodes"]:::cat
    CD["GET /performance/findCalendarDays<br/>⮑ date"]:::cal
    CT["GET /performance/findPerformanceByDay<br/>⮑ performanceCode"]:::cal
    CQ["GET /performance/findQuotaByPerformance<br/>(offerCode, performanceCode)"]:::cal
    US["POST /sell/upSell + /sell/crossSell"]:::cart
    CB["POST /cart/checkCart<br/>(cartCode)"]:::cart
    BO["POST /order/beginOrderTrans<br/>(cartCode) ⮑ orderCode"]:::order
    PAY["Paiement PSP (hors backoffice)<br/>paymentRef = orderCode"]:::pay
    CF["POST /order/confirmOrderTrans<br/>(orderCode, payments)"]:::order
    RO["GET /order/readOrderDetails<br/>(orderCode)"]:::order
    DOC["GET /document/generateDocument + /ticket/generatePDF<br/>(saleAk / mediaCode)"]:::doc

    T --> S --> RA --> F --> O --> P
    O --> CD --> CT --> CQ --> US
    P --> US
    US --> CB --> BO --> PAY --> CF --> RO --> DOC

    classDef infra fill:#eceff1,stroke:#607d8b;
    classDef auth fill:#e3f2fd,stroke:#1976d2;
    classDef cat fill:#f3e5f5,stroke:#8e24aa;
    classDef cal fill:#fff3e0,stroke:#fb8c00;
    classDef cart fill:#e8f5e9,stroke:#43a047;
    classDef order fill:#fce4ec,stroke:#d81b60;
    classDef pay fill:#fffde7,stroke:#fbc02d;
    classDef doc fill:#e0f2f1,stroke:#00897b;
```

---

## Tableau récapitulatif des chaînages de données inter-routes

| # | Donnée pivot | Produite par (route) | Consommée par (route) |
|---|--------------|----------------------|------------------------|
| 1 | `accessToken` | `POST /security/token` | en-tête `Bearer` de **tous** les appels BO |
| 2 | `accountCode` | `POST /auth/signin` | `GET /account/readAccount`, `POST /order/searchOrder` |
| 3 | `familyCode` | `GET /family/findParentFamilies` | `GET /offer/findOfferCodesByFamily` |
| 4 | `offerCode` | `GET /offer/findOfferCodesByFamily` | `readOffer`, `findProductCodes`, `findCalendarDays`, `findQuotaByPerformance` |
| 5 | `productCodes` | `GET /product/findProductCodes` | `GET /product/readProduct` |
| 6 | `date` | `findFirstAvailableDate` / `findCalendarDays` | `findCalendarDays.dateFrom` / `findPerformanceByDay.date` |
| 7 | `performanceCode` | `GET /performance/findPerformanceByDay` | `GET /performance/findQuotaByPerformance` |
| 8 | `cartCode` | checkout front (chiffré) | `cart/checkCart`, `order/beginOrderTrans`, `cart/removeCart`, exchange/renewal |
| 9 | `orderCode` | `POST /order/beginOrderTrans` (= `paymentTrx.saleAk`) | `POST /order/confirmOrderTrans`, `GET /order/readOrderDetails` |
| 10 | `saleAk` / `mediaCode` | `confirmOrderTrans` / `searchOrder` | `document/generateDocument`, `ticket/generatePDF` |
| 11 | `cypherCartCode` → `cartCode` | front (déchiffré par le BFF) | `order/exchangeTrans`, `order/renewalTrans` |
| 12 | `ticketCodes` | `POST /account/searchNotAllocatedTickets` | `POST /account/createAllocation` |

---

### Fichiers de référence (repo tiers)
- `back-end/apibosweb/openapi/unified-backoffice-api.yaml` (v1.11.16) — définition des routes BO.
- `.../be/unified/call/CallAuth.java`, `CallOrder.java`, `CallPerformance.java`, `CallCart.java`, `CallOffer.java` — orchestration + chaînage.
- `.../be/unified/request/FactoryOrder.java` — construction des requêtes (noms de champs du chaînage).
- `.../be/unified/gate/GateUnified.java`, `base/ApiClientFactory.java` — token + exécution + retry 401.
- `src/main/java/com/omniticket/api/controller/api/*ApiController.java` — mapping flows front → actions.
