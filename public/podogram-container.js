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
        <svg viewBox="0 0 140 160" width="100" height="110" style="margin: 0 auto; display: block;">
          <!-- Side profile of foot (lateral view) -->
          <!-- Leg/ankle area going up -->
          <path d="M 35 10 L 35 45 Q 30 55 25 60 Q 18 62 15 70 Q 12 78 18 82 L 30 82 Q 50 80 70 78 Q 95 75 115 72 Q 125 70 128 62 Q 130 50 122 42 Q 115 35 100 30 Q 80 22 60 15 Q 45 8 35 10 Z"
                fill="${fillColor}" stroke="#333" stroke-width="1.5" stroke-linejoin="round"/>
          <!-- Ankle bone -->
          <circle cx="42" cy="50" r="4" fill="none" stroke="#333" stroke-width="1" opacity="0.5"/>
          <!-- Heel curve detail -->
          <path d="M 18 75 Q 22 80 28 80" fill="none" stroke="#333" stroke-width="1" opacity="0.4"/>
          <!-- Toe details on top profile -->
          <path d="M 115 72 Q 120 70 125 68" fill="none" stroke="#333" stroke-width="1" opacity="0.4"/>

          <!-- Footprint below (top view of sole) - NORMAL: full footprint with slight arch curve -->
          <!-- Main sole body -->
          <path d="M 30 115 Q 22 115 20 122 Q 18 130 22 138 Q 28 145 38 145 Q 60 147 85 144 Q 100 142 108 138 Q 115 132 113 124 Q 110 115 100 113 Q 65 108 30 115 Z"
                fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <!-- Big toe -->
          <ellipse cx="115" cy="120" rx="6" ry="5" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <!-- Other toes -->
          <circle cx="122" cy="128" r="3" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="124" cy="135" r="2.5" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="123" cy="141" r="2" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="120" cy="146" r="1.8" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
        </svg>
      `,
      'Plano': `
        <svg viewBox="0 0 140 160" width="100" height="110" style="margin: 0 auto; display: block;">
          <!-- Side profile of foot - flatter arch -->
          <path d="M 35 10 L 35 45 Q 30 55 25 60 Q 18 62 15 72 Q 12 80 18 84 L 30 84 Q 50 84 70 82 Q 95 80 115 76 Q 125 72 128 64 Q 130 52 122 44 Q 115 36 100 30 Q 80 22 60 15 Q 45 8 35 10 Z"
                fill="${fillColor}" stroke="#333" stroke-width="1.5" stroke-linejoin="round"/>
          <!-- Ankle bone -->
          <circle cx="42" cy="50" r="4" fill="none" stroke="#333" stroke-width="1" opacity="0.5"/>
          <!-- Heel detail -->
          <path d="M 18 78 Q 22 83 28 83" fill="none" stroke="#333" stroke-width="1" opacity="0.4"/>
          <!-- Toe detail -->
          <path d="M 115 75 Q 120 73 125 70" fill="none" stroke="#333" stroke-width="1" opacity="0.4"/>

          <!-- Footprint - FLAT FOOT: completely full, no arch indent -->
          <path d="M 28 113 Q 18 113 16 122 Q 14 132 20 140 Q 26 147 38 147 Q 62 149 88 146 Q 106 144 112 140 Q 118 132 115 122 Q 112 113 100 111 Q 60 106 28 113 Z"
                fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <!-- Big toe -->
          <ellipse cx="118" cy="120" rx="6" ry="5" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <!-- Other toes -->
          <circle cx="124" cy="128" r="3" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="126" cy="135" r="2.5" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="125" cy="141" r="2" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="122" cy="147" r="1.8" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
        </svg>
      `,
      'Cavo': `
        <svg viewBox="0 0 140 160" width="100" height="110" style="margin: 0 auto; display: block;">
          <!-- Side profile of foot - high arch -->
          <path d="M 35 10 L 35 45 Q 30 55 25 60 Q 18 62 15 68 Q 12 75 18 80 L 28 80 Q 35 75 50 70 Q 75 62 100 65 Q 118 68 125 62 Q 132 50 124 40 Q 115 32 100 28 Q 80 20 60 13 Q 45 8 35 10 Z"
                fill="${fillColor}" stroke="#333" stroke-width="1.5" stroke-linejoin="round"/>
          <!-- Ankle bone -->
          <circle cx="42" cy="48" r="4" fill="none" stroke="#333" stroke-width="1" opacity="0.5"/>
          <!-- Pronounced arch -->
          <path d="M 30 78 Q 60 65 95 68" fill="none" stroke="#333" stroke-width="1" opacity="0.4"/>

          <!-- Footprint - CAVO: only heel and ball/forefoot, separated (no arch contact) -->
          <!-- Heel print -->
          <ellipse cx="32" cy="135" rx="14" ry="11" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <!-- Ball of foot print -->
          <ellipse cx="98" cy="125" rx="16" ry="10" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <!-- Big toe -->
          <ellipse cx="118" cy="120" rx="6" ry="5" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <!-- Other toes -->
          <circle cx="124" cy="128" r="3" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="126" cy="135" r="2.5" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="125" cy="141" r="2" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
          <circle cx="122" cy="146" r="1.8" fill="${orangeColor}" stroke="#333" stroke-width="1"/>
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
