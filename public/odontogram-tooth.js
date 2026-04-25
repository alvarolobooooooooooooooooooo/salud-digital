// Tooth component with interactive surfaces

class OdontogramTooth {
  constructor(fdi, state = {}, handlers = {}, containerRef) {
    this.fdi = fdi;
    this.tooth = getToothByFDI(fdi);
    this.state = state;
    this.handlers = handlers;
    this.containerRef = containerRef;
    this.isSelected = state.isSelected || false;
    this.condition = state.condition || CONDITIONS.HEALTHY.id;
    this.surfaces = state.surfaces || {};
    this.isEditable = handlers.isEditable !== false;
  }

  getSurfaceCondition(surface) {
    return this.surfaces[surface] || CONDITIONS.HEALTHY.id;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'tooth-container';
    container.setAttribute('data-fdi', this.fdi);
    container.setAttribute('data-tooth-type', this.tooth.type);

    container.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 0.65rem;
      background: white;
      border: 1.5px solid #e5e7eb;
      border-radius: 10px;
      cursor: ${this.isEditable ? 'pointer' : 'default'};
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
      min-width: 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    `;

    // Hover effects
    if(this.isEditable) {
      container.style.cursor = 'pointer';
      container.onmouseenter = () => {
        container.style.borderColor = '#0891b2';
        container.style.boxShadow = '0 8px 20px rgba(8, 145, 178, 0.2)';
        container.style.transform = 'translateY(-3px)';
        container.style.background = '#f8fbfc';
      };
      container.onmouseleave = () => {
        container.style.borderColor = this.isSelected ? '#0891b2' : '#e5e7eb';
        container.style.boxShadow = this.isSelected ? '0 6px 16px rgba(8, 145, 178, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.08)';
        container.style.transform = 'translateY(0)';
        container.style.background = this.isSelected ? '#f0f9ff' : 'white';
      };

      // Main click handler
      container.onclick = (e) => {
        if(this.handlers && typeof this.handlers.onSelect === 'function') {
          this.handlers.onSelect(this.fdi, e);
        }
      };
    }

    if(this.isSelected) {
      container.style.borderColor = '#0891b2';
      container.style.background = '#f0f9ff';
      container.style.boxShadow = '0 6px 16px rgba(8, 145, 178, 0.15)';
    }

    // Tooth SVG
    const svgContainer = document.createElement('div');
    svgContainer.style.cssText = `
      width: 100%;
      height: auto;
      aspect-ratio: 0.9;
      display: flex;
      align-items: center;
      justify-content: center;
      max-width: 90px;
    `;

    const svg = createToothSVG(this.tooth.type, this.condition, this.isSelected, this.isEditable);
    svgContainer.appendChild(svg);
    container.appendChild(svgContainer);

    // Tooth number
    const number = document.createElement('div');
    number.className = 'tooth-number';
    number.textContent = this.tooth.name;
    number.style.cssText = `
      font-weight: 700;
      font-size: 0.85rem;
      color: #0f172a;
      white-space: nowrap;
    `;
    container.appendChild(number);

    // Surfaces in anatomical cross layout: [B] / [M O D] / [L]
    const surfacesDiv = document.createElement('div');
    surfacesDiv.className = 'tooth-surfaces';
    surfacesDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.1rem;
      margin-top: 0.25rem;
    `;

    const isAnterior = this.tooth.type === TOOTH_TYPES.INCISOR || this.tooth.type === TOOTH_TYPES.CANINE;
    const apicalSurface = isAnterior ? SURFACES.INCISAL : SURFACES.OCCLUSAL;

    // Row 1: B alone
    const buccalEl = createSurfaceElement(
      SURFACES.BUCCAL,
      this.fdi,
      this.getSurfaceCondition(SURFACES.BUCCAL),
      this.isEditable
    );
    if(this.isEditable && this.handlers && typeof this.handlers.onSurfaceSelect === 'function') {
      buccalEl.onclick = (e) => {
        e.stopPropagation();
        this.handlers.onSurfaceSelect(this.fdi, SURFACES.BUCCAL, e);
      };
    }
    surfacesDiv.appendChild(buccalEl);

    // Row 2: M O D together
    const row2 = document.createElement('div');
    row2.style.cssText = `display: flex; gap: 0.1rem;`;

    const mesialEl = createSurfaceElement(
      SURFACES.MESIAL,
      this.fdi,
      this.getSurfaceCondition(SURFACES.MESIAL),
      this.isEditable
    );
    if(this.isEditable && this.handlers && typeof this.handlers.onSurfaceSelect === 'function') {
      mesialEl.onclick = (e) => {
        e.stopPropagation();
        this.handlers.onSurfaceSelect(this.fdi, SURFACES.MESIAL, e);
      };
    }
    row2.appendChild(mesialEl);

    const centralEl = createSurfaceElement(
      apicalSurface,
      this.fdi,
      this.getSurfaceCondition(apicalSurface),
      this.isEditable
    );
    if(this.isEditable && this.handlers && typeof this.handlers.onSurfaceSelect === 'function') {
      centralEl.onclick = (e) => {
        e.stopPropagation();
        this.handlers.onSurfaceSelect(this.fdi, apicalSurface, e);
      };
    }
    row2.appendChild(centralEl);

    const distalEl = createSurfaceElement(
      SURFACES.DISTAL,
      this.fdi,
      this.getSurfaceCondition(SURFACES.DISTAL),
      this.isEditable
    );
    if(this.isEditable && this.handlers && typeof this.handlers.onSurfaceSelect === 'function') {
      distalEl.onclick = (e) => {
        e.stopPropagation();
        this.handlers.onSurfaceSelect(this.fdi, SURFACES.DISTAL, e);
      };
    }
    row2.appendChild(distalEl);

    surfacesDiv.appendChild(row2);

    // Row 3: L alone
    const lingualEl = createSurfaceElement(
      SURFACES.LINGUAL,
      this.fdi,
      this.getSurfaceCondition(SURFACES.LINGUAL),
      this.isEditable
    );
    if(this.isEditable && this.handlers && typeof this.handlers.onSurfaceSelect === 'function') {
      lingualEl.onclick = (e) => {
        e.stopPropagation();
        this.handlers.onSurfaceSelect(this.fdi, SURFACES.LINGUAL, e);
      };
    }
    surfacesDiv.appendChild(lingualEl);

    container.appendChild(surfacesDiv);

    // Condition indicator (read-only mode)
    if(!this.isEditable) {
      const indicator = document.createElement('div');
      const condData = getConditionById(this.condition);
      indicator.style.cssText = `
        font-size: 0.7rem;
        color: #64748b;
        font-weight: 500;
        margin-top: 0.25rem;
      `;
      indicator.textContent = condData.label;
      container.appendChild(indicator);
    }

    return container;
  }

  getState() {
    return {
      fdi: this.fdi,
      condition: this.condition,
      surfaces: this.surfaces,
      isSelected: this.isSelected
    };
  }
}
