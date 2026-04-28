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
    // Build mini info popup for already-diagnosed surfaces
    this._surfaceInfoPopup = this._buildSurfaceInfoPopup();

    this.render();
  }

  _getSurfaceLabel(surface) {
    const map = {
      mesial: 'Mesial',
      distal: 'Distal',
      buccal: 'Vestibular',
      lingual: 'Lingual/Palatina',
      occlusal: 'Oclusal',
      incisal: 'Incisal'
    };
    return map[surface] || (surface.charAt(0).toUpperCase() + surface.slice(1));
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
    // Capture rect BEFORE re-render destroys e.target
    const anchorRect = e && e.target ? e.target.getBoundingClientRect() : null;

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
      const currentCondId = (this.state[fdi].surfaces && this.state[fdi].surfaces[surface]) || CONDITIONS.HEALTHY.id;

      if(this.readOnly) {
        // In read-only mode: show info popup only if surface has a diagnosis
        if(currentCondId && currentCondId !== CONDITIONS.HEALTHY.id) {
          this._showSurfaceInfoPopup(fdi, surface, currentCondId, e, anchorRect);
        }
      } else {
        // In editable mode: always show edit popup
        this._showPopup(fdi, surface, e, anchorRect);
      }
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

  _showPopup(fdi, surface, e, anchorRect) {
    if(!this._popup) return;
    // Close the mini info popup if it was open
    if(this._surfaceInfoPopup) this._surfaceInfoPopup.style.display = 'none';

    const tooth = getToothByFDI(fdi);
    let header = tooth.name;
    if(surface) {
      header += ` - ${surface.charAt(0).toUpperCase() + surface.slice(1)}`;
    }
    document.getElementById('odonto-popup-header').textContent = header;

    const rect = anchorRect || (e && e.target ? e.target.getBoundingClientRect() : { top: 100, bottom: 100, left: 100, right: 100, width: 0, height: 0 });
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

  _buildSurfaceInfoPopup() {
    // Inject keyframes once (shared with main popup, but add specific ones)
    if(!document.getElementById('odonto-mini-popup-styles')) {
      const style = document.createElement('style');
      style.id = 'odonto-mini-popup-styles';
      style.textContent = `
        @keyframes miniPopupIn {
          from { opacity: 0; transform: scale(0.85) translateY(-6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes miniPopupArrow {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes miniPopupGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(8,145,178,0.0); }
          50%      { box-shadow: 0 0 0 6px rgba(8,145,178,0.10); }
        }
        @keyframes miniPopupRing {
          0%   { transform: scale(0.6); opacity: 0.85; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .odonto-mini-popup .mp-action {
          flex: 1;
          padding: 0.6rem 0.5rem;
          background: white;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #0f172a;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
          display: flex; align-items: center; justify-content: center; gap: 0.35rem;
        }
        .odonto-mini-popup .mp-action:hover {
          border-color: #0891b2;
          background: linear-gradient(135deg, #f0f9ff 0%, #ecfeff 100%);
          color: #0e7490;
          transform: translateY(-1px);
          box-shadow: 0 6px 14px rgba(8,145,178,0.18);
        }
        .odonto-mini-popup .mp-action.mp-danger:hover {
          border-color: #ef4444;
          background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
          color: #b91c1c;
          box-shadow: 0 6px 14px rgba(239,68,68,0.18);
        }
        .odonto-mini-popup .mp-action svg { width: 13px; height: 13px; stroke-width: 2.4; }
      `;
      document.head.appendChild(style);
    }

    const popup = document.createElement('div');
    popup.id = 'odonto-surface-info-popup';
    popup.className = 'odonto-mini-popup';
    popup.style.cssText = `
      position: fixed;
      z-index: 1001;
      min-width: 260px;
      max-width: 300px;
      background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(8,145,178,0.18);
      border-radius: 16px;
      box-shadow:
        0 20px 50px rgba(8, 32, 60, 0.18),
        0 8px 20px rgba(8, 145, 178, 0.10),
        inset 0 1px 0 rgba(255,255,255,0.9);
      padding: 0;
      display: none;
      overflow: hidden;
      animation: miniPopupIn 0.22s cubic-bezier(0.34,1.56,0.64,1);
    `;

    // Top bar
    const top = document.createElement('div');
    top.style.cssText = `
      position: relative;
      padding: 0.85rem 1rem 0.75rem;
      background: linear-gradient(135deg, #0891b2 0%, #06b6d4 60%, #22d3ee 100%);
      color: #fff;
      display: flex; align-items: center; gap: 0.6rem;
    `;
    // Live indicator dot
    const dot = document.createElement('span');
    dot.style.cssText = `
      width: 8px; height: 8px; border-radius: 50%; background: #fff;
      box-shadow: 0 0 0 0 rgba(255,255,255,0.7);
      animation: miniPopupRing 1.6s ease-out infinite;
      flex-shrink: 0;
    `;
    top.appendChild(dot);

    const headerWrap = document.createElement('div');
    headerWrap.style.cssText = 'flex:1; display:flex; flex-direction:column; gap:1px; min-width:0;';
    const eyebrow = document.createElement('div');
    eyebrow.id = 'mp-eyebrow';
    eyebrow.style.cssText = `
      font-size: 0.6rem; font-weight: 700; letter-spacing: 0.14em;
      text-transform: uppercase; opacity: 0.85;
    `;
    eyebrow.textContent = 'Diagnóstico registrado';
    headerWrap.appendChild(eyebrow);

    const title = document.createElement('div');
    title.id = 'mp-title';
    title.style.cssText = `font-size: 0.95rem; font-weight: 800; letter-spacing: 0.01em; line-height: 1.2;`;
    headerWrap.appendChild(title);
    top.appendChild(headerWrap);

    const close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText = `
      background: rgba(255,255,255,0.22);
      border: none; color: #fff; cursor: pointer;
      width: 26px; height: 26px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.85rem; font-weight: 700;
      transition: all 0.2s ease; flex-shrink: 0;
    `;
    close.onmouseover = () => { close.style.background = 'rgba(255,255,255,0.34)'; close.style.transform = 'scale(1.06)'; };
    close.onmouseout  = () => { close.style.background = 'rgba(255,255,255,0.22)'; close.style.transform = 'scale(1)'; };
    close.onclick = () => { popup.style.display = 'none'; };
    top.appendChild(close);
    popup.appendChild(top);

    // Body — diagnosis card
    const body = document.createElement('div');
    body.style.cssText = `padding: 1rem;`;

    const card = document.createElement('div');
    card.id = 'mp-diag-card';
    card.style.cssText = `
      display: flex; align-items: center; gap: 0.85rem;
      padding: 0.85rem 0.95rem;
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.9);
      position: relative;
      overflow: hidden;
    `;
    // left color stripe
    const stripe = document.createElement('span');
    stripe.id = 'mp-stripe';
    stripe.style.cssText = `position: absolute; top:0; left:0; bottom:0; width:4px; background: #0891b2;`;
    card.appendChild(stripe);

    const iconWrap = document.createElement('div');
    iconWrap.id = 'mp-icon';
    iconWrap.style.cssText = `
      width: 42px; height: 42px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.25rem; color: #fff; font-weight: 700;
      flex-shrink: 0;
      background: #0891b2;
      box-shadow: 0 6px 14px rgba(8,145,178,0.30), inset 0 1px 0 rgba(255,255,255,0.4);
    `;
    card.appendChild(iconWrap);

    const txtWrap = document.createElement('div');
    txtWrap.style.cssText = 'flex:1; display:flex; flex-direction:column; gap:2px; min-width:0;';
    const surfTag = document.createElement('span');
    surfTag.id = 'mp-surface-tag';
    surfTag.style.cssText = `
      font-size: 0.6rem; font-weight: 700; letter-spacing: 0.12em;
      color: #64748b; text-transform: uppercase;
    `;
    txtWrap.appendChild(surfTag);
    const condName = document.createElement('span');
    condName.id = 'mp-cond-name';
    condName.style.cssText = `font-size: 1rem; font-weight: 800; color: #0f172a; line-height: 1.15;`;
    txtWrap.appendChild(condName);
    card.appendChild(txtWrap);

    body.appendChild(card);
    popup.appendChild(body);

    // Outside click to close
    document.addEventListener('click', (e) => {
      if(popup.style.display === 'block' && !popup.contains(e.target)) {
        popup.style.display = 'none';
      }
    }, true);

    document.body.appendChild(popup);
    return popup;
  }

  _showSurfaceInfoPopup(fdi, surface, conditionId, e, anchorRect) {
    if(!this._surfaceInfoPopup) return;
    // Close the main popup if it was open
    if(this._popup) this._popup.style.display = 'none';
    this._lastSurfaceEvent = e;
    this._lastSurfaceRect = anchorRect;

    const tooth = getToothByFDI(fdi);
    const cond = getConditionById(conditionId) || CONDITIONS.HEALTHY;
    const surfLabel = this._getSurfaceLabel(surface);

    document.getElementById('mp-title').textContent = `${tooth.name} · ${surfLabel}`;
    document.getElementById('mp-surface-tag').textContent = `Superficie ${surfLabel}`;
    document.getElementById('mp-cond-name').textContent = cond.label;
    const icon = document.getElementById('mp-icon');
    icon.textContent = cond.icon;
    icon.style.background = `linear-gradient(135deg, ${cond.color} 0%, ${this._shadeColor(cond.color, -18)} 100%)`;
    icon.style.boxShadow = `0 6px 14px ${this._hexToRgba(cond.color, 0.34)}, inset 0 1px 0 rgba(255,255,255,0.4)`;
    document.getElementById('mp-stripe').style.background = `linear-gradient(180deg, ${cond.color}, ${this._shadeColor(cond.color, -20)})`;

    const popup = this._surfaceInfoPopup;
    // Position — use captured rect to avoid stale (re-rendered) target
    const rect = anchorRect || (e && e.target ? e.target.getBoundingClientRect() : { top: 100, bottom: 100, left: 100, width: 0, height: 0 });
    const popupW = 280, popupH = 200;
    let top = rect.bottom + 10;
    let left = rect.left + rect.width / 2 - popupW / 2;
    if(top + popupH > window.innerHeight) top = rect.top - popupH - 10;
    left = Math.max(12, Math.min(left, window.innerWidth - popupW - 12));
    popup.style.top = top + 'px';
    popup.style.left = left + 'px';
    popup.style.display = 'block';
    // restart enter animation each time
    popup.style.animation = 'none';
    void popup.offsetWidth;
    popup.style.animation = 'miniPopupIn 0.22s cubic-bezier(0.34,1.56,0.64,1)';
  }

  _shadeColor(hex, percent) {
    // percent: -100..100 (negative=darker)
    const h = hex.replace('#','');
    const num = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
    let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    const f = percent / 100;
    r = Math.round(r + (f >= 0 ? (255 - r) : r) * f);
    g = Math.round(g + (f >= 0 ? (255 - g) : g) * f);
    b = Math.round(b + (f >= 0 ? (255 - b) : b) * f);
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  }

  _hexToRgba(hex, alpha) {
    const h = hex.replace('#','');
    const full = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
    const num = parseInt(full, 16);
    return `rgba(${(num>>16)&255}, ${(num>>8)&255}, ${num&255}, ${alpha})`;
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
