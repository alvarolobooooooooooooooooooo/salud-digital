/**
 * Bloqueos de disponibilidad de un doctor, para las pantallas que agendan por
 * dentro (citas, recepción). Lo que el doctor cerró o quitó en su calendario
 * sale bloqueado también aquí, no solo en el enlace público.
 *
 * Uso:
 *   await DoctorBlocks.load(doctorId);            // cachea 6 meses
 *   DoctorBlocks.cells(doctorId, '2026-08-17');   // [{h, m, reason:'blocked'}]
 *   DoctorBlocks.check(doctorId, '2026-08-17T09:00');  // null | 'closed' | 'blocked'
 */
window.DoctorBlocks = (function () {
  const GRID_MINUTES = 30;   // el selector de hora va de media en media
  const cache = {};          // doctorId -> { duration, days: { fecha: {closed, blocked} } }
  const pending = {};

  const pad = (n) => String(n).padStart(2, '0');
  const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toMinutes = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + (m || 0);
  };

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
      const duration = Number(availability && availability[0] && availability[0].slot_duration) || GRID_MINUTES;
      cache[id] = { duration, days };
      delete pending[id];
      return cache[id];
    })();

    return pending[id];
  }

  function dayInfo(doctorId, dateStr) {
    const entry = cache[parseInt(doctorId, 10)];
    if (!entry) return null;
    return { duration: entry.duration, day: entry.days[dateStr] || null };
  }

  // Casillas del selector (cada 30 min) que quedan bloqueadas ese día. Una hora
  // bloqueada tapa todo su turno, así que con turnos de 60 min caen dos casillas.
  function cells(doctorId, dateStr) {
    const info = dayInfo(doctorId, dateStr);
    if (!info || !info.day) return [];
    const out = [];
    if (info.day.closed) {
      for (let m = 0; m < 24 * 60; m += GRID_MINUTES) {
        out.push({ h: Math.floor(m / 60), m: m % 60, reason: 'closed' });
      }
      return out;
    }
    const seen = new Set();
    info.day.blocked.forEach(t => {
      const start = toMinutes(t);
      const end = start + info.duration;
      for (let m = Math.floor(start / GRID_MINUTES) * GRID_MINUTES; m < end; m += GRID_MINUTES) {
        if (m < 0 || m >= 24 * 60 || seen.has(m)) continue;
        seen.add(m);
        out.push({ h: Math.floor(m / 60), m: m % 60, reason: 'blocked' });
      }
    });
    return out;
  }

  // 'YYYY-MM-DDTHH:MM' -> motivo o null. Para avisar antes de mandar el formulario.
  function check(doctorId, scheduledAt) {
    const s = String(scheduledAt || '');
    const match = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    if (!match) return null;
    const info = dayInfo(doctorId, match[1]);
    if (!info || !info.day) return null;
    if (info.day.closed) return 'closed';
    const minutes = Number(match[2]) * 60 + Number(match[3]);
    const hit = info.day.blocked.some(t => {
      const start = toMinutes(t);
      return minutes >= start && minutes < start + info.duration;
    });
    return hit ? 'blocked' : null;
  }

  const MESSAGES = {
    closed: 'El doctor cerró ese día en su disponibilidad.',
    blocked: 'El doctor marcó esa hora como no disponible.',
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
