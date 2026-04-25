// Odontogram utility functions

function getConditionById(id) {
  return CONDITION_LIST.find(c => c.id === id) || CONDITIONS.HEALTHY;
}

function getToothLabel(fdi) {
  const tooth = getToothByFDI(fdi);
  return tooth ? tooth.name : fdi.toString();
}

function createToothSVG(toothType, condition, selected = false, isEditable = false) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 160');
  svg.setAttribute('class', 'tooth-svg');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const gradId = `grad-${Math.random().toString(36).substr(2, 9)}`;

  const condData = getConditionById(condition);
  const outlineColor = selected ? '#0891b2' : '#0f172a';
  const outlineWidth = selected ? 2.5 : 1.5;

  // Create gradient
  const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  gradient.setAttribute('id', gradId);
  gradient.setAttribute('x1', '0%');
  gradient.setAttribute('y1', '0%');
  gradient.setAttribute('x2', '100%');
  gradient.setAttribute('y2', '100%');

  const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop1.setAttribute('offset', '0%');
  stop1.setAttribute('stop-color', condData.color);
  stop1.setAttribute('stop-opacity', '0.9');

  const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop2.setAttribute('offset', '100%');
  stop2.setAttribute('stop-color', condData.color);
  stop2.setAttribute('stop-opacity', '1');

  gradient.appendChild(stop1);
  gradient.appendChild(stop2);
  defs.appendChild(gradient);
  svg.appendChild(defs);

  let crownPath = '';
  let rootPath = '';

  // INCISIVO - pequeño, plano, puntiagudo
  if(toothType === TOOTH_TYPES.INCISOR) {
    crownPath = 'M 35 8 Q 40 5 50 5 Q 60 5 65 8 Q 70 12 72 22 L 70 45 Q 68 65 65 85';
    rootPath = 'M 65 85 Q 62 105 58 125 Q 55 140 50 145 Q 45 140 42 125 Q 38 105 35 85 L 35 85 Q 32 65 30 45 L 28 22 Q 30 12 35 8';
  }

  // CANINO - puntiagudo, más largo
  if(toothType === TOOTH_TYPES.CANINE) {
    crownPath = 'M 32 10 Q 36 6 50 6 Q 64 6 68 10 Q 72 16 74 28 L 71 55 Q 68 75 62 95';
    rootPath = 'M 62 95 Q 58 115 52 135 Q 50 148 50 150 Q 48 148 46 135 Q 40 115 38 95 L 38 95 Q 32 75 29 55 L 26 28 Q 28 16 32 10';
  }

  // PREMOLAR - dos cúspides pequeñas
  if(toothType === TOOTH_TYPES.PREMOLAR) {
    crownPath = 'M 28 12 Q 32 8 42 8 Q 50 6 58 8 Q 72 12 75 18 Q 78 26 77 38 L 73 62 Q 70 80 65 100';
    rootPath = 'M 65 100 Q 60 120 55 138 Q 52 148 50 150 Q 48 148 45 138 Q 40 120 35 100 L 35 100 Q 30 80 27 62 L 23 38 Q 22 26 25 18 Q 28 12 28 12';
  }

  // MOLAR - ancho, múltiples cúspides
  if(toothType === TOOTH_TYPES.MOLAR) {
    crownPath = 'M 22 15 Q 26 10 38 10 Q 50 8 62 10 Q 78 15 82 22 Q 85 32 84 45 L 78 70 Q 74 88 68 106';
    rootPath = 'M 68 106 Q 62 125 56 140 Q 53 148 50 150 Q 47 148 44 140 Q 38 125 32 106 L 32 106 Q 26 88 22 70 L 16 45 Q 15 32 18 22 Q 22 15 22 15';
  }

  // Draw root (lighter color)
  const root = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  root.setAttribute('d', rootPath);
  root.setAttribute('fill', condData.color);
  root.setAttribute('fill-opacity', '0.5');
  root.setAttribute('stroke', outlineColor);
  root.setAttribute('stroke-width', outlineWidth);
  root.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(root);

  // Draw crown (main color)
  const crown = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  crown.setAttribute('d', crownPath);
  crown.setAttribute('fill', `url(#${gradId})`);
  crown.setAttribute('stroke', outlineColor);
  crown.setAttribute('stroke-width', outlineWidth);
  crown.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(crown);

  // Add shine/highlight
  if(toothType === TOOTH_TYPES.INCISOR) {
    const shine = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    shine.setAttribute('cx', '42');
    shine.setAttribute('cy', '25');
    shine.setAttribute('rx', '5');
    shine.setAttribute('ry', '10');
    shine.setAttribute('fill', 'white');
    shine.setAttribute('opacity', '0.25');
    svg.appendChild(shine);
  } else if(toothType === TOOTH_TYPES.CANINE) {
    const shine = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    shine.setAttribute('cx', '42');
    shine.setAttribute('cy', '28');
    shine.setAttribute('rx', '5');
    shine.setAttribute('ry', '12');
    shine.setAttribute('fill', 'white');
    shine.setAttribute('opacity', '0.25');
    svg.appendChild(shine);
  } else {
    const shine = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    shine.setAttribute('cx', '45');
    shine.setAttribute('cy', '32');
    shine.setAttribute('rx', '6');
    shine.setAttribute('ry', '10');
    shine.setAttribute('fill', 'white');
    shine.setAttribute('opacity', '0.2');
    svg.appendChild(shine);
  }

  if(selected) {
    const border = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    border.setAttribute('x', '5');
    border.setAttribute('y', '5');
    border.setAttribute('width', '90');
    border.setAttribute('height', '150');
    border.setAttribute('fill', 'none');
    border.setAttribute('stroke', '#0891b2');
    border.setAttribute('stroke-width', '2');
    border.setAttribute('rx', '3');
    svg.appendChild(border);
  }

  svg.style.cssText = `
    width: 100%;
    height: 100%;
    transition: filter 0.2s;
  `;

  return svg;
}

function createSurfaceElement(surface, fdi, condition = CONDITIONS.HEALTHY, isEditable = false) {
  const container = document.createElement('div');
  container.setAttribute('data-surface', surface);
  container.setAttribute('data-fdi', fdi);
  container.className = 'tooth-surface';

  const condData = getConditionById(condition);
  const surfaceLabel = getSurfaceLabel(surface);

  container.style.cssText = `
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 4px;
    background-color: ${condData.color};
    border: 1px solid #1e293b;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: bold;
    color: #0f172a;
    transition: all 0.2s;
    cursor: ${isEditable ? 'pointer' : 'default'};
    position: relative;
  `;

  if(isEditable) {
    container.style.cursor = 'pointer';
    container.onmouseenter = () => {
      container.style.transform = 'scale(1.1)';
      container.style.boxShadow = '0 4px 8px rgba(8, 145, 178, 0.3)';
    };
    container.onmouseleave = () => {
      container.style.transform = 'scale(1)';
      container.style.boxShadow = 'none';
    };
  }

  // Add condition icon and surface label
  const labelContainer = document.createElement('div');
  labelContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    line-height: 1;
  `;

  const iconEl = document.createElement('span');
  iconEl.textContent = condData.icon;
  iconEl.style.cssText = 'font-size: 0.8rem;';
  labelContainer.appendChild(iconEl);

  const labelEl = document.createElement('span');
  labelEl.textContent = surfaceLabel;
  labelEl.style.cssText = 'font-size: 0.65rem; font-weight: 700;';
  labelContainer.appendChild(labelEl);

  container.appendChild(labelContainer);

  // Add tooltip with full surface name
  const surfaceNames = {
    mesial: 'Mesial',
    distal: 'Distal',
    buccal: 'Vestibular/Bucal',
    lingual: 'Lingual/Palatino',
    occlusal: 'Occlusal/Incisal',
    incisal: 'Occlusal/Incisal'
  };
  container.title = `${surfaceNames[surface]}: ${condData.label}`;

  return container;
}

function getSurfaceLabel(surface) {
  const labels = {
    [SURFACES.MESIAL]: 'M',
    [SURFACES.DISTAL]: 'D',
    [SURFACES.BUCCAL]: 'B',
    [SURFACES.LINGUAL]: 'L',
    [SURFACES.OCCLUSAL]: 'O',
    [SURFACES.INCISAL]: 'I'
  };
  return labels[surface] || '?';
}

function getSurfacesForToothType(toothType) {
  return SURFACE_MAP[toothType] || [];
}
