/**
 * Disponibilidad de un doctor, para las pantallas que agendan por dentro
 * (citas, recepción). Lo que el doctor configuró en Citas Online manda también
 * aquí, no solo en el enlace público:
 *
 *   · su horario semanal  → las horas fuera de sus franjas salen bloqueadas
 *   · los días que cerró  → el día entero sale bloqueado
 *   · las horas que quitó → esa hora sale bloqueada
 *
 * Es el espejo en el navegador de lib/availability-blocks.js, que es quien lo
 * rechaza de verdad en el servidor. Si cambian las reglas de uno, cambian las
 * del otro.
 *
 * Uso:
 *   await DoctorBlocks.load(doctorId);            // cachea 6 meses
 *   DoctorBlocks.cells(doctorId, '2026-08-17');   // [{h, m, reason:'blocked'}]
 *   DoctorBlocks.check(doctorId, '2026-08-17T09:00');  // null | motivo
 */
window.DoctorBlocks = (function () {
  const GRID_MINUTES = 30;   // el selector de hora va de media en media
  const DAY_MINUTES = 24 * 60;
  const cache = {};          // doctorId -> { duration, days: {...}, week: {...}, configured }
  const pending = {};

  const pad = (n) => String(n).padStart(2, '0');
  const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toMinutes = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + (m || 0);
  };
  // A mediodía para que ningún cambio de horario mueva el día de la semana.
  const dowOf = (dateStr) => new Date(`${dateStr}T12:00:00`).getDay();

  async function load(doctorId, { force = false } = {}) {
    const id = parseInt(doctorId, 10);
    if (!id) return null;
    if (!force && cache[id]) return cache[id];
    if (!force && pending[id]) return pending[id];

    const today = new Date();
    const from = isoOf(new Date(today.getFullYear(), today.getMonth() - 1, 1));
    const to = isoOf(new Date(today.getFullYear(), today.getMonth() + 7, 0));

    pending[id] = (async () => {
      const [overrides, availability] = await Promise.all([
        api(`/api/doctor-availability/overrides?doctor_id=${id}&from=${from}&to=${to}`).catch(() => []),
        api(`/api/doctor-availability?doctor_id=${id}`).catch(() => []),
      ]);
      const days = {};
      (overrides || []).forEach(o => {
        days[o.date] = { closed: !!o.closed, blocked: o.blocked_times || [] };
      });
      // Horario semanal: día de la semana → franjas [inicio, fin) en minutos.
      const week = {};
      (availability || []).forEach(r => {
        (week[r.day_of_week] = week[r.day_of_week] || []).push({
          start: toMinutes(r.start_time),
          end: toMinutes(r.end_time),
        });
      });
      const duration = Number(availability && availability[0] && availability[0].slot_duration) || GRID_MINUTES;
      // Sin ninguna franja guardada, el doctor nunca configuró horario: no se le
      // impone ninguno y solo cuentan los días y horas que quitó a mano.
      cache[id] = { duration, days, week, configured: (availability || []).length > 0 };
      delete pending[id];
      return cache[id];
    })();

    return pending[id];
  }

  function dayInfo(doctorId, dateStr) {
    const entry = cache[parseInt(doctorId, 10)];
    if (!entry) return null;
    return {
      duration: entry.duration,
      day: entry.days[dateStr] || null,
      configured: entry.configured,
      windows: entry.week[dowOf(dateStr)] || [],
    };
  }

  const dentroDelHorario = (info, minutes) =>
    info.windows.some(w => minutes >= w.start && minutes < w.end);

  // Casillas del selector (cada 30 min) que quedan bloqueadas ese día. Una hora
  // bloqueada tapa todo su turno, así que con turnos de 60 min caen dos casillas.
  function cells(doctorId, dateStr) {
    const info = dayInfo(doctorId, dateStr);
    if (!info) return [];

    const todoElDia = (reason) => {
      const out = [];
      for (let m = 0; m < DAY_MINUTES; m += GRID_MINUTES) {
        out.push({ h: Math.floor(m / 60), m: m % 60, reason });
      }
      return out;
    };

    if (info.day && info.day.closed) return todoElDia('closed');
    // El horario semanal no incluye ese día de la semana.
    if (info.configured && info.windows.length === 0) return todoElDia('dayoff');

    const out = [];
    const seen = new Set();
    const marcar = (m, reason) => {
      if (m < 0 || m >= DAY_MINUTES || seen.has(m)) return;
      seen.add(m);
      out.push({ h: Math.floor(m / 60), m: m % 60, reason });
    };

    // Fuera de las franjas del horario semanal.
    if (info.configured) {
      for (let m = 0; m < DAY_MINUTES; m += GRID_MINUTES) {
        if (!dentroDelHorario(info, m)) marcar(m, 'offhours');
      }
    }

    // Horas que el doctor quitó de ese día concreto.
    if (info.day) {
      info.day.blocked.forEach(t => {
        const start = toMinutes(t);
        const end = start + info.duration;
        for (let m = Math.floor(start / GRID_MINUTES) * GRID_MINUTES; m < end; m += GRID_MINUTES) {
          marcar(m, 'blocked');
        }
      });
    }

    return out;
  }

  // 'YYYY-MM-DDTHH:MM' -> motivo o null. Para avisar antes de mandar el formulario.
  function check(doctorId, scheduledAt) {
    const s = String(scheduledAt || '');
    const match = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    if (!match) return null;
    const info = dayInfo(doctorId, match[1]);
    if (!info) return null;
    const minutes = Number(match[2]) * 60 + Number(match[3]);

    if (info.day) {
      if (info.day.closed) return 'closed';
      const hit = info.day.blocked.some(t => {
        const start = toMinutes(t);
        return minutes >= start && minutes < start + info.duration;
      });
      if (hit) return 'blocked';
    }
    if (!info.configured) return null;
    if (info.windows.length === 0) return 'dayoff';
    return dentroDelHorario(info, minutes) ? null : 'offhours';
  }

  const MESSAGES = {
    closed: 'El doctor cerró ese día en su disponibilidad.',
    blocked: 'El doctor marcó esa hora como no disponible.',
    dayoff: 'El doctor no atiende ese día según su horario de atención.',
    offhours: 'Esa hora queda fuera del horario de atención del doctor.',
  };

  function message(reason) {
    return MESSAGES[reason] || '';
  }

  function invalidate(doctorId) {
    const id = parseInt(doctorId, 10);
    delete cache[id];
    delete pending[id];
  }

  return { load, cells, check, message, invalidate };
})();
