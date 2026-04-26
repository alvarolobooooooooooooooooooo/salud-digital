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
    // Use container width if available, otherwise use window width
    const container = grid.closest('.arch-container')?.parentElement || grid.parentElement;
    const w = container ? container.offsetWidth : window.innerWidth;
    if (w >= 1350) cols = 8;
    else if (w >= 950) cols = 4;
    else cols = 2;
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
      font-size: 0.8rem;
      font-weight: 700;
      color: #0891b2;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding-left: 0.5rem;
      margin-bottom: 0.5rem;
    `;
    container.appendChild(label);

    // Teeth grid - responsive columns
    const grid = document.createElement('div');
    grid.className = 'arch-grid';

    grid.style.cssText = `
      display: grid;
      gap: 0.4rem;
      padding: 1rem;
      background: linear-gradient(135deg, #f8fafc 0%, #f0f9ff 100%);
      border-radius: 12px;
      border: 1.5px solid #e5e7eb;
      width: 100%;
      box-sizing: border-box;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      transition: all 0.3s ease;
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
        onSelect: this.handlers.onToothSelect ? (fdi, e) => self.handlers.onToothSelect(fdi, e) : undefined,
        onSurfaceSelect: this.handlers.onSurfaceSelect ? (fdi, surface, e) => self.handlers.onSurfaceSelect(fdi, surface, e) : undefined
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
