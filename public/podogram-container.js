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
    const color = selected ? this.skinColor : '#E8D4C8';
    const toes = {
      'Espiguio': [30, 50, 65, 80, 95],
      'Romano': [40, 55, 70, 80, 90],
      'Griego': [35, 65, 75, 80, 85],
      'Germánico': [50, 62, 72, 82, 92],
      'Celta': [48, 60, 70, 80, 90]
    };

    const toePositions = toes[type] || [50, 60, 70, 80, 90];
    const toeSvgs = toePositions.map((x, i) => {
      const height = 35 - (i * 3);
      return `<rect x="${x - 4}" y="60" width="8" height="${height}" fill="${color}" rx="4"/>`;
    }).join('');

    return `
      <svg viewBox="0 0 120 110" width="80" height="80" style="margin: 0 auto; display: block;">
        <!-- Heel -->
        <ellipse cx="60" cy="95" rx="20" ry="12" fill="${color}"/>
        <!-- Foot -->
        <path d="M 40 80 Q 35 50 50 20 L 100 25 Q 110 50 95 90 Z" fill="${color}"/>
        <!-- Toes -->
        ${toeSvgs}
      </svg>
    `;
  }

  getFootShapeSVG(shape, selected) {
    const color = selected ? this.skinColor : '#E8D4C8';
    const svgs = {
      'Normal': `
        <svg viewBox="0 0 120 100" width="80" height="80" style="margin: 0 auto; display: block;">
          <!-- Foot side view -->
          <path d="M 20 60 Q 20 40 30 25 Q 40 15 60 10 L 100 20 Q 110 40 100 75 Q 80 85 40 80 Z" fill="${color}"/>
          <!-- Toes -->
          <circle cx="65" cy="12" r="4" fill="${color}"/>
          <circle cx="75" cy="13" r="4" fill="${color}"/>
          <circle cx="85" cy="15" r="4" fill="${color}"/>
          <circle cx="95" cy="18" r="4" fill="${color}"/>
        </svg>
      `,
      'Plano': `
        <svg viewBox="0 0 120 100" width="80" height="80" style="margin: 0 auto; display: block;">
          <!-- Flat foot -->
          <path d="M 20 70 L 25 35 Q 35 20 50 12 Q 70 8 100 15 L 105 70 Z" fill="${color}"/>
          <!-- Toes -->
          <circle cx="55" cy="14" r="4" fill="${color}"/>
          <circle cx="70" cy="11" r="4" fill="${color}"/>
          <circle cx="85" cy="12" r="4" fill="${color}"/>
          <circle cx="98" cy="16" r="4" fill="${color}"/>
        </svg>
      `,
      'Cavo': `
        <svg viewBox="0 0 120 100" width="80" height="80" style="margin: 0 auto; display: block;">
          <!-- Arched foot -->
          <path d="M 20 75 Q 25 50 35 30 Q 50 10 70 8 Q 85 10 100 20 L 102 75 Z" fill="${color}"/>
          <!-- Arch indication -->
          <path d="M 25 70 Q 40 55 75 50" stroke="#D4A574" stroke-width="1" fill="none" opacity="0.5"/>
          <!-- Toes -->
          <circle cx="75" cy="10" r="4" fill="${color}"/>
          <circle cx="85" cy="9" r="4" fill="${color}"/>
          <circle cx="95" cy="12" r="4" fill="${color}"/>
          <circle cx="103" cy="18" r="4" fill="${color}"/>
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
          width: 80px;
          height: 80px;
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
