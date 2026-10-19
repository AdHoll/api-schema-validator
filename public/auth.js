/*
 * auth.js — Gestion des profils et droits (garde-fou côté client).
 *
 * ⚠️ PORTÉE : il s'agit d'un contrôle d'accès CÔTÉ NAVIGATEUR, donc CONTOURNABLE par une
 * personne technique (console, localStorage). C'est un garde-fou d'usage (éviter les erreurs),
 * PAS une sécurité forte. Pour une vraie sécurité, il faudrait une authentification serveur.
 *
 * Module partagé par toutes les pages (index, status, docs, admin). Expose `window.Auth`.
 *
 * Profils :
 *  - superadmin : tout + gestion des mots de passe + cibles prod + import/export
 *  - subadmin   : tout sauf mots de passe des profils et cibles prod ; import/export OK
 *  - dev / qa / support : accès restreint selon la matrice de droits
 *
 * Config (localStorage 'vivapi_config_v1'), structure :
 * {
 *   schema: 1,
 *   profiles: {
 *     superadmin: { passwordHash, securityQuestion, securityAnswerHash },
 *     subadmin:   { passwordHash } | null,
 *     dev/qa/support: { passwordHash } | null
 *   },
 *   permissions: {           // uniquement pour les profils restreignables
 *     dev:     { specs:[], routes:[], scenarios:[], environments:[] },
 *     qa:      { ... },
 *     support: { ... }
 *   },
 *   targets: [ { id, label, url, clientId, scope, env } ]   // AUCUN secret
 * }
 */
(function () {
  'use strict';

  const CONFIG_KEY = 'vivapi_config_v1';
  const SESSION_KEY = 'vivapi_profile';   // profil courant (localStorage, daté)
  const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;   // 30 jours

  const PROFILES = ['superadmin', 'subadmin', 'dev', 'qa', 'support'];
  const RESTRICTABLE = ['dev', 'qa', 'support'];        // profils filtrés par la matrice
  const ADMIN_PROFILES = ['superadmin', 'subadmin'];    // accès total + page Admin + import/export
  const PERM_FAMILIES = ['specs', 'routes', 'scenarios', 'environments'];

  // Catalogues statiques partagés (ids stables) — pour la matrice de la page Admin et les filtres.
  const ENVIRONMENTS = [
    { id: 'dev', label: 'Développement' },
    { id: 'preprod', label: 'Pré-production' },
    { id: 'prod', label: 'Production' },
  ];
  // Scénarios : doivent correspondre aux id de TEST_SCENARIOS (index.html).
  const SCENARIOS = [
    { id: 'purchase-full', label: 'Achat complet' },
    { id: 'purchase-product', label: 'Achat produit (familyCode)' },
    { id: 'cart-full', label: 'Panier seul' },
    { id: 'cart-product', label: 'Panier seul (familyCode)' },
    { id: 'catalog-family-to-product', label: 'Catalogue : Famille parente → Produit' },
    { id: 'purchase-flow', label: "Parcours d'achat catalogue" },
    { id: 'account-orders', label: 'Compte & commandes (login)' },
  ];

  // ── Hachage SHA-256 (hex) via WebCrypto ──────────────────────────────────
  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── Lecture / écriture de la config ──────────────────────────────────────
  function getConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function saveConfig(cfg) {
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); return true; }
    catch { return false; }
  }

  function hasConfig() {
    const c = getConfig();
    return !!(c && c.profiles && c.profiles.superadmin && c.profiles.superadmin.passwordHash);
  }

  // Config vierge (avant toute initialisation).
  function emptyConfig() {
    return {
      schema: 1,
      profiles: { superadmin: null, subadmin: null, dev: null, qa: null, support: null },
      permissions: {
        dev:     { specs: [], routes: [], scenarios: [], environments: [] },
        qa:      { specs: [], routes: [], scenarios: [], environments: [] },
        support: { specs: [], routes: [], scenarios: [], environments: [] },
      },
      targets: [],
    };
  }

  // Normalise une config importée/existante (complète les champs manquants).
  function normalizeConfig(cfg) {
    const base = emptyConfig();
    if (!cfg || typeof cfg !== 'object') return base;
    base.schema = cfg.schema || 1;
    if (cfg.profiles) PROFILES.forEach(p => { if (cfg.profiles[p]) base.profiles[p] = cfg.profiles[p]; });
    if (cfg.permissions) RESTRICTABLE.forEach(p => {
      if (cfg.permissions[p]) PERM_FAMILIES.forEach(f => {
        if (Array.isArray(cfg.permissions[p][f])) base.permissions[p][f] = cfg.permissions[p][f].slice();
      });
    });
    if (Array.isArray(cfg.targets)) base.targets = cfg.targets.filter(t => t && t.url).map(t => ({
      id: t.id || `tgt-${Math.random().toString(36).slice(2, 8)}`,
      label: t.label || t.url, url: t.url, clientId: t.clientId || '', scope: t.scope || 'b2c', env: t.env || 'dev',
    }));
    return base;
  }

  // ── Initialisation (1er lancement) : définir le superadmin ───────────────
  async function initSuperadmin(password, securityQuestion, securityAnswer) {
    const cfg = getConfig() || emptyConfig();
    cfg.profiles.superadmin = {
      passwordHash: await sha256(password),
      securityQuestion: String(securityQuestion || ''),
      securityAnswerHash: await sha256(String(securityAnswer || '').trim().toLowerCase()),
    };
    saveConfig(cfg);
    return true;
  }

  // ── Connexion ────────────────────────────────────────────────────────────
  // Renvoie true si le mot de passe correspond au profil. Les profils restreignables
  // SANS mot de passe défini sont considérés "ouverts" (connexion sans mot de passe).
  async function login(profile, password) {
    const cfg = getConfig();
    if (!cfg || !PROFILES.includes(profile)) return false;
    const entry = cfg.profiles[profile];
    if (!entry || !entry.passwordHash) {
      // Pas de mot de passe défini pour ce profil : autorisé seulement s'il est restreignable.
      if (!RESTRICTABLE.includes(profile)) return false;
      setCurrentProfile(profile);
      return true;
    }
    const ok = (await sha256(password)) === entry.passwordHash;
    if (ok) setCurrentProfile(profile);
    return ok;
  }

  function logout() {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }

  // La session est persistée dans localStorage avec une date d'expiration (30 jours).
  // Format : { profile, exp } (exp = timestamp ms). Au-delà, la connexion est oubliée.
  // On écrit AUSSI une copie simple en sessionStorage (compat ascendante / robustesse cache).
  function getCurrentProfile() {
    // 1) Source principale : localStorage daté.
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        // Nouveau format { profile, exp }.
        try {
          const data = JSON.parse(raw);
          if (data && data.profile && typeof data.exp === 'number') {
            if (Date.now() < data.exp) return data.profile;
            localStorage.removeItem(SESSION_KEY);   // expirée
            return null;
          }
        } catch { /* pas du JSON → ancien format "profil" en clair */ }
        // Ancien format : valeur = l'id de profil en clair.
        if (typeof raw === 'string' && raw.indexOf('{') !== 0) return raw;
      }
    } catch { /* ignore */ }
    // 2) Repli : session simple (sessionStorage), posée par une éventuelle ancienne version.
    try {
      const s = sessionStorage.getItem(SESSION_KEY);
      if (s) {
        try { const d = JSON.parse(s); if (d && d.profile) return d.profile; } catch { /* valeur en clair */ }
        if (s.indexOf('{') !== 0) return s;
      }
    } catch { /* ignore */ }
    return null;
  }
  function setCurrentProfile(p) {
    const payload = JSON.stringify({ profile: p, exp: Date.now() + SESSION_TTL_MS });
    // localStorage = source durable (30 jours). sessionStorage = miroir pour robustesse.
    try { localStorage.setItem(SESSION_KEY, payload); } catch { /* ignore */ }
    try { sessionStorage.setItem(SESSION_KEY, payload); } catch { /* ignore */ }
  }

  // ── Récupération de mot de passe (question secrète, superadmin) ──────────
  function getSecurityQuestion(profile) {
    const cfg = getConfig();
    return cfg?.profiles?.[profile]?.securityQuestion || null;
  }
  async function verifySecurityAnswer(profile, answer) {
    const cfg = getConfig();
    const entry = cfg?.profiles?.[profile];
    if (!entry || !entry.securityAnswerHash) return false;
    return (await sha256(String(answer || '').trim().toLowerCase())) === entry.securityAnswerHash;
  }
  async function resetPassword(profile, newPassword) {
    const cfg = getConfig();
    if (!cfg || !cfg.profiles[profile]) return false;
    cfg.profiles[profile].passwordHash = await sha256(newPassword);
    return saveConfig(cfg);
  }
  // Définit/mofifie le mot de passe d'un profil (réservé superadmin côté UI).
  async function setProfilePassword(profile, password) {
    const cfg = getConfig() || emptyConfig();
    const prev = cfg.profiles[profile] || {};
    cfg.profiles[profile] = { ...prev, passwordHash: password ? await sha256(password) : null };
    return saveConfig(cfg);
  }
  // Indique si un profil a un mot de passe défini.
  function hasPassword(profile) {
    const cfg = getConfig();
    return !!(cfg && cfg.profiles && cfg.profiles[profile] && cfg.profiles[profile].passwordHash);
  }

  // ── Droits ────────────────────────────────────────────────────────────────
  function isAdmin(profile) { return ADMIN_PROFILES.includes(profile || getCurrentProfile()); }
  function isSuperadmin(profile) { return (profile || getCurrentProfile()) === 'superadmin'; }
  function isRestrictable(profile) { return RESTRICTABLE.includes(profile || getCurrentProfile()); }

  // L'élément `id` de la famille (`specs`/`routes`/`scenarios`/`environments`) est-il autorisé
  // pour le profil courant ? Admins → tout autorisé. Restreignables → présent dans la liste.
  function isAllowed(family, id, profile) {
    const p = profile || getCurrentProfile();
    if (!p) return false;
    if (ADMIN_PROFILES.includes(p)) return true;
    const cfg = getConfig();
    const list = cfg?.permissions?.[p]?.[family];
    return Array.isArray(list) && list.includes(id);
  }

  // Liste des ids autorisés d'une famille pour le profil courant (null = tout autorisé/admin).
  function allowedList(family, profile) {
    const p = profile || getCurrentProfile();
    if (!p) return [];
    if (ADMIN_PROFILES.includes(p)) return null;   // null = pas de restriction
    const cfg = getConfig();
    return (cfg?.permissions?.[p]?.[family]) || [];
  }

  // ── Import / export ────────────────────────────────────────────────────────
  function exportConfig() {
    const cfg = getConfig() || emptyConfig();
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vivapi-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function importConfig(parsed) {
    const cfg = normalizeConfig(parsed);
    return saveConfig(cfg) ? cfg : null;
  }

  // ── Écriture de la matrice de droits (page Admin) ──────────────────────────
  // Coche/décoche un id de famille pour un profil restreignable.
  function setPermission(profile, family, id, allowed) {
    if (!RESTRICTABLE.includes(profile) || !PERM_FAMILIES.includes(family)) return false;
    const cfg = getConfig() || emptyConfig();
    cfg.permissions[profile] = cfg.permissions[profile] || { specs: [], routes: [], scenarios: [], environments: [] };
    const set = new Set(cfg.permissions[profile][family] || []);
    if (allowed) set.add(id); else set.delete(id);
    cfg.permissions[profile][family] = [...set];
    return saveConfig(cfg);
  }
  function getPermission(profile, family, id) {
    const cfg = getConfig();
    const list = cfg?.permissions?.[profile]?.[family];
    return Array.isArray(list) && list.includes(id);
  }

  // ── Cibles (page Admin) ────────────────────────────────────────────────────
  function getTargets() { const c = getConfig(); return (c && Array.isArray(c.targets)) ? c.targets : []; }
  function addTarget(t) {
    const cfg = getConfig() || emptyConfig();
    cfg.targets = cfg.targets || [];
    cfg.targets.push({
      id: t.id || `tgt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      label: t.label || t.url, url: t.url, clientId: t.clientId || '', scope: t.scope || 'b2c', env: t.env || 'dev',
    });
    return saveConfig(cfg);
  }
  function removeTarget(id) {
    const cfg = getConfig(); if (!cfg) return false;
    cfg.targets = (cfg.targets || []).filter(t => t.id !== id);
    return saveConfig(cfg);
  }
  // Met à jour une cible existante (par id). `patch` = champs à modifier (label/url/clientId/scope/env).
  function updateTarget(id, patch) {
    const cfg = getConfig(); if (!cfg) return false;
    const idx = (cfg.targets || []).findIndex(t => t.id === id);
    if (idx < 0) return false;
    const prev = cfg.targets[idx];
    cfg.targets[idx] = {
      ...prev,
      label: patch.label != null ? patch.label : prev.label,
      url: patch.url != null ? patch.url : prev.url,
      clientId: patch.clientId != null ? patch.clientId : prev.clientId,
      scope: patch.scope != null ? patch.scope : prev.scope,
      env: patch.env != null ? patch.env : prev.env,
    };
    return saveConfig(cfg);
  }
  function getTarget(id) { return getTargets().find(t => t.id === id) || null; }

  window.Auth = {
    PROFILES, RESTRICTABLE, ADMIN_PROFILES, PERM_FAMILIES, ENVIRONMENTS, SCENARIOS,
    sha256,
    getConfig, saveConfig, hasConfig, emptyConfig, normalizeConfig,
    initSuperadmin, login, logout, getCurrentProfile, setCurrentProfile,
    getSecurityQuestion, verifySecurityAnswer, resetPassword, setProfilePassword, hasPassword,
    isAdmin, isSuperadmin, isRestrictable, isAllowed, allowedList,
    setPermission, getPermission, getTargets, getTarget, addTarget, updateTarget, removeTarget,
    exportConfig, importConfig,
  };
})();
