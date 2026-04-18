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
      padding: 0.5rem;
      background: white;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      cursor: ${this.isEditable ? 'pointer' : 'default'};
      transition: all 0.2s;
      position: relative;
      min-width: 0;
    `;

    // Hover effects
    if(this.isEditable) {
      container.style.cursor = 'pointer';
      container.onmouseenter = () => {
        container.style.borderColor = '#0891b2';
        container.style.boxShadow = '0 4px 12px rgba(8, 145, 178, 0.15)';
        container.style.transform = 'translateY(-2px)';
      };
      container.onmouseleave = () => {
        container.style.borderColor = this.isSelected ? '#0891b2' : '#e2e8f0';
        container.style.boxShadow = this.isSelected ? '0 4px 12px rgba(8, 145, 178, 0.15)' : 'none';
        container.style.transform = 'translateY(0)';
      };

      // Main click handler
      container.onclick = (e) => {
        if(this.handlers && typeof this.handlers.onSelect === 'function') {
          this.handlers.onSelect(this.fdi);
        }
      };
    }

    if(this.isSelected) {
      container.style.borderColor = '#0891b2';
      container.style.background = '#f0f9ff';
      container.style.boxShadow = '0 4px 12px rgba(8, 145, 178, 0.15)';
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

    // Surfaces grid (always show, but only interactive if editable)
    const surfacesDiv = document.createElement('div');
    surfacesDiv.className = 'tooth-surfaces';
    surfacesDiv.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, auto);
      gap: 0.12rem;
      margin-top: 0.15rem;
      width: 100%;
      justify-content: center;
    `;

    const surfaces = getSurfacesForToothType(this.tooth.type);
    surfaces.forEach(surface => {
      const surfaceEl = createSurfaceElement(
        surface,
        this.fdi,
        this.getSurfaceCondition(surface),
        this.isEditable
      );

      if(this.isEditable && this.handlers && typeof this.handlers.onSurfaceSelect === 'function') {
        surfaceEl.onclick = (e) => {
          e.stopPropagation();
          this.handlers.onSurfaceSelect(this.fdi, surface);
        };
      }

      surfacesDiv.appendChild(surfaceEl);
    });

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
