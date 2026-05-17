/**
 * ConsultationDraft — autosave/restore para todas las consultas.
 *
 * Uso típico:
 *   ConsultationDraft.init({
 *     key: 'odontology',
 *     formId: 'consultForm',
 *     widgets: [
 *       { name: 'odontogram', get: () => odontogram1.getState(), set: (s) => odontogram1.setState(s) }
 *     ]
 *   });
 *   ...
 *   await loadAppointment();          // arma widgets
 *   ConsultationDraft.bind(appointmentId);
 *   ConsultationDraft.maybeRestore(); // muestra banner si hay borrador
 *   ...
 *   // tras submit exitoso:
 *   ConsultationDraft.clear();
 *
 * Guarda en localStorage bajo la clave `sd_consult_draft_<key>_<appointmentId>`.
 * Persiste: todos los <input>/<select>/<textarea> con id o name dentro del form,
 *           más cada widget registrado vía su get/set.
 * Triggers: input/change debounce 600ms, periódico cada 25s, beforeunload, pagehide,
 *           visibilitychange→hidden.
 */
(function () {
  'use strict';

  const STORAGE_PREFIX = 'sd_consult_draft_';
  const DEBOUNCE_MS = 600;
  const PERIODIC_MS = 25000;

  let cfg = null;
  let appointmentId = null;
  let dirty = false;
  let debounceTimer = null;
  let periodicTimer = null;
  let listenersInstalled = false;
  let statusEl = null;

  function storageKey() {
    if (!cfg) return null;
    const id = appointmentId != null ? appointmentId : 'standalone';
    return `${STORAGE_PREFIX}${cfg.key}_${id}`;
  }

  function debounce(fn, ms) {
    return function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fn, ms);
    };
  }

  function markDirty() {
    dirty = true;
    updateStatus('Sin guardar…');
    scheduleSave();
  }

  function scheduleSave() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { save({ source: 'auto' }); }, DEBOUNCE_MS);
  }

  function ensureStatusEl() {
    if (statusEl) return statusEl;
    const el = document.createElement('div');
    el.id = 'cdraft-status';
    el.style.cssText = [
      'position:fixed', 'bottom:14px', 'right:14px',
      'z-index:9998', 'padding:6px 10px',
      'background:rgba(15,23,42,.82)', 'color:#fff',
      'border-radius:8px', 'font:500 12px -apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif',
      'box-shadow:0 4px 12px rgba(0,0,0,.18)', 'opacity:0',
      'transition:opacity .25s', 'pointer-events:none'
    ].join(';');
    document.body.appendChild(el);
    statusEl = el;
    return el;
  }

  function updateStatus(text, kind) {
    const el = ensureStatusEl();
    el.textContent = text;
    el.style.background = kind === 'ok' ? 'rgba(16,185,129,.92)'
                       : kind === 'err' ? 'rgba(239,68,68,.92)'
                       : 'rgba(15,23,42,.82)';
    el.style.opacity = '1';
    if (kind === 'ok') {
      clearTimeout(updateStatus._t);
      updateStatus._t = setTimeout(() => { el.style.opacity = '0'; }, 2200);
    }
  }

  function getForm() {
    return document.getElementById(cfg.formId);
  }

  function snapshotFields() {
    const form = getForm();
    const fields = {};
    if (!form) return fields;
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach((el) => {
      if (el.disabled) return;
      if (el.type === 'file' || el.type === 'submit' || el.type === 'button') return;
      if (el.type === 'radio' || el.type === 'checkbox') {
        const name = el.name || el.id;
        if (!name) return;
        if (!fields[`__group__${name}`]) fields[`__group__${name}`] = [];
        if (el.checked) fields[`__group__${name}`].push(el.value);
      } else {
        const k = el.id || el.name;
        if (!k) return;
        fields[k] = el.value;
      }
    });
    return fields;
  }

  async function snapshotForm() {
    const fields = snapshotFields();
    const widgets = {};
    const promises = (cfg.widgets || []).map(async (w) => {
      try {
        const v = await Promise.resolve(w.get());
        widgets[w.name] = v;
      } catch (e) {
        console.warn('[ConsultationDraft] widget get failed:', w.name, e);
      }
    });
    await Promise.all(promises);
    return { fields, widgets, savedAt: Date.now() };
  }

  function snapshotFormSync() {
    // Synchronous path for beforeunload — async widgets fall back to last cached state
    const fields = snapshotFields();
    const widgets = {};
    (cfg.widgets || []).forEach((w) => {
      try {
        const v = w.get();
        widgets[w.name] = v instanceof Promise ? null : v;
      } catch (e) { /* ignore */ }
    });
    return { fields, widgets, savedAt: Date.now() };
  }

  function applySnapshot(snap) {
    if (!snap) return;
    const form = getForm();
    if (form && snap.fields) {
      const inputs = form.querySelectorAll('input, select, textarea');
      const groups = {};
      Object.keys(snap.fields).forEach((k) => {
        if (k.startsWith('__group__')) groups[k.slice(9)] = snap.fields[k];
      });
      inputs.forEach((el) => {
        if (el.type === 'radio' || el.type === 'checkbox') {
          const name = el.name || el.id;
          const vals = groups[name];
          if (Array.isArray(vals)) el.checked = vals.indexOf(el.value) !== -1;
        } else {
          const k = el.id || el.name;
          if (!k) return;
          if (Object.prototype.hasOwnProperty.call(snap.fields, k)) {
            el.value = snap.fields[k];
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });
    }
    (cfg.widgets || []).forEach((w) => {
      try {
        const v = snap.widgets && snap.widgets[w.name];
        if (v !== undefined && v !== null && typeof w.set === 'function') w.set(v);
      } catch (e) {
        console.warn('[ConsultationDraft] widget set failed:', w.name, e);
      }
    });
  }

  async function save(opts) {
    opts = opts || {};
    const key = storageKey();
    if (!key) return;
    try {
      const sync = opts.source === 'unload' || opts.source === 'pagehide' || opts.source === 'hidden';
      const snap = sync ? snapshotFormSync() : await snapshotForm();
      localStorage.setItem(key, JSON.stringify(snap));
      dirty = false;
      const t = new Date(snap.savedAt).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
      updateStatus(`Borrador guardado ${t}`, opts.source === 'manual' ? 'ok' : null);
      if (opts.source !== 'manual') {
        clearTimeout(updateStatus._t);
        updateStatus._t = setTimeout(() => { statusEl.style.opacity = '0'; }, 1600);
      }
    } catch (e) {
      updateStatus('No se pudo guardar borrador', 'err');
      console.warn('[ConsultationDraft] save failed', e);
    }
  }

  function clear() {
    const key = storageKey();
    if (!key) return;
    try { localStorage.removeItem(key); } catch {}
    dirty = false;
    if (statusEl) statusEl.style.opacity = '0';
  }

  function installListeners() {
    if (listenersInstalled) return;
    listenersInstalled = true;
    const form = getForm();
    if (form) {
      form.addEventListener('input', markDirty, true);
      form.addEventListener('change', markDirty, true);
    }
    window.addEventListener('beforeunload', () => { if (dirty) save({ source: 'unload' }); });
    window.addEventListener('pagehide', () => { if (dirty) save({ source: 'pagehide' }); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && dirty) save({ source: 'hidden' });
    });
    periodicTimer = setInterval(() => { if (dirty) save({ source: 'periodic' }); }, PERIODIC_MS);
  }

  function showRestoreBanner(snap) {
    const form = getForm();
    if (!form) return;
    const existing = document.getElementById('cdraft-banner');
    if (existing) existing.remove();

    const ts = snap && snap.savedAt ? new Date(snap.savedAt).toLocaleString('es-HN') : 'guardado anterior';
    const banner = document.createElement('div');
    banner.id = 'cdraft-banner';
    banner.style.cssText = [
      'margin:0 0 14px', 'padding:12px 16px', 'border-radius:12px',
      'background:linear-gradient(135deg,#0e7490 0%,#06b6d4 100%)',
      'color:#fff', 'display:flex', 'align-items:center', 'gap:12px',
      'box-shadow:0 8px 20px -8px rgba(8,145,178,.45)',
      'font:500 13px -apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif'
    ].join(';');
    banner.innerHTML = `
      <div style="flex:1;">
        <div style="font-weight:700; font-size:14px; margin-bottom:2px;">Borrador local encontrado</div>
        <div style="opacity:.92; font-size:12px;">Guardado el ${ts}. Podés restaurarlo o empezar limpio.</div>
      </div>
      <button type="button" id="cdraft-restore" style="background:rgba(255,255,255,.95); color:#0e7490; border:0; padding:8px 14px; border-radius:8px; font-weight:600; cursor:pointer; font-size:13px;">Restaurar</button>
      <button type="button" id="cdraft-discard" style="background:rgba(255,255,255,.18); color:#fff; border:1px solid rgba(255,255,255,.4); padding:8px 14px; border-radius:8px; font-weight:600; cursor:pointer; font-size:13px;">Descartar</button>
    `;
    form.parentNode.insertBefore(banner, form);

    banner.querySelector('#cdraft-restore').addEventListener('click', () => {
      applySnapshot(snap);
      banner.remove();
      updateStatus('Borrador restaurado', 'ok');
    });
    banner.querySelector('#cdraft-discard').addEventListener('click', () => {
      clear();
      banner.remove();
    });
  }

  const ConsultationDraft = {
    init(config) {
      cfg = Object.assign({ widgets: [] }, config || {});
      const start = () => installListeners();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
      } else {
        start();
      }
    },
    bind(id) {
      appointmentId = id;
    },
    maybeRestore() {
      const key = storageKey();
      if (!key) return false;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        const snap = JSON.parse(raw);
        showRestoreBanner(snap);
        return true;
      } catch (e) {
        console.warn('[ConsultationDraft] restore failed', e);
        return false;
      }
    },
    save() { save({ source: 'manual' }); },
    clear,
    isDirty() { return dirty; }
  };

  window.ConsultationDraft = ConsultationDraft;
})();
