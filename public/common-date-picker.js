/**
 * Calendar Datetime Picker
 *
 * El selector de hora sigue el mismo criterio que «Selecciona un horario» de
 * Citas Online (agendar-online.html): las horas en las que el doctor no atiende
 * no se muestran, y las que se ven tachadas —en gris, sin rojos— son las que ya
 * tienen una cita. Los motivos los pone DoctorBlocks (doctor-blocks.js).
 */

// Los estilos del selector de hora viven aquí para que las tres pantallas que
// usan el picker (citas, recepción, pacientes) se vean igual sin copiar CSS.
function ensureCalendarPickerStyles() {
  if (document.getElementById('cdp-styles')) return;
  const style = document.createElement('style');
  style.id = 'cdp-styles';
  style.textContent = `
    .cdp-wrapper .cdp-time {
      display: flex; flex-direction: column; gap: .5rem; width: 100%;
      padding: .75rem; border: 1px solid #e2e8f0; border-radius: 6px;
      background: #f9fafb;
    }
    .cdp-wrapper .cdp-time-label {
      font-size: .75rem; font-weight: 600; color: #374151; margin-bottom: .3rem;
    }
    .cdp-wrapper .cdp-slots { display: grid; gap: 14px; }
    .cdp-wrapper .cdp-slot-group-head {
      display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 7px;
    }
    .cdp-wrapper .cdp-slot-group-title { font-size: 12px; font-weight: 600; color: #334155; }
    .cdp-wrapper .cdp-slot-group-count { font-size: 11px; color: #94a3b8; }
    .cdp-wrapper .cdp-slot-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 6px;
    }
    .cdp-wrapper .cdp-slot {
      border: 1px solid #e3e8ef; border-radius: 9px; background: #fff;
      padding: 8px 6px 7px; font-family: inherit; font-size: 12px; color: #334155;
      text-align: center; line-height: 1.15; cursor: pointer;
      transition: border-color .15s ease;
    }
    .cdp-wrapper .cdp-slot:hover:not(:disabled) { border-color: rgba(8, 145, 178, .55); }
    .cdp-wrapper .cdp-slot small {
      display: block; margin-top: 3px; font-size: 8.5px;
      letter-spacing: .06em; text-transform: uppercase; color: #94a3b8;
    }
    .cdp-wrapper .cdp-slot.is-sel {
      border-color: #0891b2; background: #0891b2; color: #fff; font-weight: 600;
    }
    .cdp-wrapper .cdp-slot.is-sel small { color: rgba(255, 255, 255, .85); }
    .cdp-wrapper .cdp-slot.is-busy,
    .cdp-wrapper .cdp-slot.is-off {
      border-style: dashed; border-color: #cfd6df; background: transparent;
      color: #94a3b8; cursor: not-allowed;
    }
    .cdp-wrapper .cdp-slot.is-busy .h,
    .cdp-wrapper .cdp-slot.is-off .h { text-decoration: line-through; }
    .cdp-wrapper .cdp-note {
      border: 1px dashed #cfd6df; border-radius: 10px;
      padding: 18px 14px; text-align: center; color: #64748b; font-size: 12.5px;
    }
    /* Modo oscuro: los colores de arriba son inline-equivalentes, así que aquí
       se repiten con !important porque theme-dark.css pinta los botones del
       picker de forma genérica. */
    html[data-theme="dark"] .cdp-wrapper .cdp-slot {
      background: rgba(255, 255, 255, .04) !important;
      border-color: rgba(255, 255, 255, .12) !important;
      color: #cbd5e1 !important;
    }
    html[data-theme="dark"] .cdp-wrapper .cdp-slot .h { color: inherit !important; }
    html[data-theme="dark"] .cdp-wrapper .cdp-slot small { color: rgba(148, 163, 184, .8) !important; }
    html[data-theme="dark"] .cdp-wrapper .cdp-slot.is-sel,
    html[data-theme="dark"] .cdp-wrapper .cdp-slot.is-sel .h {
      background: #0891b2 !important; border-color: #0891b2 !important; color: #fff !important;
    }
    html[data-theme="dark"] .cdp-wrapper .cdp-slot.is-busy,
    html[data-theme="dark"] .cdp-wrapper .cdp-slot.is-off {
      background: transparent !important;
      border: 1px dashed rgba(255, 255, 255, .18) !important;
      color: rgba(148, 163, 184, .75) !important;
    }
    html[data-theme="dark"] .cdp-wrapper .cdp-slot-group-title { color: #e2e8f0 !important; }
    html[data-theme="dark"] .cdp-wrapper .cdp-slot-group-count,
    html[data-theme="dark"] .cdp-wrapper .cdp-note { color: rgba(148, 163, 184, .9) !important; }
    html[data-theme="dark"] .cdp-wrapper .cdp-note { border-color: rgba(255, 255, 255, .16) !important; }
  `;
  document.head.appendChild(style);
}

function replaceWithCalendarDatetimePicker(input, options = {}) {
  ensureCalendarPickerStyles();
  const wrapper = document.createElement('div');
  wrapper.className = 'cdp-wrapper';
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = '0.5rem';
  const getOccupiedHours = options.getOccupiedHours || (() => []);

  const today = new Date();
  let selectedYear = today.getFullYear();
  let selectedMonth = today.getMonth();
  let selectedDay = today.getDate();
  let selectedHour = today.getHours();
  let selectedMinute = today.getMinutes();

  const currentValue = input.value;
  if (currentValue) {
    const [datePart, timePart] = currentValue.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    selectedYear = year;
    selectedMonth = month - 1;
    selectedDay = day;
    selectedHour = hour;
    selectedMinute = minute;
  }

  // Update input function
  const updateInput = () => {
    const month = (selectedMonth + 1).toString().padStart(2, '0');
    const day = selectedDay.toString().padStart(2, '0');
    const hour = selectedHour.toString().padStart(2, '0');
    const minute = selectedMinute.toString().padStart(2, '0');
    input.value = `${selectedYear}-${month}-${day}T${hour}:${minute}`;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Calendar section
  const calContainer = document.createElement('div');
  calContainer.style.display = 'flex';
  calContainer.style.flexDirection = 'column';
  calContainer.style.gap = '0.4rem';
  calContainer.style.width = '100%';
  calContainer.style.padding = '0.75rem';
  calContainer.style.border = '1px solid #e2e8f0';
  calContainer.style.borderRadius = '6px';
  calContainer.style.backgroundColor = '#f9fafb';

  const calLabel = document.createElement('label');
  calLabel.textContent = 'Fecha';
  calLabel.style.fontSize = '.75rem';
  calLabel.style.fontWeight = '600';
  calLabel.style.color = '#374151';
  calLabel.style.marginBottom = '0.3rem';
  calContainer.appendChild(calLabel);

  const monthYearSpan = document.createElement('span');
  monthYearSpan.style.fontSize = '.8rem';
  monthYearSpan.style.fontWeight = '600';
  monthYearSpan.style.color = '#0f172a';
  monthYearSpan.style.textAlign = 'center';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '‹';
  prevBtn.style.background = 'none';
  prevBtn.style.border = 'none';
  prevBtn.style.color = '#475569';
  prevBtn.style.borderRadius = '6px';
  prevBtn.style.padding = '0.25rem 0.5rem';
  prevBtn.style.cursor = 'pointer';
  prevBtn.style.fontSize = '.8rem';
  prevBtn.type = 'button';

  const nextBtn = document.createElement('button');
  nextBtn.textContent = '›';
  nextBtn.style.background = 'none';
  nextBtn.style.border = 'none';
  nextBtn.style.color = '#475569';
  nextBtn.style.borderRadius = '6px';
  nextBtn.style.padding = '0.25rem 0.5rem';
  nextBtn.style.cursor = 'pointer';
  nextBtn.style.fontSize = '.8rem';
  nextBtn.type = 'button';

  const navContainer = document.createElement('div');
  navContainer.style.display = 'flex';
  navContainer.style.alignItems = 'center';
  navContainer.style.justifyContent = 'center';
  navContainer.style.gap = '0.4rem';
  navContainer.style.marginBottom = '0.3rem';

  const calGrid = document.createElement('div');
  calGrid.style.display = 'grid';
  calGrid.style.gridTemplateColumns = 'repeat(7, 1fr)';
  calGrid.style.gap = '0.25rem';

  const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const DAY_SHORT = ['L','M','X','J','V','S','D'];

  const renderCalendar = () => {
    monthYearSpan.textContent = MONTH_NAMES[selectedMonth] + ' ' + selectedYear;
    calGrid.innerHTML = '';

    DAY_SHORT.forEach(d => {
      const header = document.createElement('div');
      header.textContent = d;
      header.style.textAlign = 'center';
      header.style.fontSize = '.7rem';
      header.style.fontWeight = '600';
      header.style.color = '#94a3b8';
      header.style.padding = '0.2rem 0';
      calGrid.appendChild(header);
    });

    const first = new Date(selectedYear, selectedMonth, 1);
    const last = new Date(selectedYear, selectedMonth + 1, 0);
    const startDay = (first.getDay() + 6) % 7;

    for (let i = 0; i < startDay; i++) {
      calGrid.appendChild(document.createElement('div'));
    }

    for (let d = 1; d <= last.getDate(); d++) {
      const btn = document.createElement('button');
      btn.textContent = d;
      btn.type = 'button';
      btn.style.padding = '0.5rem';
      btn.style.border = '1px solid #f1f5f9';
      btn.style.borderRadius = '6px';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '.85rem';
      btn.style.background = 'white';
      btn.style.color = '#475569';
      btn.style.fontWeight = d === selectedDay ? '700' : '500';
      btn.style.minHeight = '32px';

      if (d === selectedDay) {
        btn.style.background = '#0891b2';
        btn.style.color = 'white';
        btn.style.borderColor = '#0891b2';
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        selectedDay = d;
        renderCalendar();
        renderTimeGrid();
        updateInput();
      });

      calGrid.appendChild(btn);
    }
  };

  prevBtn.addEventListener('click', (e) => {
    e.preventDefault();
    selectedMonth--;
    if (selectedMonth < 0) {
      selectedMonth = 11;
      selectedYear--;
    }
    renderCalendar();
    renderTimeGrid();
  });

  nextBtn.addEventListener('click', (e) => {
    e.preventDefault();
    selectedMonth++;
    if (selectedMonth > 11) {
      selectedMonth = 0;
      selectedYear++;
    }
    renderCalendar();
    renderTimeGrid();
  });

  navContainer.appendChild(prevBtn);
  navContainer.appendChild(monthYearSpan);
  navContainer.appendChild(nextBtn);
  calContainer.appendChild(navContainer);
  calContainer.appendChild(calGrid);

  // ── Selector de hora ────────────────────────────────────────────────────
  // Mismo criterio que «Selecciona un horario» de Citas Online: las horas en
  // las que el doctor no atiende (día cerrado, día de descanso, fuera de su
  // horario, o quitadas a mano) no se muestran; las que se ven tachadas son
  // las que ya tienen una cita. Nada en rojo.
  const timeContainer = document.createElement('div');
  timeContainer.className = 'cdp-time';

  const timeLabel = document.createElement('label');
  timeLabel.className = 'cdp-time-label';
  timeLabel.textContent = 'Hora';

  const timeGrid = document.createElement('div');
  timeGrid.className = 'cdp-slots';

  // Motivos que devuelve DoctorBlocks cuando el doctor no atiende esa casilla.
  // Esas horas se ocultan; lo que llega sin motivo es una cita ya agendada.
  const BLOCK_NOTES = {
    closed:   'El doctor cerró este día en su disponibilidad.',
    blocked:  'El doctor quitó estas horas de este día.',
    dayoff:   'El doctor no atiende este día según su horario de atención.',
    offhours: 'Fuera del horario de atención del doctor.',
  };
  // Cuál explicar cuando el día se queda sin ninguna hora: gana el motivo más
  // amplio, que es el que de verdad describe el día.
  const NOTE_ORDER = ['closed', 'dayoff', 'offhours', 'blocked'];

  const GRID_MINUTES = 30;
  const DAY_MINUTES = 24 * 60;
  const fmtSlot = (min) => {
    const h = Math.floor(min / 60), m = min % 60;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };

  const renderTimeGrid = () => {
    timeGrid.innerHTML = '';
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    const cells = getOccupiedHours(dateStr) || [];

    const blocked = new Map();   // minuto → motivo (el doctor no atiende)
    const busy = new Set();      // minuto → ya hay una cita
    cells.forEach(c => {
      // A la casilla de media hora que la contiene: una cita a las 09:15 tapa
      // las 09:00, que es la única de las dos que el selector ofrece.
      const key = Math.floor((c.h * 60 + c.m) / GRID_MINUTES) * GRID_MINUTES;
      if (c.reason && BLOCK_NOTES[c.reason]) {
        if (!blocked.has(key)) blocked.set(key, c.reason);
      } else {
        busy.add(key);
      }
    });

    const selectedMin = selectedHour * 60 + selectedMinute;
    const slots = [];
    for (let min = 0; min < DAY_MINUTES; min += GRID_MINUTES) {
      // Una cita se ve aunque el doctor haya cerrado esa hora después: es la
      // explicación de por qué no se puede agendar ahí.
      if (busy.has(min)) { slots.push({ min, state: 'busy' }); continue; }
      if (blocked.has(min)) {
        // La hora ya elegida nunca desaparece: si no, al editar una cita vieja
        // el selector se quedaba sin marcar nada.
        if (min === selectedMin) slots.push({ min, state: 'off' });
        continue;
      }
      slots.push({ min, state: 'free' });
    }

    const libres = slots.filter(s => s.state === 'free').length;
    if (!libres) {
      const motivo = NOTE_ORDER.find(r => [...blocked.values()].includes(r));
      const note = document.createElement('div');
      note.className = 'cdp-note';
      note.textContent = motivo
        ? BLOCK_NOTES[motivo]
        : 'No queda ninguna hora libre este día.';
      timeGrid.appendChild(note);
      if (!slots.length) return;
    }

    const groups = [
      { title: 'Mañana', slots: slots.filter(s => s.min < 12 * 60) },
      { title: 'Tarde', slots: slots.filter(s => s.min >= 12 * 60) },
    ].filter(g => g.slots.length);

    groups.forEach(g => {
      const wrap = document.createElement('div');

      const head = document.createElement('div');
      head.className = 'cdp-slot-group-head';
      const title = document.createElement('div');
      title.className = 'cdp-slot-group-title';
      title.textContent = g.title;
      const count = document.createElement('div');
      count.className = 'cdp-slot-group-count';
      const libresGrupo = g.slots.filter(s => s.state === 'free').length;
      count.textContent = `${libresGrupo} ${libresGrupo === 1 ? 'libre' : 'libres'}`;
      head.appendChild(title);
      head.appendChild(count);

      const grid = document.createElement('div');
      grid.className = 'cdp-slot-grid';

      g.slots.forEach(s => {
        const h = Math.floor(s.min / 60), m = s.min % 60;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cdp-slot';
        const isSel = s.min === selectedMin;
        if (s.state === 'busy') { btn.classList.add('is-busy'); btn.disabled = true; btn.title = 'Ya hay una cita a esta hora'; }
        else if (s.state === 'off') { btn.classList.add('is-off'); btn.disabled = true; btn.title = BLOCK_NOTES[blocked.get(s.min)] || ''; }
        else if (isSel) btn.classList.add('is-sel');

        const nota = s.state === 'busy' ? 'Cita' : (s.state === 'off' ? 'No disp.' : '');
        btn.innerHTML = `<span class="h">${fmtSlot(s.min)}</span>${nota ? `<small>${nota}</small>` : ''}`;

        if (s.state === 'free') {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            selectedHour = h;
            selectedMinute = m;
            updateInput();
            renderTimeGrid();
          });
        }
        grid.appendChild(btn);
      });

      wrap.appendChild(head);
      wrap.appendChild(grid);
      timeGrid.appendChild(wrap);
    });
  };

  timeContainer.appendChild(timeLabel);
  timeContainer.appendChild(timeGrid);
  // Add everything to wrapper
  wrapper.appendChild(calContainer);
  wrapper.appendChild(timeContainer);

  // Insert and hide input
  input.style.display = 'none';
  input.parentNode.insertBefore(wrapper, input);

  // Initial render
  renderCalendar();
  renderTimeGrid();
  updateInput();

  input._calendarDatetimePicker = {
    wrapper,
    renderCalendar,
    renderTimeGrid,
    updateInput,
    updateFromInput: () => {
      const val = input.value;
      if (val) {
        const [datePart, timePart] = val.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        selectedYear = year;
        selectedMonth = month - 1;
        selectedDay = day;
        selectedHour = hour;
        selectedMinute = minute;
        renderCalendar();
        renderTimeGrid();
      }
    }
  };
}

window.replaceWithCalendarDatetimePicker = replaceWithCalendarDatetimePicker;

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {});
}
