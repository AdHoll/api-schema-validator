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
    'nav.admin':          { fr: 'Administration',    en: 'Administration',   it: 'Amministrazione',  es: 'Administración' },
    'idx.loginPrompt':    { fr: 'Connectez-vous pour accéder au validateur.', en: 'Sign in to access the validator.', it: 'Accedi per usare il validatore.', es: 'Conéctese para acceder al validador.' },
    'status.standbyTitle':{ fr: 'Statut des APIs — en stand-by', en: 'API Status — on standby', it: 'Stato delle API — in stand-by', es: 'Estado de las API — en espera' },
    'status.standbyMsg':  { fr: 'Cette fonctionnalité est temporairement désactivée.', en: 'This feature is temporarily disabled.', it: 'Questa funzionalità è temporaneamente disattivata.', es: 'Esta función está desactivada temporalmente.' },

    // ── Profils / connexion ────────────────────────────────────────
    'prof.none':          { fr: 'Non connecté',      en: 'Not signed in',    it: 'Non connesso',     es: 'No conectado' },
    'prof.superadmin':    { fr: 'Super admin',       en: 'Super admin',      it: 'Super admin',      es: 'Super admin' },
    'prof.subadmin':      { fr: 'Sous admin',        en: 'Sub admin',        it: 'Sub admin',        es: 'Sub admin' },
    'prof.dev':           { fr: 'Développeur',       en: 'Developer',        it: 'Sviluppatore',     es: 'Desarrollador' },
    'prof.qa':            { fr: 'QA',                en: 'QA',               it: 'QA',               es: 'QA' },
    'prof.support':       { fr: 'Support',           en: 'Support',          it: 'Supporto',         es: 'Soporte' },
    'prof.switch':        { fr: 'Se connecter',      en: 'Sign in',          it: 'Accedi',           es: 'Conectarse' },
    'prof.switch2':       { fr: 'Changer',           en: 'Switch',           it: 'Cambia',           es: 'Cambiar' },
    'login.title':        { fr: 'Connexion',         en: 'Sign in',          it: 'Accesso',          es: 'Conexión' },
    'login.connect':      { fr: 'Se connecter',      en: 'Sign in',          it: 'Accedi',           es: 'Conectarse' },
    'login.profile':      { fr: 'Profil',            en: 'Profile',          it: 'Profilo',          es: 'Perfil' },
    'login.password':     { fr: 'Mot de passe',      en: 'Password',         it: 'Password',         es: 'Contraseña' },
    'login.passwordConfirm': { fr: 'Confirmer le mot de passe', en: 'Confirm password', it: 'Conferma password', es: 'Confirmar contraseña' },
    'login.forgot':       { fr: 'Mot de passe oublié ?', en: 'Forgot password?', it: 'Password dimenticata?', es: '¿Contraseña olvidada?' },
    'login.firstRunTitle': { fr: 'Première configuration', en: 'First setup', it: 'Prima configurazione', es: 'Primera configuración' },
    'login.firstRunIntro': { fr: 'Aucune configuration trouvée. Créez le compte super admin, ou importez une configuration existante.', en: 'No configuration found. Create the super admin account, or import an existing configuration.', it: 'Nessuna configurazione trovata. Crea l\'account super admin oppure importa una configurazione esistente.', es: 'No se encontró configuración. Cree la cuenta de super admin o importe una configuración existente.' },
    'login.firstRunCreate': { fr: 'Créer le compte super admin', en: 'Create the super admin account', it: 'Crea l\'account super admin', es: 'Crear la cuenta de super admin' },
    'login.firstRunCreateHint': { fr: 'Définir un mot de passe et une question de récupération', en: 'Set a password and a recovery question', it: 'Imposta una password e una domanda di recupero', es: 'Definir una contraseña y una pregunta de recuperación' },
    'login.firstRunImport': { fr: 'Importer une configuration', en: 'Import a configuration', it: 'Importa una configurazione', es: 'Importar una configuración' },
    'login.firstRunImportHint': { fr: 'Charger un fichier de configuration (.json) existant', en: 'Load an existing configuration file (.json)', it: 'Carica un file di configurazione (.json) esistente', es: 'Cargar un archivo de configuración (.json) existente' },
    'login.importNoAdmin': { fr: 'Configuration importée sans compte super admin. Créez-le ci-dessous.', en: 'Imported configuration without a super admin account. Create one below.', it: 'Configurazione importata senza account super admin. Crealo qui sotto.', es: 'Configuración importada sin cuenta de super admin. Créela a continuación.' },
    'login.importNoAdmin2': { fr: 'Configuration importée sans compte super admin. Utilisez « Créer nouvelle config ».', en: 'Imported configuration without a super admin account. Use "Create new config".', it: 'Configurazione importata senza account super admin. Usa «Crea nuova config».', es: 'Configuración importada sin cuenta de super admin. Use «Crear nueva config».' },
    'login.firstRunImportOnly': { fr: 'Importez une configuration existante pour démarrer.', en: 'Import an existing configuration to get started.', it: 'Importa una configurazione esistente per iniziare.', es: 'Importe una configuración existente para empezar.' },
    'login.firstRunNewConfig': { fr: 'Créer nouvelle config : nécessite le master password', en: 'Create new config: requires the master password', it: 'Crea nuova config: richiede la master password', es: 'Crear nueva config: requiere la master password' },
    'login.masterTitle':  { fr: 'Créer une nouvelle configuration', en: 'Create a new configuration', it: 'Crea una nuova configurazione', es: 'Crear una nueva configuración' },
    'login.masterIntro':  { fr: "La création d'une nouvelle configuration nécessite le master password.", en: 'Creating a new configuration requires the master password.', it: 'La creazione di una nuova configurazione richiede la master password.', es: 'Crear una nueva configuración requiere la master password.' },
    'login.masterPassword': { fr: 'Master password', en: 'Master password', it: 'Master password', es: 'Master password' },
    'login.masterWrong':  { fr: 'Master password incorrect.', en: 'Incorrect master password.', it: 'Master password errata.', es: 'Master password incorrecta.' },
    'login.importErr':    { fr: 'Fichier de configuration invalide.', en: 'Invalid configuration file.', it: 'File di configurazione non valido.', es: 'Archivo de configuración no válido.' },
    'login.initTitle':    { fr: 'Première configuration — Super admin', en: 'First setup — Super admin', it: 'Prima configurazione — Super admin', es: 'Primera configuración — Super admin' },
    'login.initIntro':    { fr: 'Aucune configuration trouvée. Définissez le mot de passe super admin et une question de récupération.', en: 'No configuration found. Set the super admin password and a recovery question.', it: 'Nessuna configurazione trovata. Imposta la password super admin e una domanda di recupero.', es: 'No se encontró configuración. Defina la contraseña de super admin y una pregunta de recuperación.' },
    'login.create':       { fr: 'Créer',             en: 'Create',           it: 'Crea',             es: 'Crear' },
    'login.secQuestion':  { fr: 'Question de récupération', en: 'Recovery question', it: 'Domanda di recupero', es: 'Pregunta de recuperación' },
    'login.secAnswer':    { fr: 'Réponse',           en: 'Answer',           it: 'Risposta',         es: 'Respuesta' },
    'login.recoverTitle': { fr: 'Récupération du mot de passe', en: 'Password recovery', it: 'Recupero password', es: 'Recuperación de contraseña' },
    'login.reset':        { fr: 'Réinitialiser',     en: 'Reset',            it: 'Reimposta',        es: 'Restablecer' },
    'login.newPassword':  { fr: 'Nouveau mot de passe', en: 'New password',  it: 'Nuova password',   es: 'Nueva contraseña' },
    'login.noRecover':    { fr: 'Aucune question de récupération pour ce profil. Contactez un super admin.', en: 'No recovery question for this profile. Contact a super admin.', it: 'Nessuna domanda di recupero per questo profilo. Contatta un super admin.', es: 'Sin pregunta de recuperación para este perfil. Contacte a un super admin.' },
    'login.errPwdShort':  { fr: 'Mot de passe trop court (min. 4 caractères).', en: 'Password too short (min. 4 characters).', it: 'Password troppo corta (min. 4 caratteri).', es: 'Contraseña demasiado corta (mín. 4 caracteres).' },
    'login.errPwdMatch':  { fr: 'Les mots de passe ne correspondent pas.', en: 'Passwords do not match.', it: 'Le password non coincidono.', es: 'Las contraseñas no coinciden.' },
    'login.errAnswer':    { fr: 'Renseignez la réponse à la question.', en: 'Enter the answer to the question.', it: 'Inserisci la risposta alla domanda.', es: 'Ingrese la respuesta a la pregunta.' },
    'login.errAnswerWrong': { fr: 'Réponse incorrecte.', en: 'Incorrect answer.', it: 'Risposta errata.', es: 'Respuesta incorrecta.' },
    'login.errBadPwd':    { fr: 'Mot de passe incorrect.', en: 'Incorrect password.', it: 'Password errata.', es: 'Contraseña incorrecta.' },
    'sec.q1':             { fr: 'Quel était le nom de votre premier animal de compagnie ?', en: 'What was the name of your first pet?', it: 'Qual era il nome del tuo primo animale domestico?', es: '¿Cuál era el nombre de su primera mascota?' },
    'sec.q2':             { fr: 'Quelle est votre ville de naissance ?', en: 'What is your city of birth?', it: 'Qual è la tua città natale?', es: '¿Cuál es su ciudad de nacimiento?' },
    'sec.q3':             { fr: 'Quel est le nom de jeune fille de votre mère ?', en: "What is your mother's maiden name?", it: 'Qual è il cognome da nubile di tua madre?', es: '¿Cuál es el apellido de soltera de su madre?' },
    'sec.q4':             { fr: 'Quel était le nom de votre école primaire ?', en: 'What was the name of your primary school?', it: 'Qual era il nome della tua scuola elementare?', es: '¿Cuál era el nombre de su escuela primaria?' },
    'common.back':        { fr: 'Retour',            en: 'Back',             it: 'Indietro',         es: 'Atrás' },
    'common.ok':          { fr: 'OK',                en: 'OK',               it: 'OK',               es: 'OK' },
    'common.cancel2':     { fr: 'Annuler',           en: 'Cancel',           it: 'Annulla',          es: 'Cancelar' },

    // ── Import/export config (header) ──────────────────────────────
    'cfg.export':         { fr: 'Exporter la configuration', en: 'Export configuration', it: 'Esporta configurazione', es: 'Exportar configuración' },
    'cfg.import':         { fr: 'Importer une configuration', en: 'Import configuration', it: 'Importa configurazione', es: 'Importar configuración' },
    'cfg.imported':       { fr: 'Configuration importée.', en: 'Configuration imported.', it: 'Configurazione importata.', es: 'Configuración importada.' },
    'cfg.importErr':      { fr: 'Fichier JSON invalide.', en: 'Invalid JSON file.', it: 'File JSON non valido.', es: 'Archivo JSON no válido.' },

    // ── Cibles (section 2) ─────────────────────────────────────────
    'sec2.target':        { fr: 'API cible',         en: 'Target API',       it: 'API di destinazione', es: 'API objetivo' },
    'sec2.targetPh':      { fr: '-- Choisir une cible --', en: '-- Choose a target --', it: '-- Scegli una destinazione --', es: '-- Elegir un objetivo --' },

    // ── Page Admin ─────────────────────────────────────────────────
    'admin.subtitle':     { fr: 'Gestion des profils, des droits et des cibles API', en: 'Manage profiles, permissions and API targets', it: 'Gestione di profili, diritti e destinazioni API', es: 'Gestión de perfiles, derechos y destinos API' },
    'admin.denied':       { fr: 'Accès réservé aux administrateurs. Connectez-vous avec un profil admin.', en: 'Admins only. Sign in with an admin profile.', it: 'Accesso riservato agli amministratori. Accedi con un profilo admin.', es: 'Acceso reservado a administradores. Conéctese con un perfil admin.' },
    'admin.configTitle':  { fr: 'Configuration des droits', en: 'Permissions configuration', it: 'Configurazione dei diritti', es: 'Configuración de derechos' },
    'admin.export':       { fr: 'Exporter la config', en: 'Export config',   it: 'Esporta config',   es: 'Exportar config' },
    'admin.import':       { fr: 'Importer',          en: 'Import',           it: 'Importa',          es: 'Importar' },
    'admin.matrixTitle':  { fr: 'Droits par profil', en: 'Permissions by profile', it: 'Diritti per profilo', es: 'Derechos por perfil' },
    'admin.matrixHelp':   { fr: 'Cochez les éléments disponibles pour chaque profil restreint (Développeur, QA, Support). Les super/sous admins ont accès à tout.', en: 'Check the items available to each restricted profile (Developer, QA, Support). Super/sub admins have full access.', it: 'Seleziona gli elementi disponibili per ogni profilo limitato (Sviluppatore, QA, Supporto). I super/sub admin hanno accesso completo.', es: 'Marque los elementos disponibles para cada perfil restringido (Desarrollador, QA, Soporte). Los super/sub admins tienen acceso total.' },
    'admin.specFor':      { fr: 'Version de spec (pour lister les routes) :', en: 'Spec version (to list routes):', it: 'Versione spec (per elencare le route):', es: 'Versión de spec (para listar rutas):' },
    'admin.element':      { fr: 'Élément',           en: 'Item',             it: 'Elemento',         es: 'Elemento' },
    'admin.famSpecs':     { fr: 'Versions de spec',  en: 'Spec versions',    it: 'Versioni spec',    es: 'Versiones de spec' },
    'admin.famEnvironments': { fr: 'Environnements', en: 'Environments',     it: 'Ambienti',         es: 'Entornos' },
    'admin.famScenarios': { fr: 'Scénarios',         en: 'Scenarios',        it: 'Scenari',          es: 'Escenarios' },
    'admin.famRoutes':    { fr: 'Routes',            en: 'Routes',           it: 'Route',            es: 'Rutas' },
    'admin.checkAll':     { fr: 'Tout cocher',       en: 'Check all',        it: 'Seleziona tutto',  es: 'Marcar todo' },
    'admin.uncheckAll':   { fr: 'Tout décocher',     en: 'Uncheck all',      it: 'Deseleziona tutto', es: 'Desmarcar todo' },
    'admin.byMethod':     { fr: 'Par méthode :',     en: 'By method:',       it: 'Per metodo:',      es: 'Por método:' },
    'admin.byMethodHelp': { fr: "Activer/désactiver toutes les routes d'une méthode pour un profil :", en: 'Enable/disable all routes of a method for a profile:', it: 'Attiva/disattiva tutte le route di un metodo per un profilo:', es: 'Activar/desactivar todas las rutas de un método para un perfil:' },
    'admin.allProfiles':  { fr: 'Tous',              en: 'All',              it: 'Tutti',            es: 'Todos' },
    'admin.checkMethod':  { fr: 'Cocher',            en: 'Check',            it: 'Seleziona',        es: 'Marcar' },
    'admin.targetsTitle': { fr: 'Cibles API',        en: 'API targets',      it: 'Destinazioni API', es: 'Destinos API' },
    'admin.tLabel':       { fr: 'Libellé',           en: 'Label',            it: 'Etichetta',        es: 'Etiqueta' },
    'admin.tUrl':         { fr: 'URL',               en: 'URL',              it: 'URL',              es: 'URL' },
    'admin.tClientId':    { fr: 'Client ID',         en: 'Client ID',        it: 'Client ID',        es: 'Client ID' },
    'admin.tScope':       { fr: 'Scope',             en: 'Scope',            it: 'Scope',            es: 'Scope' },
    'admin.tEnv':         { fr: 'Environnement',     en: 'Environment',      it: 'Ambiente',         es: 'Entorno' },
    'admin.tAdd':         { fr: 'Ajouter la cible',  en: 'Add target',       it: 'Aggiungi destinazione', es: 'Añadir destino' },
    'admin.tEdit':        { fr: 'Modifier',          en: 'Edit',             it: 'Modifica',         es: 'Editar' },
    'admin.tDelete':      { fr: 'Supprimer',         en: 'Delete',           it: 'Elimina',          es: 'Eliminar' },
    'admin.tSave':        { fr: 'Enregistrer les modifications', en: 'Save changes', it: 'Salva modifiche', es: 'Guardar cambios' },
    'admin.tEditing':     { fr: "Modification d'une cible", en: 'Editing a target', it: 'Modifica di una destinazione', es: 'Editando un destino' },
    'admin.tProdNote':    { fr: 'Les cibles de production ne peuvent être ajoutées que par un super admin.', en: 'Production targets can only be added by a super admin.', it: 'Le destinazioni di produzione possono essere aggiunte solo da un super admin.', es: 'Los destinos de producción solo pueden ser añadidos por un super admin.' },
    'admin.tProdDenied':  { fr: 'Seul un super admin peut ajouter une cible de production.', en: 'Only a super admin can add a production target.', it: 'Solo un super admin può aggiungere una destinazione di produzione.', es: 'Solo un super admin puede añadir un destino de producción.' },
    'admin.tUrlRequired': { fr: "L'URL est obligatoire.", en: 'URL is required.', it: "L'URL è obbligatorio.", es: 'La URL es obligatoria.' },
    'admin.noTarget':     { fr: 'Aucune cible définie.', en: 'No target defined.', it: 'Nessuna destinazione definita.', es: 'Ningún destino definido.' },
    'admin.pwdTitle':     { fr: 'Mots de passe des profils', en: 'Profile passwords', it: 'Password dei profili', es: 'Contraseñas de perfiles' },
    'admin.pwdHelp':      { fr: "Définir (ou effacer) le mot de passe d'un profil. Vide = profil ouvert sans mot de passe (profils restreints uniquement).", en: 'Set (or clear) a profile password. Empty = open profile without password (restricted profiles only).', it: 'Imposta (o cancella) la password di un profilo. Vuoto = profilo aperto senza password (solo profili limitati).', es: 'Definir (o borrar) la contraseña de un perfil. Vacío = perfil abierto sin contraseña (solo perfiles restringidos).' },
    'admin.newPwd':       { fr: 'nouveau mot de passe', en: 'new password',  it: 'nuova password',   es: 'nueva contraseña' },
    'admin.setPwd':       { fr: 'Définir',           en: 'Set',              it: 'Imposta',          es: 'Definir' },
    'admin.clearPwd':     { fr: 'Effacer',           en: 'Clear',            it: 'Cancella',         es: 'Borrar' },
    'admin.pwdSet':       { fr: 'Défini',            en: 'Set',              it: 'Impostata',        es: 'Definida' },
    'admin.pwdUnset':     { fr: 'Non défini',        en: 'Not set',          it: 'Non impostata',    es: 'Sin definir' },
    'admin.pwdSetTip':    { fr: 'Un mot de passe est défini pour ce profil', en: 'A password is set for this profile', it: 'Una password è impostata per questo profilo', es: 'Hay una contraseña definida para este perfil' },
    'admin.pwdUnsetTip':  { fr: 'Aucun mot de passe défini', en: 'No password set', it: 'Nessuna password impostata', es: 'Ninguna contraseña definida' },
    'admin.pwdEmpty':     { fr: 'Saisissez un mot de passe (ou utilisez « Effacer »).', en: 'Enter a password (or use "Clear").', it: 'Inserisci una password (o usa «Cancella»).', es: 'Introduzca una contraseña (o use «Borrar»).' },
    'admin.pwdClearConfirm': { fr: 'Effacer le mot de passe de {p} ?', en: 'Clear the password for {p}?', it: 'Cancellare la password di {p}?', es: '¿Borrar la contraseña de {p}?' },
    'admin.pwdSaved':     { fr: 'Mot de passe mis à jour pour {p}.', en: 'Password updated for {p}.', it: 'Password aggiornata per {p}.', es: 'Contraseña actualizada para {p}.' },
    'admin.imported':     { fr: 'Configuration importée.', en: 'Configuration imported.', it: 'Configurazione importata.', es: 'Configuración importada.' },
    'admin.importErr':    { fr: 'Fichier JSON invalide.', en: 'Invalid JSON file.', it: 'File JSON non valido.', es: 'Archivo JSON no válido.' },

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
    'sec2.env':           { fr: 'Environnement',     en: 'Environment',      it: 'Ambiente',         es: 'Entorno' },
    'sec2.rememberSecret': { fr: 'Mémoriser le secret (chiffré, hors prod)', en: 'Remember secret (encrypted, non-prod)', it: 'Memorizza il segreto (cifrato, non prod)', es: 'Recordar el secreto (cifrado, no prod)' },
    'sec2.envDev':        { fr: 'Développement',     en: 'Development',      it: 'Sviluppo',         es: 'Desarrollo' },
    'sec2.envPreprod':    { fr: 'Pré-production',    en: 'Pre-production',   it: 'Pre-produzione',   es: 'Preproducción' },
    'sec2.envProd':       { fr: 'Production',        en: 'Production',       it: 'Produzione',       es: 'Producción' },
    'sec2.tokenNote':     { fr: 'Les identifiants seront transmis via Query Parameters sur', en: 'Credentials will be sent via query parameters to', it: 'Le credenziali saranno inviate tramite query parameter su', es: 'Las credenciales se enviarán mediante parámetros de consulta a' },

    // ── Mode Scénarios ─────────────────────────────────────────────
    'scn.title':          { fr: 'Scénarios de test', en: 'Test scenarios',   it: 'Scenari di test',  es: 'Escenarios de prueba' },
    'scn.subtitle':       { fr: "Enchaînement automatique d'appels avec dépendances de données.", en: 'Automatic chaining of calls with data dependencies.', it: 'Concatenamento automatico di chiamate con dipendenze di dati.', es: 'Encadenamiento automático de llamadas con dependencias de datos.' },
    'scn.choose':         { fr: 'Choisir un scénario', en: 'Choose a scenario', it: 'Scegli uno scenario', es: 'Elegir un escenario' },
    'scn.choosePh':       { fr: '-- Sélectionner un scénario --', en: '-- Select a scenario --', it: '-- Seleziona uno scenario --', es: '-- Seleccionar un escenario --' },
    'scn.execMode':       { fr: "Mode d'exécution",  en: 'Execution mode',   it: 'Modalità di esecuzione', es: 'Modo de ejecución' },
    'scn.auto':           { fr: 'Auto',              en: 'Auto',             it: 'Auto',             es: 'Auto' },
    'scn.semi':           { fr: 'Semi-auto',         en: 'Semi-auto',        it: 'Semi-auto',        es: 'Semi-auto' },
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
    'res.catWarning':     { fr: 'CONFORME AVEC AVERTISSEMENTS', en: 'COMPLIANT WITH WARNINGS', it: 'CONFORME CON AVVISI', es: 'CONFORME CON ADVERTENCIAS' },
    'res.warnCount':      { fr: '{n} avertissement(s)', en: '{n} warning(s)', it: '{n} avvisi', es: '{n} advertencia(s)' },
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
    'console.reqBody':    { fr: 'Corps de la requête', en: 'Request body',    it: 'Corpo della richiesta', es: 'Cuerpo de la solicitud' },
    'console.resBody':    { fr: 'Réponse',            en: 'Response',         it: 'Risposta',         es: 'Respuesta' },
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
    'docs.source':        { fr: 'Source : unified-backoffice-api v1.11.17 — le back-end consomme cette API et expose les données au front.', en: 'Source: unified-backoffice-api v1.11.17 — the back-end consumes this API and exposes the data to the front end.', it: 'Fonte: unified-backoffice-api v1.11.17 — il back-end consuma questa API ed espone i dati al front-end.', es: 'Fuente: unified-backoffice-api v1.11.17 — el back-end consume esta API y expone los datos al front.' },
    'docs.openFull':      { fr: 'Ouvrir en plein écran', en: 'Open fullscreen', it: 'Apri a schermo intero', es: 'Abrir en pantalla completa' },
    'docs.tabFlux':       { fr: 'Flux & scénarios',    en: 'Flows & scenarios', it: 'Flussi e scenari',  es: 'Flujos y escenarios' },
    'docs.tabSwagger':    { fr: 'Swagger',             en: 'Swagger',          it: 'Swagger',          es: 'Swagger' },
    'docs.swaggerTitle':  { fr: 'Spécification OpenAPI', en: 'OpenAPI specification', it: 'Specifica OpenAPI', es: 'Especificación OpenAPI' },
    'docs.swaggerVersion':{ fr: 'Version :',           en: 'Version:',         it: 'Versione:',        es: 'Versión:' },
    'docs.swaggerIntro':  { fr: 'Vue en lecture seule de la spécification sélectionnée (endpoints, paramètres, schémas). Aucun appel n\'est effectué.', en: 'Read-only view of the selected specification (endpoints, parameters, schemas). No calls are made.', it: 'Vista in sola lettura della specifica selezionata (endpoint, parametri, schemi). Nessuna chiamata effettuata.', es: 'Vista de solo lectura de la especificación seleccionada (endpoints, parámetros, esquemas). No se realiza ninguna llamada.' },
    'docs.swaggerLoading':{ fr: 'Chargement…',         en: 'Loading…',         it: 'Caricamento…',     es: 'Cargando…' },
    'docs.swaggerError':  { fr: 'Impossible de charger les versions de spec.', en: 'Unable to load spec versions.', it: 'Impossibile caricare le versioni della spec.', es: 'No se pueden cargar las versiones de la spec.' },
    'docs.swaggerParseError': { fr: 'Impossible de charger cette spécification.', en: 'Unable to load this specification.', it: 'Impossibile caricare questa specifica.', es: 'No se puede cargar esta especificación.' },
    'docs.swaggerParams': { fr: 'Paramètres',          en: 'Parameters',       it: 'Parametri',        es: 'Parámetros' },
    'docs.swaggerBody':   { fr: 'Corps de la requête', en: 'Request body',     it: 'Corpo della richiesta', es: 'Cuerpo de la solicitud' },
    'docs.swaggerResponses': { fr: 'Réponses',         en: 'Responses',        it: 'Risposte',         es: 'Respuestas' },
    'docs.swaggerDeprecated': { fr: 'déprécié',        en: 'deprecated',       it: 'deprecato',        es: 'obsoleto' },
    'docs.swaggerNoDetail': { fr: 'Aucun détail supplémentaire.', en: 'No further details.', it: 'Nessun dettaglio aggiuntivo.', es: 'Sin detalles adicionales.' },
    'docs.swaggerCircular': { fr: 'référence circulaire', en: 'circular reference', it: 'riferimento circolare', es: 'referencia circular' },
    'docs.swaggerViewPretty': { fr: 'Vue simplifiée',  en: 'Simple view',      it: 'Vista semplificata', es: 'Vista simplificada' },
    'docs.swaggerViewJson': { fr: 'JSON',              en: 'JSON',             it: 'JSON',             es: 'JSON' },
    'docs.swaggerExample': { fr: 'Exemple',            en: 'Example',          it: 'Esempio',          es: 'Ejemplo' },
    'docs.swaggerCopy':   { fr: 'Copier',              en: 'Copy',             it: 'Copia',            es: 'Copiar' },
    'docs.swaggerCopied': { fr: 'Copié',               en: 'Copied',           it: 'Copiato',          es: 'Copiado' },
    'docs.legend':        { fr: 'Chaque bloc est une route backoffice. Flèche grise = séquence d\'appel. Flèche orange = donnée réinjectée dans l\'appel suivant.', en: 'Each block is a backoffice route. Grey arrow = call sequence. Orange arrow = data reinjected into the next call.', it: 'Ogni blocco è una route backoffice. Freccia grigia = sequenza di chiamata. Freccia arancione = dato reinserito nella chiamata successiva.', es: 'Cada bloque es una ruta backoffice. Flecha gris = secuencia de llamada. Flecha naranja = dato reinyectado en la siguiente llamada.' },
    'docs.scnTitle':      { fr: "Scénarios d'achat automatisés", en: 'Automated purchase scenarios', it: "Scenari di acquisto automatizzati", es: 'Escenarios de compra automatizados' },
    'docs.scnIntro':      { fr: "Les scénarios rejouent un parcours de vente complet (login ou création de compte, sélection d'offre, panier, checkout, paiement émulé EMULATEPAY). Les schémas ci-dessous (en anglais) détaillent la logique.", en: 'Scenarios replay a full sale journey (login or account creation, offer selection, cart, checkout, emulated EMULATEPAY payment). The diagrams below (in English) detail the logic.', it: 'Gli scenari rieseguono un percorso di vendita completo (login o creazione account, selezione offerta, carrello, checkout, pagamento emulato EMULATEPAY). I diagrammi sotto (in inglese) dettagliano la logica.', es: 'Los escenarios reproducen un recorrido de venta completo (login o creación de cuenta, selección de oferta, carrito, checkout, pago emulado EMULATEPAY). Los diagramas de abajo (en inglés) detallan la lógica.' },
    'docs.scnAuth':       { fr: "Ordre d'authentification (B2B vs B2C)", en: 'Authentication order (B2B vs B2C)', it: "Ordine di autenticazione (B2B vs B2C)", es: 'Orden de autenticación (B2B vs B2C)' },
    'docs.scnTypes':      { fr: "Typologies d'offre (5 modes)", en: 'Offer types (5 modes)', it: "Tipologie di offerta (5 modalità)", es: 'Tipos de oferta (5 modos)' },
    'docs.scnCycle':      { fr: "Cycle d'achat & chaînage de données", en: 'Purchase cycle & data chaining', it: "Ciclo di acquisto e concatenamento dei dati", es: 'Ciclo de compra y encadenamiento de datos' },

    // ── Interactions communes ───────────────────────────────────────
    'common.error':       { fr: 'Erreur',             en: 'Error',            it: 'Errore',           es: 'Error' },
    'common.confirm':     { fr: 'Confirmation',       en: 'Confirmation',     it: 'Conferma',         es: 'Confirmación' },
    'common.yes':         { fr: 'Oui',                en: 'Yes',              it: 'Sì',               es: 'Sí' },
    'common.no':          { fr: 'Non',                en: 'No',               it: 'No',               es: 'No' },
    'common.yesContinue': { fr: 'Oui, continuer',     en: 'Yes, continue',    it: 'Sì, continua',     es: 'Sí, continuar' },
    'common.cancel':      { fr: 'Non, annuler',       en: 'No, cancel',       it: 'No, annulla',      es: 'No, cancelar' },
    'env.mismatchTitle':  { fr: "Vérification de l'environnement", en: 'Environment check', it: "Verifica dell'ambiente", es: 'Verificación del entorno' },
    'env.mismatchMsg':    { fr: "L'URL ne semble pas correspondre à la typologie. Confirmez-vous que l'URL « {url} » est bien de type « {env} » ?", en: 'The URL does not seem to match the type. Do you confirm that the URL "{url}" is indeed of type "{env}"?', it: "L'URL non sembra corrispondere alla tipologia. Confermi che l'URL «{url}» sia di tipo «{env}»?", es: 'La URL no parece corresponder a la tipología. ¿Confirma que la URL «{url}» es del tipo «{env}»?' },
    'env.saleWarnTitle':  { fr: 'Création de vente',  en: 'Sale creation',    it: 'Creazione vendita', es: 'Creación de venta' },
    'env.saleWarnMsg':    { fr: 'Attention, ce scénario va créer une vente en base de données. Êtes-vous sûr de vouloir continuer ?', en: 'Warning, this scenario will create a sale in the database. Are you sure you want to continue?', it: 'Attenzione, questo scenario creerà una vendita nel database. Sei sicuro di voler continuare?', es: 'Atención, este escenario creará una venta en la base de datos. ¿Seguro que desea continuar?' },

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
    'scn.sc.purchaseFull.label': { fr: 'Achat complet', en: 'Full purchase', it: 'Acquisto completo', es: 'Compra completa' },
    'scn.sc.purchaseFull.desc':  { fr: "Depuis une famille de regroupement : offre → produit → connexion → panier → checkout → paiement émulé → commande. Cochez « Créer un compte » pour générer un nouveau compte au lieu de vous connecter.", en: 'From a grouping family: offer → product → sign-in → cart → checkout → emulated payment → order. Tick "Create an account" to generate a new account instead of signing in.', it: 'Da una famiglia di raggruppamento: offerta → prodotto → accesso → carrello → checkout → pagamento emulato → ordine. Seleziona «Crea un account» per generare un nuovo account invece di accedere.', es: 'Desde una familia de agrupación: oferta → producto → conexión → carrito → checkout → pago emulado → pedido. Marque «Crear una cuenta» para generar una cuenta nueva en lugar de conectarse.' },
    'scn.sc.purchaseProduct.label': { fr: 'Achat produit (familyCode fourni)', en: 'Product purchase (familyCode provided)', it: 'Acquisto prodotto (familyCode fornito)', es: 'Compra de producto (familyCode proporcionado)' },
    'scn.sc.purchaseProduct.desc':  { fr: "À partir d'un code famille fourni : offre → produit → connexion → panier → checkout → paiement émulé → commande. Cochez « Créer un compte » pour générer un nouveau compte au lieu de vous connecter.", en: 'From a provided family code: offer → product → sign-in → cart → checkout → emulated payment → order. Tick "Create an account" to generate a new account instead of signing in.', it: 'Da un codice famiglia fornito: offerta → prodotto → accesso → carrello → checkout → pagamento emulato → ordine. Seleziona «Crea un account» per generare un nuovo account invece di accedere.', es: 'A partir de un código de familia proporcionado: oferta → producto → conexión → carrito → checkout → pago emulado → pedido. Marque «Crear una cuenta» para generar una cuenta nueva en lugar de conectarse.' },
    'scn.sc.cartFull.label': { fr: 'Panier seul', en: 'Cart only', it: 'Solo carrello', es: 'Solo carrito' },
    'scn.sc.cartFull.desc':  { fr: "Depuis une famille de regroupement : offre → produit → connexion → vérification du panier (checkCart). Aucune vente créée. Cochez « Créer un compte » pour générer un nouveau compte au lieu de vous connecter.", en: 'From a grouping family: offer → product → sign-in → cart check (checkCart). No sale created. Tick "Create an account" to generate a new account instead of signing in.', it: 'Da una famiglia di raggruppamento: offerta → prodotto → accesso → verifica del carrello (checkCart). Nessuna vendita creata. Seleziona «Crea un account» per generare un nuovo account invece di accedere.', es: 'Desde una familia de agrupación: oferta → producto → conexión → verificación del carrito (checkCart). Ninguna venta creada. Marque «Crear una cuenta» para generar una cuenta nueva en lugar de conectarse.' },
    'scn.sc.cartProduct.label': { fr: 'Panier seul (familyCode fourni)', en: 'Cart only (familyCode provided)', it: 'Solo carrello (familyCode fornito)', es: 'Solo carrito (familyCode proporcionado)' },
    'scn.sc.cartProduct.desc':  { fr: "À partir d'un code famille fourni : offre → produit → connexion → vérification du panier (checkCart). Aucune vente créée. Cochez « Créer un compte » pour générer un nouveau compte au lieu de vous connecter.", en: 'From a provided family code: offer → product → sign-in → cart check (checkCart). No sale created. Tick "Create an account" to generate a new account instead of signing in.', it: 'Da un codice famiglia fornito: offerta → prodotto → accesso → verifica del carrello (checkCart). Nessuna vendita creata. Seleziona «Crea un account» per generare un nuovo account invece di accedere.', es: 'A partir de un código de familia proporcionado: oferta → producto → conexión → verificación del carrito (checkCart). Ninguna venta creada. Marque «Crear una cuenta» para generar una cuenta nueva en lugar de conectarse.' },
    'scn.sf.createAccount':   { fr: 'Créer un compte (sinon login du compte existant)', en: 'Create an account (otherwise sign in with existing account)', it: 'Crea un account (altrimenti accedi con l\'account esistente)', es: 'Crear una cuenta (si no, login con la cuenta existente)' },
    'scn.sf.usernameExisting': { fr: 'Identifiant (compte existant)', en: 'Username (existing account)', it: 'Nome utente (account esistente)', es: 'Usuario (cuenta existente)' },
    'scn.sf.passwordExisting': { fr: 'Mot de passe (compte existant)', en: 'Password (existing account)', it: 'Password (account esistente)', es: 'Contraseña (cuenta existente)' },
    'scn.sf.removeCart':      { fr: 'Supprimer le panier à la fin', en: 'Delete the cart at the end', it: 'Elimina il carrello alla fine', es: 'Eliminar el carrito al final' },
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
    'scn.noFamily':       { fr: 'Aucune famille trouvée.', en: 'No family found.', it: 'Nessuna famiglia trovata.', es: 'Ninguna familia encontrada.' },
    'scn.resolveCalls':   { fr: 'Résolution ({n} appel(s))', en: 'Resolution ({n} call(s))', it: 'Risoluzione ({n} chiamate)', es: 'Resolución ({n} llamada(s))' },
    'scn.httpCalls':      { fr: 'requêtes HTTP', en: 'HTTP requests', it: 'richieste HTTP', es: 'solicitudes HTTP' },
    'hist.title':         { fr: 'Derniers tests', en: 'Recent tests', it: 'Ultimi test', es: 'Últimas pruebas' },
    'hist.exportAll':     { fr: 'Tout exporter', en: 'Export all', it: 'Esporta tutto', es: 'Exportar todo' },
    'hist.import':        { fr: 'Importer', en: 'Import', it: 'Importa', es: 'Importar' },
    'hist.clear':         { fr: 'Effacer', en: 'Clear', it: 'Cancella', es: 'Borrar' },
    'hist.load':          { fr: 'Recharger ce test', en: 'Reload this test', it: 'Ricarica questo test', es: 'Recargar esta prueba' },
    'hist.exportOne':     { fr: 'Exporter ce test', en: 'Export this test', it: 'Esporta questo test', es: 'Exportar esta prueba' },
    'hist.empty':         { fr: 'Aucun test à exporter.', en: 'No test to export.', it: 'Nessun test da esportare.', es: 'Ninguna prueba para exportar.' },
    'hist.importNone':    { fr: 'Aucun test valide trouvé dans le fichier.', en: 'No valid test found in the file.', it: 'Nessun test valido nel file.', es: 'Ninguna prueba válida en el archivo.' },
    'hist.importOk':      { fr: '{n} test(s) importé(s).', en: '{n} test(s) imported.', it: '{n} test importati.', es: '{n} prueba(s) importada(s).' },
    'hist.importErr':     { fr: 'Fichier JSON invalide.', en: 'Invalid JSON file.', it: 'File JSON non valido.', es: 'Archivo JSON no válido.' },
    'hist.none':          { fr: 'Aucun test pour cette cible. Lancez un scénario ou importez des tests.', en: 'No test for this target. Run a scenario or import tests.', it: 'Nessun test per questa destinazione. Esegui uno scenario o importa test.', es: 'Ninguna prueba para este destino. Ejecute un escenario o importe pruebas.' },
    'fav.title':          { fr: 'Favoris', en: 'Favorites', it: 'Preferiti', es: 'Favoritos' },
    'fav.toggle':         { fr: 'Ajouter / retirer des favoris', en: 'Add / remove from favorites', it: 'Aggiungi / rimuovi dai preferiti', es: 'Añadir / quitar de favoritos' },
    'fav.load':           { fr: 'Charger ce favori', en: 'Load this favorite', it: 'Carica questo preferito', es: 'Cargar este favorito' },
    'fav.remove':         { fr: 'Retirer des favoris', en: 'Remove from favorites', it: 'Rimuovi dai preferiti', es: 'Quitar de favoritos' },
    'fav.max':            { fr: 'Maximum {n} favoris. Retirez-en un d’abord.', en: 'Maximum {n} favorites. Remove one first.', it: 'Massimo {n} preferiti. Rimuovine uno prima.', es: 'Máximo {n} favoritos. Quite uno primero.' },
    'scn.noOfferAny':     { fr: 'Aucune offre trouvée dans les familles explorées.', en: 'No offer found in the explored families.', it: 'Nessuna offerta trovata nelle famiglie esplorate.', es: 'Ninguna oferta encontrada en las familias exploradas.' },
    'scn.typeNotFoundAny':{ fr: 'Aucune offre de type « {type} » trouvée dans les familles explorées.', en: 'No offer of type "{type}" found in the explored families.', it: 'Nessuna offerta di tipo «{type}» trovata nelle famiglie esplorate.', es: 'Ninguna oferta de tipo «{type}» encontrada en las familias exploradas.' },
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
  window.I18n = { t, setLang, getLang: () => currentLang, apply, buildSelectors, SUPPORTED, LANG_LABELS };
})();
