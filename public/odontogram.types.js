// Odontogram type definitions and enums

const TOOTH_TYPES = {
  INCISOR: 'incisor',
  CANINE: 'canine',
  PREMOLAR: 'premolar',
  MOLAR: 'molar'
};

const DENTITION = {
  PERMANENT: 'permanent',
  TEMPORARY: 'temporary'
};

const ARCH = {
  UPPER: 'upper',
  LOWER: 'lower'
};

const QUADRANT = {
  UPPER_RIGHT: 'upper_right',
  UPPER_LEFT: 'upper_left',
  LOWER_RIGHT: 'lower_right',
  LOWER_LEFT: 'lower_left'
};

const SURFACES = {
  MESIAL: 'mesial',
  DISTAL: 'distal',
  BUCCAL: 'buccal',
  LINGUAL: 'lingual',
  OCCLUSAL: 'occlusal',
  INCISAL: 'incisal'
};

const CONDITIONS = {
  HEALTHY: { id: 'healthy', label: 'Sano', color: '#ffffff', icon: '○' },
  CARIES: { id: 'caries', label: 'Caries', color: '#ef4444', icon: '●' },
  RESTORATION: { id: 'restoration', label: 'Resina', color: '#3b82f6', icon: '■' },
  AMALGAM: { id: 'amalgam', label: 'Amalgama', color: '#8b5cf6', icon: '▲' },
  CROWN: { id: 'crown', label: 'Corona', color: '#f59e0b', icon: '◆' },
  IMPLANT: { id: 'implant', label: 'Implante', color: '#10b981', icon: '⬢' },
  ENDODONTIC: { id: 'endodontic', label: 'Endodoncia', color: '#06b6d4', icon: '✕' },
  BRIDGE: { id: 'bridge', label: 'Puente', color: '#f97316', icon: '⎺' },
  MISSING: { id: 'missing', label: 'Ausente', color: '#94a3b8', icon: '⊗' },
  EXTRACTION: { id: 'extraction', label: 'Extracción', color: '#dc2626', icon: 'ⓧ' },
  SEALANT: { id: 'sealant', label: 'Sellante', color: '#84cc16', icon: '◎' },
  FRACTURE: { id: 'fracture', label: 'Fractura', color: '#ec4899', icon: '⚡' }
};

const CONDITION_LIST = Object.values(CONDITIONS);

const SURFACE_MAP = {
  incisor: [SURFACES.MESIAL, SURFACES.DISTAL, SURFACES.BUCCAL, SURFACES.LINGUAL, SURFACES.INCISAL],
  canine: [SURFACES.MESIAL, SURFACES.DISTAL, SURFACES.BUCCAL, SURFACES.LINGUAL, SURFACES.INCISAL],
  premolar: [SURFACES.MESIAL, SURFACES.DISTAL, SURFACES.BUCCAL, SURFACES.LINGUAL, SURFACES.OCCLUSAL],
  molar: [SURFACES.MESIAL, SURFACES.DISTAL, SURFACES.BUCCAL, SURFACES.LINGUAL, SURFACES.OCCLUSAL]
};
