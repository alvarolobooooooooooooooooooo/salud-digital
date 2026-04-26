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
          flex-direction: column;
          gap: 0.75rem;
        }
        .podogram-button {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border: 2px solid #e2e8f0;
          background: white;
          border-radius: 10px;
          cursor: ${this.readOnly ? 'not-allowed' : 'pointer'};
          transition: all 0.2s;
          opacity: ${this.readOnly ? '0.6' : '1'};
        }
        .podogram-button:hover {
          border-color: #0891b2;
          background: ${this.readOnly ? 'white' : '#f0f9ff'};
          transform: ${this.readOnly ? 'none' : 'translateY(-2px)'};
        }
        .podogram-button.selected {
          border-color: #0891b2;
          background: #0891b2;
          color: white;
        }
        .podogram-button.selected .button-label {
          color: white;
          font-weight: 600;
        }
        .button-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }
        .button-label {
          font-size: 0.95rem;
          font-weight: 500;
          color: #475569;
          transition: color 0.2s;
        }
        @media (max-width: 768px) {
          .podogram-grid {
            grid-template-columns: 1fr;
          }
          .podogram-wrapper {
            padding: 1rem;
          }
        }
      </style>
    `;

    container.innerHTML = html;

    if (!this.readOnly) {
      footTypes.forEach(type => {
        document.getElementById(`footType-Right-${type}`).addEventListener('click', () => {
          this.state.footTypeRight = this.state.footTypeRight === type ? null : type;
          this.render();
        });
        document.getElementById(`footType-Left-${type}`).addEventListener('click', () => {
          this.state.footTypeLeft = this.state.footTypeLeft === type ? null : type;
          this.render();
        });
      });

      footShapes.forEach(shape => {
        document.getElementById(`footShape-Right-${shape}`).addEventListener('click', () => {
          this.state.footShapeRight = this.state.footShapeRight === shape ? null : shape;
          this.render();
        });
        document.getElementById(`footShape-Left-${shape}`).addEventListener('click', () => {
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
    const icons = {
      'Espiguio': '👣',
      'Romano': '🦶',
      'Griego': '🦵',
      'Germánico': '👞',
      'Celta': '🩴'
    };
    return `
      <button id="${id}" class="podogram-button ${selected ? 'selected' : ''}" ${this.readOnly ? 'disabled' : ''}>
        <span class="button-icon">${icons[type] || '👣'}</span>
        <span class="button-label">${type}</span>
      </button>
    `;
  }

  createFootShapeButton(shape, side) {
    const selected = side === 'Right'
      ? this.state.footShapeRight === shape
      : this.state.footShapeLeft === shape;
    const id = `footShape-${side}-${shape}`;
    const icons = {
      'Normal': '🦶',
      'Plano': '📍',
      'Cavo': '⛸️'
    };
    return `
      <button id="${id}" class="podogram-button ${selected ? 'selected' : ''}" ${this.readOnly ? 'disabled' : ''}>
        <span class="button-icon">${icons[shape] || '🦶'}</span>
        <span class="button-label">Pie ${shape}</span>
      </button>
    `;
  }
}
