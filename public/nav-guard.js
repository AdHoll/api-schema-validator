/*
 * nav-guard.js — Garde d'accès léger pour les pages secondaires (status, docs).
 *
 * - Ajoute dynamiquement l'onglet "Administration" dans la barre d'onglets si le profil
 *   courant est admin (super/sous).
 * - Sur une page PROTÉGÉE (data-requires-auth sur <body>), force la connexion : si aucun
 *   profil, ouvre la modale et grise le contenu principal (<main> ou le 1er conteneur).
 * - Documentation reste toujours accessible (pas de data-requires-auth).
 *
 * Dépend de window.Auth et window.Login.
 */
(function () {
  'use strict';
  const T = (k, fb) => (typeof window.tr === 'function' ? window.tr(k, fb) : fb);

  // Affiche l'onglet "Administration" UNIQUEMENT pour un profil admin (super/sous), et le
  // masque/retire sinon. Idempotent : peut être rappelé à chaque changement de profil.
  function injectAdminTab() {
    const validatorLink = document.querySelector('a[href="/index.html"]');
    const bar = validatorLink ? validatorLink.parentElement : null;
    if (!bar) return;
    const existing = bar.querySelector('a[href="/admin.html"]');
    const isAdmin = window.Auth.isAdmin();

    if (!isAdmin) {
      // Non-admin : masquer un onglet Admin présent en dur (admin.html) ou retirer celui injecté.
      if (existing) {
        if (existing.dataset.injected === '1') existing.remove();
        else existing.classList.add('hidden');
      }
      return;
    }
    // Admin : s'assurer que l'onglet est visible (en dur) ou l'injecter s'il manque.
    if (existing) { existing.classList.remove('hidden'); return; }
    const a = document.createElement('a');
    a.href = '/admin.html';
    a.dataset.injected = '1';
    a.className = 'px-3.5 py-1.5 rounded-md transition text-slate-400 hover:text-slate-200';
    a.innerHTML = `<i class="fa-solid fa-user-gear mr-1.5"></i> <span>${T('nav.admin', 'Administration')}</span>`;
    bar.appendChild(a);
  }

  function applyGuard() {
    const requiresAuth = document.body.hasAttribute('data-requires-auth');
    const profile = window.Auth.getCurrentProfile();
    if (!requiresAuth) return;   // page libre (documentation)
    const guarded = document.querySelectorAll('[data-guarded]');
    const blocked = !profile;
    guarded.forEach(el => {
      el.classList.toggle('opacity-40', blocked);
      el.classList.toggle('pointer-events-none', blocked);
    });
    if (blocked && window.Login) window.Login.ensureAuth();
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectAdminTab();
    applyGuard();
    if (window.Login) window.Login.onChange(() => { injectAdminTab(); applyGuard(); });
  });
})();
