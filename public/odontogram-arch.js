// Arch component - renders a row of teeth (upper or lower, left or right)

class OdontogramArch {
  constructor(quadrant, state = {}, handlers = {}) {
    this.quadrant = quadrant;
    this.teeth = getTeethByQuadrant(quadrant);
    this.state = state;
    this.handlers = handlers;
    this.isEditable = handlers.isEditable !== false;
  }

  getArchLabel() {
    const labels = {
      [QUADRANT.UPPER_RIGHT]: 'Superior Derecho',
      [QUADRANT.UPPER_LEFT]: 'Superior Izquierdo',
      [QUADRANT.LOWER_LEFT]: 'Inferior Izquierdo',
      [QUADRANT.LOWER_RIGHT]: 'Inferior Derecho'
    };
    return labels[this.quadrant] || '';
  }

  updateGridColumns(grid) {
    let cols = 4;
    if (window.innerWidth >= 1200) cols = 8;
    else if (window.innerWidth < 768) cols = 2;
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'arch-container';
    container.setAttribute('data-quadrant', this.quadrant);

    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 1rem;
      width: 100%;
      box-sizing: border-box;
    `;

    // Arch label
    const label = document.createElement('div');
    label.className = 'arch-label';
    label.textContent = this.getArchLabel();
    label.style.cssText = `
      font-size: 0.85rem;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding-left: 0.75rem;
    `;
    container.appendChild(label);

    // Teeth grid - responsive columns
    const grid = document.createElement('div');
    grid.className = 'arch-grid';

    grid.style.cssText = `
      display: grid;
      gap: 0.25rem;
      padding: 0.75rem;
      background: linear-gradient(135deg, #f9fafb 0%, #f0f9ff 100%);
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      width: 100%;
      box-sizing: border-box;
    `;

    this.updateGridColumns(grid);

    const self = this;
    const resizeHandler = () => self.updateGridColumns(grid);
    window.addEventListener('resize', resizeHandler);
    grid.addEventListener('DOMNodeRemoved', () => window.removeEventListener('resize', resizeHandler));

    this.teeth.forEach(toothData => {
      const toothState = this.state[toothData.fdi] || { condition: CONDITIONS.HEALTHY.id, surfaces: {} };
      const self = this;
      const tooth = new OdontogramTooth(toothData.fdi, toothState, {
        isEditable: this.isEditable,
        onSelect: this.handlers.onToothSelect ? (fdi) => self.handlers.onToothSelect(fdi) : undefined,
        onSurfaceSelect: this.handlers.onSurfaceSelect ? (fdi, surface) => self.handlers.onSurfaceSelect(fdi, surface) : undefined
      });

      const toothEl = tooth.render();
      grid.appendChild(toothEl);
    });

    container.appendChild(grid);
    return container;
  }

  getState() {
    const state = {};
    this.teeth.forEach(toothData => {
      state[toothData.fdi] = this.state[toothData.fdi] || { condition: CONDITIONS.HEALTHY.id, surfaces: {} };
    });
    return state;
  }

  setState(state) {
    this.state = state;
  }

  updateToothCondition(fdi, condition) {
    if(!this.state[fdi]) {
      this.state[fdi] = { condition: CONDITIONS.HEALTHY.id, surfaces: {} };
    }
    this.state[fdi].condition = condition;
  }

  updateToothSurfaceCondition(fdi, surface, condition) {
    if(!this.state[fdi]) {
      this.state[fdi] = { condition: CONDITIONS.HEALTHY.id, surfaces: {} };
    }
    if(!this.state[fdi].surfaces) {
      this.state[fdi].surfaces = {};
    }
    this.state[fdi].surfaces[surface] = condition;
  }
}
