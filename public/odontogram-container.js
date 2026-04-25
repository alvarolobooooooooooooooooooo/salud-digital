// Main Odontogram Container - orchestrates all components

class OdontogramContainer {
  constructor(containerId, initialState = {}, readOnly = false) {
    this.containerId = containerId;
    this.initialState = initialState;
    this.readOnly = readOnly;
    this.state = this.initializeState(initialState);
    this.selectedTooth = null;
    this.selectedSurface = null;
    this.components = {};
    this.firstRender = true;

    // Build floating popup for conditions
    this._popup = this._buildPopup();

    this.render();
  }

  initializeState(initial) {
    const state = {};
    TEETH_DATA.forEach(toothData => {
      state[toothData.fdi] = initial[toothData.fdi] || {
        condition: CONDITIONS.HEALTHY.id,
        surfaces: {},
        isSelected: false
      };
    });
    return state;
  }

  render() {
    const container = document.getElementById(this.containerId);
    if(!container) return;

    container.innerHTML = '';
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 2rem;
    `;

    // Arches (quadrants)
    const archesContainer = document.createElement('div');
    archesContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 2rem;
      width: 100%;
      box-sizing: border-box;
    `;

    const quadrants = [
      QUADRANT.UPPER_RIGHT,
      QUADRANT.UPPER_LEFT,
      QUADRANT.LOWER_LEFT,
      QUADRANT.LOWER_RIGHT
    ];

    this.components.arches = {};

    quadrants.forEach(quadrant => {
      const self = this;

      const arch = new OdontogramArch(quadrant, this.getQuadrantState(quadrant), {
        isEditable: !this.readOnly,
        onToothSelect: function(fdi, e) {
          self.selectTooth(fdi, e);
        },
        onSurfaceSelect: function(fdi, surface, e) {
          self.selectSurface(fdi, surface, e);
        }
      });

      this.components.arches[quadrant] = arch;
      archesContainer.appendChild(arch.render());
    });

    container.appendChild(archesContainer);

    // Legend
    const legend = new OdontogramLegend();
    container.appendChild(legend.render());

    // Add custom styles
    this.addStyles();

    this.firstRender = false;
  }

  getQuadrantState(quadrant) {
    const quadrantState = {};
    const teeth = getTeethByQuadrant(quadrant);
    teeth.forEach(toothData => {
      quadrantState[toothData.fdi] = this.state[toothData.fdi];
    });
    return quadrantState;
  }

  selectTooth(fdi, e) {
    // Desselect previous
    if(this.selectedTooth && this.selectedTooth !== fdi) {
      this.state[this.selectedTooth].isSelected = false;
    }

    // Select new
    this.selectedTooth = fdi;
    this.selectedSurface = null;
    this.state[fdi].isSelected = true;

    this.updateTeethVisuals();

    if(e) {
      this._showPopup(fdi, null, e);
    }
  }

  selectSurface(fdi, surface, e) {
    this.selectedTooth = fdi;
    this.selectedSurface = surface;
    this.state[fdi].isSelected = true;

    this.updateTeethVisuals();

    if(e) {
      this._showPopup(fdi, surface, e);
    }
  }

  applyCondition(condition, fdi, surface) {
    // Use selected tooth if not specified
    if(!fdi && this.selectedTooth) {
      fdi = this.selectedTooth;
      surface = this.selectedSurface;
    }

    // Need tooth selected
    if(!fdi) {
      return;
    }

    // Ensure tooth exists
    if(!this.state[fdi]) {
      this.state[fdi] = {
        condition: CONDITIONS.HEALTHY.id,
        surfaces: {},
        isSelected: true
      };
    }

    // Apply condition
    if(surface) {
      if(!this.state[fdi].surfaces) {
        this.state[fdi].surfaces = {};
      }
      this.state[fdi].surfaces[surface] = condition;
    } else {
      this.state[fdi].condition = condition;
    }

    this.updateTeethVisuals();
  }

  clearToothSelection() {
    if(this.selectedTooth) {
      // Reset diente a estado sano
      this.state[this.selectedTooth] = {
        condition: CONDITIONS.HEALTHY.id,
        surfaces: {},
        isSelected: false
      };
    }
    this.selectedTooth = null;
    this.selectedSurface = null;

    if(this.components.toolbar) {
      this.components.toolbar.clearSelection();
    }

    this.updateTeethVisuals();
  }

  resetAll() {
    if(confirm('¿Restablecer todos los dientes a estado sano?')) {
      TEETH_DATA.forEach(toothData => {
        this.state[toothData.fdi] = {
          condition: CONDITIONS.HEALTHY.id,
          surfaces: {},
          isSelected: false
        };
      });
      this.selectedTooth = null;
      this.selectedSurface = null;
      this.updateTeethVisuals();
    }
  }

  _buildPopup() {
    const popup = document.createElement('div');
    popup.id = 'odonto-popup';
    popup.style.cssText = `
      position: fixed;
      z-index: 1000;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      padding: 1rem;
      min-width: 260px;
      display: none;
    `;

    // Header with tooth info
    const header = document.createElement('div');
    header.id = 'odonto-popup-header';
    header.style.cssText = `
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: #1e3a5f;
      font-size: 0.9rem;
    `;
    popup.appendChild(header);

    // Condition buttons grid
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    `;

    CONDITION_LIST.forEach(condition => {
      const btn = document.createElement('button');
      btn.className = 'odonto-condition-btn';
      btn.textContent = condition.label;
      btn.title = condition.label;
      btn.style.cssText = `
        padding: 0.5rem;
        background: white;
        border: 1px solid #d1d5db;
        border-left: 3px solid ${condition.color};
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.7rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: all 0.2s;
        color: #1e293b;
        font-weight: 500;
      `;
      btn.onmouseover = () => {
        btn.style.borderRightColor = '#0891b2';
        btn.style.borderTopColor = '#0891b2';
        btn.style.borderBottomColor = '#0891b2';
        btn.style.backgroundColor = '#f0f9ff';
      };
      btn.onmouseout = () => {
        btn.style.borderRightColor = '#d1d5db';
        btn.style.borderTopColor = '#d1d5db';
        btn.style.borderBottomColor = '#d1d5db';
        btn.style.backgroundColor = 'white';
      };

      const self = this;
      btn.onclick = () => {
        self.applyCondition(condition.id, self.selectedTooth, self.selectedSurface);
        popup.style.display = 'none';
      };

      buttonsContainer.appendChild(btn);
    });

    popup.appendChild(buttonsContainer);

    // Clear selection button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Limpiar Selección';
    clearBtn.style.cssText = `
      width: 100%;
      padding: 0.5rem;
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
    `;
    clearBtn.onmouseover = () => clearBtn.style.backgroundColor = '#dc2626';
    clearBtn.onmouseout = () => clearBtn.style.backgroundColor = '#ef4444';
    const self = this;
    clearBtn.onclick = () => {
      self.clearToothSelection();
      popup.style.display = 'none';
    };
    popup.appendChild(clearBtn);

    // Outside click handler
    document.addEventListener('click', (e) => {
      if(popup.style.display === 'block' && !popup.contains(e.target)) {
        popup.style.display = 'none';
      }
    }, true);

    document.body.appendChild(popup);
    return popup;
  }

  _showPopup(fdi, surface, e) {
    if(!this._popup) return;

    const tooth = getToothByFDI(fdi);
    let header = tooth.name;
    if(surface) {
      header += ` - ${surface.charAt(0).toUpperCase() + surface.slice(1)}`;
    }
    document.getElementById('odonto-popup-header').textContent = header;

    const rect = e.target.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left;

    if(top + 320 > window.innerHeight) {
      top = rect.top - 320 - 8;
    }
    if(left + 260 > window.innerWidth) {
      left = window.innerWidth - 260 - 16;
    }
    left = Math.max(16, left);

    this._popup.style.top = top + 'px';
    this._popup.style.left = left + 'px';
    this._popup.style.display = 'block';
  }

  updateTeethVisuals() {
    // Simply re-render everything - it's cleaner and more reliable
    this.render();
  }

  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  setState(newState) {
    this.state = this.initializeState(newState);
    this.render();
  }

  setReadOnly(readOnly) {
    this.readOnly = readOnly;
    this.render();
  }

  addStyles() {
    let style = document.getElementById('odontogram-styles');
    if(!style) {
      style = document.createElement('style');
      style.id = 'odontogram-styles';
      document.head.appendChild(style);

      style.textContent = `
        .tooth-svg {
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05));
          transition: filter 0.2s;
        }

        .tooth-outline {
          transition: all 0.2s;
        }

        .tooth-container:hover .tooth-outline {
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
        }

        .tooth-surface {
          box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.3);
          transition: all 0.2s;
        }

        .tooth-surface:hover {
          transform: scale(1.15);
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }

        .tooth-surface:active {
          transform: scale(0.95) !important;
        }

        .condition-btn {
          font-family: inherit;
          white-space: nowrap;
        }

        .condition-btn:active {
          transform: scale(0.98);
        }

        /* Tablet (768px and below) */
        @media (max-width: 1024px) {
          .arch-grid {
            padding: 1rem !important;
            gap: 0.5rem !important;
            grid-template-columns: repeat(4, 1fr) !important;
          }

          .tooth-container {
            padding: 0.5rem !important;
          }

          .condition-buttons {
            grid-template-columns: repeat(3, 1fr) !important;
          }

          .legend-grid {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 1rem !important;
          }
        }

        /* Mobile Landscape (768px to 480px) */
        @media (max-width: 768px) {
          .arch-grid {
            padding: 0.75rem !important;
            gap: 0.4rem !important;
            grid-template-columns: repeat(2, 1fr) !important;
          }

          .tooth-container {
            padding: 0.4rem !important;
            gap: 0.25rem !important;
          }

          .tooth-number {
            font-size: 0.75rem !important;
          }

          .tooth-surfaces {
            grid-template-columns: repeat(2, 20px) !important;
            gap: 2px !important;
          }

          .condition-buttons {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 0.5rem !important;
          }

          .condition-btn {
            padding: 0.5rem 0.75rem !important;
            font-size: 0.75rem !important;
          }

          .legend-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 0.75rem !important;
          }
        }

        /* Mobile Portrait (480px and below) */
        @media (max-width: 480px) {
          .tooth-container {
            padding: 0.35rem !important;
            gap: 0.2rem !important;
          }

          .tooth-number {
            font-size: 0.65rem !important;
          }

          .tooth-surfaces {
            grid-template-columns: repeat(2, 18px) !important;
            gap: 2px !important;
            margin-top: 0.25rem !important;
          }

          .arch-grid {
            padding: 0.5rem !important;
            gap: 0.35rem !important;
            grid-template-columns: repeat(2, 1fr) !important;
          }

          .arch-label {
            font-size: 0.75rem !important;
          }

          .condition-buttons {
            grid-template-columns: 1fr !important;
            gap: 0.4rem !important;
          }

          .condition-btn {
            padding: 0.5rem !important;
            font-size: 0.75rem !important;
          }

          .legend-grid {
            grid-template-columns: 1fr !important;
            gap: 0.5rem !important;
          }

          .toolbar-container {
            padding: 1rem !important;
            margin-bottom: 1rem !important;
          }

          #toolbar-info {
            font-size: 0.75rem !important;
            padding: 0.5rem !important;
            min-height: 1rem !important;
          }
        }

        /* Very small phones (320px) */
        @media (max-width: 450px) {
          .tooth-container {
            padding: 0.25rem !important;
            gap: 0.15rem !important;
          }

          .tooth-surfaces {
            grid-template-columns: repeat(2, 16px) !important;
            gap: 1px !important;
          }

          .arch-grid {
            padding: 0.4rem !important;
            gap: 0.25rem !important;
            grid-template-columns: repeat(1, 1fr) !important;
          }

          .condition-buttons {
            gap: 0.3rem !important;
          }
        }
      `;
    }
  }
}

// Export for backward compatibility
window.Odontogram = OdontogramContainer;
