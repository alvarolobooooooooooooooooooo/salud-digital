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
    // Desselect previous
    if(this.selectedTooth && this.selectedTooth !== fdi) {
      this.state[this.selectedTooth].isSelected = false;
    }

    // Select new
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
      border: none;
      border-radius: 12px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.25), 0 0 1px rgba(0,0,0,0.1);
      padding: 0;
      min-width: 280px;
      display: none;
      animation: popupSlideIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      overflow: hidden;
    `;

    // Add animation
    if (!document.getElementById('odonto-popup-styles')) {
      const style = document.createElement('style');
      style.id = 'odonto-popup-styles';
      style.textContent = `
        @keyframes popupSlideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Header with tooth info and close button
    const headerContainer = document.createElement('div');
    headerContainer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem;
      background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
      border-bottom: none;
    `;

    const header = document.createElement('div');
    header.id = 'odonto-popup-header';
    header.style.cssText = `
      font-weight: 700;
      color: white;
      font-size: 0.95rem;
      flex: 1;
      letter-spacing: 0.3px;
    `;
    headerContainer.appendChild(header);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      font-size: 1.3rem;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: all 0.2s;
      flex-shrink: 0;
      margin-left: 0.75rem;
    `;
    closeBtn.onmouseover = () => {
      closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
      closeBtn.style.transform = 'scale(1.1)';
    };
    closeBtn.onmouseout = () => {
      closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
      closeBtn.style.transform = 'scale(1)';
    };
    closeBtn.onclick = () => popup.style.display = 'none';
    headerContainer.appendChild(closeBtn);

    popup.appendChild(headerContainer);

    // Condition buttons grid
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.65rem;
      padding: 1.25rem;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    `;

    CONDITION_LIST.forEach(condition => {
      const btn = document.createElement('button');
      btn.className = 'odonto-condition-btn';
      btn.innerHTML = `<span style="font-size: 0.9rem; margin-right: 0.3rem;">${condition.icon}</span>${condition.label}`;
      btn.title = condition.label;
      btn.style.cssText = `
        padding: 0.6rem 0.5rem;
        background: white;
        border: 1.5px solid #e5e7eb;
        border-left: 4px solid ${condition.color};
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.65rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        color: #1e293b;
        font-weight: 600;
        text-transform: capitalize;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
      `;
      btn.onmouseover = () => {
        btn.style.borderRightColor = '#0891b2';
        btn.style.borderTopColor = '#0891b2';
        btn.style.borderBottomColor = '#0891b2';
        btn.style.backgroundColor = '#f0f9ff';
        btn.style.boxShadow = '0 4px 12px rgba(8, 145, 178, 0.15)';
        btn.style.transform = 'translateY(-2px)';
      };
      btn.onmouseout = () => {
        btn.style.borderRightColor = '#e5e7eb';
        btn.style.borderTopColor = '#e5e7eb';
        btn.style.borderBottomColor = '#e5e7eb';
        btn.style.backgroundColor = 'white';
        btn.style.boxShadow = 'none';
        btn.style.transform = 'translateY(0)';
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
    clearBtn.textContent = '🗑️ Limpiar Selección';
    clearBtn.style.cssText = `
      width: calc(100% - 2.5rem);
      margin: 1rem 1.25rem;
      padding: 0.75rem;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 600;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
    `;
    clearBtn.onmouseover = () => {
      clearBtn.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
      clearBtn.style.boxShadow = '0 6px 16px rgba(220, 38, 38, 0.3)';
      clearBtn.style.transform = 'translateY(-2px)';
    };
    clearBtn.onmouseout = () => {
      clearBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      clearBtn.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.2)';
      clearBtn.style.transform = 'translateY(0)';
    };
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
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .tooth-outline {
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .tooth-container:hover .tooth-svg {
          filter: drop-shadow(0 4px 12px rgba(8, 145, 178, 0.2));
          transform: scale(1.05);
        }

        .tooth-container:hover .tooth-outline {
          filter: drop-shadow(0 4px 12px rgba(8, 145, 178, 0.2));
        }

        .tooth-surface {
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 100%);
        }

        .tooth-surface:hover {
          transform: scale(1.2);
          box-shadow: 0 4px 12px rgba(8, 145, 178, 0.3);
        }

        .tooth-surface:active {
          transform: scale(0.92) !important;
        }

        .condition-btn {
          font-family: inherit;
          white-space: nowrap;
        }

        .condition-btn:active {
          transform: scale(0.98);
        }

        /* Tablet (860px and below) */
        @media (max-width: 860px) {
          .arch-grid {
            padding: 1rem !important;
            gap: 0.5rem !important;
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
