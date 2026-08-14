// Odontogram teeth data — PEDIATRIC (mixed dentition), FDI numbering system.
//
// Drop-in replacement for odontogram.data.js used ONLY by the odontopediatría
// consultation page. It reuses the EXACT same odontogram component family
// (odontogram-tooth/arch/legend/toolbar/container + utils) — the only thing
// that changes is the set of teeth: here each quadrant carries its permanent
// teeth AND its deciduous (temporary) teeth, so the chart renders a full
// mixed-dentition odontogram while looking and behaving like the general one.
//
// Quadrants (FDI):
//   Permanent : 1x upper-right · 2x upper-left · 3x lower-left · 4x lower-right
//   Deciduous : 5x upper-right · 6x upper-left · 7x lower-left · 8x lower-right
// Deciduous teeth are folded into the same four anatomical quadrants so the
// shared OdontogramContainer (which renders UPPER_RIGHT/UPPER_LEFT/LOWER_LEFT/
// LOWER_RIGHT) shows permanent + deciduous together per side.

const TEETH_DATA = [
  // ── UPPER RIGHT — permanent (18-11) then deciduous (55-51) ──
  { fdi: 18, name: '1.8', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 17, name: '1.7', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 16, name: '1.6', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 15, name: '1.5', type: TOOTH_TYPES.PREMOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 14, name: '1.4', type: TOOTH_TYPES.PREMOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 13, name: '1.3', type: TOOTH_TYPES.CANINE,   dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 12, name: '1.2', type: TOOTH_TYPES.INCISOR,  dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 11, name: '1.1', type: TOOTH_TYPES.INCISOR,  dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 55, name: '5.5', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.TEMPORARY, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 54, name: '5.4', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.TEMPORARY, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 53, name: '5.3', type: TOOTH_TYPES.CANINE,   dentition: DENTITION.TEMPORARY, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 52, name: '5.2', type: TOOTH_TYPES.INCISOR,  dentition: DENTITION.TEMPORARY, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 51, name: '5.1', type: TOOTH_TYPES.INCISOR,  dentition: DENTITION.TEMPORARY, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },

  // ── UPPER LEFT — permanent (21-28) then deciduous (61-65) ──
  { fdi: 21, name: '2.1', type: TOOTH_TYPES.INCISOR,  dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 22, name: '2.2', type: TOOTH_TYPES.INCISOR,  dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 23, name: '2.3', type: TOOTH_TYPES.CANINE,   dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 24, name: '2.4', type: TOOTH_TYPES.PREMOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 25, name: '2.5', type: TOOTH_TYPES.PREMOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 26, name: '2.6', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 27, name: '2.7', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 28, name: '2.8', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 61, name: '6.1', type: TOOTH_TYPES.INCISOR,  dentition: DENTITION.TEMPORARY, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 62, name: '6.2', type: TOOTH_TYPES.INCISOR,  dentition: DENTITION.TEMPORARY, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 63, name: '6.3', type: TOOTH_TYPES.CANINE,   dentition: DENTITION.TEMPORARY, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 64, name: '6.4', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.TEMPORARY, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 65, name: '6.5', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.TEMPORARY, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },

  // ── LOWER LEFT — permanent (31-38) then deciduous (71-75) ──
  { fdi: 31, name: '3.1', type: TOOTH_TYPES.INCISOR,  dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 32, name: '3.2', type: TOOTH_TYPES.INCISOR,  dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 33, name: '3.3', type: TOOTH_TYPES.CANINE,   dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 34, name: '3.4', type: TOOTH_TYPES.PREMOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 35, name: '3.5', type: TOOTH_TYPES.PREMOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 36, name: '3.6', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 37, name: '3.7', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 38, name: '3.8', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 71, name: '7.1', type: TOOTH_TYPES.INCISOR,  dentition: DENTITION.TEMPORARY, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 72, name: '7.2', type: TOOTH_TYPES.INCISOR,  dentition: DENTITION.TEMPORARY, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 73, name: '7.3', type: TOOTH_TYPES.CANINE,   dentition: DENTITION.TEMPORARY, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 74, name: '7.4', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.TEMPORARY, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 75, name: '7.5', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.TEMPORARY, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },

  // ── LOWER RIGHT — permanent (41-48) then deciduous (81-85) ──
  { fdi: 41, name: '4.1', type: TOOTH_TYPES.INCISOR,  dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 42, name: '4.2', type: TOOTH_TYPES.INCISOR,  dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 43, name: '4.3', type: TOOTH_TYPES.CANINE,   dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 44, name: '4.4', type: TOOTH_TYPES.PREMOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 45, name: '4.5', type: TOOTH_TYPES.PREMOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 46, name: '4.6', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 47, name: '4.7', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 48, name: '4.8', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 81, name: '8.1', type: TOOTH_TYPES.INCISOR,  dentition: DENTITION.TEMPORARY, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 82, name: '8.2', type: TOOTH_TYPES.INCISOR,  dentition: DENTITION.TEMPORARY, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 83, name: '8.3', type: TOOTH_TYPES.CANINE,   dentition: DENTITION.TEMPORARY, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 84, name: '8.4', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.TEMPORARY, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 85, name: '8.5', type: TOOTH_TYPES.MOLAR,    dentition: DENTITION.TEMPORARY, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT }
];

function getToothByFDI(fdi) {
  return TEETH_DATA.find(t => t.fdi === fdi);
}

function getTeethByQuadrant(quadrant) {
  return TEETH_DATA.filter(t => t.quadrant === quadrant);
}

function getTeethByArch(arch) {
  return TEETH_DATA.filter(t => t.arch === arch);
}

// True for deciduous (temporary) teeth — FDI quadrants 5-8.
function isDeciduousFDI(fdi) {
  const q = Math.floor(fdi / 10);
  return q >= 5 && q <= 8;
}
