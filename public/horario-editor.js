/**
 * Editor del horario semanal del doctor — «Días que atiende».
 *
 * Es el mismo editor que vive en Citas Online (agendar-online.html): mismas
 * clases, mismos valores por defecto y la misma API (/api/doctor-availability),
 * así que lo que se cambia en Configuración se ve en Citas Online y al revés.
 * También manda en las horas que ofrece el selector de la agenda, porque
 * doctor-blocks.js lee de ahí.
 *
 * Uso:
 *   HorarioEditor.mount(document.getElementById('caja'), {
 *     role: 'doctor',                  // o 'clinic_admin' (sale el selector de doctor)
 *     onToast: (msg) => toast(msg),    // opcional
 *   });
 */
window.HorarioEditor = (function () {
  // Tope de lo que se puede pedir en una franja, igual que en Citas Online.
  const HOUR_START = 7;
  const HOUR_END = 21;
  // Horario que se aplica solo cuando el doctor todavía no configuró nada:
  // todos los días de 8 a 5, para que la agenda no arranque vacía.
  const DEFAULT_START = 8;
  const DEFAULT_END = 17;
  const DEFAULT_DURATION = 30;
  const DURATIONS = [15, 20, 30, 45, 60];

  // day_of_week: 0=domingo, 1=lunes, … 6=sábado
  const DAYS = [
    { dow: 1, label: 'Lunes' },
    { dow: 2, label: 'Martes' },
    { dow: 3, label: 'Miércoles' },
    { dow: 4, label: 'Jueves' },
    { dow: 5, label: 'Viernes' },
    { dow: 6, label: 'Sábado' },
    { dow: 0, label: 'Domingo' },
  ];

  const X_SVG = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const CLOCK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>';
  const USER_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>';
  const CHECK_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  // ---------- Estado ----------
  let root = null;
  let opts = {};
  let role = 'doctor';
  let doctorId = null;              // solo lo usa clinic_admin
  let availability = {};            // { 1: { enabled, slots: [{start, end}] }, … }
  let savedAvailability = {};
  let slotDuration = DEFAULT_DURATION;
  let savedSlotDuration = DEFAULT_DURATION;
  let editorState = null;           // franja que se está editando en el reloj
  let pickerHour = 8, pickerMinute = 0;

  // ---------- Helpers ----------
  const fmtHour = (h) => {
    const hr = Math.floor(h);
    const m = Math.round((h - hr) * 60);
    return `${String(hr).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  const parseHour = (str) => {
    const [h, m] = String(str).split(':').map(Number);
    return h + (m || 0) / 60;
  };
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const aviso = (msg) => {
    if (typeof opts.onToast === 'function') opts.onToast(msg);
    else if (typeof showToast === 'function') showToast(msg);
  };
  const $ = (sel) => root && root.querySelector(sel);

  // ---------- Estilos ----------
  // Copia de los de Citas Online, con los mismos tokens, para que las dos
  // pantallas se vean idénticas sin depender del CSS de la página que lo monta.
  function ensureStyles() {
    if (document.getElementById('hz-styles')) return;
    const style = document.createElement('style');
    style.id = 'hz-styles';
    style.textContent = `
      .hz-editor {
        --surface-2: #FFFFFF;
        --line: #E3E8EF;
        --line-2: #CFD6DF;
        --ink: #0F172A;
        --ink-2: #334155;
        --muted: #64748B;
        --muted-2: #94A3B8;
        --accent: #0891b2;
        --accent-ink: #155e75;
        --radius-lg: 14px;
        font-family: 'Poppins', sans-serif;
        color: var(--ink);
        font-size: 14px;
        display: grid;
        gap: 16px;
      }
      html[data-theme="dark"] .hz-editor {
        --surface-2: #18181a;
        --line: rgba(255, 255, 255, .08);
        --line-2: rgba(255, 255, 255, .14);
        --ink: #f1f5f9;
        --ink-2: #cbd5e1;
        --muted: #94a3b8;
        --muted-2: #64748b;
        --accent: #06b6d4;
        --accent-ink: #67e8f9;
      }
      .hz-editor *, .hz-editor *::before, .hz-editor *::after { box-sizing: border-box; }

      .hz-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
      .hz-title { font-size: 13px; font-weight: 600; color: var(--ink); }
      .hz-sub { font-size: 12px; color: var(--muted); margin-top: 3px; }
      .hz-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .hz-select {
        display: inline-flex; align-items: center; gap: 6px;
        border: 1px solid var(--line); border-radius: 9px;
        padding: 3px 8px; background: var(--surface-2); color: var(--muted);
      }
      .hz-select select {
        border: none; background: transparent;
        font-family: inherit; font-size: 13px;
        padding: 4px 20px 4px 2px;
        color: var(--ink); cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2'><polyline points='6 9 12 15 18 9'/></svg>");
        background-repeat: no-repeat;
        background-position: right 2px center;
      }
      .hz-select select:focus { outline: none; }

      /* Rejilla semanal — idéntica a .co-week-grid de Citas Online */
      .hz-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
      .hz-wd {
        border: 1px solid var(--line);
        border-radius: var(--radius-lg);
        background: var(--surface-2);
        padding: 10px 10px 9px;
        display: grid; gap: 8px; align-content: start;
      }
      .hz-wd.is-off { opacity: 0.6; }
      .hz-wd-top {
        display: inline-flex; align-items: center; gap: 8px;
        cursor: pointer; user-select: none; font-size: 12.5px;
      }
      .hz-wd-name { font-weight: 600; }
      .hz-wd-blocks { display: flex; flex-wrap: wrap; gap: 5px; }
      .hz-blk {
        display: inline-flex; align-items: center; gap: 3px;
        font-size: 11px;
        padding: 3px 4px 3px 7px; border-radius: 7px;
        background: color-mix(in oklch, var(--accent) 12%, transparent);
        border: 1px solid color-mix(in oklch, var(--accent) 28%, transparent);
        color: var(--accent-ink);
      }
      .hz-blk .t { cursor: pointer; }
      .hz-blk .x {
        width: 15px; height: 15px; border-radius: 4px;
        display: inline-flex; align-items: center; justify-content: center;
        opacity: 0.55; cursor: pointer;
      }
      .hz-blk .x:hover { opacity: 1; background: color-mix(in oklch, var(--accent) 22%, transparent); }
      .hz-wd-add {
        border: 1px dashed var(--line-2); background: transparent;
        color: var(--muted); font-family: inherit; font-size: 11px;
        padding: 3px 8px; border-radius: 7px; cursor: pointer;
      }
      .hz-wd-add:hover { color: var(--accent-ink); border-color: color-mix(in oklch, var(--accent) 45%, transparent); }
      .hz-wd-rest { font-size: 11px; color: var(--muted-2); }

      .hz-switch {
        width: 30px; height: 18px; border-radius: 999px;
        background: color-mix(in oklch, var(--ink) 18%, transparent);
        position: relative; transition: background 160ms ease; flex-shrink: 0;
      }
      .hz-switch::after {
        content: ""; position: absolute; top: 2px; left: 2px;
        width: 14px; height: 14px; border-radius: 50%;
        background: white;
        box-shadow: 0 1px 2px color-mix(in oklch, var(--ink) 18%, transparent);
        transition: transform 160ms ease;
      }
      .hz-switch.on { background: var(--accent); }
      .hz-switch.on::after { transform: translateX(12px); }

      .hz-foot {
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px; flex-wrap: wrap;
        padding-top: 12px; border-top: 1px solid var(--line);
        font-size: 12.5px; color: var(--muted);
      }
      .hz-summary { display: flex; gap: 22px; }
      .hz-summary b { color: var(--ink); font-weight: 600; }
      .hz-save {
        display: inline-flex; align-items: center; gap: 7px;
        height: 34px; padding: 0 14px; border-radius: 10px;
        border: 1px solid var(--line);
        background: var(--surface-2); color: var(--ink-2);
        font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
      }
      .hz-save:disabled { opacity: 0.5; cursor: not-allowed; }
      .hz-save.primary {
        background: var(--accent); border-color: var(--accent); color: #fff;
        box-shadow: 0 8px 22px -12px color-mix(in oklch, var(--accent) 70%, transparent);
      }
      .hz-note {
        font-size: 12px; color: var(--muted);
        border: 1px dashed var(--line-2); border-radius: 10px; padding: 10px 12px;
      }

      /* Reloj para elegir inicio y fin de la franja — el de Citas Online */
      .hz-tp {
        position: fixed; inset: 0;
        background: rgba(15, 23, 42, 0.45);
        display: none; align-items: center; justify-content: center;
        z-index: 2100; font-family: 'Poppins', sans-serif;
      }
      .hz-tp.active { display: flex; }
      .hz-tp-card {
        background: #fff; border-radius: 16px; padding: 22px;
        width: min(340px, 92vw);
        box-shadow: 0 30px 60px rgba(15, 23, 42, 0.2);
      }
      html[data-theme="dark"] .hz-tp-card { background: #18181a; }
      .hz-tp-title { font-size: 13px; color: #64748B; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 14px; }
      .hz-tp-display {
        text-align: center; font-size: 44px; font-weight: 600;
        color: #0F172A; margin: 4px 0 18px; letter-spacing: -0.02em;
      }
      html[data-theme="dark"] .hz-tp-display { color: #f1f5f9; }
      .hz-tp-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
      .hz-tp-group { display: grid; gap: 6px; }
      .hz-tp-label { font-size: 11px; color: #64748B; letter-spacing: 0.1em; text-transform: uppercase; text-align: center; }
      .hz-tp-btns { display: flex; gap: 6px; justify-content: center; }
      .hz-tp-btns button {
        width: 38px; height: 38px; border-radius: 10px;
        border: 1px solid #E3E8EF; background: #F7F9FC; color: #0F172A;
        font-size: 18px; font-weight: 600; cursor: pointer;
      }
      html[data-theme="dark"] .hz-tp-btns button {
        border-color: rgba(255,255,255,.12); background: rgba(255,255,255,.04); color: #f1f5f9;
      }
      .hz-tp-actions { display: flex; gap: 8px; justify-content: flex-end; }
      .hz-tp-actions button {
        height: 36px; padding: 0 14px; border-radius: 10px;
        font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
      }
      .hz-tp-actions .cancel { background: #F7F9FC; border: 1px solid #E3E8EF; color: #334155; }
      html[data-theme="dark"] .hz-tp-actions .cancel {
        background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.12); color: #cbd5e1;
      }
      .hz-tp-actions .confirm { background: #0F172A; border: 1px solid #0F172A; color: #fff; }
      html[data-theme="dark"] .hz-tp-actions .confirm { background: #06b6d4; border-color: #06b6d4; color: #08282e; }

      @media (max-width: 1100px) {
        .hz-week { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      }
      @media (max-width: 640px) {
        .hz-week { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .hz-foot { justify-content: flex-start; }
      }
    `;
    document.head.appendChild(style);
  }

  // ---------- Rejilla semanal ----------
  function renderWeek() {
    const grid = $('#hzWeek');
    if (!grid) return;

    grid.innerHTML = DAYS.map(day => {
      const data = availability[day.dow] || { enabled: false, slots: [] };
      const enabled = !!data.enabled;
      const blocks = data.slots.map((s, i) => `
        <span class="hz-blk">
          <span class="t" data-edit-slot="${day.dow}:${i}" title="Cambiar la hora">${fmtHour(s.start)}–${fmtHour(s.end)}</span>
          <span class="x" data-del-slot="${day.dow}:${i}" title="Quitar franja">${X_SVG}</span>
        </span>`).join('');
      return `
        <div class="hz-wd ${enabled ? '' : 'is-off'}">
          <label class="hz-wd-top" data-toggle="${day.dow}">
            <span class="hz-switch ${enabled ? 'on' : ''}"></span>
            <span class="hz-wd-name">${day.label}</span>
          </label>
          ${enabled
            ? `<div class="hz-wd-blocks">${blocks}<button type="button" class="hz-wd-add" data-add="${day.dow}">+ franja</button></div>`
            : '<div class="hz-wd-rest">No atiende</div>'}
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-toggle]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        toggleWeekday(Number(el.dataset.toggle));
      });
    });
    grid.querySelectorAll('[data-add]').forEach(el => {
      el.addEventListener('click', () => addBlock(Number(el.dataset.add)));
    });
    grid.querySelectorAll('[data-del-slot]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const [dow, idx] = el.dataset.delSlot.split(':').map(Number);
        const data = availability[dow];
        if (!data) return;
        availability[dow] = { ...data, slots: data.slots.filter((_, i) => i !== idx) };
        afterChange();
      });
    });
    grid.querySelectorAll('[data-edit-slot]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const [dow, idx] = el.dataset.editSlot.split(':').map(Number);
        openSlotEditor(dow, idx);
      });
    });
  }

  function toggleWeekday(dow) {
    const cur = availability[dow] || { enabled: false, slots: [] };
    const enabled = !cur.enabled;
    availability[dow] = {
      enabled,
      slots: enabled && cur.slots.length === 0
        ? [{ start: DEFAULT_START, end: DEFAULT_END }]
        : cur.slots,
    };
    afterChange();
  }

  function addBlock(dow) {
    const data = availability[dow] || { enabled: true, slots: [] };
    const last = data.slots[data.slots.length - 1];
    const start = last ? last.end : DEFAULT_START;
    const end = Math.min(start + 1, HOUR_END);
    if (end - start < 0.5) {
      aviso(`No queda espacio después de las ${fmtHour(HOUR_END)}`);
      return;
    }
    availability[dow] = { ...data, enabled: true, slots: [...data.slots, { start, end }] };
    afterChange();
  }

  function afterChange() {
    renderWeek();
    renderSummary();
    updateSaveBtn();
  }

  function renderSummary() {
    let h = 0, turnos = 0;
    DAYS.forEach(d => {
      const a = availability[d.dow];
      if (!a || !a.enabled) return;
      a.slots.forEach(s => {
        h += s.end - s.start;
        turnos += Math.floor(((s.end - s.start) * 60) / slotDuration);
      });
    });
    const hrs = $('#hzHrs'), slots = $('#hzSlots');
    if (hrs) hrs.textContent = h.toFixed(1);
    if (slots) slots.textContent = String(turnos);
  }

  function isDirty() {
    return JSON.stringify(availability) !== JSON.stringify(savedAvailability) ||
           slotDuration !== savedSlotDuration;
  }

  function updateSaveBtn() {
    const btn = $('#hzSave');
    const label = $('#hzSaveLabel');
    if (!btn || !label) return;
    const dirty = isDirty();
    btn.disabled = !dirty;
    btn.classList.toggle('primary', dirty);
    label.textContent = dirty ? 'Guardar cambios' : 'Sin cambios';
  }

  // ---------- Reloj de inicio / fin ----------
  function ensurePicker() {
    if (document.getElementById('hzTimePicker')) return;
    const modal = document.createElement('div');
    modal.className = 'hz-tp';
    modal.id = 'hzTimePicker';
    modal.innerHTML = `
      <div class="hz-tp-card">
        <div class="hz-tp-title" id="hzTpTitle">Hora de inicio</div>
        <div class="hz-tp-display" id="hzTpDisplay">08:00</div>
        <div class="hz-tp-controls">
          <div class="hz-tp-group">
            <div class="hz-tp-label">Hora</div>
            <div class="hz-tp-btns">
              <button type="button" id="hzHourDown">−</button>
              <button type="button" id="hzHourUp">+</button>
            </div>
          </div>
          <div class="hz-tp-group">
            <div class="hz-tp-label">Minuto</div>
            <div class="hz-tp-btns">
              <button type="button" id="hzMinDown">−</button>
              <button type="button" id="hzMinUp">+</button>
            </div>
          </div>
        </div>
        <div class="hz-tp-actions">
          <button type="button" class="cancel" id="hzTpCancel">Cancelar</button>
          <button type="button" class="confirm" id="hzTpOk">OK</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const upd = () => {
      document.getElementById('hzTpDisplay').textContent =
        `${String(pickerHour).padStart(2, '0')}:${String(pickerMinute).padStart(2, '0')}`;
    };
    document.getElementById('hzHourUp').addEventListener('click', () => { pickerHour = (pickerHour + 1) % 24; upd(); });
    document.getElementById('hzHourDown').addEventListener('click', () => { pickerHour = (pickerHour - 1 + 24) % 24; upd(); });
    document.getElementById('hzMinUp').addEventListener('click', () => { pickerMinute = (pickerMinute + 30) % 60; upd(); });
    document.getElementById('hzMinDown').addEventListener('click', () => { pickerMinute = (pickerMinute - 30 + 60) % 60; upd(); });
    document.getElementById('hzTpCancel').addEventListener('click', () => { editorState = null; closePicker(); });
    document.getElementById('hzTpOk').addEventListener('click', confirmPicker);
  }

  function openPicker(value, title) {
    ensurePicker();
    pickerHour = Math.floor(value);
    pickerMinute = Math.round((value - pickerHour) * 60);
    document.getElementById('hzTpTitle').textContent = title;
    document.getElementById('hzTpDisplay').textContent =
      `${String(pickerHour).padStart(2, '0')}:${String(pickerMinute).padStart(2, '0')}`;
    document.getElementById('hzTimePicker').classList.add('active');
  }

  function closePicker() {
    const el = document.getElementById('hzTimePicker');
    if (el) el.classList.remove('active');
  }

  function openSlotEditor(dow, idx) {
    const slot = availability[dow] && availability[dow].slots[idx];
    if (!slot) return;
    editorState = { dow, idx, mode: 'start', start: slot.start, end: slot.end };
    openPicker(slot.start, 'Hora de inicio');
  }

  // Primero el inicio, luego el fin: dos pasadas por el mismo reloj.
  function confirmPicker() {
    if (!editorState) { closePicker(); return; }
    const value = pickerHour + pickerMinute / 60;
    if (editorState.mode === 'start') {
      editorState.start = value;
      editorState.mode = 'end';
      closePicker();
      setTimeout(() => openPicker(editorState.end, 'Hora de fin'), 80);
      return;
    }
    editorState.end = value;
    if (editorState.end <= editorState.start) {
      aviso('La hora de fin debe ser mayor que el inicio');
      editorState = null; closePicker(); return;
    }
    if (editorState.end > HOUR_END || editorState.start < HOUR_START) {
      aviso(`Horario permitido: ${HOUR_START}:00 – ${HOUR_END}:00`);
      editorState = null; closePicker(); return;
    }
    const { dow, idx, start, end } = editorState;
    const data = availability[dow];
    if (!data) { editorState = null; closePicker(); return; }
    const overlaps = data.slots.some((s, i) => i !== idx && !(end <= s.start || start >= s.end));
    if (overlaps) {
      aviso('Ese horario se solapa con otro bloque');
      editorState = null; closePicker(); return;
    }
    availability[dow] = {
      ...data,
      slots: data.slots.map((s, i) => (i === idx ? { start, end } : s)).sort((a, b) => a.start - b.start),
    };
    editorState = null;
    closePicker();
    afterChange();
  }

  // ---------- Carga y guardado ----------
  async function save({ silent = false } = {}) {
    const payload = [];
    DAYS.forEach(d => {
      const data = availability[d.dow];
      if (!data || !data.enabled) return;
      data.slots.forEach(s => {
        payload.push({
          day_of_week: d.dow,
          start_time: fmtHour(s.start),
          end_time: fmtHour(s.end),
          slot_duration: slotDuration,
          enabled: true,
        });
      });
    });
    try {
      const body = { availability: payload };
      if (role === 'clinic_admin' && doctorId) body.doctor_id = doctorId;
      await api('/api/doctor-availability', { method: 'PUT', body, quiet: silent });
      savedAvailability = JSON.parse(JSON.stringify(availability));
      savedSlotDuration = slotDuration;
      updateSaveBtn();
      // El selector de la agenda tiene su propia caché de bloqueos.
      if (window.DoctorBlocks && doctorId) DoctorBlocks.invalidate(doctorId);
      if (!silent) aviso('Horario guardado');
      return true;
    } catch (e) {
      if (!silent) aviso('Error al guardar: ' + e.message);
      return false;
    }
  }

  async function load() {
    try {
      const url = role === 'clinic_admin' && doctorId
        ? `/api/doctor-availability?doctor_id=${doctorId}`
        : '/api/doctor-availability';
      const rows = await api(url);
      const map = {};
      DAYS.forEach(d => { map[d.dow] = { enabled: false, slots: [] }; });

      if (!rows.length) {
        // Nunca configuró nada: se propone el horario por defecto y se deja
        // guardado, igual que hace Citas Online, para que la agenda y el enlace
        // público empiecen a respetarlo desde ya.
        DAYS.forEach(d => { map[d.dow] = { enabled: true, slots: [{ start: DEFAULT_START, end: DEFAULT_END }] }; });
        slotDuration = DEFAULT_DURATION;
        availability = map;
        savedAvailability = {};
        savedSlotDuration = null;
        renderAll();
        const ok = await save({ silent: true });
        if (ok) aviso(`Horario por defecto: todos los días de ${fmtHour(DEFAULT_START)} a ${fmtHour(DEFAULT_END)}`);
        renderAll();
        return;
      }

      rows.forEach(r => {
        if (!map[r.day_of_week]) map[r.day_of_week] = { enabled: false, slots: [] };
        map[r.day_of_week].enabled = true;
        map[r.day_of_week].slots.push({ start: parseHour(r.start_time), end: parseHour(r.end_time) });
      });
      Object.keys(map).forEach(k => map[k].slots.sort((a, b) => a.start - b.start));
      slotDuration = Number(rows[0].slot_duration) || DEFAULT_DURATION;
      savedSlotDuration = slotDuration;
      availability = map;
      savedAvailability = JSON.parse(JSON.stringify(map));
      renderAll();
    } catch (e) {
      console.error(e);
      aviso('No se pudo cargar el horario');
    }
  }

  async function loadDoctors() {
    const row = $('#hzDoctorRow');
    const sel = $('#hzDoctor');
    if (!row || !sel) return;
    try {
      const doctors = await api('/api/users/doctors');
      if (!doctors.length) return;
      row.style.display = '';
      sel.innerHTML = doctors
        .map(d => `<option value="${d.id}">${esc(d.name || d.email)}</option>`)
        .join('');
      doctorId = Number(doctors[0].id);
      sel.value = String(doctorId);
      sel.addEventListener('change', () => {
        if (isDirty() && !confirm('Hay cambios sin guardar en este horario. ¿Cambiar de doctor y perderlos?')) {
          sel.value = String(doctorId);
          return;
        }
        doctorId = Number(sel.value);
        load();
      });
    } catch (e) {
      console.error(e);
    }
  }

  function syncDurationSelect() {
    const sel = $('#hzDuration');
    if (!sel) return;
    const options = DURATIONS.includes(slotDuration) ? DURATIONS : [...DURATIONS, slotDuration].sort((a, b) => a - b);
    sel.innerHTML = options.map(d => `<option value="${d}">Citas de ${d} min</option>`).join('');
    sel.value = String(slotDuration);
  }

  function renderAll() {
    syncDurationSelect();
    renderWeek();
    renderSummary();
    updateSaveBtn();
  }

  // ---------- Montaje ----------
  function mount(el, options = {}) {
    if (!el) return;
    ensureStyles();
    root = el;
    opts = options;
    role = options.role || 'doctor';

    root.classList.add('hz-editor');
    root.innerHTML = `
      <div class="hz-head">
        <div>
          <div class="hz-title">Días que atiende</div>
          <div class="hz-sub">El horario general de cada semana. Tocá una franja para cambiar la hora de inicio y fin.</div>
        </div>
        <div class="hz-controls">
          <div class="hz-select" id="hzDoctorRow" style="display:none;">
            ${USER_SVG}<select id="hzDoctor" aria-label="Doctor"></select>
          </div>
          <div class="hz-select">
            ${CLOCK_SVG}<select id="hzDuration" aria-label="Duración de cada cita"></select>
          </div>
        </div>
      </div>
      <div class="hz-week" id="hzWeek"></div>
      <div class="hz-note">
        Este es el mismo horario que usa Citas Online: las horas que quites acá dejan
        de ofrecerse en el enlace público y desaparecen del selector al agendar una cita.
        Para cerrar un día suelto o quitar horas de una fecha concreta, entrá a Citas Online.
      </div>
      <div class="hz-foot">
        <div class="hz-summary">
          <span><b id="hzHrs">0.0</b> h/sem</span>
          <span><b id="hzSlots">0</b> turnos</span>
        </div>
        <button type="button" class="hz-save" id="hzSave" disabled>
          ${CHECK_SVG}<span id="hzSaveLabel">Sin cambios</span>
        </button>
      </div>`;

    $('#hzDuration').addEventListener('change', (e) => {
      slotDuration = Number(e.target.value) || DEFAULT_DURATION;
      afterChange();
    });
    $('#hzSave').addEventListener('click', () => save());

    (async () => {
      if (role === 'clinic_admin') await loadDoctors();
      await load();
    })();
  }

  return { mount, reload: load, isDirty };
})();
