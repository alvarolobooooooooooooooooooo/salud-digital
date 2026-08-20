// Catálogo único de tipos de cita.
//
// Lo comparten la agenda interna (routes/appointments.js) y la reserva pública
// (routes/public-booking.js), para que "tipo de consulta" signifique lo mismo
// venga de donde venga la cita. El gemelo para el navegador es
// public/appointment-types.js: si se toca uno, hay que tocar el otro.

// Comunes a todas las especialidades.
const COMMON = ['nuevo_paciente', 'seguimiento', 'control', 'urgencia', 'procedimiento'];

// Exclusivos de Podología (que además no usa 'control').
const PODIATRY_ONLY = [
  'pedicure_clinico', 'onicocriptosis', 'pedicure_onicomicosis',
  'pedicure_hiperqueratosis', 'pedicure_spa',
];

const ALL = COMMON.concat(PODIATRY_ONLY);

const DEFAULT_TYPE = 'seguimiento';

// Tolerante a cómo quedó guardada la especialidad: 'Podología', 'Podologia' o 'podologia'
function isPodiatry(specialty) {
  return String(specialty || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().startsWith('podolog');
}

/** Los tipos que se le ofrecen a un doctor de esta especialidad. */
function forSpecialty(specialty) {
  return isPodiatry(specialty)
    ? COMMON.filter(v => v !== 'control').concat(PODIATRY_ONLY)
    : COMMON.slice();
}

module.exports = { COMMON, PODIATRY_ONLY, ALL, DEFAULT_TYPE, isPodiatry, forSpecialty };
