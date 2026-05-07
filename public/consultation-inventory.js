// ── consultation-inventory.js ──
// Reusable "Inventario utilizado" section for all consultation pages
// (general, podology, odontology, nutrition) and read-only view pages.
//
// Public API:
//   ConsultationInventory.mount({
//     containerId,       // string — DOM element id where the section will render
//     consultationId,    // number | null — null when consultation hasn't been saved yet
//     consultationType,  // 'general' | 'podiatry' | 'odontology' | 'nutrition'
//     readonly,          // bool — view-only mode (no buttons, no editing)
//     onChange,          // optional fn(state) — called when local state changes
//   })
//
//   ConsultationInventory.commit(consultationId)
//     Posts all locally-pending usages (added before the consultation existed).
//     Call this AFTER the consultation has been saved and its id is known.
//     Returns: { created: [...], errors: [...] }
//
//   ConsultationInventory.getPendingCount()  // number of pending (uncommitted) items
//   ConsultationInventory.getCommittedCount() // number of items already saved
//   ConsultationInventory.hasPending()
//
// Depends on: window.api (from common.js) and window.Icons (from icons.js).

(function (global) {
  'use strict';

  if (global.ConsultationInventory) return;

  // ── Style injection (idempotent) ──
  function injectStyle() {
    if (document.getElementById('ci-style')) return;
    const css = `
      .ci-section {
        background: white;
        border-radius: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        padding: 1.75rem;
        margin-bottom: 2rem;
        border: 1px solid #e2e8f0;
        position: relative;
      }
      .ci-section::before {
        content: '';
        position: absolute; top: 0; left: 1.75rem; right: 1.75rem; height: 3px;
        background: linear-gradient(90deg, #0891b2, #06b6d4, transparent);
        border-radius: 0 0 4px 4px;
      }
      .ci-head {
        display: flex; justify-content: space-between; align-items: flex-start;
        gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem;
      }
      .ci-head .ci-title-wrap { display: flex; align-items: center; gap: .85rem; flex: 1; min-width: 0; }
      .ci-head .ci-icon-badge {
        width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
        background: linear-gradient(135deg, #0891b2, #06b6d4);
        color: white; display: flex; align-items: center; justify-content: center;
        box-shadow: 0 6px 16px rgba(8, 145, 178, .25);
      }
      .ci-head h3 {
        font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.2;
        letter-spacing: -0.01em; padding: 0; border: none;
      }
      .ci-head .ci-sub { font-size: .82rem; color: #64748b; margin-top: 2px; font-weight: 500; }
      .ci-head .ci-add-btn {
        display: inline-flex; align-items: center; gap: .5rem;
        padding: .65rem 1.1rem;
        background: linear-gradient(135deg, #0891b2, #06b6d4);
        color: white; border: none; border-radius: 10px;
        font-weight: 700; font-size: .87rem; font-family: inherit; cursor: pointer;
        box-shadow: 0 6px 16px rgba(8, 145, 178, .25); transition: all .25s;
      }
      .ci-head .ci-add-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(8, 145, 178, .35); }

      .ci-empty {
        padding: 2.5rem 1rem; text-align: center; color: #94a3b8;
        background: linear-gradient(135deg, #f8fafc, #f0f9ff);
        border-radius: 12px; border: 1.5px dashed rgba(8, 145, 178, .2);
      }
      .ci-empty .ci-empty-icon {
        width: 56px; height: 56px; margin: 0 auto .85rem;
        border-radius: 16px;
        background: linear-gradient(135deg, rgba(8, 145, 178, .12), rgba(6, 182, 212, .12));
        color: #0891b2; display: flex; align-items: center; justify-content: center;
      }
      .ci-empty p { font-size: .92rem; color: #64748b; font-weight: 600; }

      .ci-list { display: flex; flex-direction: column; gap: .75rem; }
      .ci-item {
        display: flex; gap: 1rem; padding: 1rem; border: 1.5px solid #e2e8f0;
        border-radius: 12px; background: linear-gradient(135deg, #fafcfd, white);
        transition: all .25s; align-items: flex-start;
      }
      .ci-item:hover { border-color: rgba(8, 145, 178, .25); box-shadow: 0 6px 18px rgba(8, 145, 178, .08); }
      .ci-item.ci-pending { border-left: 4px solid #f59e0b; }
      .ci-item-thumb {
        width: 56px; height: 56px; border-radius: 10px; flex-shrink: 0;
        background: #e0f2fe; display: flex; align-items: center; justify-content: center;
        color: #0891b2; overflow: hidden; border: 1px solid rgba(8, 145, 178, .12);
      }
      .ci-item-thumb img { width: 100%; height: 100%; object-fit: cover; }
      .ci-item-body { flex: 1; min-width: 0; }
      .ci-item-name { font-weight: 800; color: #0f172a; font-size: .95rem; line-height: 1.3; }
      .ci-item-meta {
        display: flex; gap: .4rem; flex-wrap: wrap; align-items: center;
        margin-top: .35rem; font-size: .76rem; color: #64748b;
      }
      .ci-item-meta .dot { color: #cbd5e1; }
      .ci-badge {
        display: inline-flex; align-items: center; gap: .25rem;
        padding: .15rem .55rem; border-radius: 999px;
        font-size: .68rem; font-weight: 700;
      }
      .ci-badge::before {
        content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor;
      }
      .ci-badge.disponible { background: #dcfce7; color: #15803d; }
      .ci-badge.bajo_stock { background: #fef3c7; color: #b45309; }
      .ci-badge.agotado { background: #fee2e2; color: #b91c1c; }
      .ci-badge.por_vencer { background: #fed7aa; color: #c2410c; }
      .ci-badge.vencido { background: #fecaca; color: #991b1b; }
      .ci-badge.pendiente { background: #fef3c7; color: #b45309; }
      .ci-warn {
        margin-top: .4rem; font-size: .76rem; color: #b45309; font-weight: 700;
        display: flex; align-items: center; gap: .3rem;
      }
      .ci-warn.danger { color: #991b1b; }

      .ci-item-controls {
        display: flex; gap: .65rem; align-items: center; margin-top: .65rem; flex-wrap: wrap;
      }
      .ci-qty-wrap {
        display: inline-flex; align-items: stretch;
        border: 1.5px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: white;
      }
      .ci-qty-wrap:focus-within { border-color: #0891b2; box-shadow: 0 0 0 3px rgba(8, 145, 178, .12); }
      .ci-qty-wrap button {
        background: #f8fafc; border: none; padding: 0 .7rem; cursor: pointer;
        font-size: 1rem; color: #475569; font-weight: 700; font-family: inherit;
        transition: all .15s;
      }
      .ci-qty-wrap button:hover { background: #ecf9fc; color: #0891b2; }
      .ci-qty-wrap input {
        width: 64px; padding: .45rem .35rem; border: none; outline: none;
        text-align: center; font-size: .92rem; font-weight: 700; font-family: inherit;
        color: #0f172a; background: white;
      }
      .ci-qty-unit {
        font-size: .78rem; color: #64748b; font-weight: 600; align-self: center;
      }
      .ci-cost {
        font-weight: 800; font-size: .92rem; color: #0891b2; margin-left: auto;
        white-space: nowrap;
      }
      .ci-note-input {
        flex: 1 1 100%;
        padding: .55rem .75rem; border: 1.5px solid #e2e8f0; border-radius: 9px;
        font-size: .85rem; font-family: inherit; background: white; color: #0f172a;
        transition: all .2s;
      }
      .ci-note-input:focus { outline: none; border-color: #0891b2; box-shadow: 0 0 0 3px rgba(8, 145, 178, .1); }

      .ci-remove {
        background: white; border: 1.5px solid #fecaca; color: #dc2626; cursor: pointer;
        width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center;
        justify-content: center; transition: all .2s; flex-shrink: 0;
      }
      .ci-remove:hover { background: #fef2f2; border-color: #dc2626; }

      .ci-footer {
        display: flex; justify-content: space-between; align-items: center; gap: 1rem;
        margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1.5px dashed #e2e8f0;
        flex-wrap: wrap;
      }
      .ci-summary {
        display: flex; gap: 1.25rem; align-items: center; flex-wrap: wrap;
      }
      .ci-summary-item .lbl { font-size: .7rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
      .ci-summary-item .val { font-size: 1.1rem; color: #0f172a; font-weight: 800; }
      .ci-summary-item .val.cost { color: #0891b2; }
      .ci-pending-tag {
        display: inline-flex; align-items: center; gap: .35rem;
        padding: .35rem .75rem; background: #fef3c7; color: #b45309;
        border-radius: 999px; font-size: .75rem; font-weight: 700;
      }

      /* ── Search modal ── */
      .ci-modal-overlay {
        position: fixed; inset: 0; background: rgba(15, 23, 42, .55);
        backdrop-filter: blur(6px); z-index: 600;
        display: none; align-items: flex-start; justify-content: center;
        padding: 4rem 1rem 2rem; animation: ciFade .2s ease;
      }
      .ci-modal-overlay.open { display: flex; }
      @keyframes ciFade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes ciIn { from { transform: translateY(-12px) scale(.97); opacity: 0; } to { transform: none; opacity: 1; } }

      .ci-modal {
        width: 100%; max-width: 640px; max-height: calc(100vh - 6rem);
        background: white; border-radius: 18px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, .25);
        display: flex; flex-direction: column; overflow: hidden;
        animation: ciIn .25s cubic-bezier(.34, 1.56, .64, 1);
      }
      .ci-modal-head {
        padding: 1rem 1.25rem; background: linear-gradient(135deg, #0891b2, #06b6d4);
        color: white; display: flex; align-items: center; gap: .65rem;
      }
      .ci-modal-head h3 { font-size: 1rem; font-weight: 800; flex: 1; margin: 0; padding: 0; border: none; color: white; }
      .ci-modal-close {
        background: rgba(255,255,255,.2); border: none; color: white;
        width: 32px; height: 32px; border-radius: 9px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all .25s; font-size: 1.1rem; padding: 0;
      }
      .ci-modal-close:hover { background: rgba(255,255,255,.32); transform: rotate(90deg); }

      .ci-search-wrap {
        padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; position: relative;
      }
      .ci-search-icon {
        position: absolute; left: 1.85rem; top: 50%; transform: translateY(-50%); color: #94a3b8;
        display: flex; align-items: center;
      }
      .ci-search-input {
        width: 100%; padding: .7rem 1rem .7rem 2.7rem;
        border: 1.5px solid #e2e8f0; border-radius: 10px;
        font-size: .92rem; font-family: inherit; background: #f8fafc; color: #0f172a;
        transition: all .25s;
      }
      .ci-search-input:focus { outline: none; border-color: #0891b2; background: white; box-shadow: 0 0 0 3px rgba(8, 145, 178, .12); }

      .ci-results {
        flex: 1; overflow-y: auto; padding: .5rem 0;
      }
      .ci-result {
        display: flex; gap: .85rem; padding: .75rem 1.25rem; cursor: pointer;
        align-items: center; transition: background .15s; border: none; background: transparent;
        width: 100%; text-align: left; font-family: inherit;
      }
      .ci-result:hover { background: #f0fdfd; }
      .ci-result-thumb {
        width: 40px; height: 40px; border-radius: 9px; background: #e0f2fe;
        display: flex; align-items: center; justify-content: center; color: #0891b2;
        overflow: hidden; flex-shrink: 0;
      }
      .ci-result-thumb img { width: 100%; height: 100%; object-fit: cover; }
      .ci-result-info { flex: 1; min-width: 0; }
      .ci-result-name { font-weight: 700; color: #0f172a; font-size: .92rem; }
      .ci-result-meta { font-size: .75rem; color: #64748b; margin-top: 2px; display: flex; gap: .45rem; align-items: center; flex-wrap: wrap; }
      .ci-result-meta .dot { color: #cbd5e1; }
      .ci-result-stock { font-size: .8rem; font-weight: 800; color: #0f172a; white-space: nowrap; padding-left: .5rem; }
      .ci-result-stock .unit { color: #94a3b8; font-weight: 500; font-size: .75rem; margin-left: 2px; }
      .ci-result.disabled { opacity: .55; cursor: not-allowed; }
      .ci-result.disabled:hover { background: transparent; }

      .ci-results-empty {
        padding: 2rem 1rem; text-align: center; color: #94a3b8; font-size: .88rem;
      }
      .ci-results-loading { padding: 1.5rem; text-align: center; color: #94a3b8; font-size: .85rem; }

      /* ── Toast ── */
      .ci-toast-wrap { position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 700; pointer-events: none; }
      .ci-toast {
        background: white; border-left: 4px solid #10b981;
        padding: .85rem 1.1rem; border-radius: 12px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, .18);
        display: flex; align-items: center; gap: .65rem;
        font-weight: 600; color: #0f172a; font-size: .87rem;
        max-width: 360px; pointer-events: auto;
        animation: ciIn .25s ease;
      }
      .ci-toast.error { border-left-color: #ef4444; }

      /* ── Read-only view styles ── */
      .ci-readonly-card {
        display: flex; gap: 1rem; padding: 1rem; border: 1px solid #e2e8f0;
        border-radius: 12px; background: white;
      }
      .ci-readonly-card .ci-item-thumb { width: 64px; height: 64px; border-radius: 12px; }
      .ci-readonly-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: .75rem 1rem; margin-top: .65rem; font-size: .82rem;
      }
      .ci-readonly-field .lbl { font-size: .68rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
      .ci-readonly-field .val { color: #0f172a; font-weight: 600; margin-top: 1px; }
      .ci-readonly-note {
        margin-top: .5rem; padding: .55rem .75rem; background: #f8fafc;
        border-left: 3px solid #06b6d4; border-radius: 6px;
        font-size: .82rem; color: #475569; font-style: italic;
      }
      .ci-readonly-summary {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: .85rem; padding: 1rem; margin-bottom: 1rem;
        background: linear-gradient(135deg, rgba(8, 145, 178, .06), rgba(6, 182, 212, .06));
        border-radius: 12px; border: 1px solid rgba(8, 145, 178, .12);
      }
      .ci-readonly-summary .stat .lbl { font-size: .68rem; color: #0891b2; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
      .ci-readonly-summary .stat .val { font-size: 1.15rem; color: #0f172a; font-weight: 800; margin-top: 2px; }
      .ci-readonly-summary .stat .val.alert { color: #b45309; }

      /* ── Responsive ── */
      @media (max-width: 640px) {
        .ci-section { padding: 1.25rem; }
        .ci-head { flex-direction: column; align-items: stretch; }
        .ci-head .ci-add-btn { width: 100%; justify-content: center; }
        .ci-item { flex-direction: column; }
        .ci-item-thumb { width: 100%; height: 120px; }
        .ci-cost { margin-left: 0; }
        .ci-modal-overlay { padding: 1rem; align-items: flex-end; }
        .ci-modal { max-height: 80vh; border-radius: 18px 18px 0 0; }
        .ci-toast-wrap { left: 1rem; right: 1rem; bottom: 90px; }
        .ci-toast { max-width: 100%; }
      }
    `;
    const styleEl = document.createElement('style');
    styleEl.id = 'ci-style';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  // ── Helpers ──
  const TYPE_LABELS = {
    medicamento: 'Medicamento', insumo_medico: 'Insumo médico', equipo: 'Equipo',
    descartable: 'Descartable', administrativo: 'Administrativo', otro: 'Otro'
  };
  const AREA_LABELS = {
    recepcion: 'Recepción', consultorio: 'Consultorio', laboratorio: 'Laboratorio',
    farmacia: 'Farmacia', bodega: 'Bodega', quirofano: 'Quirófano',
    odontologia: 'Odontología', otro: 'Otro'
  };
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
  function fmtMoney(n) {
    const num = Number(n || 0);
    return 'L. ' + num.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fmtDateTime(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleString('es-HN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function icon(name, size) {
    if (typeof Icons !== 'undefined' && Icons[name]) {
      return Icons.render(name, size || 18);
    }
    return '';
  }

  function deriveStockStatus(item) {
    const stock = Number(item.current_stock || item.item_current_stock || 0);
    const min = Number(item.min_stock || item.item_min_stock || 0);
    if (stock <= 0) return 'agotado';
    if (min > 0 && stock <= min) return 'bajo_stock';
    return 'disponible';
  }
  function expirationBadge(expDate) {
    if (!expDate) return '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const exp = new Date(expDate);
    if (isNaN(exp.getTime())) return '';
    const diff = Math.floor((exp - today) / 86400000);
    if (diff < 0) return `<span class="ci-badge vencido">Vencido</span>`;
    if (diff <= 30) return `<span class="ci-badge por_vencer">${diff}d</span>`;
    return '';
  }

  function ensureToastWrap() {
    let w = document.getElementById('ciToastWrap');
    if (!w) {
      w = document.createElement('div');
      w.className = 'ci-toast-wrap';
      w.id = 'ciToastWrap';
      document.body.appendChild(w);
    }
    return w;
  }
  function toast(message, isError) {
    const wrap = ensureToastWrap();
    const el = document.createElement('div');
    el.className = 'ci-toast' + (isError ? ' error' : '');
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity .25s';
      setTimeout(() => el.remove(), 250);
    }, 3200);
  }

  // ── State ──
  // pendingItems: items added before consultationId exists. Each: {tempId, item, quantity_used, notes}
  // committedUsages: items already saved via /api/inventory-usage. Each: full row from server.
  const state = {
    options: null,
    container: null,
    pendingItems: [], // [{tempId, item, quantity_used, notes}]
    committedUsages: [], // server rows
    nextTempId: 1,
  };

  function tempId() { return 'tmp-' + (state.nextTempId++); }

  function notifyChange() {
    if (state.options?.onChange) {
      try { state.options.onChange({ pending: state.pendingItems.length, committed: state.committedUsages.length }); } catch (_) {}
    }
  }

  // ── Render: editable mode ──
  function renderEditable() {
    const total = state.pendingItems.length + state.committedUsages.length;
    const totalCost =
      state.pendingItems.reduce((s, p) => s + Number(p.quantity_used || 0) * Number(p.item.unit_cost || 0), 0) +
      state.committedUsages.reduce((s, u) => s + Number(u.total_cost || 0), 0);

    const headHTML = `
      <div class="ci-head">
        <div class="ci-title-wrap">
          <div class="ci-icon-badge">${icon('boxes', 22)}</div>
          <div>
            <h3>Inventario utilizado</h3>
            <div class="ci-sub">Registra los insumos, medicamentos o productos usados durante esta consulta.</div>
          </div>
        </div>
        <button type="button" class="ci-add-btn" id="ciAddBtn">${icon('plus', 16)} Agregar artículo</button>
      </div>
    `;

    const itemsHTML = total === 0
      ? `<div class="ci-empty">
          <div class="ci-empty-icon">${icon('package', 32)}</div>
          <p>Aún no se han agregado artículos utilizados en esta consulta.</p>
        </div>`
      : `<div class="ci-list">
          ${state.committedUsages.map(renderCommittedItem).join('')}
          ${state.pendingItems.map(renderPendingItem).join('')}
        </div>`;

    const footerHTML = total === 0 ? '' : `
      <div class="ci-footer">
        <div class="ci-summary">
          <div class="ci-summary-item">
            <div class="lbl">Artículos</div>
            <div class="val">${total}</div>
          </div>
          <div class="ci-summary-item">
            <div class="lbl">Costo total</div>
            <div class="val cost">${fmtMoney(totalCost)}</div>
          </div>
        </div>
        ${state.pendingItems.length > 0
          ? `<div class="ci-pending-tag">${icon('clock', 12)} ${state.pendingItems.length} se ${state.pendingItems.length === 1 ? 'aplicará' : 'aplicarán'} al guardar la consulta</div>`
          : ''}
      </div>
    `;

    state.container.innerHTML = `<div class="ci-section">${headHTML}${itemsHTML}${footerHTML}</div>`;

    const addBtn = state.container.querySelector('#ciAddBtn');
    if (addBtn) addBtn.addEventListener('click', openSearchModal);

    // Wire item controls
    state.container.querySelectorAll('[data-pending-id]').forEach(node => wirePendingControls(node));
    state.container.querySelectorAll('[data-usage-id]').forEach(node => wireCommittedControls(node));
  }

  function renderPendingItem(p) {
    const it = p.item;
    const stockStatus = deriveStockStatus(it);
    const expBadge = expirationBadge(it.expiration_date);
    const totalCost = Number(p.quantity_used || 0) * Number(it.unit_cost || 0);
    const stockWarn = Number(p.quantity_used || 0) > Number(it.current_stock || 0)
      ? `<div class="ci-warn danger">${icon('alert', 12)} La cantidad excede el stock disponible (${it.current_stock} ${it.unit || ''})</div>`
      : (stockStatus === 'bajo_stock'
          ? `<div class="ci-warn">${icon('alert', 12)} El artículo está en bajo stock</div>`
          : '');

    return `
      <div class="ci-item ci-pending" data-pending-id="${p.tempId}">
        <div class="ci-item-thumb">
          ${it.image_url ? `<img src="${escapeHtml(it.image_url)}" alt="">` : icon('package', 24)}
        </div>
        <div class="ci-item-body">
          <div class="ci-item-name">${escapeHtml(it.name)}</div>
          <div class="ci-item-meta">
            <span>${escapeHtml(it.category || TYPE_LABELS[it.type] || 'Sin categoría')}</span>
            ${it.area ? `<span class="dot">·</span><span>${escapeHtml(AREA_LABELS[it.area] || it.area)}</span>` : ''}
            ${it.exact_location ? `<span class="dot">·</span><span>${escapeHtml(it.exact_location)}</span>` : ''}
            <span class="ci-badge ${stockStatus}">${stockStatus === 'agotado' ? 'Agotado' : stockStatus === 'bajo_stock' ? 'Bajo stock' : 'Disponible'}</span>
            ${expBadge}
            <span class="ci-badge pendiente">${icon('clock', 10)} Pendiente</span>
          </div>
          ${stockWarn}
          <div class="ci-item-controls">
            <div class="ci-qty-wrap">
              <button type="button" data-qty-action="dec" aria-label="Disminuir">−</button>
              <input type="number" min="0" step="any" value="${p.quantity_used}" data-qty-input>
              <button type="button" data-qty-action="inc" aria-label="Aumentar">+</button>
            </div>
            <span class="ci-qty-unit">${escapeHtml(it.unit || 'unidades')}</span>
            <span style="color:#94a3b8; font-size: .78rem;">
              · Stock: <strong style="color:#0f172a;">${Number(it.current_stock).toLocaleString('es-HN')}</strong>
            </span>
            <span class="ci-cost">${fmtMoney(totalCost)}</span>
            <input type="text" class="ci-note-input" placeholder="Nota / motivo de uso (opcional)" value="${escapeHtml(p.notes || '')}" data-note-input>
          </div>
        </div>
        <button type="button" class="ci-remove" title="Quitar" data-remove>${icon('trash', 16)}</button>
      </div>
    `;
  }

  function renderCommittedItem(u) {
    const stockStatus = u.item_current_stock != null
      ? deriveStockStatus({ current_stock: u.item_current_stock, min_stock: u.item_min_stock })
      : null;
    const expBadge = expirationBadge(u.item_expiration_date);

    return `
      <div class="ci-item" data-usage-id="${u.id}">
        <div class="ci-item-thumb">
          ${u.item_image_url ? `<img src="${escapeHtml(u.item_image_url)}" alt="">` : icon('package', 24)}
        </div>
        <div class="ci-item-body">
          <div class="ci-item-name">${escapeHtml(u.item_name || 'Artículo eliminado')}</div>
          <div class="ci-item-meta">
            <span>${escapeHtml(u.item_category || TYPE_LABELS[u.item_type] || 'Sin categoría')}</span>
            ${u.item_area ? `<span class="dot">·</span><span>${escapeHtml(AREA_LABELS[u.item_area] || u.item_area)}</span>` : ''}
            ${stockStatus ? `<span class="ci-badge ${stockStatus}">${stockStatus === 'agotado' ? 'Agotado' : stockStatus === 'bajo_stock' ? 'Bajo stock' : 'Disponible'}</span>` : ''}
            ${expBadge}
            <span class="ci-badge disponible">${icon('check', 10)} Aplicado</span>
          </div>
          <div class="ci-item-controls">
            <div class="ci-qty-wrap">
              <button type="button" data-qty-action="dec">−</button>
              <input type="number" min="0" step="any" value="${u.quantity_used}" data-qty-input>
              <button type="button" data-qty-action="inc">+</button>
            </div>
            <span class="ci-qty-unit">${escapeHtml(u.unit || 'unidades')}</span>
            <span style="color:#94a3b8; font-size: .78rem;">
              · Stock actual: <strong style="color:#0f172a;">${Number(u.item_current_stock || 0).toLocaleString('es-HN')}</strong>
            </span>
            <span class="ci-cost">${fmtMoney(u.total_cost)}</span>
            <input type="text" class="ci-note-input" placeholder="Nota / motivo de uso" value="${escapeHtml(u.notes || '')}" data-note-input>
          </div>
        </div>
        <button type="button" class="ci-remove" title="Eliminar y devolver al inventario" data-remove>${icon('trash', 16)}</button>
      </div>
    `;
  }

  function wirePendingControls(node) {
    const id = node.dataset.pendingId;
    const get = () => state.pendingItems.find(p => p.tempId === id);
    const qtyInput = node.querySelector('[data-qty-input]');
    const noteInput = node.querySelector('[data-note-input]');
    let qtyTimer = null;

    qtyInput.addEventListener('input', e => {
      const p = get(); if (!p) return;
      const v = Number(e.target.value);
      p.quantity_used = isNaN(v) || v < 0 ? 0 : v;
      clearTimeout(qtyTimer);
      qtyTimer = setTimeout(() => { renderEditable(); notifyChange(); }, 350);
    });
    node.querySelector('[data-qty-action="inc"]').addEventListener('click', () => {
      const p = get(); if (!p) return;
      p.quantity_used = Number(p.quantity_used || 0) + 1;
      renderEditable(); notifyChange();
    });
    node.querySelector('[data-qty-action="dec"]').addEventListener('click', () => {
      const p = get(); if (!p) return;
      p.quantity_used = Math.max(0, Number(p.quantity_used || 0) - 1);
      renderEditable(); notifyChange();
    });
    noteInput.addEventListener('input', e => {
      const p = get(); if (!p) return;
      p.notes = e.target.value;
      notifyChange();
    });
    node.querySelector('[data-remove]').addEventListener('click', () => {
      state.pendingItems = state.pendingItems.filter(p => p.tempId !== id);
      renderEditable(); notifyChange();
    });
  }

  function wireCommittedControls(node) {
    const usageId = parseInt(node.dataset.usageId, 10);
    const get = () => state.committedUsages.find(u => u.id === usageId);
    const qtyInput = node.querySelector('[data-qty-input]');
    const noteInput = node.querySelector('[data-note-input]');
    let qtyTimer = null;
    let noteTimer = null;

    async function updateUsage(payload) {
      try {
        const updated = await api(`/api/inventory-usage/${usageId}`, { method: 'PUT', body: payload });
        // Merge — preserve joined fields like item_name etc.
        const cur = get();
        if (cur) Object.assign(cur, updated);
        // Refetch the joined version so item_current_stock reflects the new stock
        await reloadCommitted();
        renderEditable(); notifyChange();
      } catch (err) {
        toast(err.message || 'Error al actualizar', true);
        // Revert UI
        const cur = get();
        if (cur) {
          if (payload.quantity_used !== undefined) qtyInput.value = cur.quantity_used;
          if (payload.notes !== undefined) noteInput.value = cur.notes || '';
        }
      }
    }

    qtyInput.addEventListener('input', e => {
      const v = Number(e.target.value);
      if (isNaN(v) || v <= 0) return;
      clearTimeout(qtyTimer);
      qtyTimer = setTimeout(() => updateUsage({ quantity_used: v }), 600);
    });
    node.querySelector('[data-qty-action="inc"]').addEventListener('click', () => {
      const cur = get(); if (!cur) return;
      const v = Number(cur.quantity_used) + 1;
      qtyInput.value = v;
      updateUsage({ quantity_used: v });
    });
    node.querySelector('[data-qty-action="dec"]').addEventListener('click', () => {
      const cur = get(); if (!cur) return;
      const v = Math.max(1, Number(cur.quantity_used) - 1);
      qtyInput.value = v;
      updateUsage({ quantity_used: v });
    });
    noteInput.addEventListener('input', e => {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => updateUsage({ notes: e.target.value }), 700);
    });
    node.querySelector('[data-remove]').addEventListener('click', async () => {
      const cur = get();
      if (!cur) return;
      if (!confirm(`¿Eliminar "${cur.item_name}" del registro de uso? Se devolverá ${cur.quantity_used} ${cur.unit || ''} al inventario.`)) return;
      try {
        await api(`/api/inventory-usage/${usageId}`, { method: 'DELETE' });
        state.committedUsages = state.committedUsages.filter(u => u.id !== usageId);
        renderEditable(); notifyChange();
        toast('Artículo removido y stock devuelto');
      } catch (err) {
        toast(err.message || 'Error al eliminar', true);
      }
    });
  }

  // ── Search modal ──
  let modalEl = null;
  let searchTimer = null;
  function ensureSearchModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.className = 'ci-modal-overlay';
    modalEl.innerHTML = `
      <div class="ci-modal">
        <div class="ci-modal-head">
          ${icon('search', 18)}
          <h3>Buscar artículo del inventario</h3>
          <button type="button" class="ci-modal-close" id="ciModalClose" aria-label="Cerrar">✕</button>
        </div>
        <div class="ci-search-wrap">
          <span class="ci-search-icon">${icon('search', 16)}</span>
          <input type="search" class="ci-search-input" id="ciSearchInput" placeholder="Buscar por nombre, SKU, categoría o código de barras..." autocomplete="off">
        </div>
        <div class="ci-results" id="ciResults">
          <div class="ci-results-loading">Cargando inventario...</div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
    modalEl.addEventListener('click', e => { if (e.target === modalEl) closeSearchModal(); });
    modalEl.querySelector('#ciModalClose').addEventListener('click', closeSearchModal);
    const input = modalEl.querySelector('#ciSearchInput');
    input.addEventListener('input', e => {
      clearTimeout(searchTimer);
      const q = e.target.value.trim();
      searchTimer = setTimeout(() => searchInventory(q), 220);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modalEl?.classList.contains('open')) closeSearchModal();
    });
    return modalEl;
  }

  async function searchInventory(q) {
    const results = modalEl.querySelector('#ciResults');
    results.innerHTML = `<div class="ci-results-loading">Buscando...</div>`;
    try {
      const url = '/api/inventory' + (q ? `?search=${encodeURIComponent(q)}` : '');
      const items = await api(url);
      if (!items || items.length === 0) {
        results.innerHTML = `<div class="ci-results-empty">${icon('package', 28)}<div style="margin-top:.5rem;">No se encontraron artículos${q ? ` para "${escapeHtml(q)}"` : ''}.</div></div>`;
        return;
      }
      // Filter out archived/inactive and items already added (pending or committed)
      const usedIds = new Set([
        ...state.pendingItems.map(p => p.item.id),
        ...state.committedUsages.map(u => u.inventory_item_id)
      ]);
      const filtered = items.filter(it => !it.is_archived && it.is_active !== false);
      results.innerHTML = filtered.map(it => {
        const status = it.stock_status || deriveStockStatus(it);
        const expBadge = expirationBadge(it.expiration_date);
        const already = usedIds.has(it.id);
        return `
          <button type="button" class="ci-result ${status === 'agotado' ? 'disabled' : ''}" data-id="${it.id}" ${status === 'agotado' ? 'disabled' : ''}>
            <div class="ci-result-thumb">
              ${it.image_url ? `<img src="${escapeHtml(it.image_url)}" alt="">` : icon('package', 20)}
            </div>
            <div class="ci-result-info">
              <div class="ci-result-name">${escapeHtml(it.name)}${already ? ' <span style="color:#0891b2;font-size:.72rem;">(ya agregado · sumar más)</span>' : ''}</div>
              <div class="ci-result-meta">
                <span>${escapeHtml(it.category || TYPE_LABELS[it.type] || 'Sin categoría')}</span>
                <span class="dot">·</span>
                <span class="ci-badge ${status}">${status === 'agotado' ? 'Agotado' : status === 'bajo_stock' ? 'Bajo stock' : 'Disponible'}</span>
                ${expBadge}
              </div>
            </div>
            <div class="ci-result-stock">
              ${Number(it.current_stock).toLocaleString('es-HN')}<span class="unit">${escapeHtml(it.unit || '')}</span>
            </div>
          </button>
        `;
      }).join('');
      results.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.dataset.id, 10);
          const item = filtered.find(it => it.id === id);
          if (item) addItem(item);
        });
      });
    } catch (err) {
      results.innerHTML = `<div class="ci-results-empty">Error: ${escapeHtml(err.message)}</div>`;
    }
  }

  function openSearchModal() {
    ensureSearchModal();
    modalEl.classList.add('open');
    const input = modalEl.querySelector('#ciSearchInput');
    input.value = '';
    searchInventory('');
    setTimeout(() => input.focus(), 50);
  }
  function closeSearchModal() {
    if (modalEl) modalEl.classList.remove('open');
  }

  async function addItem(item) {
    closeSearchModal();
    // If item already in pending or committed: increment quantity instead of duplicating
    const existingPending = state.pendingItems.find(p => p.item.id === item.id);
    if (existingPending) {
      existingPending.quantity_used = Number(existingPending.quantity_used || 0) + 1;
      renderEditable(); notifyChange();
      toast(`Cantidad aumentada para ${item.name}`);
      return;
    }
    const existingCommitted = state.committedUsages.find(u => u.inventory_item_id === item.id);
    if (existingCommitted) {
      // Add an extra unit via PUT
      const newQty = Number(existingCommitted.quantity_used) + 1;
      try {
        const updated = await api(`/api/inventory-usage/${existingCommitted.id}`, { method: 'PUT', body: { quantity_used: newQty } });
        Object.assign(existingCommitted, updated);
        await reloadCommitted();
        renderEditable(); notifyChange();
        toast(`Cantidad aumentada para ${item.name}`);
      } catch (err) {
        toast(err.message || 'Error', true);
      }
      return;
    }

    if (state.options.consultationId) {
      // Persist immediately
      try {
        const created = await api('/api/inventory-usage', {
          method: 'POST',
          body: {
            consultation_id: state.options.consultationId,
            inventory_item_id: item.id,
            quantity_used: 1,
            consultation_type: state.options.consultationType
          }
        });
        state.committedUsages.push(created);
        renderEditable(); notifyChange();
        toast(`${item.name} agregado`);
      } catch (err) {
        toast(err.message || 'Error', true);
      }
    } else {
      // Add as pending
      state.pendingItems.push({
        tempId: tempId(),
        item,
        quantity_used: 1,
        notes: ''
      });
      renderEditable(); notifyChange();
    }
  }

  async function reloadCommitted() {
    if (!state.options.consultationId) { state.committedUsages = []; return; }
    try {
      const list = await api(`/api/inventory-usage?consultation_id=${state.options.consultationId}`);
      state.committedUsages = Array.isArray(list) ? list : [];
    } catch (err) {
      console.error('[ci] reloadCommitted', err);
    }
  }

  // ── Render: read-only mode ──
  function renderReadonly() {
    const usages = state.committedUsages;
    const totalCost = usages.reduce((s, u) => s + Number(u.total_cost || 0), 0);
    const alertCount = usages.filter(u => {
      if (u.item_current_stock != null) {
        const status = deriveStockStatus({ current_stock: u.item_current_stock, min_stock: u.item_min_stock });
        if (status === 'agotado' || status === 'bajo_stock') return true;
      }
      if (u.item_expiration_date) {
        const exp = new Date(u.item_expiration_date);
        if (!isNaN(exp.getTime())) {
          const today = new Date(); today.setHours(0, 0, 0, 0);
          if (exp - today < 30 * 86400000) return true;
        }
      }
      return false;
    }).length;

    const headHTML = `
      <div class="ci-head">
        <div class="ci-title-wrap">
          <div class="ci-icon-badge">${icon('boxes', 22)}</div>
          <div>
            <h3>Inventario usado en esta consulta</h3>
            <div class="ci-sub">Insumos, medicamentos y productos registrados durante la atención.</div>
          </div>
        </div>
      </div>
    `;

    if (usages.length === 0) {
      state.container.innerHTML = `<div class="ci-section">${headHTML}
        <div class="ci-empty">
          <div class="ci-empty-icon">${icon('package', 32)}</div>
          <p>No se registraron artículos de inventario en esta consulta.</p>
        </div>
      </div>`;
      return;
    }

    const summaryHTML = `
      <div class="ci-readonly-summary">
        <div class="stat"><div class="lbl">Total artículos</div><div class="val">${usages.length}</div></div>
        <div class="stat"><div class="lbl">Costo estimado</div><div class="val">${fmtMoney(totalCost)}</div></div>
        ${alertCount > 0 ? `<div class="stat"><div class="lbl">Con alertas</div><div class="val alert">${alertCount}</div></div>` : ''}
      </div>
    `;

    const itemsHTML = `<div class="ci-list">${usages.map(renderReadonlyCard).join('')}</div>`;
    state.container.innerHTML = `<div class="ci-section">${headHTML}${summaryHTML}${itemsHTML}</div>`;
  }

  function renderReadonlyCard(u) {
    const stockStatus = u.item_current_stock != null
      ? deriveStockStatus({ current_stock: u.item_current_stock, min_stock: u.item_min_stock })
      : null;
    const expBadge = expirationBadge(u.item_expiration_date);
    const linkBtn = u.inventory_item_id
      ? `<a href="/inventario.html" style="display:inline-flex;align-items:center;gap:.3rem;font-size:.78rem;color:#0891b2;font-weight:700;text-decoration:none;margin-top:.4rem;">${icon('arrowRight', 12)} Ver en inventario</a>`
      : '';

    return `
      <div class="ci-readonly-card">
        <div class="ci-item-thumb">
          ${u.item_image_url ? `<img src="${escapeHtml(u.item_image_url)}" alt="">` : icon('package', 28)}
        </div>
        <div class="ci-item-body">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.85rem;flex-wrap:wrap;">
            <div style="min-width:0;">
              <div class="ci-item-name">${escapeHtml(u.item_name || 'Artículo eliminado')}</div>
              <div class="ci-item-meta">
                <span>${escapeHtml(u.item_category || TYPE_LABELS[u.item_type] || 'Sin categoría')}</span>
                ${stockStatus ? `<span class="ci-badge ${stockStatus}">${stockStatus === 'agotado' ? 'Agotado' : stockStatus === 'bajo_stock' ? 'Bajo stock' : 'Disponible'}</span>` : ''}
                ${expBadge}
              </div>
            </div>
            <span class="ci-cost">${fmtMoney(u.total_cost)}</span>
          </div>
          <div class="ci-readonly-grid">
            <div class="ci-readonly-field"><div class="lbl">Cantidad</div><div class="val">${Number(u.quantity_used).toLocaleString('es-HN')} ${escapeHtml(u.unit || '')}</div></div>
            <div class="ci-readonly-field"><div class="lbl">Costo unitario</div><div class="val">${fmtMoney(u.unit_cost)}</div></div>
            <div class="ci-readonly-field"><div class="lbl">Ubicación</div><div class="val">${escapeHtml(u.item_area ? AREA_LABELS[u.item_area] || u.item_area : '—')}${u.item_location ? ' · ' + escapeHtml(u.item_location) : ''}</div></div>
            <div class="ci-readonly-field"><div class="lbl">Registrado por</div><div class="val">${escapeHtml(u.used_by_name || '—')}</div></div>
            <div class="ci-readonly-field"><div class="lbl">Fecha y hora</div><div class="val">${fmtDateTime(u.used_at || u.created_at)}</div></div>
            ${u.item_expiration_date ? `<div class="ci-readonly-field"><div class="lbl">Vencimiento</div><div class="val">${fmtDate(u.item_expiration_date)}</div></div>` : ''}
          </div>
          ${u.notes ? `<div class="ci-readonly-note">"${escapeHtml(u.notes)}"</div>` : ''}
          ${linkBtn}
        </div>
      </div>
    `;
  }

  // ── Public API ──
  const ConsultationInventory = {
    async mount(opts) {
      injectStyle();
      state.options = Object.assign({
        containerId: null,
        consultationId: null,
        consultationType: 'general',
        readonly: false,
        onChange: null,
      }, opts || {});

      state.container = document.getElementById(state.options.containerId);
      if (!state.container) {
        console.error('[ConsultationInventory] container not found:', state.options.containerId);
        return;
      }

      state.pendingItems = [];
      state.committedUsages = [];

      if (state.options.consultationId) {
        await reloadCommitted();
      }

      if (state.options.readonly) renderReadonly();
      else renderEditable();
      notifyChange();
    },

    async commit(consultationId) {
      if (!consultationId) throw new Error('consultationId requerido');
      if (state.pendingItems.length === 0) return { created: [], errors: [] };
      const payload = {
        consultation_id: consultationId,
        consultation_type: state.options?.consultationType || 'general',
        items: state.pendingItems.map(p => ({
          inventory_item_id: p.item.id,
          quantity_used: Number(p.quantity_used || 0),
          notes: p.notes || ''
        })).filter(p => p.quantity_used > 0)
      };
      if (payload.items.length === 0) return { created: [], errors: [] };
      try {
        const result = await api('/api/inventory-usage/bulk', { method: 'POST', body: payload });
        // Update local state
        state.options.consultationId = consultationId;
        state.pendingItems = [];
        await reloadCommitted();
        if (!state.options.readonly) renderEditable();
        notifyChange();
        return result;
      } catch (err) {
        toast('Error guardando inventario: ' + (err.message || ''), true);
        throw err;
      }
    },

    getPendingCount() { return state.pendingItems.length; },
    getCommittedCount() { return state.committedUsages.length; },
    hasPending() { return state.pendingItems.length > 0; }
  };

  global.ConsultationInventory = ConsultationInventory;
})(window);
