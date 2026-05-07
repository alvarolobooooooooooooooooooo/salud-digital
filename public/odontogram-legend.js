// Legend component - displays condition color reference

class OdontogramLegend {
  constructor() {
    // Legend is static, just shows all conditions
  }

  _hexToRgba(hex, alpha) {
    const h = (hex || '#000000').replace('#','');
    const full = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
    const num = parseInt(full, 16);
    return `rgba(${(num>>16)&255}, ${(num>>8)&255}, ${num&255}, ${alpha})`;
  }

  _isLight(hex) {
    const h = (hex || '#000000').replace('#','');
    const full = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    return (0.299*r + 0.587*g + 0.114*b) > 170;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'legend-container odonto-legend';
    container.style.cssText = `
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 1rem 1.1rem;
      box-shadow: 0 1px 2px rgba(15,23,42,0.04);
    `;

    // Header
    const head = document.createElement('div');
    head.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.85rem;
    `;
    const title = document.createElement('div');
    title.style.cssText = `
      display: inline-flex; align-items: center; gap: 0.45rem;
      font-size: 0.7rem;
      font-weight: 800;
      color: #334155;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    `;
    title.innerHTML = `
      <span style="display:inline-flex;width:18px;height:18px;border-radius:6px;background:linear-gradient(135deg,#0891b2,#06b6d4);align-items:center;justify-content:center;color:#fff;font-size:0.65rem;">●</span>
      <span>Leyenda clínica</span>
    `;
    head.appendChild(title);

    const hint = document.createElement('div');
    hint.style.cssText = `
      font-size: 0.68rem;
      color: #94a3b8;
      font-weight: 600;
    `;
    hint.textContent = 'Color de diagnóstico · ícono';
    head.appendChild(hint);
    container.appendChild(head);

    // Chips row — wraps responsively
    const grid = document.createElement('div');
    grid.className = 'legend-grid';
    grid.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    `;

    CONDITION_LIST.forEach(condition => {
      const chip = document.createElement('div');
      chip.className = 'legend-item';
      chip.title = condition.label;
      chip.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.65rem 0.4rem 0.4rem;
        background: #ffffff;
        border: 1px solid ${this._hexToRgba(condition.color, 0.35)};
        border-radius: 999px;
        transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        cursor: default;
      `;
      chip.onmouseenter = () => {
        chip.style.transform = 'translateY(-1px)';
        chip.style.boxShadow = `0 6px 14px ${this._hexToRgba(condition.color, 0.18)}`;
        chip.style.borderColor = this._hexToRgba(condition.color, 0.6);
      };
      chip.onmouseleave = () => {
        chip.style.transform = 'translateY(0)';
        chip.style.boxShadow = 'none';
        chip.style.borderColor = this._hexToRgba(condition.color, 0.35);
      };

      const dot = document.createElement('span');
      dot.style.cssText = `
        display: inline-flex; align-items: center; justify-content: center;
        width: 22px; height: 22px;
        border-radius: 50%;
        background: ${condition.color};
        color: ${this._isLight(condition.color) ? '#0f172a' : '#ffffff'};
        font-size: 0.78rem; font-weight: 800;
        flex-shrink: 0;
        box-shadow: 0 2px 4px ${this._hexToRgba(condition.color, 0.4)}, inset 0 1px 0 rgba(255,255,255,0.35);
      `;
      dot.textContent = condition.icon;
      chip.appendChild(dot);

      const label = document.createElement('span');
      label.style.cssText = `font-size: 0.78rem; font-weight: 700; color: #0f172a; letter-spacing: 0.01em;`;
      label.textContent = condition.label;
      chip.appendChild(label);

      grid.appendChild(chip);
    });

    container.appendChild(grid);

    return container;
  }
}
