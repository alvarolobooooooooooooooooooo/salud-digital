/**
 * Catálogo único de tipos de cita para el navegador.
 *
 * Lo usan la agenda (citas.html), recepción (recepcion-citas.html) y la reserva
 * pública (agendar.html), para que el "tipo de consulta" que elige un paciente
 * por el enlace público sea exactamente el mismo que el del modal de nueva cita.
 * El gemelo del servidor es lib/appointment-types.js: si se toca uno, hay que
 * tocar el otro.
 */
window.ApptTypes = (function () {
  const META = {
    nuevo_paciente:           { label: 'Nuevo paciente',           color: '#8b5cf6' },
    seguimiento:              { label: 'Seguimiento',              color: '#06b6d4' },
    control:                  { label: 'Control',                  color: '#10b981' },
    urgencia:                 { label: 'Urgencia',                 color: '#ef4444' },
    procedimiento:            { label: 'Procedimiento',            color: '#f59e0b' },
    // Exclusivos de Podología
    pedicure_clinico:         { label: 'Pedicure Clínico',         color: '#14b8a6' },
    onicocriptosis:           { label: 'Onicocriptosis',           color: '#f43f5e' },
    pedicure_onicomicosis:    { label: 'Pedicure Onicomicosis',    color: '#84cc16' },
    pedicure_hiperqueratosis: { label: 'Pedicure Hiperqueratosis', color: '#6366f1' },
    pedicure_spa:             { label: 'Pedicure Spa',             color: '#ec4899' },
  };

  const COMMON = ['nuevo_paciente', 'seguimiento', 'control', 'urgencia', 'procedimiento'];
  const PODIATRY_ONLY = ['pedicure_clinico', 'onicocriptosis', 'pedicure_onicomicosis',
                         'pedicure_hiperqueratosis', 'pedicure_spa'];
  const ALL = COMMON.concat(PODIATRY_ONLY);
  const DEFAULT_TYPE = 'seguimiento';

  // Tolerante a cómo quedó guardada la especialidad: 'Podología', 'Podologia' o 'podologia'
  function isPodiatry(specialty) {
    return String(specialty || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim().startsWith('podolog');
  }

  // Podología no ofrece "Control" y suma sus propios pedicures.
  function forSpecialty(specialty) {
    return isPodiatry(specialty)
      ? COMMON.filter(v => v !== 'control').concat(PODIATRY_ONLY)
      : COMMON.slice();
  }

  function label(v) { return (META[v] && META[v].label) || META[DEFAULT_TYPE].label; }
  function color(v) { return (META[v] && META[v].color) || META[DEFAULT_TYPE].color; }

  return { META, COMMON, PODIATRY_ONLY, ALL, DEFAULT_TYPE, isPodiatry, forSpecialty, label, color };
})();
