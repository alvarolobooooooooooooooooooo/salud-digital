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
      gap: 0.8rem;
      padding: 1rem 0.85rem;
      background: linear-gradient(180deg, #ffffff 0%, #f5f9fb 100%);
      border: 1px solid rgba(8, 145, 178, 0.15);
      border-radius: 16px;
      cursor: ${this.isEditable ? 'pointer' : 'default'};
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
      min-width: 0;
      box-shadow:
        0 0 0 1px rgba(8, 145, 178, 0.08),
        0 4px 12px rgba(8, 145, 178, 0.1),
        0 20px 40px rgba(8, 145, 178, 0.06),
        inset 0 1px 0 rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(10px);
    `;

    // Hover effects
    if(this.isEditable) {
      container.style.cursor = 'pointer';
      container.onmouseenter = () => {
        container.style.borderColor = 'rgba(8, 145, 178, 0.4)';
        container.style.boxShadow = '0 0 0 1px rgba(8, 145, 178, 0.2), 0 8px 20px rgba(8, 145, 178, 0.25), 0 20px 50px rgba(8, 145, 178, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.95)';
        container.style.transform = 'translateY(-6px) scale(1.03)';
        container.style.background = 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)';
        svgContainer.style.transform = 'scale(1.1)';
        number.style.transform = 'scale(1.1)';
      };
      container.onmouseleave = () => {
        container.style.borderColor = this.isSelected ? 'rgba(8, 145, 178, 0.3)' : 'rgba(8, 145, 178, 0.15)';
        container.style.boxShadow = this.isSelected ? '0 0 0 1px rgba(8, 145, 178, 0.15), 0 6px 16px rgba(8, 145, 178, 0.18), 0 20px 40px rgba(8, 145, 178, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)' : '0 0 0 1px rgba(8, 145, 178, 0.08), 0 4px 12px rgba(8, 145, 178, 0.1), 0 20px 40px rgba(8, 145, 178, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
        container.style.transform = 'translateY(0) scale(1)';
        container.style.background = this.isSelected ? 'linear-gradient(180deg, #f0f9ff 0%, #e8f5f9 100%)' : 'linear-gradient(180deg, #ffffff 0%, #f5f9fb 100%)';
        svgContainer.style.transform = 'scale(1)';
        number.style.transform = 'scale(1)';
      };

      // Main click handler
      container.onclick = (e) => {
        if(this.handlers && typeof this.handlers.onSelect === 'function') {
          this.handlers.onSelect(this.fdi, e);
        }
      };
    }

    if(this.isSelected) {
      container.style.borderColor = 'rgba(8, 145, 178, 0.3)';
      container.style.background = 'linear-gradient(180deg, #f0f9ff 0%, #e8f5f9 100%)';
      container.style.boxShadow = '0 0 0 1px rgba(8, 145, 178, 0.15), 0 6px 16px rgba(8, 145, 178, 0.18), 0 20px 40px rgba(8, 145, 178, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
    }

    // Tooth SVG with background
    const svgContainer = document.createElement('div');
    svgContainer.style.cssText = `
      width: 100%;
      height: auto;
      aspect-ratio: 0.85;
      display: flex;
      align-items: center;
      justify-content: center;
      max-width: 110px;
      background: radial-gradient(circle at 30% 30%, rgba(8, 145, 178, 0.06), transparent);
      border-radius: 12px;
      padding: 0.5rem;
      transition: all 0.3s ease;
    `;

    const svg = createToothSVG(this.tooth.type, this.condition, this.isSelected, this.isEditable);
    svgContainer.appendChild(svg);
    container.appendChild(svgContainer);

    // Tooth number badge
    const number = document.createElement('div');
    number.className = 'tooth-number';
    number.textContent = this.tooth.name;
    number.style.cssText = `
      font-weight: 900;
      font-size: 1rem;
      color: white;
      white-space: nowrap;
      letter-spacing: 0.5px;
      background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
      padding: 0.4rem 0.7rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(8, 145, 178, 0.3);
      transition: all 0.3s ease;
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
    if(this.handlers && typeof this.handlers.onSurfaceSelect === 'function') {
      buccalEl.style.cursor = 'pointer';
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
    if(this.handlers && typeof this.handlers.onSurfaceSelect === 'function') {
      mesialEl.style.cursor = 'pointer';
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
    if(this.handlers && typeof this.handlers.onSurfaceSelect === 'function') {
      centralEl.style.cursor = 'pointer';
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
    if(this.handlers && typeof this.handlers.onSurfaceSelect === 'function') {
      distalEl.style.cursor = 'pointer';
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
    if(this.handlers && typeof this.handlers.onSurfaceSelect === 'function') {
      lingualEl.style.cursor = 'pointer';
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
