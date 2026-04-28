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
  // Use different viewBox for custom tooth types
  let viewBox = '0 0 100 160';
  if(toothType === TOOTH_TYPES.MOLAR) viewBox = '0 0 512.048 512.048';
  else if(toothType === TOOTH_TYPES.INCISOR) viewBox = '0 0 368.477 368.477';
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('class', 'tooth-svg');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const gradId = `grad-${Math.random().toString(36).substr(2, 9)}`;

  const condData = getConditionById(condition);
  const outlineColor = selected ? '#0891b2' : '#0f172a';
  // Scale stroke width for custom tooth types due to larger viewBox
  let outlineWidth = selected ? 2.5 : 1.5;
  if(toothType === TOOTH_TYPES.MOLAR) outlineWidth = selected ? 8 : 4;
  else if(toothType === TOOTH_TYPES.INCISOR) outlineWidth = selected ? 6 : 3;

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
    crownPath = 'M273.106,8.768C271.885,8.41,242.528,0,184.239,0S96.591,8.41,95.37,8.768c-2.769,0.812-4.671,3.352-4.671,6.237v72.537c0,28.018,12.386,53.195,31.966,70.353c0.48,27.934,8.605,77.12,20.522,123.856c6.025,23.629,12.326,43.834,18.22,58.43c8.01,19.833,14.742,28.295,22.511,28.295c7.808,0,14.598-8.466,22.704-28.308c5.976-14.627,12.362-34.87,18.47-58.54c12.019-46.582,20.234-95.616,20.807-123.75c20.297-17.793,31.881-43.253,31.881-70.337V15.005C277.778,12.12,275.876,9.579,273.106,8.768z M264.778,87.542c0,24.096-10.649,46.701-29.223,62.073c-1.589,1.185-2.622,3.073-2.622,5.208c0,25.334-7.726,73.085-19.224,118.823c-5.636,22.42-11.591,42.059-17.222,56.793c-6.544,17.123-10.798,22.717-12.545,24.458c-1.733-1.76-5.941-7.386-12.394-24.488c-5.552-14.716-11.423-34.318-16.978-56.688c-9.672-38.955-16.629-79.336-18.453-105.996c14.068,8.475,30.534,13.356,48.12,13.356c10.694,0,21.185-1.792,31.181-5.325c3.385-1.196,5.159-4.91,3.962-8.295c-1.195-3.385-4.912-5.158-8.294-3.962c-6.568,2.321-13.389,3.762-20.35,4.317v-36.756c0-3.59-2.909-6.5-6.499-6.5c-3.59,0-6.5,2.91-6.5,6.5v36.736c-41.379-3.324-74.04-38.035-74.04-80.254V20.101C113.899,17.837,140.785,13,184.239,13c43.289,0,70.301,4.848,80.54,7.108V87.542z';
    rootPath = '';
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
  svg.appendChild(crown);

  // Add shine/highlight
  if(toothType === TOOTH_TYPES.CANINE) {
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
