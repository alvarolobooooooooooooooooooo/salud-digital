// Odontogram utility functions

function getConditionById(id) {
  return CONDITION_LIST.find(c => c.id === id) || CONDITIONS.HEALTHY;
}

function darkenColor(color, amount = 0.2) {
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  const r = Math.max(0, (num >> 16) - Math.floor(255 * amount));
  const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.floor(255 * amount));
  const b = Math.max(0, (num & 0x0000FF) - Math.floor(255 * amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function getToothLabel(fdi) {
  const tooth = getToothByFDI(fdi);
  return tooth ? tooth.name : fdi.toString();
}

function createToothSVG(toothType, condition, selected = false, isEditable = false) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  // Use different viewBox for custom tooth types
  let viewBox = '0 0 100 160';
  if(toothType === TOOTH_TYPES.MOLAR) viewBox = '0 0 512.048 512.048';
  else if(toothType === TOOTH_TYPES.INCISOR) viewBox = '0 0 368.477 368.477';
  else if(toothType === TOOTH_TYPES.PREMOLAR) viewBox = '0 0 100 160';
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('class', 'tooth-svg');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const gradId = `grad-${Math.random().toString(36).substr(2, 9)}`;
  const shadowId = `shadow-${Math.random().toString(36).substr(2, 9)}`;

  const condData = getConditionById(condition);
  const outlineColor = selected ? '#0891b2' : '#0f172a';
  const isHealthy = condition === CONDITIONS.HEALTHY.id;

  // Scale stroke width for custom tooth types due to larger viewBox
  let outlineWidth = selected ? 2.5 : 1.5;
  if(toothType === TOOTH_TYPES.MOLAR) outlineWidth = selected ? 8 : 4;
  else if(toothType === TOOTH_TYPES.INCISOR) outlineWidth = selected ? 6 : 3;
  else if(toothType === TOOTH_TYPES.PREMOLAR) outlineWidth = selected ? 2.2 : 1.5;

  // Create radial gradient for premium look
  const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
  gradient.setAttribute('id', gradId);
  gradient.setAttribute('cx', '35%');
  gradient.setAttribute('cy', '35%');
  gradient.setAttribute('r', '65%');

  const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop1.setAttribute('offset', '0%');
  if(isHealthy) {
    stop1.setAttribute('stop-color', '#fafafa');
    stop1.setAttribute('stop-opacity', '1');
  } else {
    stop1.setAttribute('stop-color', condData.color);
    stop1.setAttribute('stop-opacity', '1');
  }

  const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop2.setAttribute('offset', '40%');
  if(isHealthy) {
    stop2.setAttribute('stop-color', '#f5f5f5');
    stop2.setAttribute('stop-opacity', '1');
  } else {
    stop2.setAttribute('stop-color', condData.color);
    stop2.setAttribute('stop-opacity', '0.98');
  }

  const stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop3.setAttribute('offset', '70%');
  if(isHealthy) {
    stop3.setAttribute('stop-color', '#e8e8e8');
    stop3.setAttribute('stop-opacity', '1');
  } else {
    stop3.setAttribute('stop-color', darkenColor(condData.color, 0.15));
    stop3.setAttribute('stop-opacity', '1');
  }

  const stop4 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop4.setAttribute('offset', '100%');
  if(isHealthy) {
    stop4.setAttribute('stop-color', '#d4d4d4');
    stop4.setAttribute('stop-opacity', '1');
  } else {
    stop4.setAttribute('stop-color', darkenColor(condData.color, 0.30));
    stop4.setAttribute('stop-opacity', '1');
  }

  gradient.appendChild(stop1);
  gradient.appendChild(stop2);
  gradient.appendChild(stop3);
  gradient.appendChild(stop4);

  // Add subtle shadow filter - minimal and contained
  const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  filter.setAttribute('id', shadowId);
  filter.setAttribute('x', '-10%');
  filter.setAttribute('y', '-10%');
  filter.setAttribute('width', '120%');
  filter.setAttribute('height', '120%');

  const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
  feGaussianBlur.setAttribute('in', 'SourceGraphic');
  feGaussianBlur.setAttribute('stdDeviation', '0.8');
  filter.appendChild(feGaussianBlur);

  const feOffset = document.createElementNS('http://www.w3.org/2000/svg', 'feOffset');
  feOffset.setAttribute('dx', '0.4');
  feOffset.setAttribute('dy', '0.4');
  feOffset.setAttribute('result', 'offsetblur');
  filter.appendChild(feOffset);

  const feComponentTransfer = document.createElementNS('http://www.w3.org/2000/svg', 'feComponentTransfer');
  const feFuncA = document.createElementNS('http://www.w3.org/2000/svg', 'feFuncA');
  feFuncA.setAttribute('type', 'linear');
  feFuncA.setAttribute('slope', '0.15');
  feComponentTransfer.appendChild(feFuncA);
  filter.appendChild(feComponentTransfer);

  const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
  const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
  feMergeNode1.setAttribute('in', 'offsetblur');
  feMerge.appendChild(feMergeNode1);
  const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
  feMergeNode2.setAttribute('in', 'SourceGraphic');
  feMerge.appendChild(feMergeNode2);
  filter.appendChild(feMerge);

  defs.appendChild(gradient);
  defs.appendChild(filter);
  svg.appendChild(defs);

  let crownPath = '';
  let rootPath = '';

  // INCISIVO - pequeño, plano, puntiagudo
  if(toothType === TOOTH_TYPES.INCISOR) {
    crownPath = 'M273.106,8.768C271.885,8.41,242.528,0,184.239,0S96.591,8.41,95.37,8.768c-2.769,0.812-4.671,3.352-4.671,6.237v72.537c0,28.018,12.386,53.195,31.966,70.353c0.48,27.934,8.605,77.12,20.522,123.856c6.025,23.629,12.326,43.834,18.22,58.43c8.01,19.833,14.742,28.295,22.511,28.295c7.808,0,14.598-8.466,22.704-28.308c5.976-14.627,12.362-34.87,18.47-58.54c12.019-46.582,20.234-95.616,20.807-123.75c20.297-17.793,31.881-43.253,31.881-70.337V15.005C277.778,12.12,275.876,9.579,273.106,8.768z';
    rootPath = '';
  }

  // CANINO - puntiagudo, más largo
  if(toothType === TOOTH_TYPES.CANINE) {
    crownPath = 'M 32 10 Q 36 6 50 6 Q 64 6 68 10 Q 72 16 74 28 L 71 55 Q 68 75 62 95';
    rootPath = 'M 62 95 Q 58 115 52 135 Q 50 148 50 150 Q 48 148 46 135 Q 40 115 38 95 L 38 95 Q 32 75 29 55 L 26 28 Q 28 16 32 10';
  }

  // PREMOLAR - dos cúspides con diseño profesional
  if(toothType === TOOTH_TYPES.PREMOLAR) {
    crownPath = 'M30 18 C42 5, 52 19, 60 19 C68 19, 79 5, 91 18 C107 35, 96 58, 84 74 C76 83, 70 96, 66 117 C63 134, 58 150, 55 153 C52 150, 45 133, 41 116 C36 95, 31 83, 24 74 C12 58, 14 34, 30 18 Z';
    rootPath = '';
  }

  // MOLAR - ancho, múltiples cúspides - custom SVG design
  if(toothType === TOOTH_TYPES.MOLAR) {
    crownPath = 'M403.331,245.808c26.667-59.947,51.307-146.453,33.173-193.067c-25.707-65.92-80.747-55.04-129.28-45.547c-17.28,3.413-35.2,6.933-51.2,6.933s-33.92-3.52-51.2-6.933c-48.533-9.6-103.467-20.373-129.28,45.547c-18.133,46.507,6.507,133.12,33.173,193.067c0.747,1.707,1.067,3.52,0.853,5.333c-2.56,25.067-3.84,50.347-3.733,75.52c0,68.8,10.453,185.387,49.387,185.387c33.387,0,37.973-44.267,42.88-91.2c6.933-67.52,15.253-115.307,57.92-115.307c42.027,0,50.133,47.36,57.067,114.133c4.907,47.467,9.493,92.267,43.733,92.267c39.04,0,49.493-116.587,49.493-185.387c0-25.173-1.173-50.347-3.733-75.52C402.264,249.328,402.584,247.408,403.331,245.808z';
    rootPath = '';
  }

  // Draw root (lighter color) - skip for molars
  if(rootPath) {
    const root = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    root.setAttribute('d', rootPath);
    root.setAttribute('fill', condData.color);
    root.setAttribute('fill-opacity', '0.5');
    root.setAttribute('stroke', outlineColor);
    root.setAttribute('stroke-width', outlineWidth);
    root.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(root);
  }

  // Draw crown (main color)
  const crown = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  crown.setAttribute('d', crownPath);
  crown.setAttribute('fill', `url(#${gradId})`);
  crown.setAttribute('stroke', outlineColor);
  crown.setAttribute('stroke-width', outlineWidth);
  crown.setAttribute('stroke-linejoin', 'round');
  crown.setAttribute('fill-rule', 'evenodd');
  crown.setAttribute('filter', `url(#${shadowId})`);
  svg.appendChild(crown);

  // Add detail lines/grooves
  const detailLines = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const detailColor = isHealthy ? '#888888' : darkenColor(condData.color, 0.25);
  const detailOpacity = isHealthy ? '0.15' : '0.2';

  if(toothType === TOOTH_TYPES.MOLAR) {
    const grooves = ['M256 100 L256 350', 'M150 250 L350 250'];
    grooves.forEach(d => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('d', d);
      line.setAttribute('stroke', detailColor);
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('opacity', detailOpacity);
      detailLines.appendChild(line);
    });
  } else if(toothType === TOOTH_TYPES.PREMOLAR) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', 'M50 15 L50 130');
    line.setAttribute('stroke', detailColor);
    line.setAttribute('stroke-width', '1');
    line.setAttribute('opacity', detailOpacity);
    detailLines.appendChild(line);
  } else if(toothType === TOOTH_TYPES.INCISOR) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', 'M184 80 L184 300');
    line.setAttribute('stroke', detailColor);
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('opacity', detailOpacity);
    detailLines.appendChild(line);
  } else if(toothType === TOOTH_TYPES.CANINE) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', 'M50 20 L50 120');
    line.setAttribute('stroke', detailColor);
    line.setAttribute('stroke-width', '0.8');
    line.setAttribute('opacity', detailOpacity);
    detailLines.appendChild(line);
  }

  svg.appendChild(detailLines);


  // Add glossy highlight for premium effect
  const gloss = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  let glossCx, glossCy, glossRx, glossRy, glossOpacity;

  if(toothType === TOOTH_TYPES.MOLAR) {
    glossCx = '150'; glossCy = '80'; glossRx = '60'; glossRy = '80';
    glossOpacity = '0.40';
  } else if(toothType === TOOTH_TYPES.INCISOR) {
    glossCx = '120'; glossCy = '60'; glossRx = '50'; glossRy = '70';
    glossOpacity = '0.38';
  } else if(toothType === TOOTH_TYPES.PREMOLAR) {
    glossCx = '45'; glossCy = '40'; glossRx = '15'; glossRy = '25';
    glossOpacity = '0.38';
  } else if(toothType === TOOTH_TYPES.CANINE) {
    glossCx = '45'; glossCy = '35'; glossRx = '8'; glossRy = '15';
    glossOpacity = '0.36';
  } else {
    glossCx = '42'; glossCy = '28'; glossRx = '10'; glossRy = '16';
    glossOpacity = '0.38';
  }

  gloss.setAttribute('cx', glossCx);
  gloss.setAttribute('cy', glossCy);
  gloss.setAttribute('rx', glossRx);
  gloss.setAttribute('ry', glossRy);
  gloss.setAttribute('fill', 'white');
  gloss.setAttribute('opacity', glossOpacity);
  gloss.setAttribute('mix-blend-mode', 'screen');
  svg.appendChild(gloss);

  // Add shine/highlight
  if(toothType === TOOTH_TYPES.CANINE) {
    const shine = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    shine.setAttribute('cx', '42');
    shine.setAttribute('cy', '28');
    shine.setAttribute('rx', '5');
    shine.setAttribute('ry', '12');
    shine.setAttribute('fill', 'white');
    shine.setAttribute('opacity', '0.28');
    svg.appendChild(shine);
  } else {
    const shine = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    shine.setAttribute('cx', '45');
    shine.setAttribute('cy', '32');
    shine.setAttribute('rx', '6');
    shine.setAttribute('ry', '10');
    shine.setAttribute('fill', 'white');
    shine.setAttribute('opacity', '0.25');
    svg.appendChild(shine);
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
