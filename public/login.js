/*
 * login.js — Écran de connexion / sélection de profil (modale partagée).
 *
 * S'appuie sur window.Auth (auth.js). Gère :
 *  - l'initialisation au 1er lancement (définir le mot de passe superadmin + question secrète) ;
 *  - la connexion à un profil (mot de passe) ;
 *  - la récupération du mot de passe superadmin via la question secrète ;
 *  - le changement de profil (re-saisie du mot de passe).
 *
 * Expose window.Login : { open(opts), close(), ensureAuth(), onChange(cb) }.
 * Les libellés utilisent tr() si présent (i18n), avec repli FR.
 */
(function () {
  'use strict';

  const T = (k, fb, v) => (typeof window.tr === 'function' ? window.tr(k, fb, v) : (() => {
    let s = fb; if (v) for (const [kk, vv] of Object.entries(v)) s = s.replace(new RegExp('\\{' + kk + '\\}', 'g'), String(vv)); return s;
  })());

  const PROFILE_LABELS = {
    superadmin: () => T('prof.superadmin', 'Super admin'),
    subadmin:   () => T('prof.subadmin', 'Sous admin'),
    dev:        () => T('prof.dev', 'Développeur'),
    qa:         () => T('prof.qa', 'QA'),
    support:    () => T('prof.support', 'Support'),
  };

  const SECURITY_QUESTIONS = [
    () => T('sec.q1', 'Quel était le nom de votre premier animal de compagnie ?'),
    () => T('sec.q2', 'Quelle est votre ville de naissance ?'),
    () => T('sec.q3', 'Quel est le nom de jeune fille de votre mère ?'),
    () => T('sec.q4', 'Quel était le nom de votre école primaire ?'),
  ];

  let overlay = null;
  const changeCallbacks = [];

  function onChange(cb) { if (typeof cb === 'function') changeCallbacks.push(cb); }
  function emitChange() { const p = window.Auth.getCurrentProfile(); changeCallbacks.forEach(cb => { try { cb(p); } catch { /* ignore */ } }); }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'loginOverlay';
    overlay.className = 'fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[70] hidden flex items-center justify-center p-4';
    overlay.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-700 flex items-center gap-3">
          <i class="fa-solid fa-user-shield text-indigo-400 text-lg"></i>
          <h3 id="loginTitle" class="text-sm font-semibold text-slate-100"></h3>
        </div>
        <div id="loginBody" class="px-6 py-5 space-y-3 text-sm text-slate-300"></div>
        <div class="bg-slate-800/50 px-6 py-3 border-t border-slate-700/80 flex justify-between gap-2">
          <button type="button" id="loginBackBtn" class="hidden px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition"></button>
          <div class="flex gap-2 ml-auto">
            <button type="button" id="loginCancelBtn" class="hidden px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition"></button>
            <button type="button" id="loginOkBtn" class="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500 transition"></button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  const els = () => ({
    body: document.getElementById('loginBody'),
    title: document.getElementById('loginTitle'),
    ok: document.getElementById('loginOkBtn'),
    cancel: document.getElementById('loginCancelBtn'),
    back: document.getElementById('loginBackBtn'),
  });

  function show() { ensureOverlay().classList.remove('hidden'); }
  function close() { if (overlay) overlay.classList.add('hidden'); }

  function err(msg) {
    const e = document.getElementById('loginError');
    if (e) { e.textContent = msg; e.classList.remove('hidden'); }
  }

  // ── Vue : initialisation du superadmin (1er lancement) ────────────────────
  function viewInit() {
    const { body, title, ok, cancel, back } = els();
    title.textContent = T('login.initTitle', 'Première configuration — Super admin');
    cancel.classList.add('hidden'); back.classList.add('hidden');
    ok.textContent = T('login.create', 'Créer');
    const qOpts = SECURITY_QUESTIONS.map((q, i) => `<option value="${i}">${q()}</option>`).join('');
    body.innerHTML = `
      <p class="text-xs text-slate-400">${T('login.initIntro', 'Aucune configuration trouvée. Définissez le mot de passe super admin et une question de récupération.')}</p>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] font-semibold text-slate-300">${T('login.password', 'Mot de passe')}</label>
        <input type="password" id="initPwd" class="bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] font-semibold text-slate-300">${T('login.passwordConfirm', 'Confirmer le mot de passe')}</label>
        <input type="password" id="initPwd2" class="bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] font-semibold text-slate-300">${T('login.secQuestion', 'Question de récupération')}</label>
        <select id="initQ" class="bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">${qOpts}</select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] font-semibold text-slate-300">${T('login.secAnswer', 'Réponse')}</label>
        <input type="text" id="initA" class="bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">
      </div>
      <p id="loginError" class="hidden text-[11px] text-rose-400"></p>`;
    ok.onclick = async () => {
      const p1 = document.getElementById('initPwd').value;
      const p2 = document.getElementById('initPwd2').value;
      const q = SECURITY_QUESTIONS[Number(document.getElementById('initQ').value)]();
      const a = document.getElementById('initA').value;
      if (!p1 || p1.length < 4) return err(T('login.errPwdShort', 'Mot de passe trop court (min. 4 caractères).'));
      if (p1 !== p2) return err(T('login.errPwdMatch', 'Les mots de passe ne correspondent pas.'));
      if (!a.trim()) return err(T('login.errAnswer', 'Renseignez la réponse à la question.'));
      await window.Auth.initSuperadmin(p1, q, a);
      await window.Auth.login('superadmin', p1);
      close(); emitChange();
    };
  }

  // ── Vue : connexion (choix du profil + mot de passe) ──────────────────────
  function viewLogin(preselect) {
    const { body, title, ok, cancel, back } = els();
    title.textContent = T('login.title', 'Connexion');
    ok.textContent = T('login.connect', 'Se connecter');
    cancel.classList.toggle('hidden', !window.Auth.getCurrentProfile()); // annulable seulement si déjà connecté
    cancel.textContent = T('common.cancel2', 'Annuler');
    cancel.onclick = () => close();
    back.classList.add('hidden');
    const profOpts = window.Auth.PROFILES.map(p => `<option value="${p}" ${p === preselect ? 'selected' : ''}>${PROFILE_LABELS[p]()}</option>`).join('');
    body.innerHTML = `
      <div class="flex flex-col gap-1">
        <label class="text-[11px] font-semibold text-slate-300">${T('login.profile', 'Profil')}</label>
        <select id="loginProfile" class="bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">${profOpts}</select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] font-semibold text-slate-300">${T('login.password', 'Mot de passe')}</label>
        <input type="password" id="loginPwd" class="bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">
      </div>
      <p id="loginError" class="hidden text-[11px] text-rose-400"></p>
      <button type="button" id="loginForgot" class="text-[11px] text-indigo-400 hover:text-indigo-300 transition">${T('login.forgot', 'Mot de passe oublié ?')}</button>`;
    const pwdInput = document.getElementById('loginPwd');
    pwdInput.addEventListener('keydown', e => { if (e.key === 'Enter') ok.click(); });
    document.getElementById('loginForgot').onclick = () => viewRecover(document.getElementById('loginProfile').value);
    ok.onclick = async () => {
      const profile = document.getElementById('loginProfile').value;
      const pwd = pwdInput.value;
      const okLogin = await window.Auth.login(profile, pwd);
      if (!okLogin) return err(T('login.errBadPwd', 'Mot de passe incorrect.'));
      close(); emitChange();
    };
  }

  // ── Vue : récupération (question secrète) ─────────────────────────────────
  function viewRecover(profile) {
    const { body, title, ok, back, cancel } = els();
    const question = window.Auth.getSecurityQuestion(profile);
    title.textContent = T('login.recoverTitle', 'Récupération du mot de passe');
    cancel.classList.add('hidden');
    back.classList.remove('hidden');
    back.textContent = T('common.back', 'Retour');
    back.onclick = () => viewLogin(profile);
    if (!question) {
      ok.textContent = T('common.ok', 'OK');
      body.innerHTML = `<p class="text-xs text-amber-400">${T('login.noRecover', 'Aucune question de récupération pour ce profil. Contactez un super admin.')}</p>`;
      ok.onclick = () => viewLogin(profile);
      return;
    }
    ok.textContent = T('login.reset', 'Réinitialiser');
    body.innerHTML = `
      <div class="flex flex-col gap-1">
        <label class="text-[11px] font-semibold text-slate-300">${question}</label>
        <input type="text" id="recA" class="bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] font-semibold text-slate-300">${T('login.newPassword', 'Nouveau mot de passe')}</label>
        <input type="password" id="recP" class="bg-slate-800 border border-slate-600 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">
      </div>
      <p id="loginError" class="hidden text-[11px] text-rose-400"></p>`;
    ok.onclick = async () => {
      const a = document.getElementById('recA').value;
      const np = document.getElementById('recP').value;
      if (!(await window.Auth.verifySecurityAnswer(profile, a))) return err(T('login.errAnswerWrong', 'Réponse incorrecte.'));
      if (!np || np.length < 4) return err(T('login.errPwdShort', 'Mot de passe trop court (min. 4 caractères).'));
      await window.Auth.resetPassword(profile, np);
      await window.Auth.login(profile, np);
      close(); emitChange();
    };
  }

  // ── API publique ───────────────────────────────────────────────────────────
  function open(opts) {
    opts = opts || {};
    ensureOverlay();
    show();
    if (!window.Auth.hasConfig()) viewInit();
    else viewLogin(opts.preselect || window.Auth.getCurrentProfile() || 'support');
  }

  // S'assure qu'un profil est actif : sinon ouvre l'écran (init ou connexion).
  function ensureAuth() {
    if (window.Auth.getCurrentProfile()) { emitChange(); return true; }
    open();
    return false;
  }

  window.Login = { open, close, ensureAuth, onChange };
})();
