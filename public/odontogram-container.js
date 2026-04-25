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
    this.components.toolbars = {};

    quadrants.forEach(quadrant => {
      const self = this;

      // Create toolbar before each quadrant (if editable)
      if(!this.readOnly) {
        const toolbar = new OdontogramToolbar({
          onConditionSelect: function(condition, fdi, surface) {
            self.applyCondition(condition, fdi, surface);
          },
          onReset: function() {
            self.resetAll();
          },
          onClearSelection: function() {
            self.clearToothSelection();
          }
        });
        this.components.toolbars[quadrant] = toolbar;
        archesContainer.appendChild(toolbar.render());
      }

      const arch = new OdontogramArch(quadrant, this.getQuadrantState(quadrant), {
        isEditable: !this.readOnly,
        onToothSelect: function(fdi) {
          self.selectTooth(fdi);
        },
        onSurfaceSelect: function(fdi, surface) {
          self.selectSurface(fdi, surface);
        }
      });

      this.components.arches[quadrant] = arch;
      archesContainer.appendChild(arch.render());
    });

    container.appendChild(archesContainer);

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

  selectTooth(fdi) {
    // Desselect previous
    if(this.selectedTooth && this.selectedTooth !== fdi) {
      this.state[this.selectedTooth].isSelected = false;
    }

    // Select new
    this.selectedTooth = fdi;
    this.selectedSurface = null;
    this.state[fdi].isSelected = true;

    if(this.components.toolbar) {
      this.components.toolbar.setSelectedTooth(fdi);
    }

    this.updateTeethVisuals();
  }

  selectSurface(fdi, surface) {
    this.selectedTooth = fdi;
    this.selectedSurface = surface;
    this.state[fdi].isSelected = true;

    if(this.components.toolbar) {
      this.components.toolbar.setSelectedSurface(fdi, surface);
    }

    this.updateTeethVisuals();
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
