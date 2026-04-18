// Treatment Toolbar component

class OdontogramToolbar {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.selectedCondition = CONDITIONS.HEALTHY.id;
    this.selectedTooth = null;
    this.selectedSurface = null;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'toolbar-container';
    container.style.cssText = `
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      width: 100%;
      box-sizing: border-box;
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
    title.textContent = 'Herramientas de Tratamiento';
    container.appendChild(title);

    // Selection info
    const infoContainer = document.createElement('div');
    infoContainer.id = 'toolbar-info';
    infoContainer.style.cssText = `
      padding: 0.75rem;
      background: #f0f9ff;
      border-radius: 6px;
      font-size: 0.85rem;
      color: #0891b2;
      margin-bottom: 1rem;
      min-height: 1.5rem;
    `;
    infoContainer.textContent = 'Selecciona un diente o superficie para editar.';
    container.appendChild(infoContainer);

    // Condition buttons grid
    const grid = document.createElement('div');
    grid.className = 'condition-buttons';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem;
      width: 100%;
    `;

    CONDITION_LIST.forEach(condition => {
      const btn = document.createElement('button');
      btn.className = 'condition-btn';
      btn.setAttribute('data-condition', condition.id);
      btn.style.cssText = `
        padding: 0.75rem 1rem;
        border: 2px solid ${condition.color};
        background: ${condition.color}20;
        color: #0f172a;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 500;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      `;

      if(condition.id === this.selectedCondition) {
        btn.style.background = condition.color;
        btn.style.color = condition.id === CONDITIONS.HEALTHY.id ? '#0f172a' : 'white';
      }

      const icon = document.createElement('span');
      icon.textContent = condition.icon;
      btn.appendChild(icon);

      const label = document.createTextNode(condition.label);
      btn.appendChild(label);

      btn.onmouseenter = () => {
        if(condition.id !== this.selectedCondition) {
          btn.style.opacity = '0.8';
          btn.style.transform = 'translateY(-2px)';
        }
      };
      btn.onmouseleave = () => {
        if(condition.id !== this.selectedCondition) {
          btn.style.opacity = '1';
          btn.style.transform = 'translateY(0)';
        }
      };

      btn.onclick = () => {
        this.selectCondition(condition.id);
        if(this.handlers && typeof this.handlers.onConditionSelect === 'function') {
          this.handlers.onConditionSelect(condition.id, this.selectedTooth, this.selectedSurface);
        }
      };

      grid.appendChild(btn);
    });

    container.appendChild(grid);

    // Action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = `
      display: flex;
      gap: 0.75rem;
      margin-top: 1rem;
    `;

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Limpiar Selección';
    clearBtn.style.cssText = `
      padding: 0.5rem 1rem;
      border: 1px solid #e2e8f0;
      background: white;
      color: #475569;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
    `;
    clearBtn.onmouseenter = () => clearBtn.style.background = '#f8fafc';
    clearBtn.onmouseleave = () => clearBtn.style.background = 'white';
    clearBtn.onclick = () => {
      this.clearSelection();
      if(this.handlers && typeof this.handlers.onClearSelection === 'function') {
        this.handlers.onClearSelection();
      }
    };

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Restablecer Todos';
    resetBtn.style.cssText = `
      padding: 0.5rem 1rem;
      border: 1px solid #e2e8f0;
      background: white;
      color: #475569;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
    `;
    resetBtn.onmouseenter = () => resetBtn.style.background = '#f8fafc';
    resetBtn.onmouseleave = () => resetBtn.style.background = 'white';
    resetBtn.onclick = () => {
      if(this.handlers.onReset) {
        this.handlers.onReset();
      }
    };

    actionsDiv.appendChild(clearBtn);
    actionsDiv.appendChild(resetBtn);
    container.appendChild(actionsDiv);

    return container;
  }

  selectCondition(id) {
    this.selectedCondition = id;
  }

  setSelectedTooth(fdi) {
    this.selectedTooth = fdi;
    this.updateInfo();
  }

  setSelectedSurface(fdi, surface) {
    this.selectedTooth = fdi;
    this.selectedSurface = surface;
    this.updateInfo();
  }

  clearSelection() {
    this.selectedTooth = null;
    this.selectedSurface = null;
    this.updateInfo();
  }

  updateInfo() {
    const infoEl = document.getElementById('toolbar-info');
    if(!infoEl) return;

    let text = 'Selecciona un diente o superficie para editar.';
    if(this.selectedTooth) {
      const tooth = getToothByFDI(this.selectedTooth);
      if(this.selectedSurface) {
        text = `Editando: Diente ${tooth.name}, Superficie ${this.selectedSurface.toUpperCase()}`;
      } else {
        text = `Editando: Diente ${tooth.name}`;
      }
    }
    infoEl.textContent = text;
  }

  getSelectedCondition() {
    return this.selectedCondition;
  }
}
