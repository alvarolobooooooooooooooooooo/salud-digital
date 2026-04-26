class PodogramContainer {
  constructor(containerId, initialState = {}, readOnly = false) {
    this.containerId = containerId;
    this.readOnly = readOnly;
    this.state = {
      footTypeRight: initialState.foot_type_right || null,
      footTypeLeft: initialState.foot_type_left || null,
      footShapeRight: initialState.foot_shape_right || null,
      footShapeLeft: initialState.foot_shape_left || null
    };
    this.skinColor = '#E8B89E';
    this.render();
  }

  getState() {
    return {
      foot_type_right: this.state.footTypeRight,
      foot_type_left: this.state.footTypeLeft,
      foot_shape_right: this.state.footShapeRight,
      foot_shape_left: this.state.footShapeLeft
    };
  }

  getFootTypeSVG(type, selected) {
    const fillColor = selected ? this.skinColor : 'white';
    const strokeColor = '#333';
    const strokeWidth = '1.5';

    // Each foot type has 5 toes with different lengths
    // [toe1_height, toe2_height, toe3_height, toe4_height, toe5_height] - higher value = longer toe
    const toeLengths = {
      'Espiguio': [55, 35, 30, 28, 25],
      'Romano': [45, 45, 40, 35, 30],
      'Griego': [40, 55, 45, 38, 30],
      'Germánico': [50, 38, 32, 28, 25],
      'Celta': [45, 40, 42, 35, 28]
    };

    const lengths = toeLengths[type] || [50, 45, 40, 35, 30];
    const toeXPositions = [25, 40, 55, 70, 83];
    const toeWidths = [13, 11, 10, 9, 8];

    let toes = '';
    let nails = '';
    let lines = '';

    for (let i = 0; i < 5; i++) {
      const x = toeXPositions[i];
      const w = toeWidths[i];
      const h = lengths[i];
      const yTop = 80 - h;

      // Toe shape
      toes += `<path d="M ${x - w/2} 80 L ${x - w/2} ${yTop + 8} Q ${x - w/2} ${yTop} ${x} ${yTop} Q ${x + w/2} ${yTop} ${x + w/2} ${yTop + 8} L ${x + w/2} 80 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;

      // Nail
      nails += `<rect x="${x - w/2 + 2}" y="${yTop + 3}" width="${w - 4}" height="${Math.min(6, h/4)}" fill="none" stroke="${strokeColor}" stroke-width="1" rx="2"/>`;

      // Vertical line on toe
      lines += `<line x1="${x}" y1="${yTop + 10}" x2="${x}" y2="78" stroke="${strokeColor}" stroke-width="0.8" opacity="0.5"/>`;
    }

    return `
      <svg viewBox="0 0 110 110" width="80" height="80" style="margin: 0 auto; display: block;">
        <!-- Foot base (sole) -->
        <path d="M 15 80 Q 12 95 20 105 L 90 105 Q 98 95 95 80 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
        <!-- Toes -->
        ${toes}
        <!-- Nails -->
        ${nails}
        <!-- Lines on toes -->
        ${lines}
      </svg>
    `;
  }

  getFootShapeSVG(shape, selected) {
    const fillColor = selected ? this.skinColor : 'white';
    const orangeColor = selected ? '#F39C5C' : '#FAD4B0';

    const svgs = {
      'Normal': `
        <svg viewBox="0 0 140 130" width="100" height="90" style="margin: 0 auto; display: block;">
          <!-- Side view of foot (top part) -->
          <path d="M 15 55 Q 15 40 25 30 Q 35 22 55 18 Q 75 16 95 20 Q 115 25 125 35 Q 130 50 125 65 Q 120 72 110 75 L 25 75 Q 15 70 15 55 Z"
                fill="${fillColor}" stroke="#333" stroke-width="1.5"/>
          <!-- Ankle indent -->
          <ellipse cx="40" cy="40" rx="6" ry="4" fill="none" stroke="#333" stroke-width="1" opacity="0.4"/>
          <!-- Footprint (bottom - orange) - normal full footprint -->
          <path d="M 30 95 Q 25 95 25 105 Q 25 118 35 120 Q 50 122 70 120 Q 95 118 110 115 Q 120 110 118 100 Q 115 92 105 92 Q 70 90 30 95 Z"
                fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <!-- Toes on footprint -->
          <circle cx="115" cy="98" r="4" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="123" cy="103" r="3" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="127" cy="110" r="2.5" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="129" cy="116" r="2" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
        </svg>
      `,
      'Plano': `
        <svg viewBox="0 0 140 130" width="100" height="90" style="margin: 0 auto; display: block;">
          <!-- Side view of foot (top) -->
          <path d="M 15 55 Q 15 40 25 30 Q 35 22 55 18 Q 75 16 95 20 Q 115 25 125 35 Q 130 50 125 65 Q 120 72 110 75 L 25 75 Q 15 70 15 55 Z"
                fill="${fillColor}" stroke="#333" stroke-width="1.5"/>
          <!-- Ankle indent -->
          <ellipse cx="40" cy="40" rx="6" ry="4" fill="none" stroke="#333" stroke-width="1" opacity="0.4"/>
          <!-- Footprint (bottom - orange) - flat foot, full contact wider -->
          <path d="M 25 95 Q 18 95 18 108 Q 18 122 32 122 Q 55 124 80 122 Q 105 120 115 117 Q 122 112 120 102 Q 115 92 100 92 Q 60 88 25 95 Z"
                fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <!-- Toes on footprint -->
          <circle cx="118" cy="100" r="4" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="125" cy="105" r="3" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="128" cy="111" r="2.5" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="130" cy="117" r="2" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
        </svg>
      `,
      'Cavo': `
        <svg viewBox="0 0 140 130" width="100" height="90" style="margin: 0 auto; display: block;">
          <!-- Side view of foot (top) - higher arch -->
          <path d="M 15 55 Q 15 38 25 28 Q 35 20 55 16 Q 75 14 95 18 Q 115 23 125 33 Q 132 48 125 65 Q 120 72 110 75 L 25 75 Q 15 70 15 55 Z"
                fill="${fillColor}" stroke="#333" stroke-width="1.5"/>
          <!-- Ankle indent -->
          <ellipse cx="40" cy="40" rx="6" ry="4" fill="none" stroke="#333" stroke-width="1" opacity="0.4"/>
          <!-- Footprint (bottom - orange) - cavo, only heel and ball of foot visible -->
          <!-- Heel -->
          <ellipse cx="35" cy="108" rx="14" ry="10" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <!-- Ball of foot -->
          <ellipse cx="105" cy="105" rx="18" ry="11" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <!-- Toes on footprint -->
          <circle cx="120" cy="98" r="4" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="126" cy="103" r="3" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="129" cy="110" r="2.5" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="131" cy="116" r="2" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
        </svg>
      `
    };

    return svgs[shape] || svgs['Normal'];
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const footTypes = ['Espiguio', 'Romano', 'Griego', 'Germánico', 'Celta'];
    const footShapes = ['Normal', 'Plano', 'Cavo'];

    let html = `
      <div class="podogram-wrapper">
        <!-- Tipo de Pie -->
        <div class="podogram-section">
          <h4 style="margin-bottom: 1.5rem; font-weight: 600; color: #0f172a;">Tipo de Pie</h4>
          <div class="podogram-grid">
            <div class="podogram-column">
              <div style="text-align: center; margin-bottom: 1rem; font-weight: 600; color: #475569;">Pie Derecho</div>
              <div class="podogram-options">
                ${footTypes.map(type => this.createFootTypeButton(type, 'Right')).join('')}
              </div>
            </div>
            <div class="podogram-column">
              <div style="text-align: center; margin-bottom: 1rem; font-weight: 600; color: #475569;">Pie Izquierdo</div>
              <div class="podogram-options">
                ${footTypes.map(type => this.createFootTypeButton(type, 'Left')).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Forma de Pie -->
        <div class="podogram-section" style="margin-top: 2rem;">
          <h4 style="margin-bottom: 1.5rem; font-weight: 600; color: #0f172a;">Forma de Pie</h4>
          <div class="podogram-grid">
            <div class="podogram-column">
              <div style="text-align: center; margin-bottom: 1rem; font-weight: 600; color: #475569;">Pie Derecho</div>
              <div class="podogram-options">
                ${footShapes.map(shape => this.createFootShapeButton(shape, 'Right')).join('')}
              </div>
            </div>
            <div class="podogram-column">
              <div style="text-align: center; margin-bottom: 1rem; font-weight: 600; color: #475569;">Pie Izquierdo</div>
              <div class="podogram-options">
                ${footShapes.map(shape => this.createFootShapeButton(shape, 'Left')).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        .podogram-wrapper {
          background: #f9fafb;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 2rem;
          margin: 1.5rem 0;
        }
        .podogram-section {
          margin-bottom: 2rem;
        }
        .podogram-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }
        .podogram-column {
          display: flex;
          flex-direction: column;
        }
        .podogram-options {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          justify-content: center;
        }
        .podogram-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem;
          border: 2px solid #e2e8f0;
          background: white;
          border-radius: 10px;
          cursor: ${this.readOnly ? 'not-allowed' : 'pointer'};
          transition: all 0.2s;
          opacity: ${this.readOnly ? '0.6' : '1'};
          width: 100px;
          text-align: center;
        }
        .podogram-button:hover {
          border-color: #0891b2;
          background: ${this.readOnly ? 'white' : '#f0f9ff'};
          transform: ${this.readOnly ? 'none' : 'translateY(-2px)'};
        }
        .podogram-button.selected {
          border-color: #0891b2;
          background: #f0f9ff;
        }
        .podogram-button.selected .foot-svg {
          filter: brightness(1.1);
        }
        .foot-svg {
          width: 90px;
          height: 90px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .button-label {
          font-size: 0.8rem;
          font-weight: 500;
          color: #475569;
          transition: color 0.2s;
        }
        .podogram-button.selected .button-label {
          color: #0891b2;
          font-weight: 600;
        }
        @media (max-width: 768px) {
          .podogram-grid {
            grid-template-columns: 1fr;
          }
          .podogram-wrapper {
            padding: 1rem;
          }
          .podogram-options {
            justify-content: center;
          }
        }
      </style>
    `;

    container.innerHTML = html;

    if (!this.readOnly) {
      footTypes.forEach(type => {
        const rightBtn = document.getElementById(`footType-Right-${type}`);
        const leftBtn = document.getElementById(`footType-Left-${type}`);
        if (rightBtn) rightBtn.addEventListener('click', () => {
          this.state.footTypeRight = this.state.footTypeRight === type ? null : type;
          this.render();
        });
        if (leftBtn) leftBtn.addEventListener('click', () => {
          this.state.footTypeLeft = this.state.footTypeLeft === type ? null : type;
          this.render();
        });
      });

      footShapes.forEach(shape => {
        const rightBtn = document.getElementById(`footShape-Right-${shape}`);
        const leftBtn = document.getElementById(`footShape-Left-${shape}`);
        if (rightBtn) rightBtn.addEventListener('click', () => {
          this.state.footShapeRight = this.state.footShapeRight === shape ? null : shape;
          this.render();
        });
        if (leftBtn) leftBtn.addEventListener('click', () => {
          this.state.footShapeLeft = this.state.footShapeLeft === shape ? null : shape;
          this.render();
        });
      });
    }
  }

  createFootTypeButton(type, side) {
    const selected = side === 'Right'
      ? this.state.footTypeRight === type
      : this.state.footTypeLeft === type;
    const id = `footType-${side}-${type}`;
    return `
      <button id="${id}" class="podogram-button ${selected ? 'selected' : ''}" ${this.readOnly ? 'disabled' : ''}>
        <div class="foot-svg">
          ${this.getFootTypeSVG(type, selected)}
        </div>
        <span class="button-label">${type}</span>
      </button>
    `;
  }

  createFootShapeButton(shape, side) {
    const selected = side === 'Right'
      ? this.state.footShapeRight === shape
      : this.state.footShapeLeft === shape;
    const id = `footShape-${side}-${shape}`;
    return `
      <button id="${id}" class="podogram-button ${selected ? 'selected' : ''}" ${this.readOnly ? 'disabled' : ''}>
        <div class="foot-svg">
          ${this.getFootShapeSVG(shape, selected)}
        </div>
        <span class="button-label">${shape}</span>
      </button>
    `;
  }
}
