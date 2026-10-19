/*
 * spec-viewer.js — Vue "type Swagger" en LECTURE SEULE de la spécification OpenAPI.
 * -------------------------------------------------------------------------------
 * Aucune dépendance externe (pas de CDN, pas de Swagger UI). Rendu maison, thème sombre.
 * - Pas de "Try it out", aucun appel d'API : c'est une visualisation du YAML.
 * - La spec est récupérée déréférencée en JSON via /api/spec-parsed/:filename.
 * - Regroupe les opérations par tag, badges de méthode colorés, détail dépliable
 *   (paramètres, corps de requête, réponses) avec rendu récursif des schémas.
 *
 * Gère aussi la bascule entre les onglets internes "Flux & scénarios" / "Swagger".
 */
(function () {
  'use strict';

  const T = (k, fb) => (window.I18n && typeof window.I18n.t === 'function' && window.I18n.t(k) !== k) ? window.I18n.t(k) : fb;
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const METHOD_COLORS = {
    get:    'bg-emerald-600 border-emerald-500',
    post:   'bg-sky-600 border-sky-500',
    put:    'bg-amber-600 border-amber-500',
    patch:  'bg-violet-600 border-violet-500',
    delete: 'bg-rose-600 border-rose-500',
    head:   'bg-slate-600 border-slate-500',
    options:'bg-slate-600 border-slate-500',
  };
  const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

  let initialised = false;   // versions chargées une seule fois
  let specCache = {};        // filename -> spec JSON
  let currentSpec = null;    // spec actuellement affichée
  let viewMode = 'pretty';   // 'pretty' (vue simplifiée) | 'json' (JSON brut)

  // ── Bascule d'onglets internes ─────────────────────────────────────────────
  function setupTabs() {
    const fluxBtn = document.getElementById('docTabFluxBtn');
    const swaggerBtn = document.getElementById('docTabSwaggerBtn');
    const tabFlux = document.getElementById('tabFlux');
    const tabSwagger = document.getElementById('tabSwagger');
    if (!fluxBtn || !swaggerBtn) return;

    function activate(onSwagger) {
      tabFlux.classList.toggle('hidden', onSwagger);
      tabSwagger.classList.toggle('hidden', !onSwagger);
      [[fluxBtn, !onSwagger], [swaggerBtn, onSwagger]].forEach(([btn, active]) => {
        btn.classList.toggle('bg-indigo-600', active);
        btn.classList.toggle('text-white', active);
        btn.classList.toggle('text-slate-400', !active);
      });
      if (onSwagger && !initialised) loadVersions();
    }
    fluxBtn.addEventListener('click', () => activate(false));
    swaggerBtn.addEventListener('click', () => activate(true));

    // Boutons de bascule d'affichage (vue simplifiée / JSON).
    document.querySelectorAll('[data-swagger-view]').forEach(btn => {
      btn.addEventListener('click', () => setViewMode(btn.dataset.swaggerView));
    });
    setViewMode(viewMode);   // état initial des boutons
  }

  // ── Chargement des versions + spec ─────────────────────────────────────────
  async function loadVersions() {
    const sel = document.getElementById('swaggerSpecSelect');
    const view = document.getElementById('swaggerView');
    try {
      const res = await fetch('/api/spec-versions');
      const data = await res.json();
      const versions = data.versions || [];
      sel.innerHTML = versions.map(v => `<option value="${esc(v.filename)}">${esc(v.label)}</option>`).join('');
      initialised = true;
      sel.addEventListener('change', () => loadSpec(sel.value));
      if (versions.length) loadSpec(versions[0].filename);
    } catch (e) {
      view.innerHTML = `<div class="bg-rose-950/40 border border-rose-800 rounded-lg p-4 text-rose-300 text-sm">${T('docs.swaggerError', 'Impossible de charger les versions de spec.')}</div>`;
    }
  }

  async function loadSpec(filename) {
    const view = document.getElementById('swaggerView');
    const loading = document.getElementById('swaggerLoading');
    loading.classList.remove('hidden');
    view.innerHTML = '';
    try {
      let spec = specCache[filename];
      if (!spec) {
        const res = await fetch(`/api/spec-parsed/${encodeURIComponent(filename)}`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        spec = await res.json();
        specCache[filename] = spec;
      }
      currentSpec = spec;
      renderCurrent();
    } catch (e) {
      view.innerHTML = `<div class="bg-rose-950/40 border border-rose-800 rounded-lg p-4 text-rose-300 text-sm">${T('docs.swaggerParseError', 'Impossible de charger cette spécification.')}</div>`;
    } finally {
      loading.classList.add('hidden');
    }
  }

  // ── Bascule d'affichage : vue simplifiée vs JSON brut ───────────────────────
  function setViewMode(mode) {
    viewMode = (mode === 'json') ? 'json' : 'pretty';
    // Met à jour l'état visuel des boutons de bascule s'ils existent.
    document.querySelectorAll('[data-swagger-view]').forEach(btn => {
      const active = btn.dataset.swaggerView === viewMode;
      btn.classList.toggle('bg-indigo-600', active);
      btn.classList.toggle('text-white', active);
      btn.classList.toggle('text-slate-400', !active);
    });
    renderCurrent();
  }

  // (Re)affiche la spec courante selon le mode choisi.
  function renderCurrent() {
    const view = document.getElementById('swaggerView');
    if (!view || !currentSpec) return;
    if (viewMode === 'json') renderJsonView(currentSpec, view);
    else renderSpec(currentSpec, view);
  }

  // Vue JSON brute : la spec (YAML convertie + déréférencée) en JSON formaté et coloré.
  function renderJsonView(spec, host) {
    const json = JSON.stringify(spec, null, 2);
    host.innerHTML = `
      <div class="flex justify-end mb-2">
        <button type="button" id="swaggerCopyJson" class="text-[11px] font-semibold px-2.5 py-1 rounded border border-slate-600 bg-slate-800 hover:bg-indigo-600 hover:text-white transition">
          <i class="fa-regular fa-copy mr-1"></i>${T('docs.swaggerCopy', 'Copier')}
        </button>
      </div>
      <pre class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] leading-relaxed text-slate-200 overflow-auto max-h-[70vh]"><code>${highlightJson(json)}</code></pre>`;
    const copyBtn = document.getElementById('swaggerCopyJson');
    if (copyBtn) copyBtn.addEventListener('click', () => {
      navigator.clipboard?.writeText(json).then(() => {
        copyBtn.innerHTML = `<i class="fa-solid fa-check mr-1"></i>${T('docs.swaggerCopied', 'Copié')}`;
        setTimeout(() => { copyBtn.innerHTML = `<i class="fa-regular fa-copy mr-1"></i>${T('docs.swaggerCopy', 'Copier')}`; }, 1500);
      }).catch(() => {});
    });
  }

  // Coloration syntaxique JSON minimale (sans dépendance).
  function highlightJson(json) {
    return esc(json).replace(
      /(&quot;(\\.|[^&])*?&quot;)(\s*:)?|\b(true|false|null)\b|-?\d+(\.\d+)?([eE][+-]?\d+)?/g,
      (m, str, _c, colon, kw) => {
        if (str !== undefined && str !== '') {
          return colon
            ? `<span class="text-sky-300">${m}</span>`          // clé
            : `<span class="text-emerald-300">${m}</span>`;     // chaîne
        }
        if (kw) return `<span class="text-violet-300">${m}</span>`; // bool/null
        return `<span class="text-amber-300">${m}</span>`;          // nombre
      });
  }

  // ── Rendu principal ────────────────────────────────────────────────────────
  function renderSpec(spec, host) {
    const info = spec.info || {};
    const paths = spec.paths || {};

    // En-tête : titre, version, description
    const header = `
      <div class="bg-slate-800/80 rounded-xl p-5 border border-slate-700/80">
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 class="text-xl font-bold text-slate-100">${esc(info.title || 'API')}</h3>
          ${info.version ? `<span class="text-xs font-mono px-2 py-0.5 rounded bg-slate-700 text-slate-300">v${esc(info.version)}</span>` : ''}
        </div>
        ${info.description ? `<p class="text-sm text-slate-400 mt-2 whitespace-pre-line">${esc(info.description)}</p>` : ''}
      </div>`;

    // Regroupement des opérations par tag (ordre d'apparition des tags déclarés, puis autres)
    const groups = new Map();   // tag -> [{method, path, op}]
    const tagOrder = Array.isArray(spec.tags) ? spec.tags.map(t => t.name) : [];
    const ensure = (tag) => { if (!groups.has(tag)) groups.set(tag, []); return groups.get(tag); };

    Object.keys(paths).forEach(p => {
      const item = paths[p] || {};
      HTTP_METHODS.forEach(method => {
        const op = item[method];
        if (!op) return;
        const tags = (op.tags && op.tags.length) ? op.tags : ['default'];
        tags.forEach(tag => ensure(tag).push({ method, path: p, op }));
      });
    });

    // Ordonner les tags : ceux déclarés d'abord, puis le reste alphabétiquement
    const allTags = [...groups.keys()];
    const ordered = [
      ...tagOrder.filter(t => groups.has(t)),
      ...allTags.filter(t => !tagOrder.includes(t)).sort(),
    ];

    const tagDescriptions = {};
    if (Array.isArray(spec.tags)) spec.tags.forEach(t => { tagDescriptions[t.name] = t.description; });

    const sections = ordered.map((tag, gi) => {
      const ops = groups.get(tag);
      const rows = ops.map((o, oi) => renderOperation(o, `op-${gi}-${oi}`)).join('');
      return `
        <section class="bg-slate-800/60 rounded-xl border border-slate-700/70 overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-700/70">
            <h4 class="text-base font-semibold text-indigo-300">${esc(tag)}</h4>
            ${tagDescriptions[tag] ? `<p class="text-xs text-slate-400 mt-0.5">${esc(tagDescriptions[tag])}</p>` : ''}
          </div>
          <div class="divide-y divide-slate-700/40">${rows}</div>
        </section>`;
    }).join('');

    host.innerHTML = header + sections;

    // Dépliage des opérations
    host.querySelectorAll('[data-op-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = document.getElementById(btn.dataset.opToggle);
        if (!panel) return;
        const open = !panel.classList.contains('hidden');
        panel.classList.toggle('hidden', open);
        const chevron = btn.querySelector('[data-chevron]');
        if (chevron) chevron.classList.toggle('rotate-90', !open);
      });
    });
  }

  // ── Rendu d'une opération (ligne repliable) ─────────────────────────────────
  function renderOperation(o, id) {
    const { method, path, op } = o;
    const color = METHOD_COLORS[method] || 'bg-slate-600 border-slate-500';
    const summary = op.summary || '';
    const deprecated = op.deprecated
      ? `<span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">${T('docs.swaggerDeprecated', 'déprécié')}</span>` : '';

    const detail = renderOperationDetail(op);

    return `
      <div>
        <button type="button" data-op-toggle="${id}" class="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-700/30 transition">
          <i data-chevron class="fa-solid fa-chevron-right text-[10px] text-slate-500 transition-transform"></i>
          <span class="font-mono text-[10px] font-bold uppercase text-white px-2 py-1 rounded border ${color} w-16 text-center flex-shrink-0">${esc(method)}</span>
          <span class="font-mono text-xs text-slate-200 break-all">${esc(path)}</span>
          ${summary ? `<span class="text-xs text-slate-400 ml-1 truncate">${esc(summary)}</span>` : ''}
          ${deprecated}
        </button>
        <div id="${id}" class="hidden px-4 pb-4 pt-1 space-y-4">${detail}</div>
      </div>`;
  }

  function renderOperationDetail(op) {
    const parts = [];
    if (op.description) {
      parts.push(`<p class="text-xs text-slate-400 whitespace-pre-line border-l-2 border-slate-700 pl-3">${esc(op.description)}</p>`);
    }

    // Paramètres groupés par emplacement
    const params = op.parameters || [];
    if (params.length) {
      const byIn = { path: [], query: [], header: [], cookie: [] };
      params.forEach(p => { (byIn[p.in] || (byIn[p.in] = [])).push(p); });
      const blocks = Object.keys(byIn).filter(k => byIn[k].length).map(loc => {
        const rows = byIn[loc].map(p => `
          <tr class="border-b border-slate-800/60 align-top">
            <td class="py-1.5 pr-3 font-mono text-[11px] text-sky-300 whitespace-nowrap">${esc(p.name)}${p.required ? ' <span class="text-rose-400">*</span>' : ''}</td>
            <td class="py-1.5 pr-3 text-[11px] text-slate-400 whitespace-nowrap">${esc(typeLabel(p.schema))}</td>
            <td class="py-1.5 text-[11px] text-slate-400">${esc(p.description || '')}</td>
          </tr>`).join('');
        return `
          <div>
            <h5 class="text-[11px] font-semibold text-slate-300 uppercase tracking-wide mb-1">${esc(loc)}</h5>
            <table class="w-full text-left"><tbody>${rows}</tbody></table>
          </div>`;
      }).join('');
      parts.push(sectionBlock(T('docs.swaggerParams', 'Paramètres'), blocks));
    }

    // Corps de la requête
    const rb = op.requestBody;
    if (rb && rb.content) {
      parts.push(sectionBlock(
        T('docs.swaggerBody', 'Corps de la requête') + (rb.required ? ' <span class="text-rose-400">*</span>' : ''),
        renderContent(rb.content)
      ));
    }

    // Réponses
    const responses = op.responses || {};
    const respRows = Object.keys(responses).map(code => {
      const r = responses[code] || {};
      const codeColor = /^2/.test(code) ? 'text-emerald-300' : /^3/.test(code) ? 'text-sky-300' : /^4/.test(code) ? 'text-amber-300' : /^5/.test(code) ? 'text-rose-300' : 'text-slate-300';
      const body = r.content ? renderContent(r.content) : '';
      return `
        <div class="border border-slate-700/60 rounded-lg overflow-hidden">
          <div class="flex items-center gap-2 px-3 py-1.5 bg-slate-900/60">
            <span class="font-mono text-xs font-bold ${codeColor}">${esc(code)}</span>
            <span class="text-[11px] text-slate-400">${esc(r.description || '')}</span>
          </div>
          ${body ? `<div class="p-3 border-t border-slate-800/60">${body}</div>` : ''}
        </div>`;
    }).join('');
    if (respRows) parts.push(sectionBlock(T('docs.swaggerResponses', 'Réponses'), `<div class="space-y-2">${respRows}</div>`));

    return parts.join('') || `<p class="text-xs text-slate-500 italic">${T('docs.swaggerNoDetail', 'Aucun détail supplémentaire.')}</p>`;
  }

  function sectionBlock(title, inner) {
    return `
      <div class="space-y-2">
        <h5 class="text-xs font-semibold text-indigo-300">${title}</h5>
        ${inner}
      </div>`;
  }

  // Rendu d'un bloc content (map mediaType -> {schema, example, examples}) :
  // type(s) MIME + schéma (structure attendue) + exemple(s) s'ils sont fournis.
  function renderContent(content) {
    return Object.keys(content).map(mt => {
      const media = content[mt] || {};
      const schema = media.schema;
      // Exemple(s) : OpenAPI accepte `example` (unique) ou `examples` (map de { value }).
      let exampleBlock = '';
      const examples = [];
      if (media.example !== undefined) examples.push({ label: '', value: media.example });
      if (media.examples && typeof media.examples === 'object') {
        Object.keys(media.examples).forEach(k => {
          const ex = media.examples[k];
          examples.push({ label: k, value: ex && ex.value !== undefined ? ex.value : ex });
        });
      }
      if (examples.length) {
        exampleBlock = examples.map(ex => `
          <div class="mt-1.5">
            ${ex.label ? `<div class="text-[10px] text-slate-500 mb-0.5">${T('docs.swaggerExample', 'Exemple')} : ${esc(ex.label)}</div>` : `<div class="text-[10px] text-slate-500 mb-0.5">${T('docs.swaggerExample', 'Exemple')}</div>`}
            <pre class="bg-slate-950 border border-slate-800 rounded-md p-2 text-[10.5px] text-emerald-200 overflow-x-auto">${esc(jsonStr(ex.value))}</pre>
          </div>`).join('');
      }
      return `
        <div class="space-y-1.5">
          <span class="inline-block font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">${esc(mt)}</span>
          ${schema ? renderSchema(schema, 0) : ''}
          ${exampleBlock}
        </div>`;
    }).join('');
  }

  // Sérialise une valeur en JSON lisible (pour les exemples).
  function jsonStr(v) {
    try { return typeof v === 'string' ? v : JSON.stringify(v, null, 2); }
    catch { return String(v); }
  }

  // Liste d'enum lisible (toutes les valeurs, repli si la valeur n'est pas un tableau).
  function enumText(en) {
    const arr = Array.isArray(en) ? en : String(en).split(/\s+/).filter(Boolean);
    return arr.map(x => esc(x)).join(', ');
  }

  // Libellé court d'un type (ex: "string", "array[integer]", "object")
  function typeLabel(schema) {
    if (!schema || typeof schema !== 'object') return '';
    if (schema.$circular) return '…';
    if (schema.enum) return (schema.type || 'enum');
    if (schema.type === 'array') return 'array[' + typeLabel(schema.items) + ']';
    let t = schema.type || (schema.properties ? 'object' : (schema.oneOf || schema.anyOf || schema.allOf ? 'object' : ''));
    if (schema.format) t += ' (' + schema.format + ')';
    return t || 'object';
  }

  // Contraintes utiles d'un schéma (min/max, longueur, pattern, format…), en texte court.
  function constraintsText(s) {
    const c = [];
    if (s.format) c.push(`format: ${s.format}`);
    if (s.pattern) c.push(`pattern: ${s.pattern}`);
    if (s.minLength != null || s.maxLength != null) c.push(`len: ${s.minLength ?? 0}..${s.maxLength ?? '∞'}`);
    if (s.minimum != null || s.maximum != null) c.push(`${s.minimum ?? '-∞'}..${s.maximum ?? '∞'}`);
    if (s.default !== undefined) c.push(`default: ${jsonStr(s.default)}`);
    if (s.nullable) c.push('nullable');
    return c.length ? `<span class="text-[10px] text-slate-500"> · ${esc(c.join(' · '))}</span>` : '';
  }

  // Rendu récursif d'un schéma (lecture seule). depth limite la profondeur d'imbrication.
  function renderSchema(schema, depth) {
    if (!schema || typeof schema !== 'object') return '';
    if (schema.$circular) return `<span class="text-[11px] text-slate-500 italic">↻ ${T('docs.swaggerCircular', 'référence circulaire')}</span>`;
    if (depth > 10) return `<span class="text-[11px] text-slate-500 italic">…</span>`;

    // Combinateurs (allOf / oneOf / anyOf)
    for (const comb of ['allOf', 'oneOf', 'anyOf']) {
      if (Array.isArray(schema[comb])) {
        return `<div class="pl-2 border-l-2 border-slate-700/60 space-y-1.5">
          <span class="text-[10px] uppercase tracking-wide text-slate-500">${comb}</span>
          ${schema[comb].map(s => renderSchema(s, depth + 1)).join('')}</div>`;
      }
    }

    // Tableau : on détaille toujours le schéma des éléments.
    if (schema.type === 'array' && schema.items) {
      return `<div class="space-y-1">
        <span class="text-[11px] text-slate-400">array of ${esc(typeLabel(schema.items))}</span>
        ${schema.description ? `<div class="text-[10.5px] text-slate-500">${esc(schema.description)}</div>` : ''}
        <div class="pl-3 border-l border-slate-800/60">${renderSchema(schema.items, depth + 1)}</div>
      </div>`;
    }

    // Objet avec propriétés : une ligne par champ, descriptions et enums toujours visibles.
    if (schema.properties) {
      const required = new Set(schema.required || []);
      const rows = Object.keys(schema.properties).map(name => {
        const prop = schema.properties[name] || {};
        const isObj = !!prop.properties;
        const isArrObj = prop.type === 'array' && prop.items && (prop.items.properties || prop.items.enum || (prop.items.type === 'array'));
        const nested = (isObj || isArrObj) ? `<div class="pl-4 mt-1">${renderSchema(prop, depth + 1)}</div>` : '';
        const enumHint = prop.enum
          ? `<div class="text-[10px] text-slate-500 mt-0.5">enum : ${enumText(prop.enum)}</div>` : '';
        return `
          <div class="py-1 border-b border-slate-800/40 last:border-0">
            <div class="flex flex-wrap items-baseline gap-x-2">
              <span class="font-mono text-[11px] text-sky-300">${esc(name)}</span>${required.has(name) ? '<span class="text-rose-400 font-bold">*</span>' : ''}
              <span class="text-[10px] text-slate-500">${esc(typeLabel(prop))}</span>${constraintsText(prop)}
            </div>
            ${prop.description ? `<div class="text-[11px] text-slate-400 mt-0.5">${esc(prop.description)}</div>` : ''}
            ${enumHint}
            ${nested}
          </div>`;
      }).join('');
      return `<div class="rounded-lg bg-slate-900/50 border border-slate-800/60 p-2.5 space-y-0.5">
        ${schema.description ? `<div class="text-[11px] text-slate-400 mb-1">${esc(schema.description)}</div>` : ''}
        ${rows}
      </div>`;
    }

    // Type simple : libellé + contraintes + enum + description.
    const label = typeLabel(schema);
    const enumHint = schema.enum ? `<div class="text-[10px] text-slate-500 mt-0.5">enum : ${enumText(schema.enum)}</div>` : '';
    return `<div class="text-[11px] text-slate-400">${esc(label)}${constraintsText(schema)}${schema.description ? ` — <span class="text-slate-500">${esc(schema.description)}</span>` : ''}${enumHint}</div>`;
  }

  document.addEventListener('DOMContentLoaded', setupTabs);
})();
