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
    // Tracks whether the detail panel was active before the latest render, so
    // we can suppress the slide-up animation when it's just a content refresh.
    this._panelWasActive = false;

    // Build floating popup for conditions
    this._popup = this._buildPopup();
    // Build mini info popup for already-diagnosed surfaces
    this._surfaceInfoPopup = this._buildSurfaceInfoPopup();
    // Build premium hover tooltip for surfaces with diagnosis
    this._surfaceHoverTip = this._buildSurfaceHoverTip();
    this._surfaceHoverTimer = null;

    this.render();
  }

  _getSurfaceLabel(surface, fdi) {
    const isUpperTooth = fdi && (Math.floor(fdi / 10) === 1 || Math.floor(fdi / 10) === 2);
    const map = {
      mesial: 'Mesial',
      distal: 'Distal',
      buccal: isUpperTooth ? 'Vestibular' : 'Bucal',
      lingual: isUpperTooth ? 'Palatino' : 'Lingual',
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
    container.classList.add('odonto-root');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    `;

    // Workspace: arches grid + sticky/lateral detail panel
    const workspace = document.createElement('div');
    workspace.className = 'odonto-workspace';
    container.appendChild(workspace);

    // Arches column
    const archesCol = document.createElement('div');
    archesCol.className = 'odonto-arches-col';

    const archesContainer = document.createElement('div');
    archesContainer.className = 'odonto-arches';
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

    archesCol.appendChild(archesContainer);
    workspace.appendChild(archesCol);

    // Detail panel (clinical insight) — on mobile, render at body level to escape
    // <main>'s stacking context (it has z-index:1, which would trap a fixed-position
    // panel below the page's fixed mobile nav at z-index:100).
    if(this.components.detailPanel && this.components.detailPanel.parentNode) {
      this.components.detailPanel.parentNode.removeChild(this.components.detailPanel);
    }
    const detailPanel = this._buildDetailPanel();
    const isMobile = window.innerWidth <= 860;
    if(isMobile) {
      document.body.appendChild(detailPanel);
    } else {
      workspace.appendChild(detailPanel);
    }
    this.components.detailPanel = detailPanel;

    // Suppress slide-up animation when the panel was already open — this is
    // just a content refresh (e.g. user tapped another surface), not a true
    // open. Without this the panel re-animates on every selection change.
    const willBeActive = !!this.selectedTooth;
    if(this._panelWasActive && willBeActive) {
      detailPanel.classList.add('odonto-detail-noanim');
    }
    this._panelWasActive = willBeActive;

    // Legend (full width below)
    const legend = new OdontogramLegend();
    container.appendChild(legend.render());

    // Surface hover tooltip — single delegated listener
    archesContainer.addEventListener('odonto:surface-hover', (e) => {
      const { fdi, surface, condId, rect } = e.detail || {};
      if(!fdi || !surface || !condId) return;
      this._showSurfaceHoverTip(fdi, surface, condId, rect);
    });
    archesContainer.addEventListener('odonto:surface-hover-end', () => {
      this._hideSurfaceHoverTip();
    });

    // Add custom styles
    this.addStyles();

    // Refresh detail panel from current selection
    this._renderDetailPanelContent();

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
    // Detail panel handles all editing UI now — no separate popup.
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

    if(e && this.readOnly) {
      const currentCondId = (this.state[fdi].surfaces && this.state[fdi].surfaces[surface]) || CONDITIONS.HEALTHY.id;
      // Read-only: show contextual mini info popup if surface has a diagnosis.
      if(currentCondId && currentCondId !== CONDITIONS.HEALTHY.id) {
        this._showSurfaceInfoPopup(fdi, surface, currentCondId, e, anchorRect);
      }
    }
    // Editable: detail panel handles editing — no popup.
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

  // ─── Clinical Detail Panel ─────────────────────────────────────────────

  _buildDetailPanel() {
    const panel = document.createElement('aside');
    panel.className = 'odonto-detail-panel';
    panel.setAttribute('aria-live', 'polite');
    panel.setAttribute('aria-label', 'Detalle clínico del diente');

    const inner = document.createElement('div');
    inner.className = 'odonto-detail-inner';
    panel.appendChild(inner);

    return panel;
  }

  _renderDetailPanelContent() {
    const panel = this.components && this.components.detailPanel;
    if(!panel) return;
    const inner = panel.querySelector('.odonto-detail-inner');
    if(!inner) return;
    inner.innerHTML = '';

    if(!this.selectedTooth) {
      inner.appendChild(this._renderDetailEmpty());
      panel.classList.remove('odonto-detail-active');
      return;
    }
    panel.classList.add('odonto-detail-active');

    const fdi = this.selectedTooth;
    const tooth = getToothByFDI(fdi);
    const st = this.state[fdi] || { condition: CONDITIONS.HEALTHY.id, surfaces: {} };
    const cond = getConditionById(st.condition);
    const surfacesObj = st.surfaces || {};
    const affected = Object.entries(surfacesObj)
      .filter(([, c]) => c && c !== CONDITIONS.HEALTHY.id);

    // Header
    const header = document.createElement('div');
    header.className = 'odonto-detail-header';
    header.style.cssText = `
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.95rem 1rem;
      background: linear-gradient(135deg, #0891b2 0%, #06b6d4 60%, #22d3ee 100%);
      color: #fff;
      position: relative;
    `;

    const numberBadge = document.createElement('div');
    numberBadge.style.cssText = `
      display: flex; align-items: center; justify-content: center;
      min-width: 44px; height: 44px; padding: 0 0.6rem;
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 12px;
      font-weight: 900; font-size: 1.1rem; letter-spacing: 0.5px;
      color: #fff;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.3);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    `;
    numberBadge.textContent = tooth.name;
    header.appendChild(numberBadge);

    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'flex:1; display:flex; flex-direction:column; gap:1px; min-width:0;';
    const eyebrow = document.createElement('div');
    eyebrow.style.cssText = `font-size:0.6rem; font-weight:800; letter-spacing:0.16em; text-transform:uppercase; opacity:0.9;`;
    eyebrow.textContent = 'Detalle clínico';
    titleWrap.appendChild(eyebrow);
    const title = document.createElement('div');
    title.style.cssText = `font-size:0.95rem; font-weight:800; line-height:1.2;`;
    const typeLabel = ({ incisor: 'Incisivo', canine: 'Canino', premolar: 'Premolar', molar: 'Molar' })[tooth.type] || '';
    title.textContent = `Diente ${tooth.name}${typeLabel ? ' · ' + typeLabel : ''}`;
    titleWrap.appendChild(title);
    header.appendChild(titleWrap);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Cerrar detalle');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: rgba(255,255,255,0.22);
      border: none; color: #fff; cursor: pointer;
      width: 28px; height: 28px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.9rem; font-weight: 700;
      transition: all 0.2s ease; flex-shrink: 0;
    `;
    closeBtn.onmouseover = () => { closeBtn.style.background = 'rgba(255,255,255,0.34)'; closeBtn.style.transform = 'scale(1.06)'; };
    closeBtn.onmouseout  = () => { closeBtn.style.background = 'rgba(255,255,255,0.22)'; closeBtn.style.transform = 'scale(1)'; };
    closeBtn.onclick = () => {
      if(this.selectedTooth && this.state[this.selectedTooth]) {
        this.state[this.selectedTooth].isSelected = false;
      }
      this.selectedTooth = null;
      this.selectedSurface = null;
      this.updateTeethVisuals();
    };
    header.appendChild(closeBtn);

    inner.appendChild(header);

    // ── Mobile-only: interactive tooth preview inside the fullscreen modal ──
    // On mobile the modal covers the odontogram, so the doctor needs a way to
    // pick surfaces from within the panel.
    if(window.innerWidth <= 860) {
      inner.appendChild(this._renderToothPreview(fdi));
    }

    // Body
    const body = document.createElement('div');
    body.className = 'odonto-detail-body';
    body.style.cssText = 'padding: 1rem; display: flex; flex-direction: column; gap: 0.85rem;';

    // General diagnosis card
    const dxCard = document.createElement('div');
    dxCard.className = 'odonto-detail-dx-card';
    dxCard.style.cssText = `
      position: relative;
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.75rem 0.85rem 0.75rem 1rem;
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.9);
      overflow: hidden;
    `;
    const stripe = document.createElement('span');
    stripe.style.cssText = `position:absolute; top:0; left:0; bottom:0; width:4px; background: linear-gradient(180deg, ${cond.color}, ${this._shadeColor(cond.color, -22)});`;
    dxCard.appendChild(stripe);

    const dxIcon = document.createElement('div');
    dxIcon.style.cssText = `
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem; font-weight: 800; color: #fff;
      background: linear-gradient(135deg, ${cond.color} 0%, ${this._shadeColor(cond.color, -18)} 100%);
      box-shadow: 0 6px 14px ${this._hexToRgba(cond.color, 0.32)}, inset 0 1px 0 rgba(255,255,255,0.4);
      flex-shrink: 0;
    `;
    dxIcon.textContent = cond.icon;
    dxCard.appendChild(dxIcon);

    const dxTxt = document.createElement('div');
    dxTxt.style.cssText = 'flex:1; display:flex; flex-direction:column; gap:2px; min-width:0;';
    const dxLabel = document.createElement('div');
    dxLabel.className = 'odonto-detail-dx-label';
    dxLabel.style.cssText = `font-size:0.6rem; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:#64748b;`;
    dxLabel.textContent = 'Diagnóstico general';
    dxTxt.appendChild(dxLabel);
    const dxName = document.createElement('div');
    dxName.className = 'odonto-detail-dx-name';
    dxName.style.cssText = `font-size:1.05rem; font-weight:800; color:#0f172a; line-height:1.2;`;
    dxName.textContent = cond.label;
    dxTxt.appendChild(dxName);
    dxCard.appendChild(dxTxt);

    body.appendChild(dxCard);

    // Surfaces section
    const surfTitle = document.createElement('div');
    surfTitle.className = 'odonto-detail-surf-title';
    surfTitle.style.cssText = `
      display:flex; align-items:center; justify-content:space-between;
      font-size:0.66rem; font-weight:800; letter-spacing:0.14em;
      text-transform:uppercase; color:#475569;
      margin-top: 0.15rem;
    `;
    const surfTitleLeft = document.createElement('span');
    surfTitleLeft.textContent = 'Superficies';
    surfTitle.appendChild(surfTitleLeft);
    const surfCount = document.createElement('span');
    surfCount.className = 'odonto-detail-surf-count' + (affected.length ? ' has-affected' : '');
    surfCount.style.cssText = `
      font-size:0.62rem; font-weight:800; letter-spacing:0.04em;
      padding: 0.18rem 0.5rem;
      border-radius: 999px;
      background: ${affected.length ? 'rgba(8,145,178,0.10)' : 'rgba(15,23,42,0.05)'};
      color: ${affected.length ? '#0e7490' : '#64748b'};
      text-transform: none;
    `;
    surfCount.textContent = affected.length === 0
      ? 'Sin diagnósticos'
      : `${affected.length} afectada${affected.length === 1 ? '' : 's'}`;
    surfTitle.appendChild(surfCount);
    body.appendChild(surfTitle);

    if(affected.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'odonto-detail-surf-empty';
      empty.style.cssText = `
        padding: 0.75rem; text-align: center;
        font-size: 0.78rem; color: #94a3b8;
        background: #f8fafc; border: 1px dashed #e2e8f0;
        border-radius: 10px;
      `;
      empty.textContent = 'Ninguna superficie con diagnóstico registrado.';
      body.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.style.cssText = 'display: flex; flex-direction: column; gap: 0.4rem;';
      const order = [SURFACES.MESIAL, SURFACES.BUCCAL, SURFACES.OCCLUSAL, SURFACES.INCISAL, SURFACES.DISTAL, SURFACES.LINGUAL];
      const ordered = affected.slice().sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
      ordered.forEach(([surface, condId]) => {
        const c = getConditionById(condId);
        const item = document.createElement('div');
        item.className = 'odonto-detail-surf-item';
        item.style.cssText = `
          display:flex; align-items:center; gap:0.7rem;
          padding: 0.55rem 0.65rem;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-left: 4px solid ${c.color};
          border-radius: 10px;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        `;
        item.onmouseenter = () => {
          item.style.transform = 'translateY(-1px)';
          item.style.boxShadow = `0 6px 14px ${this._hexToRgba(c.color, 0.18)}`;
        };
        item.onmouseleave = () => {
          item.style.transform = 'translateY(0)';
          item.style.boxShadow = 'none';
        };

        const surfLetter = document.createElement('span');
        surfLetter.style.cssText = `
          display:inline-flex; align-items:center; justify-content:center;
          min-width: 26px; height: 26px; padding: 0 6px;
          border-radius: 7px;
          background: ${c.color};
          color: ${this._isLight(c.color) ? '#0f172a' : '#ffffff'};
          font-weight: 900; font-size: 0.78rem;
          flex-shrink: 0;
          box-shadow: 0 2px 5px ${this._hexToRgba(c.color, 0.35)};
        `;
        surfLetter.textContent = getSurfaceLabel(surface, fdi);
        item.appendChild(surfLetter);

        const txt = document.createElement('div');
        txt.style.cssText = 'flex:1; display:flex; flex-direction:column; gap:1px; min-width:0;';
        const surfName = document.createElement('div');
        surfName.className = 'odonto-detail-surf-name';
        surfName.style.cssText = `font-size:0.78rem; font-weight:700; color:#0f172a; line-height:1.15;`;
        surfName.textContent = this._getSurfaceLabel(surface, fdi);
        txt.appendChild(surfName);
        const surfDx = document.createElement('div');
        surfDx.className = 'odonto-detail-surf-dx';
        surfDx.style.cssText = `font-size:0.7rem; font-weight:600; color:#64748b; line-height:1.15;`;
        surfDx.textContent = c.label;
        txt.appendChild(surfDx);
        item.appendChild(txt);

        list.appendChild(item);
      });
      body.appendChild(list);
    }

    inner.appendChild(body);

    // ── Editor section (editable only) — picker + actions, all-in-one ──
    if(!this.readOnly) {
      inner.appendChild(this._renderDxPicker(fdi));
    }
  }

  _renderDxPicker(fdi) {
    const wrap = document.createElement('div');
    wrap.className = 'odonto-dx-picker';
    wrap.style.cssText = `
      padding: 0.85rem 1rem 1rem;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
      border-top: 1px solid #e2e8f0;
      display: flex; flex-direction: column; gap: 0.7rem;
    `;

    // Section title row with target chip
    const titleRow = document.createElement('div');
    titleRow.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      gap: 0.5rem; flex-wrap: wrap;
    `;
    const ttl = document.createElement('div');
    ttl.style.cssText = `
      font-size: 0.66rem; font-weight: 800; letter-spacing: 0.14em;
      text-transform: uppercase; color: #475569;
    `;
    ttl.textContent = 'Aplicar diagnóstico';
    titleRow.appendChild(ttl);

    const target = document.createElement('div');
    const isSurface = !!this.selectedSurface;
    const surfLabel = isSurface ? this._getSurfaceLabel(this.selectedSurface, fdi) : null;
    target.style.cssText = `
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.22rem 0.55rem 0.22rem 0.4rem;
      background: ${isSurface ? 'rgba(8,145,178,0.10)' : 'rgba(15, 23, 42, 0.05)'};
      border: 1px solid ${isSurface ? 'rgba(8,145,178,0.30)' : 'rgba(15,23,42,0.08)'};
      border-radius: 999px;
      font-size: 0.68rem; font-weight: 700;
      color: ${isSurface ? '#0e7490' : '#334155'};
    `;
    const targetDot = document.createElement('span');
    targetDot.style.cssText = `
      width: 6px; height: 6px; border-radius: 50%;
      background: ${isSurface ? '#0891b2' : '#64748b'};
      flex-shrink: 0;
    `;
    target.appendChild(targetDot);
    const targetTxt = document.createElement('span');
    targetTxt.textContent = isSurface ? `${surfLabel}` : 'Diente completo';
    target.appendChild(targetTxt);
    titleRow.appendChild(target);

    wrap.appendChild(titleRow);

    // Helper hint
    const help = document.createElement('div');
    help.style.cssText = `
      font-size: 0.7rem; color: #64748b; line-height: 1.35;
      margin-top: -0.15rem;
    `;
    help.textContent = isSurface
      ? `Aplicando a la superficie ${surfLabel} del diente ${getToothByFDI(fdi).name}. Haz clic en el diente para volver al diente completo.`
      : `Aplicando al diente ${getToothByFDI(fdi).name} completo. Haz clic en una superficie para diagnosticarla individualmente.`;
    wrap.appendChild(help);

    // Picker grid
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.4rem;
    `;

    const currentCondId = isSurface
      ? ((this.state[fdi].surfaces || {})[this.selectedSurface] || CONDITIONS.HEALTHY.id)
      : (this.state[fdi].condition || CONDITIONS.HEALTHY.id);

    CONDITION_LIST.forEach(cond => {
      const btn = this._makeDxButton(cond, cond.id === currentCondId);
      btn.onclick = () => {
        this.applyCondition(cond.id, this.selectedTooth, this.selectedSurface);
      };
      grid.appendChild(btn);
    });

    wrap.appendChild(grid);

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.style.cssText = `
      display: flex; align-items: center; justify-content: center;
      gap: 0.45rem;
      padding: 0.65rem 0.85rem;
      margin-top: 0.25rem;
      background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
      color: #b91c1c;
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 10px;
      font-size: 0.78rem; font-weight: 700;
      cursor: pointer;
      transition: all 0.18s ease;
    `;
    clearBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
      </svg>
      <span>Limpiar diente completo</span>
    `;
    clearBtn.onmouseenter = () => {
      clearBtn.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
      clearBtn.style.borderColor = '#ef4444';
      clearBtn.style.boxShadow = '0 6px 16px rgba(239,68,68,0.18)';
      clearBtn.style.transform = 'translateY(-1px)';
    };
    clearBtn.onmouseleave = () => {
      clearBtn.style.background = 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)';
      clearBtn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      clearBtn.style.boxShadow = 'none';
      clearBtn.style.transform = 'translateY(0)';
    };
    clearBtn.onclick = () => {
      this.clearToothSelection();
    };
    wrap.appendChild(clearBtn);

    return wrap;
  }

  _makeDxButton(cond, isActive) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = cond.label;

    const baseBg = isActive
      ? `linear-gradient(135deg, ${this._hexToRgba(cond.color, 0.16)} 0%, ${this._hexToRgba(cond.color, 0.08)} 100%)`
      : '#ffffff';
    const baseBorder = isActive ? this._hexToRgba(cond.color, 0.55) : '#e2e8f0';

    btn.style.cssText = `
      position: relative;
      display: flex; align-items: center; gap: 0.45rem;
      padding: 0.5rem 0.55rem 0.5rem 0.5rem;
      background: ${baseBg};
      border: 1px solid ${baseBorder};
      border-left: 3px solid ${cond.color};
      border-radius: 9px;
      font-size: 0.72rem;
      font-weight: 700;
      color: #0f172a;
      cursor: pointer;
      transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s, background 0.18s, border-color 0.18s;
      text-align: left;
      min-width: 0;
      letter-spacing: 0.005em;
    `;

    const isLight = this._isLight(cond.color);
    const icon = document.createElement('span');
    icon.style.cssText = `
      display:inline-flex; align-items:center; justify-content:center;
      width: 20px; height: 20px;
      border-radius: 6px;
      background: linear-gradient(135deg, ${cond.color} 0%, ${this._shadeColor(cond.color, -18)} 100%);
      color: ${isLight ? '#0f172a' : '#ffffff'};
      font-size: 0.78rem; font-weight: 800;
      box-shadow: 0 2px 4px ${this._hexToRgba(cond.color, 0.35)}, inset 0 1px 0 rgba(255,255,255,0.3);
      flex-shrink: 0;
    `;
    icon.textContent = cond.icon;
    btn.appendChild(icon);

    const lbl = document.createElement('span');
    lbl.style.cssText = `
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
    `;
    lbl.textContent = cond.label;
    btn.appendChild(lbl);

    if(isActive) {
      const check = document.createElement('span');
      check.style.cssText = `
        position: absolute; top: 4px; right: 5px;
        width: 14px; height: 14px;
        border-radius: 50%;
        background: ${cond.color};
        color: ${isLight ? '#0f172a' : '#ffffff'};
        display: flex; align-items: center; justify-content: center;
        font-size: 0.55rem; font-weight: 900;
        box-shadow: 0 0 0 2px #fff;
      `;
      check.textContent = '✓';
      btn.appendChild(check);
    }

    btn.onmouseenter = () => {
      btn.style.transform = 'translateY(-1px)';
      btn.style.boxShadow = `0 6px 14px ${this._hexToRgba(cond.color, 0.20)}`;
      btn.style.borderColor = this._hexToRgba(cond.color, 0.6);
      if(!isActive) {
        btn.style.background = `linear-gradient(135deg, ${this._hexToRgba(cond.color, 0.06)} 0%, #ffffff 100%)`;
      }
    };
    btn.onmouseleave = () => {
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = 'none';
      btn.style.borderColor = baseBorder;
      btn.style.background = baseBg;
    };

    return btn;
  }

  _renderDetailEmpty() {
    const wrap = document.createElement('div');
    wrap.className = 'odonto-detail-empty';
    wrap.style.cssText = `
      padding: 1.25rem 1rem;
      display: flex; flex-direction: column; align-items: center;
      gap: 0.5rem;
      text-align: center;
    `;
    const ico = document.createElement('div');
    ico.className = 'odonto-detail-empty-icon';
    ico.style.cssText = `
      width: 44px; height: 44px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #ecfeff 0%, #f0f9ff 100%);
      border: 1px solid rgba(8,145,178,0.18);
      color: #0891b2; font-size: 1.2rem; font-weight: 800;
    `;
    ico.textContent = '🦷';
    wrap.appendChild(ico);

    const eyebrow = document.createElement('div');
    eyebrow.className = 'odonto-detail-empty-eyebrow';
    eyebrow.style.cssText = `font-size:0.6rem; font-weight:800; letter-spacing:0.16em; text-transform:uppercase; color:#0891b2;`;
    eyebrow.textContent = 'Detalle clínico';
    wrap.appendChild(eyebrow);

    const txt = document.createElement('div');
    txt.className = 'odonto-detail-empty-text';
    txt.style.cssText = `font-size: 0.82rem; color: #475569; max-width: 240px; line-height: 1.4;`;
    txt.textContent = this.readOnly
      ? 'Selecciona un diente para ver su diagnóstico, superficies afectadas y detalles clínicos.'
      : 'Selecciona un diente o superficie para ver y editar su diagnóstico.';
    wrap.appendChild(txt);

    return wrap;
  }

  // ─── Mobile tooth preview inside fullscreen modal ─────────────────────

  _renderToothPreview(fdi) {
    const section = document.createElement('div');
    section.className = 'odonto-tooth-preview-section';
    section.style.cssText = `
      padding: 1.1rem 1rem 0.85rem;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.7rem;
    `;

    // Hint text on top
    const hint = document.createElement('div');
    hint.className = 'odonto-tooth-preview-hint';
    hint.style.cssText = `
      font-size: 0.66rem; font-weight: 800; letter-spacing: 0.14em;
      text-transform: uppercase; color: #475569;
      align-self: flex-start;
    `;
    hint.textContent = this.selectedSurface
      ? '⬢ Toca otra superficie o el diente completo'
      : '⬢ Toca una superficie para diagnosticarla';
    section.appendChild(hint);

    // Tooth card wrapper (constrained width)
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      width: 100%;
      max-width: 240px;
      display: flex;
      justify-content: center;
    `;

    // Create preview state without selection styling
    const previewState = {
      condition: this.state[fdi].condition,
      surfaces: this.state[fdi].surfaces,
      isSelected: false
    };
    const previewTooth = new OdontogramTooth(fdi, previewState, {
      isEditable: true,
      onSelect: (f, e) => this.selectTooth(f, e),
      onSurfaceSelect: (f, s, e) => this.selectSurface(f, s, e)
    });
    const cardEl = previewTooth.render();
    // Slight scale-up for tap target friendliness
    cardEl.style.width = '100%';
    cardEl.style.cursor = 'default';
    cardEl.style.outline = 'none';

    // Highlight currently selected surface, if any
    if(this.selectedSurface) {
      const surfEl = cardEl.querySelector(`[data-surface="${this.selectedSurface}"]`);
      if(surfEl) {
        surfEl.style.boxShadow = '0 0 0 3px #0891b2, 0 0 0 6px rgba(8,145,178,0.20), 0 6px 14px rgba(8,145,178,0.30)';
        surfEl.style.transform = 'scale(1.12)';
        surfEl.style.zIndex = '1';
        surfEl.style.position = 'relative';
      }
    }

    wrap.appendChild(cardEl);
    section.appendChild(wrap);

    return section;
  }

  // ─── Surface hover tooltip ─────────────────────────────────────────────

  _buildSurfaceHoverTip() {
    if(!document.getElementById('odonto-hovertip-styles')) {
      const style = document.createElement('style');
      style.id = 'odonto-hovertip-styles';
      style.textContent = `
        @keyframes odontoHoverIn {
          from { opacity: 0; transform: translateY(4px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `;
      document.head.appendChild(style);
    }

    const tip = document.createElement('div');
    tip.id = 'odonto-surface-hover-tip';
    tip.style.cssText = `
      position: fixed;
      z-index: 1002;
      pointer-events: none;
      min-width: 180px;
      max-width: 240px;
      padding: 0.55rem 0.7rem;
      background: linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(15,23,42,0.92) 100%);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      color: #f8fafc;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 12px 32px rgba(2,6,23,0.35);
      display: none;
      font-size: 0.75rem;
      line-height: 1.25;
      animation: odontoHoverIn 0.15s ease-out;
    `;

    const head = document.createElement('div');
    head.style.cssText = 'display:flex; align-items:center; gap:0.45rem; margin-bottom: 2px;';
    const swatch = document.createElement('span');
    swatch.id = 'odonto-hovertip-swatch';
    swatch.style.cssText = 'width:10px; height:10px; border-radius:50%; box-shadow: 0 0 0 2px rgba(255,255,255,0.12); flex-shrink:0;';
    head.appendChild(swatch);
    const headText = document.createElement('span');
    headText.id = 'odonto-hovertip-tooth';
    headText.style.cssText = 'font-weight:800; font-size:0.7rem; letter-spacing:0.04em; color:#cbd5e1;';
    head.appendChild(headText);
    tip.appendChild(head);

    const surf = document.createElement('div');
    surf.id = 'odonto-hovertip-surf';
    surf.style.cssText = 'font-weight:800; font-size:0.85rem; color:#ffffff;';
    tip.appendChild(surf);

    const dx = document.createElement('div');
    dx.id = 'odonto-hovertip-dx';
    dx.style.cssText = 'font-weight:600; font-size:0.7rem; color:#94a3b8; margin-top: 1px;';
    tip.appendChild(dx);

    document.body.appendChild(tip);
    return tip;
  }

  _showSurfaceHoverTip(fdi, surface, conditionId, rect) {
    const tip = this._surfaceHoverTip;
    if(!tip) return;
    if(this._surfaceHoverTimer) clearTimeout(this._surfaceHoverTimer);

    const tooth = getToothByFDI(fdi);
    const cond = getConditionById(conditionId) || CONDITIONS.HEALTHY;
    const surfLabel = this._getSurfaceLabel(surface, fdi);

    const sw = document.getElementById('odonto-hovertip-swatch');
    const tt = document.getElementById('odonto-hovertip-tooth');
    const sf = document.getElementById('odonto-hovertip-surf');
    const dd = document.getElementById('odonto-hovertip-dx');
    if(!sw || !tt || !sf || !dd) return;

    sw.style.background = cond.color;
    tt.textContent = `Diente ${tooth.name}`;
    sf.textContent = surfLabel;
    dd.textContent = cond.label;

    // Position above the surface element
    const r = rect || { top: 100, bottom: 100, left: 100, width: 0 };
    tip.style.display = 'block';
    // measure
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let top = r.top - h - 10;
    let left = r.left + (r.width / 2) - (w / 2);
    if(top < 8) top = r.bottom + 10;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
  }

  _hideSurfaceHoverTip() {
    const tip = this._surfaceHoverTip;
    if(!tip) return;
    if(this._surfaceHoverTimer) clearTimeout(this._surfaceHoverTimer);
    this._surfaceHoverTimer = setTimeout(() => {
      tip.style.display = 'none';
    }, 80);
  }

  _isLight(hex) {
    const h = (hex || '#000000').replace('#','');
    const full = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    return (0.299*r + 0.587*g + 0.114*b) > 170;
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
      min-width: 380px;
      max-height: 80vh;
      display: none;
      animation: popupSlideIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      overflow-y: auto;
      overflow-x: hidden;
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
      const surfLabel = this._getSurfaceLabel(surface, fdi);
      header += ` - ${surfLabel}`;
    }
    document.getElementById('odonto-popup-header').textContent = header;

    const rect = anchorRect || (e && e.target ? e.target.getBoundingClientRect() : { top: 100, bottom: 100, left: 100, right: 100, width: 0, height: 0 });
    let top = rect.bottom + 8;
    let left = rect.left;

    const popupHeight = 350;
    const availableBelow = window.innerHeight - rect.bottom;
    const availableAbove = rect.top;

    if(availableBelow < popupHeight && availableAbove > availableBelow) {
      top = Math.max(8, rect.top - popupHeight - 8);
    }

    if(left + 380 > window.innerWidth) {
      left = window.innerWidth - 380 - 16;
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
    const surfLabel = this._getSurfaceLabel(surface, fdi);

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
        /* ── Workspace layout ── */
        .odonto-workspace {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.25rem;
          align-items: start;
          width: 100%;
        }
        .odonto-arches-col { min-width: 0; }

        .odonto-detail-panel {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
          opacity: 1;
          transition: box-shadow 0.25s ease, transform 0.25s ease;
        }
        .odonto-detail-panel.odonto-detail-active {
          box-shadow: 0 10px 30px rgba(8, 145, 178, 0.14), 0 2px 6px rgba(15, 23, 42, 0.06);
        }
        .odonto-detail-inner {
          display: flex;
          flex-direction: column;
        }

        /* Desktop: lateral drawer ≥ 1280px */
        @media (min-width: 1280px) {
          .odonto-workspace {
            grid-template-columns: minmax(0, 1fr) 340px;
            gap: 1.5rem;
          }
          .odonto-detail-panel {
            position: sticky;
            top: 1rem;
            max-height: calc(100vh - 2rem);
            overflow-y: auto;
          }
        }

        /* Tablet (861-1279px): sticky panel near top */
        @media (min-width: 861px) and (max-width: 1279px) {
          .odonto-workspace {
            grid-template-areas: "panel" "arches";
          }
          .odonto-arches-col { grid-area: arches; }
          .odonto-detail-panel {
            grid-area: panel;
            position: sticky;
            top: 0.75rem;
            z-index: 8;
            max-height: calc(100vh - 1.5rem);
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }
          .odonto-detail-panel.odonto-detail-active {
            margin-bottom: 0.75rem;
            box-shadow: 0 10px 30px rgba(8, 145, 178, 0.14), 0 2px 6px rgba(15, 23, 42, 0.06);
          }
        }

        /* Mobile (≤860px): fullscreen overlay panel when active, hidden otherwise */
        @media (max-width: 860px) {
          .odonto-workspace {
            grid-template-areas: "arches";
          }
          .odonto-arches-col { grid-area: arches; }

          /* Inactive: panel is hidden — arches take full focus */
          .odonto-detail-panel {
            display: none;
          }

          /* Active: fullscreen sheet covering everything */
          .odonto-detail-panel.odonto-detail-active {
            display: block;
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            width: 100%;
            height: 100vh;
            height: 100dvh;
            max-height: none;
            margin: 0;
            border: none;
            border-radius: 0;
            z-index: 1000;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            background: #ffffff;
            box-shadow: none;
            animation: odontoPanelSlideUp 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          .odonto-detail-panel.odonto-detail-active.odonto-detail-noanim {
            animation: none !important;
          }
          .odonto-detail-panel.odonto-detail-active .odonto-detail-inner {
            min-height: 100%;
            padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
          }
          .odonto-detail-panel.odonto-detail-active .odonto-detail-header {
            position: sticky;
            top: 0;
            z-index: 2;
            padding-top: max(0.95rem, calc(env(safe-area-inset-top, 0px) + 0.5rem)) !important;
          }
        }
        @keyframes odontoPanelSlideUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0); opacity: 1; }
        }

        /* ── Tooth card microinteractions ── */
        .tooth-container {
          outline: none;
        }
        .tooth-container:focus-visible {
          box-shadow: 0 0 0 3px rgba(8, 145, 178, 0.35), 0 8px 22px rgba(8, 145, 178, 0.18) !important;
          border-color: rgba(8, 145, 178, 0.45) !important;
        }
        .tooth-container.tooth-editable:hover,
        .tooth-container.tooth-readonly:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 24px rgba(8, 145, 178, 0.18), 0 2px 6px rgba(15, 23, 42, 0.06) !important;
          border-color: rgba(8, 145, 178, 0.30) !important;
        }
        .tooth-dx-chip {
          animation: chipFadeIn 0.25s ease-out;
        }
        @keyframes chipFadeIn {
          from { opacity: 0; transform: translateY(2px); }
          to   { opacity: 1; transform: translateY(0); }
        }

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

        /* ═══════════════════════════════════════════════════════════════
           DARK THEME OVERRIDES
           Inline styles set via JS use !important to win over them.
           ═══════════════════════════════════════════════════════════════ */
        /* Outer wrapper used by consultation / view-consultation / clinical-record */
        [data-theme="dark"] .odontogram-container {
          background: linear-gradient(135deg, rgba(14,14,16,0.7) 0%, rgba(20,20,22,0.55) 100%) !important;
          border: 1px solid rgba(255,255,255,0.06) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.03) !important;
        }
        [data-theme="dark"] .arch-grid {
          background: linear-gradient(135deg, rgba(20,20,22,0.7) 0%, rgba(14,14,16,0.85) 100%) !important;
          border: 1.5px solid rgba(255,255,255,0.06) !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35) !important;
        }
        [data-theme="dark"] .arch-label {
          color: #22d3ee !important;
        }
        [data-theme="dark"] .tooth-container {
          background: linear-gradient(180deg, rgba(28,28,30,0.85) 0%, rgba(20,20,22,0.7) 100%) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
        }
        [data-theme="dark"] .tooth-container.tooth-editable:hover,
        [data-theme="dark"] .tooth-container.tooth-readonly:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 24px rgba(6,182,212,0.18), 0 2px 6px rgba(0,0,0,0.45) !important;
          border-color: rgba(6,182,212,0.35) !important;
        }
        [data-theme="dark"] .tooth-container.tooth-selected {
          background: linear-gradient(180deg, rgba(6,182,212,0.12) 0%, rgba(8,145,178,0.06) 100%) !important;
          border-color: rgba(6,182,212,0.5) !important;
          box-shadow: 0 0 0 1px rgba(6,182,212,0.35), 0 8px 22px rgba(6,182,212,0.20), 0 24px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04) !important;
        }
        [data-theme="dark"] .tooth-info-dot {
          box-shadow: 0 0 0 2px #0a0a0c, 0 2px 6px rgba(0,0,0,0.6) !important;
        }
        [data-theme="dark"] .tooth-svg {
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        }
        [data-theme="dark"] .tooth-container:hover .tooth-svg {
          filter: drop-shadow(0 4px 12px rgba(6,182,212,0.35));
        }
        [data-theme="dark"] .tooth-surface {
          box-shadow: 0 1px 3px rgba(0,0,0,0.4);
          border-color: rgba(255,255,255,0.18) !important;
        }
        [data-theme="dark"] .tooth-surface.tooth-surface-healthy {
          background-color: rgba(255,255,255,0.08) !important;
          color: #cbd5e1 !important;
        }
        [data-theme="dark"] .tooth-surfaces-summary {
          background: rgba(255,255,255,0.05) !important;
        }
        /* Tooth diagnosis chip: lighten label color (uses cond.color, easier read on dark) */
        [data-theme="dark"] .tooth-dx-chip span:last-child {
          color: inherit !important;
          opacity: 0.95;
        }
        [data-theme="dark"] .tooth-dx-chip {
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06) !important;
        }

        /* ── Detail panel (sticky drawer / inline card) ── */
        [data-theme="dark"] .odonto-detail-panel {
          background: rgba(20,20,22,0.92) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.45) !important;
        }
        [data-theme="dark"] .odonto-detail-panel.odonto-detail-active {
          box-shadow: 0 16px 40px rgba(0,0,0,0.55), 0 4px 12px rgba(6,182,212,0.08) !important;
        }
        @media (max-width: 860px) {
          [data-theme="dark"] .odonto-detail-panel.odonto-detail-active {
            background: #0a0a0c !important;
          }
        }

        /* Detail panel — populated state */
        [data-theme="dark"] .odonto-detail-dx-card {
          background: linear-gradient(135deg, rgba(28,28,30,0.85) 0%, rgba(20,20,22,0.7) 100%) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04) !important;
        }
        [data-theme="dark"] .odonto-detail-dx-label {
          color: #94a3b8 !important;
        }
        [data-theme="dark"] .odonto-detail-dx-name {
          color: #f1f5f9 !important;
        }
        [data-theme="dark"] .odonto-detail-surf-title {
          color: #cbd5e1 !important;
        }
        [data-theme="dark"] .odonto-detail-surf-count {
          background: rgba(255,255,255,0.06) !important;
          color: #94a3b8 !important;
        }
        [data-theme="dark"] .odonto-detail-surf-count.has-affected {
          background: rgba(6,182,212,0.12) !important;
          color: #22d3ee !important;
        }
        [data-theme="dark"] .odonto-detail-surf-empty {
          background: rgba(255,255,255,0.03) !important;
          border: 1px dashed rgba(255,255,255,0.1) !important;
          color: #94a3b8 !important;
        }
        [data-theme="dark"] .odonto-detail-surf-item {
          background: rgba(28,28,30,0.7) !important;
          border-color: rgba(255,255,255,0.08) !important;
        }
        [data-theme="dark"] .odonto-detail-surf-name {
          color: #f1f5f9 !important;
        }
        [data-theme="dark"] .odonto-detail-surf-dx {
          color: #94a3b8 !important;
        }

        /* Detail panel — empty state */
        [data-theme="dark"] .odonto-detail-empty-icon {
          background: linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(8,145,178,0.08) 100%) !important;
          border: 1px solid rgba(6,182,212,0.25) !important;
          color: #22d3ee !important;
        }
        [data-theme="dark"] .odonto-detail-empty-eyebrow {
          color: #22d3ee !important;
        }
        [data-theme="dark"] .odonto-detail-empty-text {
          color: #94a3b8 !important;
        }

        /* Mobile tooth preview header inside the fullscreen modal */
        [data-theme="dark"] .odonto-tooth-preview-section {
          background: linear-gradient(180deg, rgba(14,14,16,0.6) 0%, rgba(20,20,22,0.4) 100%) !important;
          border-bottom: 1px solid rgba(255,255,255,0.08) !important;
        }
        [data-theme="dark"] .odonto-tooth-preview-hint {
          color: #cbd5e1 !important;
        }

        /* ── Treatment toolbar ── */
        [data-theme="dark"] .toolbar-container {
          background: rgba(20,20,22,0.85) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          color: #f1f5f9 !important;
        }
        [data-theme="dark"] #toolbar-info {
          background: rgba(6,182,212,0.10) !important;
          color: #22d3ee !important;
        }
        [data-theme="dark"] .condition-btn {
          color: #f1f5f9 !important;
        }

        /* ── Legend ── */
        [data-theme="dark"] .legend-container,
        [data-theme="dark"] .odonto-legend {
          background: linear-gradient(180deg, rgba(20,20,22,0.85) 0%, rgba(14,14,16,0.92) 100%) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          box-shadow: 0 1px 2px rgba(0,0,0,0.3) !important;
        }
        [data-theme="dark"] .odonto-legend > div:first-child > div:first-child {
          color: #cbd5e1 !important;
        }
        [data-theme="dark"] .odonto-legend > div:first-child > div:last-child {
          color: #64748b !important;
        }
        [data-theme="dark"] .legend-item {
          background: rgba(28,28,30,0.7) !important;
        }
        [data-theme="dark"] .legend-item span:last-child {
          color: #f1f5f9 !important;
        }
      `;
    }
  }
}

// Export for backward compatibility
window.Odontogram = OdontogramContainer;
