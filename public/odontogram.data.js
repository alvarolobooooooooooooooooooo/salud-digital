// Odontogram teeth data - FDI numbering system

const TEETH_DATA = [
  // UPPER RIGHT (18-11)
  { fdi: 18, name: '1.8', type: TOOTH_TYPES.MOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 17, name: '1.7', type: TOOTH_TYPES.MOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 16, name: '1.6', type: TOOTH_TYPES.MOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 15, name: '1.5', type: TOOTH_TYPES.PREMOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 14, name: '1.4', type: TOOTH_TYPES.PREMOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 13, name: '1.3', type: TOOTH_TYPES.CANINE, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 12, name: '1.2', type: TOOTH_TYPES.INCISOR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },
  { fdi: 11, name: '1.1', type: TOOTH_TYPES.INCISOR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_RIGHT },

  // UPPER LEFT (21-28)
  { fdi: 21, name: '2.1', type: TOOTH_TYPES.INCISOR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 22, name: '2.2', type: TOOTH_TYPES.INCISOR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 23, name: '2.3', type: TOOTH_TYPES.CANINE, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 24, name: '2.4', type: TOOTH_TYPES.PREMOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 25, name: '2.5', type: TOOTH_TYPES.PREMOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 26, name: '2.6', type: TOOTH_TYPES.MOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 27, name: '2.7', type: TOOTH_TYPES.MOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },
  { fdi: 28, name: '2.8', type: TOOTH_TYPES.MOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.UPPER, quadrant: QUADRANT.UPPER_LEFT },

  // LOWER LEFT (31-38)
  { fdi: 31, name: '3.1', type: TOOTH_TYPES.INCISOR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 32, name: '3.2', type: TOOTH_TYPES.INCISOR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 33, name: '3.3', type: TOOTH_TYPES.CANINE, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 34, name: '3.4', type: TOOTH_TYPES.PREMOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 35, name: '3.5', type: TOOTH_TYPES.PREMOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 36, name: '3.6', type: TOOTH_TYPES.MOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 37, name: '3.7', type: TOOTH_TYPES.MOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },
  { fdi: 38, name: '3.8', type: TOOTH_TYPES.MOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_LEFT },

  // LOWER RIGHT (41-48)
  { fdi: 41, name: '4.1', type: TOOTH_TYPES.INCISOR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 42, name: '4.2', type: TOOTH_TYPES.INCISOR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 43, name: '4.3', type: TOOTH_TYPES.CANINE, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 44, name: '4.4', type: TOOTH_TYPES.PREMOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 45, name: '4.5', type: TOOTH_TYPES.PREMOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 46, name: '4.6', type: TOOTH_TYPES.MOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 47, name: '4.7', type: TOOTH_TYPES.MOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT },
  { fdi: 48, name: '4.8', type: TOOTH_TYPES.MOLAR, dentition: DENTITION.PERMANENT, arch: ARCH.LOWER, quadrant: QUADRANT.LOWER_RIGHT }
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
