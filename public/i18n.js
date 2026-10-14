/*
 * i18n.js — Infrastructure d'internationalisation (FR / EN / IT / ES)
 * ------------------------------------------------------------------
 * Phase 1 : traduction des textes STATIQUES du HTML via l'attribut data-i18n.
 *
 * Utilisation dans le HTML :
 *   <span data-i18n="nav.validator">Validateur</span>
 *   <input data-i18n-attr="placeholder:field.masterPassword.ph">
 *   <element data-i18n-html="key">  (si le texte contient du HTML à conserver)
 *
 * API JS (pour la Phase 2 / chaînes générées) :
 *   I18n.t('cle', { var: 'valeur' })   → retourne la chaîne traduite
 *   I18n.setLang('en')                 → change la langue et réapplique
 *   I18n.getLang()                     → langue courante
 *   I18n.apply(racine?)                → (ré)applique les traductions sur le DOM
 *
 * Le choix de langue est persisté dans localStorage (clé "app_lang").
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'app_lang';
  const DEFAULT_LANG = 'fr';
  const SUPPORTED = ['fr', 'en', 'it', 'es'];

  const LANG_LABELS = {
    fr: { flag: '🇫🇷', name: 'Français' },
    en: { flag: '🇬🇧', name: 'English' },
    it: { flag: '🇮🇹', name: 'Italiano' },
    es: { flag: '🇪🇸', name: 'Español' },
  };

  // ------------------------------------------------------------------
  // DICTIONNAIRES
  // Clé → { fr, en, it, es }. Les traductions IT/ES sont à faire relire
  // par un locuteur natif (produites par l'assistant).
  // ------------------------------------------------------------------
  const DICT = {
    // ── Navigation / onglets ───────────────────────────────────────
    'nav.validator':      { fr: 'Validateur',        en: 'Validator',        it: 'Validatore',       es: 'Validador' },
    'nav.status':         { fr: 'Statut des APIs',   en: 'API Status',       it: 'Stato delle API',  es: 'Estado de las API' },
    'nav.docs':           { fr: 'Documentation',     en: 'Documentation',    it: 'Documentazione',   es: 'Documentación' },

    // ── Header commun ──────────────────────────────────────────────
    'header.tagline':     { fr: 'Vérification automatique de conformité OpenAPI/YAML sécurisée par OAuth2 (b2b / b2c)', en: 'Automatic OpenAPI/YAML compliance checking secured by OAuth2 (b2b / b2c)', it: 'Verifica automatica di conformità OpenAPI/YAML protetta da OAuth2 (b2b / b2c)', es: 'Verificación automática de conformidad OpenAPI/YAML protegida por OAuth2 (b2b / b2c)' },
    'header.langLabel':   { fr: 'Langue',            en: 'Language',         it: 'Lingua',           es: 'Idioma' },

    // ── index.html : barre d'actions ───────────────────────────────
    'mode.manual':        { fr: 'Manuel',            en: 'Manual',           it: 'Manuale',          es: 'Manual' },
    'mode.scenario':      { fr: 'Scénarios',         en: 'Scenarios',        it: 'Scenari',          es: 'Escenarios' },
    'logs.in':            { fr: 'Logs dans',         en: 'Logs in',          it: 'Log in',           es: 'Registros en' },
    'btn.runValidation':  { fr: 'Lancer la validation', en: 'Run validation', it: 'Avvia la validazione', es: 'Ejecutar validación' },

    // ── Section 1 : Spécification YAML ──────────────────────────────
    'sec1.title':         { fr: '1. Spécification YAML', en: '1. YAML specification', it: '1. Specifica YAML', es: '1. Especificación YAML' },
    'sec1.versionLabel':  { fr: 'Version de la spec (bibliothèque)', en: 'Spec version (library)', it: 'Versione della spec (libreria)', es: 'Versión de la spec (biblioteca)' },
    'sec1.versionLoading':{ fr: '-- Chargement des versions… --', en: '-- Loading versions… --', it: '-- Caricamento versioni… --', es: '-- Cargando versiones… --' },
    'sec1.or':            { fr: 'ou',                en: 'or',               it: 'o',                es: 'o' },
    'sec1.fileLabel':     { fr: 'Fichier OpenAPI (.yaml / .yml)', en: 'OpenAPI file (.yaml / .yml)', it: 'File OpenAPI (.yaml / .yml)', es: 'Archivo OpenAPI (.yaml / .yml)' },
    'sec1.historyLabel':  { fr: 'Sessions récentes sauvegardées :', en: 'Recently saved sessions:', it: 'Sessioni salvate di recente:', es: 'Sesiones guardadas recientes:' },
    'sec1.clear':         { fr: 'Effacer',           en: 'Clear',            it: 'Cancella',         es: 'Borrar' },

    // ── Section 2 : Authentification OAuth2 ─────────────────────────
    'sec2.title':         { fr: '2. Authentification OAuth2', en: '2. OAuth2 authentication', it: '2. Autenticazione OAuth2', es: '2. Autenticación OAuth2' },
    'sec2.historyPh':     { fr: "-- Choisir une cible dans l'historique --", en: '-- Choose a target from history --', it: '-- Scegli un target dalla cronologia --', es: '-- Elegir un destino del historial --' },
    'sec2.targetUrl':     { fr: "URL de l'API Cible", en: 'Target API URL',  it: "URL dell'API di destinazione", es: 'URL de la API de destino' },
    'sec2.clientId':      { fr: 'Client ID',         en: 'Client ID',        it: 'Client ID',        es: 'Client ID' },
    'sec2.clientSecret':  { fr: 'Client Secret',     en: 'Client Secret',    it: 'Client Secret',    es: 'Client Secret' },
    'sec2.scope':         { fr: 'Scope',             en: 'Scope',            it: 'Scope',            es: 'Scope' },
    'sec2.tokenNote':     { fr: 'Les identifiants seront transmis via Query Parameters sur', en: 'Credentials will be sent via query parameters to', it: 'Le credenziali saranno inviate tramite query parameter su', es: 'Las credenciales se enviarán mediante parámetros de consulta a' },

    // ── Mode Scénarios ─────────────────────────────────────────────
    'scn.title':          { fr: 'Scénarios de test', en: 'Test scenarios',   it: 'Scenari di test',  es: 'Escenarios de prueba' },
    'scn.subtitle':       { fr: "Enchaînement automatique d'appels avec dépendances de données.", en: 'Automatic chaining of calls with data dependencies.', it: 'Concatenamento automatico di chiamate con dipendenze di dati.', es: 'Encadenamiento automático de llamadas con dependencias de datos.' },
    'scn.choose':         { fr: 'Choisir un scénario', en: 'Choose a scenario', it: 'Scegli uno scenario', es: 'Elegir un escenario' },
    'scn.choosePh':       { fr: '-- Sélectionner un scénario --', en: '-- Select a scenario --', it: '-- Seleziona uno scenario --', es: '-- Seleccionar un escenario --' },
    'scn.execMode':       { fr: "Mode d'exécution",  en: 'Execution mode',   it: 'Modalità di esecuzione', es: 'Modo de ejecución' },
    'scn.auto':           { fr: 'Auto',              en: 'Auto',             it: 'Auto',             es: 'Auto' },
    'scn.manual':         { fr: 'Manuel',            en: 'Manual',           it: 'Manuale',          es: 'Manual' },
    'scn.run':            { fr: 'Exécuter le scénario', en: 'Run scenario',  it: 'Esegui lo scenario', es: 'Ejecutar el escenario' },
    'scn.replay':         { fr: 'Rejouer le dernier test', en: 'Replay last test', it: "Riesegui l'ultimo test", es: 'Repetir la última prueba' },
    'scn.retryFailed':    { fr: "Rejouer l'étape échouée", en: 'Retry the failed step', it: 'Riprova il passo fallito', es: 'Reintentar el paso fallido' },
    'scn.stepConfig':     { fr: "Paramètres de l'appel suivant", en: 'Next call parameters', it: 'Parametri della chiamata successiva', es: 'Parámetros de la siguiente llamada' },
    'scn.prevStep':       { fr: 'Étape précédente',  en: 'Previous step',    it: 'Passo precedente', es: 'Paso anterior' },
    'scn.nextStep':       { fr: 'Étape suivante',    en: 'Next step',        it: 'Passo successivo', es: 'Paso siguiente' },

    // ── Section 3 : Sélection des routes ────────────────────────────
    'sec3.title':         { fr: '3. Sélection des routes à tester', en: '3. Select routes to test', it: '3. Selezione delle route da testare', es: '3. Selección de rutas a probar' },
    'sec3.selectAll':     { fr: 'Tout cocher',       en: 'Select all',       it: 'Seleziona tutto',  es: 'Marcar todo' },
    'sec3.deselectAll':   { fr: 'Tout décocher',     en: 'Deselect all',     it: 'Deseleziona tutto', es: 'Desmarcar todo' },
    'sec3.empty':         { fr: 'Sélectionnez un fichier YAML ou chargez une session récente depuis l\'historique ci-dessus.', en: 'Select a YAML file or load a recent session from the history above.', it: 'Seleziona un file YAML o carica una sessione recente dalla cronologia sopra.', es: 'Seleccione un archivo YAML o cargue una sesión reciente del historial anterior.' },

    // ── Section 4 : Paramètres ──────────────────────────────────────
    'sec4.title':         { fr: '4. Paramètres des routes', en: '4. Route parameters', it: '4. Parametri delle route', es: '4. Parámetros de las rutas' },
    'sec4.subtitle':      { fr: 'Mutualisés entre toutes les routes qui les utilisent.', en: 'Shared across all routes that use them.', it: 'Condivisi tra tutte le route che li utilizzano.', es: 'Compartidos entre todas las rutas que los utilizan.' },
    'sec4.prefill':       { fr: 'Pré-remplissage automatique', en: 'Auto fill', it: 'Precompilazione automatica', es: 'Relleno automático' },
    'sec4.localeGlobal':  { fr: 'Locale (global)',   en: 'Locale (global)',  it: 'Locale (globale)', es: 'Locale (global)' },
    'sec4.localeNote':    { fr: 'Injecté automatiquement dans toutes les routes utilisant le paramètre', en: 'Automatically injected into every route using the parameter', it: 'Iniettato automaticamente in tutte le route che usano il parametro', es: 'Inyectado automáticamente en todas las rutas que usan el parámetro' },
    'sec4.searchPh':      { fr: 'Rechercher un paramètre…', en: 'Search a parameter…', it: 'Cerca un parametro…', es: 'Buscar un parámetro…' },

    // ── Section 5 : Corps des requêtes ──────────────────────────────
    'sec5.title':         { fr: '5. Corps des requêtes (JSON)', en: '5. Request bodies (JSON)', it: '5. Corpi delle richieste (JSON)', es: '5. Cuerpos de las solicitudes (JSON)' },
    'sec5.subtitlePre':   { fr: 'Utilisez', en: 'Use', it: 'Usa', es: 'Use' },
    'sec5.subtitlePost':  { fr: 'pour injecter une valeur des paramètres au moment de l\'appel.', en: 'to inject a parameter value at call time.', it: 'per iniettare un valore dei parametri al momento della chiamata.', es: 'para inyectar un valor de los parámetros en el momento de la llamada.' },

    // ── Section Résultats ───────────────────────────────────────────
    'res.title':          { fr: 'Résultats de la validation', en: 'Validation results', it: 'Risultati della validazione', es: 'Resultados de la validación' },
    'res.filter':         { fr: 'Filtrer :',         en: 'Filter:',          it: 'Filtra:',          es: 'Filtrar:' },
    'res.all':            { fr: 'Tous',              en: 'All',              it: 'Tutti',            es: 'Todos' },
    'res.conform':        { fr: 'Conformes',         en: 'Compliant',        it: 'Conformi',         es: 'Conformes' },
    'res.declaredErr':    { fr: 'Erreurs Prévues YAML', en: 'Expected YAML errors', it: 'Errori previsti YAML', es: 'Errores previstos YAML' },
    'res.undeclaredErr':  { fr: 'Code HTTP Non Déclaré', en: 'Undeclared HTTP code', it: 'Codice HTTP non dichiarato', es: 'Código HTTP no declarado' },
    'res.schemaErr':      { fr: 'Non Conformes Schéma', en: 'Schema non-compliant', it: 'Non conformi allo schema', es: 'No conformes al esquema' },
    'res.unhandledErr':   { fr: 'Code HTTP Non Géré', en: 'Unhandled HTTP code', it: 'Codice HTTP non gestito', es: 'Código HTTP no gestionado' },
    'res.colMethod':      { fr: 'Méthode',           en: 'Method',           it: 'Metodo',           es: 'Método' },
    'res.colRoute':       { fr: 'Route / Endpoint',  en: 'Route / Endpoint', it: 'Route / Endpoint', es: 'Ruta / Endpoint' },
    'res.colHttp':        { fr: 'Code HTTP',          en: 'HTTP code',        it: 'Codice HTTP',      es: 'Código HTTP' },
    'res.colConform':     { fr: 'Conformité',         en: 'Compliance',       it: 'Conformità',       es: 'Conformidad' },
    'res.colErrors':      { fr: 'Synthèse Erreurs',   en: 'Error summary',    it: 'Sintesi errori',   es: 'Resumen de errores' },
    'res.colAction':      { fr: 'Action',             en: 'Action',           it: 'Azione',           es: 'Acción' },

    // ── Console API ─────────────────────────────────────────────────
    'console.title':      { fr: 'Console API',        en: 'API Console',      it: 'Console API',      es: 'Consola API' },
    'console.clear':      { fr: 'Vider',              en: 'Clear',            it: 'Svuota',           es: 'Vaciar' },
    'console.all':        { fr: 'Tous',               en: 'All',              it: 'Tutti',            es: 'Todos' },
    'console.prefill':    { fr: 'Pré-remplissage',    en: 'Prefill',          it: 'Precompilazione',  es: 'Relleno' },
    'console.batch':      { fr: 'Validation',         en: 'Validation',       it: 'Validazione',      es: 'Validación' },
    'console.errApi':     { fr: 'Erreurs API',        en: 'API errors',       it: 'Errori API',       es: 'Errores API' },
    'console.errJs':      { fr: 'Erreurs JS',         en: 'JS errors',        it: 'Errori JS',        es: 'Errores JS' },

    // ── Modal détails (index) ───────────────────────────────────────
    'modal.errorsTitle':  { fr: 'Écarts détectés par rapport au schéma :', en: 'Discrepancies found against the schema:', it: 'Scostamenti rilevati rispetto allo schema:', es: 'Discrepancias detectadas respecto al esquema:' },
    'modal.copyJson':     { fr: 'Copier JSON',        en: 'Copy JSON',        it: 'Copia JSON',       es: 'Copiar JSON' },
    'modal.expectedSchema': { fr: 'Schéma attendu selon YAML', en: 'Expected schema per YAML', it: 'Schema atteso secondo YAML', es: 'Esquema esperado según YAML' },
    'modal.close':        { fr: 'Fermer',             en: 'Close',            it: 'Chiudi',           es: 'Cerrar' },

    // ── status.html : Coffre Bitwarden ──────────────────────────────
    'bw.title':           { fr: 'Coffre Bitwarden',   en: 'Bitwarden vault',  it: 'Cassaforte Bitwarden', es: 'Bóveda Bitwarden' },
    'bw.configConnect':   { fr: 'Config & connexion (EU)', en: 'Config & login (EU)', it: 'Config e accesso (EU)', es: 'Config y conexión (EU)' },
    'bw.locked':          { fr: 'Verrouillé',         en: 'Locked',           it: 'Bloccato',         es: 'Bloqueado' },
    'bw.unlocked':        { fr: 'Déverrouillé',       en: 'Unlocked',         it: 'Sbloccato',        es: 'Desbloqueado' },
    'bw.masterPassword':  { fr: 'Mot de passe maître', en: 'Master password', it: 'Password principale', es: 'Contraseña maestra' },
    'bw.masterPasswordPh':{ fr: 'Saisi uniquement en mémoire, jamais stocké', en: 'Kept in memory only, never stored', it: 'Mantenuta solo in memoria, mai salvata', es: 'Solo en memoria, nunca almacenada' },
    'bw.unlock':          { fr: 'Déverrouiller',      en: 'Unlock',           it: 'Sblocca',          es: 'Desbloquear' },
    'bw.lock':            { fr: 'Verrouiller',        en: 'Lock',             it: 'Blocca',           es: 'Bloquear' },
    'bw.securityNote':    { fr: "Le mot de passe maître n'est jamais stocké ni journalisé. La session expire automatiquement après 15 min d'inactivité.", en: 'The master password is never stored or logged. The session expires automatically after 15 min of inactivity.', it: 'La password principale non viene mai salvata né registrata. La sessione scade automaticamente dopo 15 min di inattività.', es: 'La contraseña maestra nunca se almacena ni se registra. La sesión expira automáticamente tras 15 min de inactividad.' },

    // ── status.html : APIs à tester ─────────────────────────────────
    'api.title':          { fr: 'APIs à tester',      en: 'APIs to test',     it: 'API da testare',   es: 'API a probar' },
    'api.add':            { fr: 'Ajouter une API',    en: 'Add an API',       it: 'Aggiungi un\'API', es: 'Añadir una API' },
    'api.testAll':        { fr: 'Tout tester',        en: 'Test all',         it: 'Testa tutto',      es: 'Probar todo' },
    'api.empty':          { fr: 'Aucune API configurée. Cliquez sur « Ajouter une API ».', en: 'No API configured. Click "Add an API".', it: 'Nessuna API configurata. Clicca su «Aggiungi un\'API».', es: 'Ninguna API configurada. Haga clic en «Añadir una API».' },
    'api.emptyBase':      { fr: 'Aucune API',         en: 'No API',           it: 'Nessuna API',      es: 'Ninguna API' },
    'api.emptyConfigured':{ fr: 'configurée',         en: 'configured',       it: 'configurata',      es: 'configurada' },
    'api.emptyForTag':    { fr: 'pour le tag',        en: 'for tag',          it: 'per il tag',       es: 'para la etiqueta' },
    'api.notTested':      { fr: 'Non testé',          en: 'Not tested',       it: 'Non testato',      es: 'No probado' },
    'api.testing':        { fr: 'Test en cours…',     en: 'Testing…',         it: 'Test in corso…',   es: 'Probando…' },
    'api.noResponse':     { fr: 'Pas de réponse',     en: 'No response',      it: 'Nessuna risposta', es: 'Sin respuesta' },
    'api.filter':         { fr: 'Filtrer :',          en: 'Filter:',          it: 'Filtra:',          es: 'Filtrar:' },
    'api.all':            { fr: 'Tous',               en: 'All',              it: 'Tutti',            es: 'Todos' },

    // ── status.html : Modal ajout/édition API ───────────────────────
    'apiModal.addTitle':  { fr: 'Ajouter une API',    en: 'Add an API',       it: 'Aggiungi un\'API', es: 'Añadir una API' },
    'apiModal.label':     { fr: 'Libellé',            en: 'Label',            it: 'Etichetta',        es: 'Etiqueta' },
    'apiModal.owner':     { fr: 'Propriétaire (organisation Bitwarden)', en: 'Owner (Bitwarden organization)', it: 'Proprietario (organizzazione Bitwarden)', es: 'Propietario (organización Bitwarden)' },
    'apiModal.ownerPh':   { fr: 'Laisser vide pour le coffre personnel', en: 'Leave empty for personal vault', it: 'Lascia vuoto per la cassaforte personale', es: 'Dejar vacío para la bóveda personal' },
    'apiModal.collection':{ fr: 'Collection Bitwarden', en: 'Bitwarden collection', it: 'Collezione Bitwarden', es: 'Colección Bitwarden' },
    'apiModal.optional':  { fr: 'Optionnel',          en: 'Optional',         it: 'Opzionale',        es: 'Opcional' },
    'apiModal.itemName':  { fr: "Nom de l'entrée Bitwarden", en: 'Bitwarden item name', it: 'Nome della voce Bitwarden', es: 'Nombre de la entrada Bitwarden' },
    'apiModal.scope':     { fr: 'Scope',              en: 'Scope',            it: 'Scope',            es: 'Scope' },
    'apiModal.tag':       { fr: 'Environnement (tag)', en: 'Environment (tag)', it: 'Ambiente (tag)',  es: 'Entorno (tag)' },
    'apiModal.cancel':    { fr: 'Annuler',            en: 'Cancel',           it: 'Annulla',          es: 'Cancelar' },
    'apiModal.save':      { fr: 'Enregistrer',        en: 'Save',             it: 'Salva',            es: 'Guardar' },

    // ── docs.html : Documentation ───────────────────────────────────
    'docs.title':         { fr: 'Documentation des flux API', en: 'API flow documentation', it: 'Documentazione dei flussi API', es: 'Documentación de los flujos API' },
    'docs.intro':         { fr: "Carte des parcours front et des routes backoffice appelées, avec le chaînage des données d'une route à l'autre.", en: 'Map of front-end journeys and the backoffice routes they call, with data chaining from one route to the next.', it: 'Mappa dei percorsi front-end e delle route backoffice chiamate, con il concatenamento dei dati da una route all\'altra.', es: 'Mapa de los recorridos del front y de las rutas backoffice llamadas, con el encadenamiento de datos de una ruta a otra.' },
    'docs.source':        { fr: 'Source : unified-backoffice-api v1.11.16 — le back-end consomme cette API et expose les données au front.', en: 'Source: unified-backoffice-api v1.11.16 — the back-end consumes this API and exposes the data to the front end.', it: 'Fonte: unified-backoffice-api v1.11.16 — il back-end consuma questa API ed espone i dati al front-end.', es: 'Fuente: unified-backoffice-api v1.11.16 — el back-end consume esta API y expone los datos al front.' },
    'docs.openFull':      { fr: 'Ouvrir en plein écran', en: 'Open fullscreen', it: 'Apri a schermo intero', es: 'Abrir en pantalla completa' },
    'docs.legend':        { fr: 'Chaque bloc est une route backoffice. Flèche grise = séquence d\'appel. Flèche orange = donnée réinjectée dans l\'appel suivant.', en: 'Each block is a backoffice route. Grey arrow = call sequence. Orange arrow = data reinjected into the next call.', it: 'Ogni blocco è una route backoffice. Freccia grigia = sequenza di chiamata. Freccia arancione = dato reinserito nella chiamata successiva.', es: 'Cada bloque es una ruta backoffice. Flecha gris = secuencia de llamada. Flecha naranja = dato reinyectado en la siguiente llamada.' },

    // ── Interactions communes ───────────────────────────────────────
    'common.error':       { fr: 'Erreur',             en: 'Error',            it: 'Errore',           es: 'Error' },

    // ── status.js : interactions ────────────────────────────────────
    'bw.unlocking':       { fr: 'Déverrouillage...',  en: 'Unlocking...',     it: 'Sblocco in corso...', es: 'Desbloqueando...' },
    'bw.unlockFailed':    { fr: 'Déverrouillage échoué', en: 'Unlock failed', it: 'Sblocco non riuscito', es: 'Desbloqueo fallido' },
    'bw.terminalFailed':  { fr: 'Échec',              en: 'Failed',           it: 'Non riuscito',     es: 'Fallido' },
    'bw.terminalOpened':  { fr: "Un terminal PowerShell s'est ouvert.\n\nSuivez les invites pour vous connecter (serveur EU + login + 2FA éventuel).\nUne fois connecté, revenez ici et déverrouillez avec votre mot de passe maître.", en: 'A PowerShell terminal has opened.\n\nFollow the prompts to log in (EU server + login + optional 2FA).\nOnce connected, come back here and unlock with your master password.', it: 'Si è aperto un terminale PowerShell.\n\nSegui le istruzioni per accedere (server EU + login + eventuale 2FA).\nUna volta connesso, torna qui e sblocca con la tua password principale.', es: 'Se ha abierto un terminal PowerShell.\n\nSiga las indicaciones para iniciar sesión (servidor EU + login + 2FA opcional).\nUna vez conectado, vuelva aquí y desbloquee con su contraseña maestra.' },
    'api.vaultLockedFirst': { fr: "Déverrouillez d'abord le coffre Bitwarden.", en: 'Unlock the Bitwarden vault first.', it: 'Sblocca prima la cassaforte Bitwarden.', es: 'Desbloquee primero la bóveda Bitwarden.' },
    'api.testError':      { fr: 'Erreur de test',     en: 'Test error',       it: 'Errore di test',   es: 'Error de prueba' },
    'api.editTitle':      { fr: "Modifier l'API",     en: 'Edit API',         it: "Modifica l'API",   es: 'Editar la API' },
    'api.confirmDelete':  { fr: 'Supprimer « {label} » ?', en: 'Delete "{label}"?', it: 'Eliminare «{label}»?', es: '¿Eliminar «{label}»?' },
    'api.requiredFields': { fr: "Le libellé et le nom de l'entrée Bitwarden sont requis.", en: 'Label and Bitwarden item name are required.', it: "L'etichetta e il nome della voce Bitwarden sono obbligatori.", es: 'La etiqueta y el nombre de la entrada Bitwarden son obligatorios.' },
    'api.noResponseComment': { fr: '// Aucune réponse', en: '// No response', it: '// Nessuna risposta', es: '// Sin respuesta' },

    // ── index.html : interactions ───────────────────────────────────
    'idx.analyzeError':   { fr: "Erreur d'analyse :", en: 'Analysis error:',  it: 'Errore di analisi:', es: 'Error de análisis:' },
    'idx.loadVersionFail':{ fr: 'Impossible de charger la version sélectionnée.', en: 'Unable to load the selected version.', it: 'Impossibile caricare la versione selezionata.', es: 'No se puede cargar la versión seleccionada.' },
    'idx.serverInvalid':  { fr: 'Le serveur a renvoyé un statut invalide ({status}).', en: 'The server returned an invalid status ({status}).', it: 'Il server ha restituito uno stato non valido ({status}).', es: 'El servidor devolvió un estado no válido ({status}).' },
    'idx.processError':   { fr: 'Erreur lors du traitement.', en: 'Processing error.', it: 'Errore durante l\'elaborazione.', es: 'Error durante el procesamiento.' },
    'idx.loadYamlFirst':  { fr: 'Veuillez d\'abord charger un fichier YAML.', en: 'Please load a YAML file first.', it: 'Carica prima un file YAML.', es: 'Cargue primero un archivo YAML.' },
    'idx.prefillCreds':   { fr: 'Veuillez renseigner l\'URL cible et les identifiants OAuth2 avant le pré-remplissage.', en: 'Please provide the target URL and OAuth2 credentials before auto-filling.', it: 'Inserisci l\'URL di destinazione e le credenziali OAuth2 prima della precompilazione.', es: 'Indique la URL de destino y las credenciales OAuth2 antes del relleno automático.' },
    'idx.prefillRunning': { fr: 'En cours...',        en: 'Running...',       it: 'In corso...',      es: 'En curso...' },
    'idx.prefillInit':    { fr: 'Initialisation...',  en: 'Initializing...',  it: 'Inizializzazione...', es: 'Inicializando...' },
    'idx.prefillSkipped': { fr: 'Ignoré :',           en: 'Skipped:',         it: 'Ignorato:',        es: 'Omitido:' },
    'idx.prefillMissing': { fr: 'manque',             en: 'missing',          it: 'manca',            es: 'falta' },
    'idx.prefillFail':    { fr: 'Échec :',            en: 'Failed:',          it: 'Non riuscito:',    es: 'Fallido:' },
    'idx.prefillFieldsFilled': { fr: '{n} champ(s) rempli(s)', en: '{n} field(s) filled', it: '{n} campo/i compilato/i', es: '{n} campo(s) rellenado(s)' },
    'idx.prefillNoValue': { fr: 'aucune valeur extraite', en: 'no value extracted', it: 'nessun valore estratto', es: 'ningún valor extraído' },
    'idx.prefillDoneOk':  { fr: 'Terminé — {filled} champ(s) pré-rempli(s), {skipped} étape(s) ignorée(s)', en: 'Done — {filled} field(s) pre-filled, {skipped} step(s) skipped', it: 'Completato — {filled} campo/i precompilato/i, {skipped} passo/i ignorato/i', es: 'Terminado — {filled} campo(s) rellenado(s), {skipped} paso(s) omitido(s)' },
    'idx.prefillDoneNone':{ fr: 'Terminé — aucune valeur obtenue', en: 'Done — no value obtained', it: 'Completato — nessun valore ottenuto', es: 'Terminado — ningún valor obtenido' },
    'idx.prefillBtn':     { fr: 'Pré-remplissage automatique', en: 'Auto fill', it: 'Precompilazione automatica', es: 'Relleno automático' },
    'idx.routesTested':   { fr: '{n} route(s) testée(s)', en: '{n} route(s) tested', it: '{n} route testate', es: '{n} ruta(s) probada(s)' },
    'idx.badgeAuto':      { fr: 'auto',               en: 'auto',             it: 'auto',             es: 'auto' },
    'idx.badgeSaved':     { fr: 'saved',              en: 'saved',            it: 'salvato',          es: 'guardado' },
    'idx.versionNone':    { fr: 'Aucune version dans la bibliothèque', en: 'No version in the library', it: 'Nessuna versione nella libreria', es: 'Ninguna versión en la biblioteca' },
    'idx.versionChoose':  { fr: '-- Choisir une version --', en: '-- Choose a version --', it: '-- Scegli una versione --', es: '-- Elegir una versión --' },
    'idx.versionLoadErr': { fr: 'Erreur de chargement des versions', en: 'Error loading versions', it: 'Errore nel caricamento delle versioni', es: 'Error al cargar las versiones' },
    'idx.submitMissing':  { fr: 'Il manque : {items}', en: 'Missing: {items}', it: 'Manca: {items}', es: 'Falta: {items}' },
    'idx.submitReady':    { fr: 'Lancer la validation des routes sélectionnées', en: 'Run validation of the selected routes', it: 'Avvia la validazione delle route selezionate', es: 'Ejecutar la validación de las rutas seleccionadas' },
    'idx.missingYaml':    { fr: 'un fichier YAML',    en: 'a YAML file',      it: 'un file YAML',     es: 'un archivo YAML' },
    'idx.missingTarget':  { fr: "l'URL de l'API cible", en: 'the target API URL', it: "l'URL dell'API di destinazione", es: 'la URL de la API de destino' },
    'idx.missingSep':     { fr: ' et ',               en: ' and ',            it: ' e ',              es: ' y ' },

    // ── index.html : routes & batch ─────────────────────────────────
    'idx.noValidRoutes':  { fr: 'Aucune route valide trouvée dans ce YAML.', en: 'No valid route found in this YAML.', it: 'Nessuna route valida trovata in questo YAML.', es: 'Ninguna ruta válida encontrada en este YAML.' },
    'idx.toggleSection':  { fr: 'Tout cocher / décocher cette section', en: 'Check / uncheck this section', it: 'Seleziona / deseleziona questa sezione', es: 'Marcar / desmarcar esta sección' },
    'idx.routeCountOne':  { fr: '{n} route',          en: '{n} route',        it: '{n} route',        es: '{n} ruta' },
    'idx.routeCountMany': { fr: '{n} routes',         en: '{n} routes',       it: '{n} route',        es: '{n} rutas' },
    'idx.checkOneRoute':  { fr: 'Veuillez cocher au moins une route à tester.', en: 'Please check at least one route to test.', it: 'Seleziona almeno una route da testare.', es: 'Marque al menos una ruta para probar.' },
    'idx.running':        { fr: 'Exécution des requêtes & Validation...', en: 'Running requests & validation...', it: 'Esecuzione richieste e validazione...', es: 'Ejecutando solicitudes y validación...' },
    'idx.serverErrorLogs':{ fr: 'Erreur serveur ({status}). Voir les logs dans /logs.', en: 'Server error ({status}). See logs in /logs.', it: 'Errore del server ({status}). Vedi i log in /logs.', es: 'Error del servidor ({status}). Consulte los registros en /logs.' },
    'idx.serverError':    { fr: 'Erreur serveur',     en: 'Server error',     it: 'Errore del server', es: 'Error del servidor' },
    'idx.noYamlAvailable':{ fr: 'Aucun fichier YAML disponible. Veuillez re-sélectionner le fichier YAML.', en: 'No YAML file available. Please re-select the YAML file.', it: 'Nessun file YAML disponibile. Riseleziona il file YAML.', es: 'Ningún archivo YAML disponible. Vuelva a seleccionar el archivo YAML.' },

    // ── index.html : infobulles & badges d'historique ───────────────
    'idx.lockLocked':     { fr: 'Champ verrouillé — cliquer pour déverrouiller', en: 'Field locked — click to unlock', it: 'Campo bloccato — clicca per sbloccare', es: 'Campo bloqueado — haga clic para desbloquear' },
    'idx.lockUnlocked':   { fr: "Verrouiller ce champ (le pré-remplissage ne l'écrasera plus)", en: 'Lock this field (auto-fill will no longer overwrite it)', it: 'Blocca questo campo (la precompilazione non lo sovrascriverà più)', es: 'Bloquear este campo (el relleno automático ya no lo sobrescribirá)' },
    'idx.resetToYaml':    { fr: 'Réinitialiser au squelette du YAML', en: 'Reset to YAML skeleton', it: 'Reimposta allo scheletro YAML', es: 'Restablecer al esqueleto YAML' },
    'idx.reset':          { fr: 'Réinitialiser',      en: 'Reset',            it: 'Reimposta',        es: 'Restablecer' },
    'idx.histLoading':    { fr: "Chargement depuis l'historique...", en: 'Loading from history...', it: 'Caricamento dalla cronologia...', es: 'Cargando desde el historial...' },
    'idx.histReselect':   { fr: '(re-sélectionnez le fichier YAML pour valider)', en: '(re-select the YAML file to validate)', it: '(riseleziona il file YAML per validare)', es: '(vuelva a seleccionar el archivo YAML para validar)' },
    'idx.histLoadedPrefix': { fr: 'Historique chargé :', en: 'History loaded:', it: 'Cronologia caricata:', es: 'Historial cargado:' },
    'idx.histLoadedFrom': { fr: "Chargé depuis l'historique :", en: 'Loaded from history:', it: 'Caricato dalla cronologia:', es: 'Cargado desde el historial:' },
    'idx.specAnalyzing':  { fr: 'Analyse de {name}...', en: 'Analyzing {name}...', it: 'Analisi di {name}...', es: 'Analizando {name}...' },
    'idx.specActive':     { fr: 'Spec active : {name}', en: 'Active spec: {name}', it: 'Spec attiva: {name}', es: 'Spec activa: {name}' },

    // ── Scénarios : définitions (labels / descriptions) ─────────────
    'scn.sc.purchaseFullLogin.label': { fr: 'Achat complet (login)', en: 'Full purchase (login)', it: 'Acquisto completo (login)', es: 'Compra completa (login)' },
    'scn.sc.purchaseFullLogin.desc':  { fr: "Depuis une famille de regroupement : offre → produit → login (compte existant) → panier → checkout → paiement émulé → commande.", en: 'From a grouping family: offer → product → login (existing account) → cart → checkout → emulated payment → order.', it: 'Da una famiglia di raggruppamento: offerta → prodotto → login (account esistente) → carrello → checkout → pagamento emulato → ordine.', es: 'Desde una familia de agrupación: oferta → producto → login (cuenta existente) → carrito → checkout → pago emulado → pedido.' },
    'scn.sc.purchaseFullCreate.label': { fr: 'Achat complet (création de compte)', en: 'Full purchase (account creation)', it: 'Acquisto completo (creazione account)', es: 'Compra completa (creación de cuenta)' },
    'scn.sc.purchaseFullCreate.desc':  { fr: "Depuis une famille de regroupement, avec création d'un compte (données générées) avant le login, jusqu'à la commande payée.", en: 'From a grouping family, with account creation (generated data) before login, up to the paid order.', it: 'Da una famiglia di raggruppamento, con creazione di un account (dati generati) prima del login, fino all\'ordine pagato.', es: 'Desde una familia de agrupación, con creación de una cuenta (datos generados) antes del login, hasta el pedido pagado.' },
    'scn.sc.purchaseProductLogin.label': { fr: 'Achat produit (familyCode fourni, login)', en: 'Product purchase (familyCode provided, login)', it: 'Acquisto prodotto (familyCode fornito, login)', es: 'Compra de producto (familyCode proporcionado, login)' },
    'scn.sc.purchaseProductLogin.desc':  { fr: "À partir d'un code famille fourni : offre → produit → login (compte existant) → panier → checkout → paiement émulé → commande.", en: 'From a provided family code: offer → product → login (existing account) → cart → checkout → emulated payment → order.', it: 'Da un codice famiglia fornito: offerta → prodotto → login (account esistente) → carrello → checkout → pagamento emulato → ordine.', es: 'A partir de un código de familia proporcionado: oferta → producto → login (cuenta existente) → carrito → checkout → pago emulado → pedido.' },
    'scn.sc.purchaseProductCreate.label': { fr: 'Achat produit (familyCode fourni, création de compte)', en: 'Product purchase (familyCode provided, account creation)', it: 'Acquisto prodotto (familyCode fornito, creazione account)', es: 'Compra de producto (familyCode proporcionado, creación de cuenta)' },
    'scn.sc.purchaseProductCreate.desc':  { fr: "À partir d'un code famille fourni, avec création d'un compte (données générées) avant le login, jusqu'à la commande payée.", en: 'From a provided family code, with account creation (generated data) before login, up to the paid order.', it: 'Da un codice famiglia fornito, con creazione di un account (dati generati) prima del login, fino all\'ordine pagato.', es: 'A partir de un código de familia proporcionado, con creación de una cuenta (datos generados) antes del login, hasta el pedido pagado.' },
    'scn.sf.usernameOpt': { fr: 'Identifiant (si login direct)', en: 'Username (if direct login)', it: 'Nome utente (se login diretto)', es: 'Usuario (si login directo)' },
    'scn.sf.passwordOpt': { fr: 'Mot de passe (si login direct)', en: 'Password (if direct login)', it: 'Password (se login diretto)', es: 'Contraseña (si login directo)' },
    'scn.br.createAccount.label': { fr: 'Création de compte', en: 'Account creation', it: 'Creazione account', es: 'Creación de cuenta' },
    'scn.br.createAccount.on':    { fr: 'Créer un compte (données générées)', en: 'Create an account (generated data)', it: 'Crea un account (dati generati)', es: 'Crear una cuenta (datos generados)' },
    'scn.br.createAccount.off':   { fr: 'Login direct (id/mdp fournis)', en: 'Direct login (provided id/password)', it: 'Login diretto (id/password forniti)', es: 'Login directo (id/contraseña proporcionados)' },
    'scn.st.createAccount': { fr: 'Création de compte (données générées) → login', en: 'Account creation (generated data) → login', it: 'Creazione account (dati generati) → login', es: 'Creación de cuenta (datos generados) → login' },
    'scn.st.checkCartCode': { fr: 'Vérification panier → cartCode', en: 'Cart check → cartCode', it: 'Verifica carrello → cartCode', es: 'Verificación del carrito → cartCode' },
    'scn.st.beginOrder':    { fr: 'Début de transaction → orderCode', en: 'Begin transaction → orderCode', it: 'Avvio transazione → orderCode', es: 'Inicio de transacción → orderCode' },
    'scn.st.confirmOrder':  { fr: 'Confirmation commande (paiement émulé)', en: 'Order confirmation (emulated payment)', it: 'Conferma ordine (pagamento emulato)', es: 'Confirmación del pedido (pago emulado)' },
    'scn.st.readOrderDetails': { fr: 'Lecture commande (validation)', en: 'Read order (validation)', it: 'Lettura ordine (validazione)', es: 'Lectura del pedido (validación)' },
    'scn.sc.catalogFamilyProduct.label': { fr: 'Catalogue : Famille parente → Produit', en: 'Catalog: Parent family → Product', it: 'Catalogo: Famiglia padre → Prodotto', es: 'Catálogo: Familia principal → Producto' },
    'scn.sc.catalogFamilyProduct.desc':  { fr: "Part d'une famille parente et remonte jusqu'à un produit disponible.", en: 'Starts from a parent family and goes up to an available product.', it: 'Parte da una famiglia padre e risale fino a un prodotto disponibile.', es: 'Parte de una familia principal y sube hasta un producto disponible.' },
    'scn.sc.purchaseFlow.label': { fr: "Parcours d'achat catalogue", en: 'Catalog purchase flow', it: "Percorso d'acquisto catalogo", es: 'Recorrido de compra del catálogo' },
    'scn.sc.purchaseFlow.desc':  { fr: "À partir d'une famille, trouve une offre, une date, une performance, un produit et son prix.", en: 'From a family, finds an offer, a date, a performance, a product and its price.', it: 'Da una famiglia, trova un\'offerta, una data, una performance, un prodotto e il suo prezzo.', es: 'A partir de una familia, encuentra una oferta, una fecha, una función, un producto y su precio.' },
    'scn.sc.accountOrders.label': { fr: 'Compte & commandes (login)', en: 'Account & orders (login)', it: 'Account e ordini (login)', es: 'Cuenta y pedidos (login)' },
    'scn.sc.accountOrders.desc':  { fr: 'Se connecte, lit le compte, cherche une commande et lit un ticket.', en: 'Logs in, reads the account, searches an order and reads a ticket.', it: 'Accede, legge l\'account, cerca un ordine e legge un biglietto.', es: 'Inicia sesión, lee la cuenta, busca un pedido y lee un billete.' },

    // ── Scénarios : champs de départ ────────────────────────────────
    'scn.sf.code':        { fr: 'Code de regroupement', en: 'Grouping code',  it: 'Codice di raggruppamento', es: 'Código de agrupación' },
    'scn.sf.offerType':   { fr: "Typologie d'offre",   en: 'Offer type',       it: 'Tipologia di offerta', es: 'Tipo de oferta' },
    'scn.opt.open':       { fr: 'Produit open',        en: 'Open product',     it: 'Prodotto open',    es: 'Producto open' },
    'scn.opt.dated':      { fr: 'Produit daté',        en: 'Dated product',    it: 'Prodotto datato',  es: 'Producto con fecha' },
    'scn.opt.timed':      { fr: 'Produit horodaté',    en: 'Timed product',    it: 'Prodotto a orario', es: 'Producto con horario' },
    'scn.opt.eachType':   { fr: 'Un de chaque type présent', en: 'One of each type present', it: 'Uno per ogni tipo presente', es: 'Uno de cada tipo presente' },
    'scn.opt.complex':    { fr: 'Vente complexe (1 vente, les 3 types)', en: 'Complex sale (1 sale, all 3 types)', it: 'Vendita complessa (1 vendita, i 3 tipi)', es: 'Venta compleja (1 venta, los 3 tipos)' },
    'scn.st.doPurchase':  { fr: 'Achat selon la typologie → commande(s)', en: 'Purchase by type → order(s)', it: 'Acquisto per tipologia → ordine/i', es: 'Compra por tipo → pedido(s)' },
    'scn.noOffer':        { fr: 'Aucune offre trouvée pour cette famille.', en: 'No offer found for this family.', it: 'Nessuna offerta trovata per questa famiglia.', es: 'Ninguna oferta encontrada para esta familia.' },
    'scn.typeNotFound':   { fr: 'Aucune offre de type « {type} » trouvée dans cette famille.', en: 'No offer of type "{type}" found in this family.', it: 'Nessuna offerta di tipo «{type}» trovata in questa famiglia.', es: 'Ninguna oferta de tipo «{type}» encontrada en esta familia.' },
    'scn.saleFailed':     { fr: 'Échec de la vente ({type}).', en: 'Sale failed ({type}).', it: 'Vendita non riuscita ({type}).', es: 'Venta fallida ({type}).' },
    'scn.noneSold':       { fr: 'Aucune vente aboutie (types manquants : {missing}).', en: 'No completed sale (missing types: {missing}).', it: 'Nessuna vendita completata (tipi mancanti: {missing}).', es: 'Ninguna venta completada (tipos faltantes: {missing}).' },
    'scn.sf.familyCode':  { fr: 'Code famille',        en: 'Family code',      it: 'Codice famiglia',  es: 'Código de familia' },
    'scn.sf.username':    { fr: 'Identifiant',         en: 'Username',         it: 'Nome utente',      es: 'Usuario' },
    'scn.sf.password':    { fr: 'Mot de passe',        en: 'Password',         it: 'Password',         es: 'Contraseña' },

    // ── Scénarios : branche "séance" ────────────────────────────────
    'scn.br.session.label': { fr: 'Avec séance',       en: 'With session',     it: 'Con sessione',     es: 'Con sesión' },
    'scn.br.session.on':    { fr: 'Avec séance',       en: 'With session',     it: 'Con sessione',     es: 'Con sesión' },
    'scn.br.session.off':   { fr: 'Sans séance',       en: 'Without session',  it: 'Senza sessione',   es: 'Sin sesión' },

    // ── Scénarios : libellés d'étapes (par contenu, dédupliqués) ────
    'scn.st.parentFamilies':  { fr: 'Familles parentes → parentFamilyCode', en: 'Parent families → parentFamilyCode', it: 'Famiglie padre → parentFamilyCode', es: 'Familias principales → parentFamilyCode' },
    'scn.st.parentFamily':    { fr: 'Famille parente → familyCode', en: 'Parent family → familyCode', it: 'Famiglia padre → familyCode', es: 'Familia principal → familyCode' },
    'scn.st.offersByFamily':  { fr: 'Offres par famille → offerCode', en: 'Offers by family → offerCode', it: 'Offerte per famiglia → offerCode', es: 'Ofertas por familia → offerCode' },
    'scn.st.offerDetails':    { fr: 'Détails offre (validation)', en: 'Offer details (validation)', it: 'Dettagli offerta (validazione)', es: 'Detalles de oferta (validación)' },
    'scn.st.sessionDays':     { fr: '[Séance] Jours disponibles → date', en: '[Session] Available days → date', it: '[Sessione] Giorni disponibili → date', es: '[Sesión] Días disponibles → date' },
    'scn.st.sessionPerf':     { fr: '[Séance] Performances du jour → performanceCode', en: '[Session] Day performances → performanceCode', it: '[Sessione] Performance del giorno → performanceCode', es: '[Sesión] Funciones del día → performanceCode' },
    'scn.st.productCodes':    { fr: 'Codes produits → productCode', en: 'Product codes → productCode', it: 'Codici prodotto → productCode', es: 'Códigos de producto → productCode' },
    'scn.st.readProduct':     { fr: 'Lecture produit (validation)', en: 'Read product (validation)', it: 'Lettura prodotto (validazione)', es: 'Lectura de producto (validación)' },
    'scn.st.firstDate':       { fr: 'Première date dispo → dateFrom / dateTo', en: 'First available date → dateFrom / dateTo', it: 'Prima data disponibile → dateFrom / dateTo', es: 'Primera fecha disponible → dateFrom / dateTo' },
    'scn.st.calendarDays':    { fr: 'Jours calendrier → date', en: 'Calendar days → date', it: 'Giorni calendario → date', es: 'Días de calendario → date' },
    'scn.st.perfByDay':       { fr: 'Performances du jour → performanceCode', en: 'Day performances → performanceCode', it: 'Performance del giorno → performanceCode', es: 'Funciones del día → performanceCode' },
    'scn.st.productCodes2':   { fr: 'Codes produits → productCode / productCodes', en: 'Product codes → productCode / productCodes', it: 'Codici prodotto → productCode / productCodes', es: 'Códigos de producto → productCode / productCodes' },
    'scn.st.prices':          { fr: 'Prix (validation)', en: 'Prices (validation)', it: 'Prezzi (validazione)', es: 'Precios (validación)' },
    'scn.st.signin':          { fr: 'Signin → accountCode', en: 'Sign-in → accountCode', it: 'Signin → accountCode', es: 'Signin → accountCode' },
    'scn.st.readAccount':     { fr: 'Lecture compte (validation)', en: 'Read account (validation)', it: 'Lettura account (validazione)', es: 'Lectura de cuenta (validación)' },
    'scn.st.searchOrders':    { fr: 'Recherche commandes → orderCode', en: 'Search orders → orderCode', it: 'Ricerca ordini → orderCode', es: 'Búsqueda de pedidos → orderCode' },
    'scn.st.orderDetails':    { fr: 'Détail commande (validation)', en: 'Order details (validation)', it: 'Dettaglio ordine (validazione)', es: 'Detalle de pedido (validación)' },
    'scn.st.searchTickets':   { fr: 'Recherche tickets → mediaCode', en: 'Search tickets → mediaCode', it: 'Ricerca biglietti → mediaCode', es: 'Búsqueda de billetes → mediaCode' },
    'scn.st.readTicket':      { fr: 'Lecture ticket (validation)', en: 'Read ticket (validation)', it: 'Lettura biglietto (validazione)', es: 'Lectura de billete (validación)' },

    // ── Scénarios : exécution / statuts / synthèse ──────────────────
    'scn.run':            { fr: 'Exécuter le scénario', en: 'Run scenario',   it: 'Esegui lo scenario', es: 'Ejecutar el escenario' },
    'scn.running':        { fr: 'Exécution...',        en: 'Running...',       it: 'Esecuzione...',    es: 'Ejecutando...' },
    'scn.needYaml':       { fr: "Chargez d'abord une spec YAML.", en: 'Load a YAML spec first.', it: 'Carica prima una spec YAML.', es: 'Cargue primero una spec YAML.' },
    'scn.needUrl':        { fr: "Renseignez l'URL de l'API cible.", en: 'Enter the target API URL.', it: "Inserisci l'URL dell'API di destinazione.", es: 'Indique la URL de la API de destino.' },
    'scn.noLastRun':      { fr: 'Aucun test précédent mémorisé pour ce scénario et cette URL.', en: 'No previous test saved for this scenario and URL.', it: 'Nessun test precedente salvato per questo scenario e questo URL.', es: 'Ninguna prueba anterior guardada para este escenario y esta URL.' },
    'scn.skipped':        { fr: '(ignorée)',           en: '(skipped)',        it: '(ignorato)',       es: '(omitido)' },
    'scn.statusOk':       { fr: 'Scénario validé',     en: 'Scenario passed',  it: 'Scenario validato', es: 'Escenario validado' },
    'scn.statusWarn':     { fr: 'Validé avec avertissements', en: 'Passed with warnings', it: 'Validato con avvisi', es: 'Validado con advertencias' },
    'scn.statusNullable': { fr: 'Validé avec champs null', en: 'Passed with null fields', it: 'Validato con campi null', es: 'Validado con campos null' },
    'scn.statusUndoc':    { fr: 'Validé avec champs non documentés', en: 'Passed with undocumented fields', it: 'Validato con campi non documentati', es: 'Validado con campos no documentados' },
    'scn.statusNotImpl':  { fr: 'Validé avec champs non implémentés', en: 'Passed with unimplemented fields', it: 'Validato con campi non implementati', es: 'Validado con campos no implementados' },
    'scn.statusFail':     { fr: "Échec à l'étape {n}", en: 'Failed at step {n}', it: 'Fallito al passo {n}', es: 'Fallo en el paso {n}' },
    'scn.cfgTitle':       { fr: 'Paramètres pour la route {path}', en: 'Parameters for route {path}', it: 'Parametri per la route {path}', es: 'Parámetros para la ruta {path}' },
    'scn.cfgRetryTitle':  { fr: 'Réessayer : paramètres pour {path}', en: 'Retry: parameters for {path}', it: 'Riprova: parametri per {path}', es: 'Reintentar: parámetros para {path}' },
    'scn.retryStep':      { fr: 'Réessayer cette étape', en: 'Retry this step', it: 'Riprova questo passo', es: 'Reintentar este paso' },
    'scn.stepFailedRetry':{ fr: "L'étape a échoué. Ajustez les paramètres et réessayez.", en: 'The step failed. Adjust the parameters and retry.', it: 'Il passo è fallito. Regola i parametri e riprova.', es: 'El paso falló. Ajuste los parámetros y reintente.' },
    'scn.dateOrder':      { fr: 'La date de début doit être antérieure ou égale à la date de fin.', en: 'The start date must be before or equal to the end date.', it: 'La data di inizio deve essere precedente o uguale alla data di fine.', es: 'La fecha de inicio debe ser anterior o igual a la fecha de fin.' },
    'scn.branchChoice':   { fr: 'Choix de parcours : {label}', en: 'Path choice: {label}', it: 'Scelta del percorso: {label}', es: 'Elección de recorrido: {label}' },
    'scn.required':       { fr: 'requis',              en: 'required',         it: 'obbligatorio',     es: 'requerido' },
    'scn.optional':       { fr: 'optionnel',           en: 'optional',         it: 'opzionale',        es: 'opcional' },
    'scn.condMark':       { fr: 'Obligatoire sous condition', en: 'Conditionally required', it: 'Obbligatorio a condizione', es: 'Obligatorio bajo condición' },
    'scn.occurrences':    { fr: '{n} occurrences',     en: '{n} occurrences',  it: '{n} occorrenze',   es: '{n} ocurrencias' },
    'scn.confOk':         { fr: 'Conforme',            en: 'Compliant',        it: 'Conforme',         es: 'Conforme' },
    'scn.confWarn':       { fr: 'Avertissements',      en: 'Warnings',         it: 'Avvisi',           es: 'Advertencias' },
    'scn.confNullable':   { fr: 'Champs null',         en: 'Null fields',      it: 'Campi null',       es: 'Campos null' },
    'scn.confUndoc':      { fr: 'Champs non documentés', en: 'Undocumented fields', it: 'Campi non documentati', es: 'Campos no documentados' },
    'scn.confNotImpl':    { fr: 'Champs non implémentés', en: 'Unimplemented fields', it: 'Campi non implementati', es: 'Campos no implementados' },
    'scn.confFail':       { fr: 'Échec',               en: 'Failed',           it: 'Fallito',          es: 'Fallo' },
    'scn.confSkip':       { fr: 'Ignorée',             en: 'Skipped',          it: 'Ignorato',         es: 'Omitido' },
    'scn.summaryTitle':   { fr: 'Synthèse du scénario', en: 'Scenario summary', it: 'Sintesi dello scenario', es: 'Resumen del escenario' },
    'scn.export':         { fr: 'Exporter JSON',       en: 'Export JSON',      it: 'Esporta JSON',     es: 'Exportar JSON' },
    'scn.cntConform':     { fr: '{n} conforme(s)',     en: '{n} compliant',    it: '{n} conformi',     es: '{n} conforme(s)' },
    'scn.cntWarn':        { fr: '{n} avertissement(s)', en: '{n} warning(s)',  it: '{n} avviso/i',     es: '{n} advertencia(s)' },
    'scn.cntNull':        { fr: '{n} champ(s) null',   en: '{n} null field(s)', it: '{n} campo/i null', es: '{n} campo(s) null' },
    'scn.cntUndoc':       { fr: '{n} non documenté(s)', en: '{n} undocumented', it: '{n} non documentati', es: '{n} no documentado(s)' },
    'scn.cntNotImpl':     { fr: '{n} non implémenté(s)', en: '{n} unimplemented', it: '{n} non implementati', es: '{n} no implementado(s)' },
    'scn.cntFail':        { fr: '{n} échec(s)',        en: '{n} failure(s)',   it: '{n} fallimento/i', es: '{n} fallo(s)' },
    'scn.cntSkip':        { fr: '{n} ignorée(s)',      en: '{n} skipped',      it: '{n} ignorato/i',   es: '{n} omitido(s)' },
    'scn.stepFailedConsole': { fr: 'Étape "{label}" échouée', en: 'Step "{label}" failed', it: 'Passo "{label}" fallito', es: 'Paso "{label}" fallido' },
    'scn.warnSchema':     { fr: '{n} avertissement(s) de schéma', en: '{n} schema warning(s)', it: '{n} avviso/i di schema', es: '{n} advertencia(s) de esquema' },
    'scn.nullFields':     { fr: '{n} champ(s) null',   en: '{n} null field(s)', it: '{n} campo/i null', es: '{n} campo(s) null' },
    'scn.undocFields':    { fr: '{n} champ(s) non documenté(s)', en: '{n} undocumented field(s)', it: '{n} campo/i non documentati', es: '{n} campo(s) no documentado(s)' },
    'scn.notImplFields':  { fr: '{n} champ(s) non implémenté(s)', en: '{n} unimplemented field(s)', it: '{n} campo/i non implementati', es: '{n} campo(s) no implementado(s)' },
  };

  // ------------------------------------------------------------------
  // ÉTAT
  // ------------------------------------------------------------------
  function getLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(stored) ? stored : DEFAULT_LANG;
  }

  let currentLang = getLang();

  function t(key, vars) {
    const entry = DICT[key];
    let str = entry ? (entry[currentLang] ?? entry[DEFAULT_LANG] ?? key) : key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v));
      }
    }
    return str;
  }

  // ------------------------------------------------------------------
  // APPLICATION DES TRADUCTIONS SUR LE DOM
  // ------------------------------------------------------------------
  function apply(root) {
    const scope = root || document;

    // Texte simple : data-i18n="cle"
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });

    // Texte avec HTML conservé : data-i18n-html="cle"
    scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });

    // Attributs : data-i18n-attr="placeholder:cle; title:cle2"
    scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.getAttribute('data-i18n-attr').split(';').forEach((pair) => {
        const [attr, key] = pair.split(':').map((s) => s && s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });

    // Met à jour l'attribut lang du document
    document.documentElement.setAttribute('lang', currentLang);
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    apply();
    syncSelectors();
    document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang } }));
  }

  // ------------------------------------------------------------------
  // SÉLECTEUR DE LANGUE (injecté dans tout élément .lang-switcher)
  // ------------------------------------------------------------------
  function buildSelectors() {
    document.querySelectorAll('.lang-switcher').forEach((host) => {
      if (host.dataset.i18nReady) return;
      host.dataset.i18nReady = '1';

      const select = document.createElement('select');
      select.className =
        'lang-select bg-slate-900/80 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer';
      select.setAttribute('aria-label', t('header.langLabel'));

      SUPPORTED.forEach((code) => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = `${LANG_LABELS[code].flag} ${LANG_LABELS[code].name}`;
        select.appendChild(opt);
      });

      select.value = currentLang;
      select.addEventListener('change', (e) => setLang(e.target.value));
      host.appendChild(select);
    });
  }

  function syncSelectors() {
    document.querySelectorAll('.lang-select').forEach((sel) => {
      sel.value = currentLang;
    });
  }

  // ------------------------------------------------------------------
  // INIT
  // ------------------------------------------------------------------
  function init() {
    buildSelectors();
    apply();
    syncSelectors();
    // Signale que I18n est prêt : les pages peuvent re-rendre leurs contenus
    // générés en JS (selects, listes) qui ont pu être construits avant ce point.
    document.dispatchEvent(new CustomEvent('i18n:ready', { detail: { lang: currentLang } }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // API publique
  window.I18n = { t, setLang, getLang: () => currentLang, apply, SUPPORTED, LANG_LABELS };
})();
