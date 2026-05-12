// Tooth component with interactive surfaces

class OdontogramTooth {
  constructor(fdi, state = {}, handlers = {}, containerRef) {
    this.fdi = fdi;
    this.tooth = getToothByFDI(fdi);
    this.state = state;
    this.handlers = handlers;
    this.containerRef = containerRef;
    this.isSelected = state.isSelected || false;
    this.condition = state.condition || CONDITIONS.HEALTHY.id;
    this.surfaces = state.surfaces || {};
    this.isEditable = handlers.isEditable !== false;
  }

  getSurfaceCondition(surface) {
    return this.surfaces[surface] || CONDITIONS.HEALTHY.id;
  }

  _hexToRgba(hex, alpha) {
    const h = (hex || '#000000').replace('#','');
    const full = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
    const num = parseInt(full, 16);
    return `rgba(${(num>>16)&255}, ${(num>>8)&255}, ${num&255}, ${alpha})`;
  }

  _getAffectedSurfaces() {
    return Object.entries(this.surfaces || {})
      .filter(([, condId]) => condId && condId !== CONDITIONS.HEALTHY.id)
      .map(([surface, condId]) => ({ surface, condId }));
  }

  render() {
    const container = document.createElement('div');
    container.className = 'tooth-container';
    container.setAttribute('data-fdi', this.fdi);
    container.setAttribute('data-tooth-type', this.tooth.type);
    container.setAttribute('tabindex', '0');

    const hasGeneralDx = this.condition !== CONDITIONS.HEALTHY.id;
    const affected = this._getAffectedSurfaces();
    const hasAnyDx = hasGeneralDx || affected.length > 0;

    container.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      padding: 0.9rem 0.7rem 0.75rem;
      background: linear-gradient(180deg, #ffffff 0%, #f5f9fb 100%);
      border: 1px solid rgba(8, 145, 178, 0.15);
      border-radius: 16px;
      cursor: pointer;
      transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s, border-color 0.18s;
      position: relative;
      min-width: 0;
      box-shadow: 0 2px 8px rgba(8, 145, 178, 0.08);
      will-change: transform, box-shadow;
      outline: none;
    `;

    // Always clickable: tooth select fires regardless of mode (visual selection only).
    // Editing logic remains gated by container.readOnly.
    container.className = 'tooth-container' + (this.isEditable ? ' tooth-editable' : ' tooth-readonly');
    container.onclick = (e) => {
      if(this.handlers && typeof this.handlers.onSelect === 'function') {
        this.handlers.onSelect(this.fdi, e);
      }
    };
    container.onkeydown = (e) => {
      if(e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if(this.handlers && typeof this.handlers.onSelect === 'function') {
          this.handlers.onSelect(this.fdi, e);
        }
      }
    };

    if(this.isSelected) {
      container.classList.add('tooth-selected');
      container.style.borderColor = 'rgba(8, 145, 178, 0.45)';
      container.style.background = 'linear-gradient(180deg, #f0f9ff 0%, #e8f5f9 100%)';
      container.style.boxShadow = '0 0 0 1px rgba(8, 145, 178, 0.25), 0 8px 22px rgba(8, 145, 178, 0.22), 0 24px 48px rgba(8, 145, 178, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
    }

    // Top-right info dot — visible cue that this tooth has clinical data
    if(hasAnyDx) {
      const condData = hasGeneralDx ? getConditionById(this.condition) : getConditionById(affected[0].condId);
      const dot = document.createElement('span');
      dot.className = 'tooth-info-dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: ${condData.color};
        box-shadow: 0 0 0 2px #ffffff, 0 2px 6px ${this._hexToRgba(condData.color, 0.55)};
        z-index: 2;
      `;
      container.appendChild(dot);
    }

    // Tooth SVG with background
    const svgContainer = document.createElement('div');
    svgContainer.className = 'tooth-svg-wrapper';
    svgContainer.style.cssText = `
      width: 100%;
      height: auto;
      aspect-ratio: 0.85;
      display: flex;
      align-items: center;
      justify-content: center;
      max-width: 110px;
      border-radius: 12px;
      padding: 0.5rem;
    `;

    const svg = createToothSVG(this.tooth.type, this.condition, this.isSelected, this.isEditable);
    svgContainer.appendChild(svg);
    container.appendChild(svgContainer);

    // Tooth number badge
    const number = document.createElement('div');
    number.className = 'tooth-number';
    number.textContent = this.tooth.name;
    number.style.cssText = `
      font-weight: 900;
      font-size: 1rem;
      color: white;
      white-space: nowrap;
      letter-spacing: 0.5px;
      background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
      padding: 0.35rem 0.65rem;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(8, 145, 178, 0.2);
    `;
    container.appendChild(number);

    // Surfaces in anatomical cross layout: [B] / [M O D] / [L]
    const surfacesDiv = document.createElement('div');
    surfacesDiv.className = 'tooth-surfaces';
    surfacesDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.1rem;
      margin-top: 0.15rem;
    `;

    const isAnterior = this.tooth.type === TOOTH_TYPES.INCISOR || this.tooth.type === TOOTH_TYPES.CANINE;
    const apicalSurface = isAnterior ? SURFACES.INCISAL : SURFACES.OCCLUSAL;

    const wireSurface = (el, surface) => {
      if(this.handlers && typeof this.handlers.onSurfaceSelect === 'function') {
        el.style.cursor = 'pointer';
        el.onclick = (e) => {
          e.stopPropagation();
          this.handlers.onSurfaceSelect(this.fdi, surface, e);
        };
      }
      // Premium hover tooltip — bubbles a custom event the container listens to
      el.addEventListener('mouseenter', (e) => {
        const condId = this.getSurfaceCondition(surface);
        if(condId === CONDITIONS.HEALTHY.id) return;
        const evt = new CustomEvent('odonto:surface-hover', {
          bubbles: true,
          detail: { fdi: this.fdi, surface, condId, rect: el.getBoundingClientRect() }
        });
        el.dispatchEvent(evt);
      });
      el.addEventListener('mouseleave', () => {
        const evt = new CustomEvent('odonto:surface-hover-end', { bubbles: true });
        el.dispatchEvent(evt);
      });
    };

    // Row 1: B alone
    const buccalEl = createSurfaceElement(
      SURFACES.BUCCAL,
      this.fdi,
      this.getSurfaceCondition(SURFACES.BUCCAL),
      this.isEditable
    );
    wireSurface(buccalEl, SURFACES.BUCCAL);
    surfacesDiv.appendChild(buccalEl);

    // Row 2: M O D together
    const row2 = document.createElement('div');
    row2.style.cssText = `display: flex; gap: 0.1rem;`;

    const mesialEl = createSurfaceElement(
      SURFACES.MESIAL,
      this.fdi,
      this.getSurfaceCondition(SURFACES.MESIAL),
      this.isEditable
    );
    wireSurface(mesialEl, SURFACES.MESIAL);
    row2.appendChild(mesialEl);

    const centralEl = createSurfaceElement(
      apicalSurface,
      this.fdi,
      this.getSurfaceCondition(apicalSurface),
      this.isEditable
    );
    wireSurface(centralEl, apicalSurface);
    row2.appendChild(centralEl);

    const distalEl = createSurfaceElement(
      SURFACES.DISTAL,
      this.fdi,
      this.getSurfaceCondition(SURFACES.DISTAL),
      this.isEditable
    );
    wireSurface(distalEl, SURFACES.DISTAL);
    row2.appendChild(distalEl);

    surfacesDiv.appendChild(row2);

    // Row 3: L alone
    const lingualEl = createSurfaceElement(
      SURFACES.LINGUAL,
      this.fdi,
      this.getSurfaceCondition(SURFACES.LINGUAL),
      this.isEditable
    );
    wireSurface(lingualEl, SURFACES.LINGUAL);
    surfacesDiv.appendChild(lingualEl);

    container.appendChild(surfacesDiv);

    // ── Clinical summary (chip + affected surfaces) ──
    if(hasAnyDx) {
      const summary = document.createElement('div');
      summary.className = 'tooth-clinical-summary';
      summary.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.3rem;
        width: 100%;
        margin-top: 0.15rem;
      `;

      // 1) General diagnosis chip — shown only when condition !== HEALTHY
      if(hasGeneralDx) {
        const cond = getConditionById(this.condition);
        const chip = document.createElement('div');
        chip.className = 'tooth-dx-chip';
        chip.title = cond.label;
        chip.style.cssText = `
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          max-width: 100%;
          padding: 0.28rem 0.55rem;
          border-radius: 999px;
          background: linear-gradient(135deg, ${this._hexToRgba(cond.color, 0.14)} 0%, ${this._hexToRgba(cond.color, 0.06)} 100%);
          border: 1px solid ${this._hexToRgba(cond.color, 0.45)};
          color: ${cond.color};
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          line-height: 1;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.6);
        `;

        const chipDot = document.createElement('span');
        chipDot.style.cssText = `
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: ${cond.color};
          box-shadow: 0 0 0 2px ${this._hexToRgba(cond.color, 0.18)};
          flex-shrink: 0;
        `;
        chip.appendChild(chipDot);

        const chipLabel = document.createElement('span');
        chipLabel.style.cssText = `
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: ${this._darken(cond.color, 0.35)};
        `;
        chipLabel.textContent = cond.label;
        chip.appendChild(chipLabel);

        summary.appendChild(chip);
      }

      // 2) Affected surfaces mini-row — colored letter dots
      if(affected.length > 0) {
        const surfRow = document.createElement('div');
        surfRow.className = 'tooth-surfaces-summary';
        surfRow.title = `${affected.length} superficie${affected.length === 1 ? '' : 's'} afectada${affected.length === 1 ? '' : 's'}`;
        surfRow.style.cssText = `
          display: inline-flex;
          align-items: center;
          gap: 0.22rem;
          padding: 0.18rem 0.4rem;
          background: rgba(15, 23, 42, 0.04);
          border-radius: 8px;
        `;

        const order = [SURFACES.MESIAL, SURFACES.BUCCAL, apicalSurface, SURFACES.DISTAL, SURFACES.LINGUAL];
        const seen = new Set();
        order.forEach(surf => {
          const dx = (this.surfaces || {})[surf];
          if(!dx || dx === CONDITIONS.HEALTHY.id) return;
          if(seen.has(surf)) return;
          seen.add(surf);
          const cond = getConditionById(dx);
          const letter = getSurfaceLabel(surf, this.fdi);
          const tag = document.createElement('span');
          tag.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 14px;
            height: 14px;
            padding: 0 4px;
            border-radius: 4px;
            background: ${cond.color};
            color: ${this._isLight(cond.color) ? '#0f172a' : '#ffffff'};
            font-size: 0.6rem;
            font-weight: 800;
            letter-spacing: 0.04em;
            line-height: 1;
            box-shadow: 0 1px 2px ${this._hexToRgba(cond.color, 0.4)};
          `;
          tag.textContent = letter;
          surfRow.appendChild(tag);
        });

        summary.appendChild(surfRow);
      }

      container.appendChild(summary);
    } else {
      // Healthy: show a tiny, subtle "Sano" label so the doctor instantly recognizes the empty state.
      const healthy = document.createElement('div');
      healthy.style.cssText = `
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: #94a3b8;
        text-transform: uppercase;
        margin-top: 0.1rem;
      `;
      healthy.textContent = 'Sano';
      container.appendChild(healthy);
    }

    return container;
  }

  _darken(hex, amount = 0.2) {
    const h = (hex || '#000000').replace('#','');
    const full = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
    const num = parseInt(full, 16);
    let r = Math.max(0, ((num >> 16) & 255) - Math.floor(255 * amount));
    let g = Math.max(0, ((num >> 8)  & 255) - Math.floor(255 * amount));
    let b = Math.max(0, ( num        & 255) - Math.floor(255 * amount));
    return `rgb(${r}, ${g}, ${b})`;
  }

  _isLight(hex) {
    const h = (hex || '#000000').replace('#','');
    const full = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    // Perceived luminance
    return (0.299*r + 0.587*g + 0.114*b) > 170;
  }

  getState() {
    return {
      fdi: this.fdi,
      condition: this.condition,
      surfaces: this.surfaces,
      isSelected: this.isSelected
    };
  }
}
