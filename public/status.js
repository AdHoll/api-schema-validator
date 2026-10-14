// ============================================================
// Page "Statut des APIs" — logique client
// ============================================================

const ALL_TAGS = ['Prod', 'Préprod', 'QA', 'Dev', 'Demo'];
const TAG_COLORS = {
  'Prod':    'bg-rose-950/60 border-rose-700 text-rose-300',
  'Préprod': 'bg-amber-950/60 border-amber-700 text-amber-300',
  'QA':      'bg-violet-950/60 border-violet-700 text-violet-300',
  'Dev':     'bg-sky-950/60 border-sky-700 text-sky-300',
  'Demo':    'bg-emerald-950/60 border-emerald-700 text-emerald-300',
};

let targets = [];           // liste des APIs (config)
let results = {};           // id → résultat du dernier test
let activeTagFilter = null; // tag sélectionné pour filtrer, null = tous
let editingId = null;       // id en cours d'édition (null = ajout)

// Éléments DOM
const vaultStatus = document.getElementById('vaultStatus');
const unlockForm = document.getElementById('unlockForm');
const masterPassword = document.getElementById('masterPassword');
const unlockBtn = document.getElementById('unlockBtn');
const lockBtn = document.getElementById('lockBtn');
const apiList = document.getElementById('apiList');
const tagFilters = document.getElementById('tagFilters');
const addApiBtn = document.getElementById('addApiBtn');
const testAllBtn = document.getElementById('testAllBtn');

// Modal API
const apiModal = document.getElementById('apiModal');
const apiModalTitle = document.getElementById('apiModalTitle');
const fLabel = document.getElementById('fLabel');
const fOwner = document.getElementById('fOwner');
const fCollection = document.getElementById('fCollection');
const fItemName = document.getElementById('fItemName');
const fScope = document.getElementById('fScope');
const fTag = document.getElementById('fTag');

// Modal détail
const detailModal = document.getElementById('detailModal');
const detailTitle = document.getElementById('detailTitle');
const detailBody = document.getElementById('detailBody');

// ── Coffre ───────────────────────────────────────────────────────────
async function refreshVaultStatus() {
  try {
    const res = await fetch('/api/status/vault-status');
    const data = await res.json();
    setVaultUI(data.unlocked);
  } catch { setVaultUI(false); }
}

// Helper i18n : utilise I18n.t si disponible, sinon retombe sur le libellé fourni.
// vars (optionnel) permet l'interpolation {clé} aussi bien via I18n.t que sur le fallback.
function tr(key, fallback, vars) {
  if (window.I18n && typeof window.I18n.t === 'function') return window.I18n.t(key, vars);
  let s = fallback;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v));
  return s;
}

function setVaultUI(unlocked) {
  if (unlocked) {
    vaultStatus.innerHTML = `<i class="fa-solid fa-lock-open text-emerald-400"></i> <span>${tr('bw.unlocked', 'Déverrouillé')}</span>`;
    vaultStatus.className = 'text-xs flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-700 bg-emerald-950/40 text-emerald-300';
    unlockBtn.classList.add('hidden');
    lockBtn.classList.remove('hidden');
    masterPassword.value = '';
  } else {
    vaultStatus.innerHTML = `<i class="fa-solid fa-lock text-rose-400"></i> <span>${tr('bw.locked', 'Verrouillé')}</span>`;
    vaultStatus.className = 'text-xs flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/60 text-slate-400';
    unlockBtn.classList.remove('hidden');
    lockBtn.classList.add('hidden');
  }
}

unlockForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pwd = masterPassword.value;
  if (!pwd) return;
  unlockBtn.disabled = true;
  unlockBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${tr('bw.unlocking', 'Déverrouillage...')}`;
  try {
    const res = await fetch('/api/status/unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterPassword: pwd }),
    });
    const data = await res.json();
    masterPassword.value = ''; // on efface immédiatement
    if (!res.ok) throw new Error(data.error || tr('bw.unlockFailed', 'Déverrouillage échoué'));
    setVaultUI(true);
  } catch (err) {
    alert(tr('common.error', 'Erreur') + ' : ' + err.message);
  } finally {
    unlockBtn.disabled = false;
    unlockBtn.innerHTML = `<i class="fa-solid fa-unlock"></i> ${tr('bw.unlock', 'Déverrouiller')}`;
  }
});

lockBtn.addEventListener('click', async () => {
  await fetch('/api/status/lock', { method: 'POST' });
  setVaultUI(false);
});

// Ouvre un terminal PowerShell pour config serveur EU + login Bitwarden (interactif)
document.getElementById('loginTerminalBtn').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/status/open-login-terminal', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || tr('bw.terminalFailed', 'Échec'));
    alert(tr('bw.terminalOpened', 'Un terminal PowerShell s\'est ouvert.'));
  } catch (err) {
    alert(tr('common.error', 'Erreur') + ' : ' + err.message);
  }
});

// ── Config des cibles ────────────────────────────────────────────────
async function loadTargets() {
  try {
    const res = await fetch('/api/status/targets');
    const data = await res.json();
    targets = data.targets || [];
  } catch { targets = []; }
  renderTagFilters();
  renderApiList();
}

async function saveTargets() {
  await fetch('/api/status/targets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targets }),
  });
}

// ── Filtres par tag ──────────────────────────────────────────────────
function renderTagFilters() {
  const used = new Set();
  targets.forEach(t => (t.tags || []).forEach(tag => used.add(tag)));
  const tags = ALL_TAGS.filter(t => used.has(t));

  if (tags.length === 0) { tagFilters.innerHTML = ''; return; }

  tagFilters.innerHTML =
    `<span class="text-slate-400 font-medium mr-1"><i class="fa-solid fa-filter"></i> ${tr('api.filter', 'Filtrer :')}</span>` +
    `<button type="button" data-tag="" class="tag-filter px-3 py-1 rounded-lg border font-semibold transition ${activeTagFilter === null ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'}">${tr('api.all', 'Tous')}</button>` +
    tags.map(tag => {
      const active = activeTagFilter === tag;
      return `<button type="button" data-tag="${tag}" class="tag-filter px-3 py-1 rounded-lg border font-semibold transition ${active ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'}">
        ${tag} <button type="button" data-test-tag="${tag}" class="ml-1 text-[10px] opacity-70 hover:opacity-100" title="Tester les APIs ${tag}"><i class="fa-solid fa-play"></i></button>
      </button>`;
    }).join('');

  tagFilters.querySelectorAll('.tag-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Si on a cliqué sur le mini bouton "tester ce tag"
      const testTag = e.target.closest('[data-test-tag]');
      if (testTag) { e.stopPropagation(); runTests({ tags: [testTag.dataset.testTag] }); return; }
      const tag = btn.dataset.tag;
      activeTagFilter = tag === '' ? null : tag;
      renderTagFilters();
      renderApiList();
    });
  });
}

// ── Liste des APIs ───────────────────────────────────────────────────
function renderApiList() {
  const list = activeTagFilter
    ? targets.filter(t => (t.tags || []).includes(activeTagFilter))
    : targets;

  if (list.length === 0) {
    const suffix = activeTagFilter
      ? ` ${tr('api.emptyForTag', 'pour le tag')} ${activeTagFilter}`
      : ` ${tr('api.emptyConfigured', 'configurée')}`;
    apiList.innerHTML = `<div class="text-slate-500 italic text-center py-6">${tr('api.emptyBase', 'Aucune API')}${suffix}.</div>`;
    return;
  }

  apiList.innerHTML = list.map(t => {
    const r = results[t.id];
    const loading = r && r._loading;
    let dotHtml = '<span class="w-3 h-3 rounded-full flex-shrink-0 bg-slate-600"></span>';
    let info = `<span class="text-slate-500">${tr('api.notTested', 'Non testé')}</span>`, clickable = '';

    if (loading) {
      dotHtml = '<i class="fa-solid fa-spinner fa-spin text-indigo-400 w-3 flex-shrink-0"></i>';
      info = `<span class="text-indigo-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i>${tr('api.testing', 'Test en cours…')}</span>`;
    } else if (r) {
      const dot = r.ok ? 'bg-emerald-500' : 'bg-rose-500';
      const glow = r.ok ? '' : 'style="box-shadow:0 0 6px rgba(244,63,94,.6)"';
      dotHtml = `<span class="w-3 h-3 rounded-full flex-shrink-0 ${dot}" ${glow}></span>`;
      const code = r.statusCode != null ? `HTTP ${r.statusCode}` : tr('api.noResponse', 'Pas de réponse');
      info = `<span class="${r.ok ? 'text-emerald-400' : 'text-rose-400'} font-semibold">${code}</span>
              <span class="text-slate-500">· ${r.durationMs} ms</span>
              ${r.error ? `<span class="text-rose-400 italic ml-1" title="${r.error}">· ${r.error}</span>` : ''}`;
      clickable = 'cursor-pointer hover:bg-slate-800/60';
    }

    const tagsHtml = (t.tags || []).map(tag =>
      `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded border ${TAG_COLORS[tag] || 'bg-slate-800 border-slate-600 text-slate-300'}">${tag}</span>`
    ).join(' ');

    const disabledAttr = loading ? 'disabled' : '';
    const disabledCls = loading ? 'opacity-40 cursor-not-allowed' : '';

    return `
      <div class="bg-slate-900/70 border border-slate-700/60 rounded-lg transition ${clickable}" data-id="${t.id}">
        <div class="flex items-center gap-3 p-3" ${r && !loading ? `onclick="showDetail('${t.id}')"` : ''}>
          ${dotHtml}
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-slate-200 truncate">${t.label}</span>
              ${tagsHtml}
              <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-400">${t.scope}</span>
            </div>
            <div class="text-[11px] font-mono text-slate-500 truncate mt-0.5">
              <i class="fa-solid fa-key mr-1"></i>${t.bwItemName}${t.collection ? ' · ' + t.collection : ''}
            </div>
          </div>
          <div class="text-[11px] flex-shrink-0 text-right">${info}</div>
          <div class="flex items-center gap-1 flex-shrink-0" onclick="event.stopPropagation()">
            <button type="button" ${disabledAttr} onclick="runTests({ids:['${t.id}']})" class="w-7 h-7 rounded bg-slate-800 hover:bg-indigo-600 border border-slate-600 text-slate-300 hover:text-white transition text-[11px] ${disabledCls}" title="Tester"><i class="fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-play'}"></i></button>
            <button type="button" ${disabledAttr} onclick="editApi('${t.id}')" class="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 transition text-[11px] ${disabledCls}" title="Modifier"><i class="fa-solid fa-pen"></i></button>
            <button type="button" ${disabledAttr} onclick="deleteApi('${t.id}')" class="w-7 h-7 rounded bg-slate-800 hover:bg-rose-700 border border-slate-600 text-slate-300 hover:text-white transition text-[11px] ${disabledCls}" title="Supprimer"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── Tests ────────────────────────────────────────────────────────────
async function runTests(selector) {
  // selector = { ids: [...] } ou { tags: [...] } ou {} pour tout
  const res = await fetch('/api/status/vault-status');
  const vs = await res.json();
  if (!vs.unlocked) { alert(tr('api.vaultLockedFirst', 'Déverrouillez d\'abord le coffre Bitwarden.')); return; }

  // Marquer les lignes concernées "en cours"
  const concerned = selector.ids
    ? targets.filter(t => selector.ids.includes(t.id))
    : selector.tags
      ? targets.filter(t => (t.tags || []).some(tag => selector.tags.includes(tag)))
      : targets;
  concerned.forEach(t => { results[t.id] = { ...results[t.id], _loading: true }; });
  renderApiList();

  // Griser le bouton "Tout tester" pendant l'exécution
  const prevBtnHtml = testAllBtn.innerHTML;
  testAllBtn.disabled = true;
  testAllBtn.classList.add('opacity-40', 'cursor-not-allowed');
  testAllBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Test en cours…';

  try {
    const r = await fetch('/api/status/test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selector),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || tr('api.testError', 'Erreur de test'));
    (data.results || []).forEach(res => { results[res.id] = res; });
  } catch (err) {
    alert(tr('common.error', 'Erreur') + ' : ' + err.message);
  } finally {
    // Lever le flag de chargement sur les lignes restées en cours
    concerned.forEach(t => {
      if (results[t.id] && results[t.id]._loading) {
        results[t.id] = { ...results[t.id], _loading: false };
      }
    });
    testAllBtn.disabled = false;
    testAllBtn.classList.remove('opacity-40', 'cursor-not-allowed');
    testAllBtn.innerHTML = prevBtnHtml;
    renderApiList();
  }
}

testAllBtn.addEventListener('click', () => runTests({}));

// ── Détail de la réponse ─────────────────────────────────────────────
window.showDetail = function(id) {
  const t = targets.find(x => x.id === id);
  const r = results[id];
  if (!t || !r) return;
  detailTitle.textContent = `${t.label} — ${r.statusCode != null ? 'HTTP ' + r.statusCode : tr('api.noResponse', 'Pas de réponse')}`;
  detailBody.textContent = r.responseBody !== undefined
    ? JSON.stringify(r.responseBody, null, 2)
    : (r.error || tr('api.noResponseComment', '// Aucune réponse'));
  detailModal.classList.remove('hidden');
};
document.getElementById('closeDetailBtn').addEventListener('click', () => detailModal.classList.add('hidden'));
detailModal.addEventListener('click', (e) => { if (e.target === detailModal) detailModal.classList.add('hidden'); });

// ── CRUD des cibles ──────────────────────────────────────────────────
function openApiModal(target) {
  editingId = target?.id || null;
  apiModalTitle.textContent = target ? tr('api.editTitle', 'Modifier l\'API') : tr('apiModal.addTitle', 'Ajouter une API');
  fLabel.value = target?.label || '';
  fOwner.value = target?.owner || '';
  fCollection.value = target?.collection || '';
  fItemName.value = target?.bwItemName || '';
  fScope.value = target?.scope || 'b2c';
  fTag.value = (target?.tags && target.tags[0]) || 'Dev';
  apiModal.classList.remove('hidden');
}

addApiBtn.addEventListener('click', () => openApiModal(null));
window.editApi = function(id) { openApiModal(targets.find(t => t.id === id)); };

window.deleteApi = async function(id) {
  const t = targets.find(x => x.id === id);
  if (!t || !confirm(tr('api.confirmDelete', 'Supprimer « {label} » ?', { label: t.label }))) return;
  targets = targets.filter(x => x.id !== id);
  delete results[id];
  await saveTargets();
  renderTagFilters();
  renderApiList();
};

document.getElementById('saveApiBtn').addEventListener('click', async () => {
  const label = fLabel.value.trim();
  const bwItemName = fItemName.value.trim();
  if (!label || !bwItemName) { alert(tr('api.requiredFields', 'Le libellé et le nom de l\'entrée Bitwarden sont requis.')); return; }

  const payload = {
    id: editingId || ('api-' + Date.now()),
    label,
    owner: fOwner.value.trim() || undefined,
    collection: fCollection.value.trim() || undefined,
    bwItemName,
    scope: fScope.value,
    tags: [fTag.value],
  };

  if (editingId) {
    targets = targets.map(t => t.id === editingId ? payload : t);
  } else {
    targets.push(payload);
  }
  await saveTargets();
  apiModal.classList.add('hidden');
  renderTagFilters();
  renderApiList();
});

document.getElementById('cancelApiBtn').addEventListener('click', () => apiModal.classList.add('hidden'));
document.getElementById('closeApiModalBtn').addEventListener('click', () => apiModal.classList.add('hidden'));
apiModal.addEventListener('click', (e) => { if (e.target === apiModal) apiModal.classList.add('hidden'); });

// Re-render des zones générées en JS à l'init de i18n et à chaque changement de langue
function refreshStatusI18n() {
  refreshVaultStatus();
  renderTagFilters();
  renderApiList();
}
document.addEventListener('i18n:ready', refreshStatusI18n);
document.addEventListener('i18n:changed', refreshStatusI18n);

// ── Init ─────────────────────────────────────────────────────────────
refreshVaultStatus();
loadTargets();
