// Legend component - displays condition color reference

class OdontogramLegend {
  constructor() {
    // Legend is static, just shows all conditions
  }

  render() {
    const container = document.createElement('div');
    container.className = 'legend-container';
    container.style.cssText = `
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1.5rem;
    `;

    // Title
    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 0.85rem;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 1rem;
    `;
    title.textContent = 'Leyenda de Condiciones y Tratamientos';
    container.appendChild(title);

    // Grid of conditions
    const grid = document.createElement('div');
    grid.className = 'legend-grid';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1.5rem;
    `;

    CONDITION_LIST.forEach(condition => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.style.cssText = `
        display: flex;
        align-items: center;
        gap: 0.75rem;
      `;

      // Color box
      const colorBox = document.createElement('div');
      colorBox.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 6px;
        background-color: ${condition.color};
        border: 2px solid ${condition.color === '#ffffff' ? '#1e293b' : condition.color};
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: ${condition.id === CONDITIONS.HEALTHY.id ? '#0f172a' : 'white'};
        font-size: 1.1rem;
      `;
      colorBox.textContent = condition.icon;
      item.appendChild(colorBox);

      // Label
      const label = document.createElement('div');
      label.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      `;

      const labelName = document.createElement('div');
      labelName.style.cssText = `
        font-size: 0.85rem;
        font-weight: 500;
        color: #0f172a;
      `;
      labelName.textContent = condition.label;
      label.appendChild(labelName);

      const labelId = document.createElement('div');
      labelId.style.cssText = `
        font-size: 0.75rem;
        color: #94a3b8;
      `;
      labelId.textContent = condition.id;
      label.appendChild(labelId);

      item.appendChild(label);
      grid.appendChild(item);
    });

    container.appendChild(grid);

    return container;
  }
}
