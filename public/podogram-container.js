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
    const opacity = selected ? '1' : '0.85';
    const imageMap = {
      'Espiguio': '/assets/foot-types/tipo-espiguio.png',
      'Romano': '/assets/foot-types/tipo-romano.png',
      'Griego': '/assets/foot-types/tipo-griego.png',
      'Germánico': '/assets/foot-types/tipo-germanico.png',
      'Celta': '/assets/foot-types/tipo-celta.png'
    };
    const src = imageMap[type] || imageMap['Romano'];
    return `<img class="foot-img foot-img--line" src="${src}" alt="${type}" style="width: 85px; height: 95px; object-fit: contain; margin: 0 auto; display: block; opacity: ${opacity};"/>`;
  }

  getFootShapeSVG(shape, selected) {
    const opacity = selected ? '1' : '0.85';
    const imageMap = {
      'Normal': '/assets/foot-types/pie-normal.png',
      'Plano': '/assets/foot-types/pie-plano.png',
      'Cavo': '/assets/foot-types/pie-cavo.png'
    };
    const src = imageMap[shape] || imageMap['Normal'];
    return `<img class="foot-img foot-img--photo" src="${src}" alt="${shape}" style="width: 85px; height: 95px; object-fit: contain; margin: 0 auto; display: block; opacity: ${opacity};"/>`;
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const footTypes = ['Espiguio', 'Romano', 'Griego', 'Germánico', 'Celta'];
    const footShapes = ['Normal', 'Plano', 'Cavo'];

    let html = `
      <!-- SVG filter: knocks out near-white pixels so colored photos blend cleanly on dark cards -->
      <svg width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden;" aria-hidden="true">
        <defs>
          <filter id="podogramRemoveBg" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
            <feColorMatrix type="matrix" values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              -1.4 -1.4 -1.4 3.8 0"/>
          </filter>
        </defs>
      </svg>
      <div class="podogram-wrapper">
        <!-- Tipo de Pie -->
        <div class="podogram-section">
          <h4 class="podogram-title">Tipo de Pie</h4>
          <div class="podogram-grid">
            <div class="podogram-column">
              <div class="podogram-side-label">Pie Derecho</div>
              <div class="podogram-options">
                ${footTypes.map(type => this.createFootTypeButton(type, 'Right')).join('')}
              </div>
            </div>
            <div class="podogram-column">
              <div class="podogram-side-label">Pie Izquierdo</div>
              <div class="podogram-options">
                ${footTypes.map(type => this.createFootTypeButton(type, 'Left')).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Forma de Pie -->
        <div class="podogram-section" style="margin-top: 2rem;">
          <h4 class="podogram-title">Forma de Pie</h4>
          <div class="podogram-grid">
            <div class="podogram-column">
              <div class="podogram-side-label">Pie Derecho</div>
              <div class="podogram-options">
                ${footShapes.map(shape => this.createFootShapeButton(shape, 'Right')).join('')}
              </div>
            </div>
            <div class="podogram-column">
              <div class="podogram-side-label">Pie Izquierdo</div>
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
        .podogram-title {
          margin-bottom: 1.5rem;
          font-weight: 600;
          color: #0f172a;
        }
        .podogram-side-label {
          text-align: center;
          margin-bottom: 1rem;
          font-weight: 600;
          color: #475569;
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
          background: white;
          box-shadow: 0 0 0 3px rgba(8, 145, 178, 0.2), 0 4px 12px rgba(8, 145, 178, 0.15);
          transform: scale(1.05);
        }
        .podogram-button.selected .foot-svg {
          filter: brightness(1.05);
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

        /* ── Dark theme overrides ── */
        [data-theme="dark"] .podogram-wrapper {
          background: rgba(20, 20, 22, 0.6);
          border-color: rgba(255, 255, 255, 0.09);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        [data-theme="dark"] .podogram-title {
          color: #f1f5f9;
        }
        [data-theme="dark"] .podogram-side-label {
          color: #cbd5e1;
        }
        [data-theme="dark"] .podogram-button {
          background: rgba(28, 28, 30, 0.7);
          border-color: rgba(255, 255, 255, 0.09);
        }
        [data-theme="dark"] .podogram-button:hover {
          border-color: #06b6d4;
          background: ${this.readOnly ? 'rgba(28, 28, 30, 0.7)' : 'rgba(6, 182, 212, 0.08)'};
        }
        [data-theme="dark"] .podogram-button.selected {
          border-color: #06b6d4;
          background: rgba(6, 182, 212, 0.08);
          box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.25), 0 4px 14px rgba(6, 182, 212, 0.2);
        }
        [data-theme="dark"] .button-label {
          color: #94a3b8;
        }
        [data-theme="dark"] .podogram-button.selected .button-label {
          color: #06b6d4;
        }
        /* Line drawings: invert dark strokes → light, then screen-blend so the
           inverted black background disappears into the card (no rectangle). */
        [data-theme="dark"] .foot-img--line {
          filter: invert(1) brightness(1.15) contrast(1.1);
          mix-blend-mode: screen;
        }
        /* Photos: knock out the near-white PNG background via SVG luminance
           filter so the colored foot floats directly on the card. */
        [data-theme="dark"] .foot-img--photo {
          filter: url(#podogramRemoveBg) brightness(1.05) contrast(1.02);
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
