/* Tab: Plan nutricional — objetivos SMART, distribución, CONSTRUCTOR DE PLATO drag&drop, plan semanal */

const TabPlan = () => {
  const toast = React.useContext(ToastContext);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <SecHeader
        title="Plan nutricional"
        sub="Objetivos · distribución de macros · constructor visual de platos · plan semanal"
        actions={<>
          <button className="btn btn-secondary"><Icon name="copy" size={14}/> Cargar plantilla</button>
          <button className="btn btn-primary"><Icon name="save" size={14}/> Guardar plan</button>
        </>}
      />

      {/* Top: objetivos + distribución */}
      <div className="grid" style={{ gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <Card title="Objetivos SMART" icon="target" sub="Específicos · medibles · alcanzables · realistas · temporales">
          <div className="stack" style={{ gap: 10 }}>
            {[
              { obj: 'Reducir 5 kg (de 74.8 a 69.8 kg) en 16 semanas', date: '12 sept 2026', pct: 36 },
              { obj: 'Mantener glucosa en ayunas <100 mg/dL en 12 semanas', date: '14 ago 2026', pct: 42 },
              { obj: 'Aumentar consumo de agua a 2.0 L/día en 4 semanas', date: '18 jun 2026', pct: 65 },
              { obj: 'Incorporar 3 sesiones de actividad física/semana', date: '12 jun 2026', pct: 50 },
              { obj: 'Reducir consumo de refrescos azucarados a 0/semana', date: '4 jun 2026', pct: 80 },
            ].map((g, i) => (
              <div key={i} style={{ padding: 12, border: '1px solid var(--border-default)', borderRadius: 'var(--r-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: 'var(--fg-strong)', fontWeight: 500 }}>{g.obj}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>{g.date}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--sd-ink-100)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${g.pct}%`, height: '100%', background: g.pct >= 60 ? 'var(--sd-vital-500)' : g.pct >= 40 ? 'var(--sd-blue-600)' : 'var(--sd-alert-500)' }}/>
                  </div>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--fg-muted)' }}>{g.pct}%</span>
                </div>
              </div>
            ))}
            <button className="btn btn-ghost sm" style={{ alignSelf: 'flex-start' }}><Icon name="plus" size={13}/> Nuevo objetivo</button>
          </div>
        </Card>

        <Card title="Distribución de la dieta" icon="utensils" sub="Meta: 1,750 kcal/día — déficit de 500 kcal">
          <DistribucionMacros/>
        </Card>
      </div>

      {/* ===== PLATE BUILDER ===== */}
      <SecHeader
        title="Constructor visual de plato"
        sub="Arrastre alimentos al plato. Calcula kcal y macros en vivo. Funciona con el método del plato (½ vegetales, ¼ proteína, ¼ carbohidratos)."
      />
      <PlateBuilder/>

      {/* ===== Plan semanal ===== */}
      <SecHeader
        title="Plan semanal"
        sub="Vista resumida — del 26 may al 1 jun 2026"
        actions={<>
          <button className="btn btn-secondary sm"><Icon name="copy" size={13}/> Duplicar semana</button>
          <button className="btn btn-secondary sm"><Icon name="download" size={13}/> Exportar PDF</button>
        </>}
      />
      <PlanSemanal/>
    </div>
  );
};

/* ===== Distribución de macros ===== */
const DistribucionMacros = () => {
  const [kcal, setKcal] = React.useState(1750);
  const [carb, setCarb] = React.useState(45);
  const [prot, setProt] = React.useState(25);
  const [grasa, setGrasa] = React.useState(30);

  const gCarb = Math.round((kcal * carb / 100) / 4);
  const gProt = Math.round((kcal * prot / 100) / 4);
  const gGrasa = Math.round((kcal * grasa / 100) / 9);
  const sum = carb + prot + grasa;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <Field label="Energía total diaria (kcal)">
        <Input type="number" mono value={kcal} suffix="kcal" onChange={(e) => setKcal(parseInt(e.target.value) || 0)}/>
      </Field>

      <div className="stack" style={{ gap: 12 }}>
        <MacroSlider label="Carbohidratos" pct={carb} setPct={setCarb} grams={gCarb} color="var(--sd-alert-500)" lo={40} hi={55}/>
        <MacroSlider label="Proteínas" pct={prot} setPct={setProt} grams={gProt} color="var(--sd-blue-600)" lo={20} hi={30}/>
        <MacroSlider label="Grasas" pct={grasa} setPct={setGrasa} grams={gGrasa} color="var(--sd-vital-500)" lo={25} hi={35}/>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: sum === 100 ? 'var(--sd-vital-100)' : 'var(--sd-alert-100)', borderRadius: 'var(--r-md)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: sum === 100 ? 'var(--sd-vital-600)' : 'var(--sd-alert-600)' }}>
          {sum === 100 ? '✓ Distribución equilibrada' : `Suma ${sum}% — debe ser 100%`}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: sum === 100 ? 'var(--sd-vital-600)' : 'var(--sd-alert-600)' }}>{sum}%</span>
      </div>
    </div>
  );
};

const MacroSlider = ({ label, pct, setPct, grams, color, lo, hi }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: color }}/>{label}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>
        <span style={{ color: 'var(--fg-strong)', fontWeight: 600 }}>{pct}%</span> · {grams} g · meta {lo}-{hi}%
      </span>
    </div>
    <input type="range" min="0" max="100" value={pct} onChange={(e) => setPct(parseInt(e.target.value))} style={{ width: '100%', accentColor: color }}/>
  </div>
);

/* ====================================================================
   PLATE BUILDER — the centerpiece
   ==================================================================== */
const PlateBuilder = () => {
  const toast = React.useContext(ToastContext);
  const [activeCat, setActiveCat] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [activeMeal, setActiveMeal] = React.useState('almuerzo');
  const [dragOverZone, setDragOverZone] = React.useState(null);
  const [draggingId, setDraggingId] = React.useState(null);
  const [showSubs, setShowSubs] = React.useState(null);
  const [showSaveModal, setShowSaveModal] = React.useState(false);

  // Plates state: { mealId: [ { foodId, qty, zone, x, y } ] }
  const [plates, setPlates] = React.useState({
    desayuno: [],
    'snack-am': [],
    almuerzo: [
      { foodId: 'arroz-blanco', qty: 1, zone: 'carb', x: 70, y: 70 },
      { foodId: 'pollo-plancha', qty: 1, zone: 'pro', x: 75, y: 25 },
      { foodId: 'ensalada-mixta', qty: 1, zone: 'veg', x: 25, y: 35 },
      { foodId: 'aguacate', qty: 1, zone: 'pro', x: 90, y: 50 },
      { foodId: 'tomate', qty: 1, zone: 'veg', x: 22, y: 70 },
    ],
    'snack-pm': [],
    cena: [],
  });

  const currentPlate = plates[activeMeal] || [];

  const filteredFoods = FOODS.filter(f => {
    if (activeCat !== 'all' && f.cat !== activeCat) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Totals
  const totals = currentPlate.reduce((acc, item) => {
    const food = FOODS.find(f => f.id === item.foodId);
    if (!food) return acc;
    acc.kcal += food.kcal * item.qty;
    acc.p += food.p * item.qty;
    acc.c += food.c * item.qty;
    acc.g += food.g * item.qty;
    return acc;
  }, { kcal: 0, p: 0, c: 0, g: 0 });

  const mealTarget = MEALS.find(m => m.id === activeMeal)?.target || 500;
  const macroTarget = { p: mealTarget * 0.25 / 4, c: mealTarget * 0.5 / 4, g: mealTarget * 0.25 / 9 };

  // ===== Add / remove / update qty
  const addFoodToPlate = (foodId, dropZone = null, x = null, y = null) => {
    const food = FOODS.find(f => f.id === foodId);
    if (!food) return;
    const zone = dropZone || CAT_ZONE[food.cat];
    // generate random position within zone area if not specified
    let nx = x, ny = y;
    if (nx === null) {
      if (zone === 'veg')  { nx = 18 + Math.random() * 22; ny = 25 + Math.random() * 50; }
      if (zone === 'pro')  { nx = 60 + Math.random() * 28; ny = 18 + Math.random() * 22; }
      if (zone === 'carb') { nx = 60 + Math.random() * 28; ny = 58 + Math.random() * 22; }
    }
    setPlates(p => {
      // if already on plate, increment qty
      const existing = p[activeMeal].find(it => it.foodId === foodId);
      if (existing) {
        return { ...p, [activeMeal]: p[activeMeal].map(it => it.foodId === foodId ? { ...it, qty: it.qty + 1 } : it) };
      }
      return { ...p, [activeMeal]: [...p[activeMeal], { foodId, qty: 1, zone, x: nx, y: ny }] };
    });
  };
  const removeFromPlate = (foodId) => setPlates(p => ({ ...p, [activeMeal]: p[activeMeal].filter(it => it.foodId !== foodId) }));
  const updateQty = (foodId, delta) => setPlates(p => ({
    ...p,
    [activeMeal]: p[activeMeal]
      .map(it => it.foodId === foodId ? { ...it, qty: Math.max(0, +(it.qty + delta).toFixed(1)) } : it)
      .filter(it => it.qty > 0)
  }));

  // ===== Drag handlers
  const onDragStart = (e, foodId) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', foodId);
    setDraggingId(foodId);
  };
  const onDragEnd = () => { setDraggingId(null); setDragOverZone(null); };

  const onZoneDragOver = (e, zone) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverZone(zone);
  };
  const onZoneDragLeave = (e, zone) => {
    if (dragOverZone === zone) setDragOverZone(null);
  };
  const onZoneDrop = (e, zone) => {
    e.preventDefault();
    const foodId = e.dataTransfer.getData('text/plain');
    setDragOverZone(null);
    if (foodId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const plateRect = e.currentTarget.closest('.plate').getBoundingClientRect();
      const x = ((e.clientX - plateRect.left) / plateRect.width) * 100;
      const y = ((e.clientY - plateRect.top) / plateRect.height) * 100;
      addFoodToPlate(foodId, zone, x, y);
      toast.push(`${FOODS.find(f => f.id === foodId)?.name} agregado al plato`, { icon: 'check' });
    }
  };

  const clearPlate = () => setPlates(p => ({ ...p, [activeMeal]: [] }));

  return (
    <>
      <div className="plate-app">
        {/* ===== Left: food shelf ===== */}
        <div className="food-shelf">
          <div className="food-shelf__head">
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-strong)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="utensils" size={14} style={{ color: 'var(--sd-blue-600)' }}/>
              Alimentos
            </div>
            <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{filteredFoods.length}</span>
          </div>
          <div className="food-shelf__search">
            <Icon name="search" size={14}/>
            <input placeholder="Buscar alimento…" value={search} onChange={(e) => setSearch(e.target.value)}/>
          </div>
          <div className="food-shelf__cats">
            {CATEGORIES.map(c => (
              <button key={c.id} className={`food-shelf__cat ${activeCat === c.id ? 'on' : ''}`} onClick={() => setActiveCat(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="food-shelf__list">
            {filteredFoods.map(f => (
              <div
                key={f.id}
                className={`food-item ${draggingId === f.id ? 'dragging' : ''}`}
                draggable
                onDragStart={(e) => onDragStart(e, f.id)}
                onDragEnd={onDragEnd}
                onClick={() => addFoodToPlate(f.id)}
                title={`Doble click o arrastra al plato — ${f.kcal} kcal`}
              >
                <div className="food-item__icon"><FoodIcon id={f.id} size={32}/></div>
                <div style={{ minWidth: 0 }}>
                  <div className="food-item__name">{f.name}</div>
                  <div className="food-item__sub">{f.portion} · {f.kcal} kcal</div>
                </div>
                <div className="food-item__add"><Icon name="plus" size={12}/></div>
              </div>
            ))}
            {filteredFoods.length === 0 && (
              <div className="empty-state">
                <div>Sin resultados</div>
              </div>
            )}
          </div>
        </div>

        {/* ===== Center: plate stage ===== */}
        <div className="plate-stage">
          {/* Meal tabs */}
          <div className="meal-tabs">
            {MEALS.map(m => {
              const k = (plates[m.id] || []).reduce((a, it) => {
                const f = FOODS.find(x => x.id === it.foodId); return a + (f ? f.kcal * it.qty : 0);
              }, 0);
              return (
                <button key={m.id} className={`meal-tab ${activeMeal === m.id ? 'on' : ''}`} onClick={() => setActiveMeal(m.id)}>
                  <span>{m.label}</span>
                  <small>{m.time} · {Math.round(k)} kcal</small>
                </button>
              );
            })}
          </div>

          {/* Plate canvas */}
          <div className="plate-canvas">
            <div className="plate">
              {['veg', 'pro', 'carb'].map((zone) => {
                const zoneItems = currentPlate.filter(it => it.zone === zone);
                return (
                  <div
                    key={zone}
                    className={`plate__zone zone-${zone} ${dragOverZone === zone ? 'is-over' : ''}`}
                    onDragOver={(e) => onZoneDragOver(e, zone)}
                    onDragLeave={(e) => onZoneDragLeave(e, zone)}
                    onDrop={(e) => onZoneDrop(e, zone)}
                  >
                    <div className="zone-label">{ZONE_LABEL[zone]}</div>
                    {zoneItems.length === 0 && (
                      <div className="zone-empty-hint">
                        Arrastra aquí
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Items absolutely positioned on plate */}
              {currentPlate.map((item, idx) => {
                const food = FOODS.find(f => f.id === item.foodId);
                if (!food) return null;
                return (
                  <div
                    key={`${item.foodId}-${idx}`}
                    className="plate-item"
                    style={{ left: `${item.x}%`, top: `${item.y}%`, transform: 'translate(-50%, -50%)' }}
                    onClick={(e) => { e.stopPropagation(); }}
                    title={food.name}
                  >
                    <FoodIcon id={food.id} size={64}/>
                    {item.qty > 1 && (
                      <span style={{
                        position: 'absolute', top: -2, right: -6,
                        background: 'var(--sd-navy-700)', color: '#fff',
                        fontSize: 10, fontWeight: 700,
                        borderRadius: 999, padding: '2px 6px',
                        fontFamily: 'var(--font-mono)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }}>×{item.qty}</span>
                    )}
                    <button className="plate-item__remove" onClick={() => removeFromPlate(item.foodId)} title="Quitar">×</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Macros */}
          <div className="macros">
            <div className="macro" style={{ borderColor: totals.kcal > mealTarget * 1.1 ? 'var(--sd-alert-500)' : 'var(--border-default)' }}>
              <div className="macro__label"><span className="macro__dot" style={{ background: 'var(--sd-navy-700)' }}/>Energía</div>
              <div className="macro__value">{Math.round(totals.kcal)}<span className="unit">kcal</span></div>
              <div className="macro__bar"><span style={{ width: `${Math.min(100, (totals.kcal / mealTarget) * 100)}%`, background: 'var(--sd-navy-700)' }}/></div>
              <div className="macro__target">meta {mealTarget} kcal</div>
            </div>
            <div className="macro">
              <div className="macro__label"><span className="macro__dot" style={{ background: 'var(--sd-blue-600)' }}/>Proteína</div>
              <div className="macro__value">{totals.p.toFixed(1)}<span className="unit">g</span></div>
              <div className="macro__bar"><span style={{ width: `${Math.min(100, (totals.p / macroTarget.p) * 100)}%`, background: 'var(--sd-blue-600)' }}/></div>
              <div className="macro__target">meta {macroTarget.p.toFixed(0)} g</div>
            </div>
            <div className="macro">
              <div className="macro__label"><span className="macro__dot" style={{ background: 'var(--sd-alert-500)' }}/>Carbohidratos</div>
              <div className="macro__value">{totals.c.toFixed(1)}<span className="unit">g</span></div>
              <div className="macro__bar"><span style={{ width: `${Math.min(100, (totals.c / macroTarget.c) * 100)}%`, background: 'var(--sd-alert-500)' }}/></div>
              <div className="macro__target">meta {macroTarget.c.toFixed(0)} g</div>
            </div>
            <div className="macro">
              <div className="macro__label"><span className="macro__dot" style={{ background: 'var(--sd-vital-500)' }}/>Grasas</div>
              <div className="macro__value">{totals.g.toFixed(1)}<span className="unit">g</span></div>
              <div className="macro__bar"><span style={{ width: `${Math.min(100, (totals.g / macroTarget.g) * 100)}%`, background: 'var(--sd-vital-500)' }}/></div>
              <div className="macro__target">meta {macroTarget.g.toFixed(0)} g</div>
            </div>
          </div>
        </div>

        {/* ===== Right: plate contents ===== */}
        <div className="plate-side">
          <div className="plate-side__head">
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-strong)' }}>Composición del plato</div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>{currentPlate.length} alimento{currentPlate.length !== 1 ? 's' : ''}</div>
            </div>
            <button className="btn btn-ghost sm" onClick={clearPlate} disabled={currentPlate.length === 0}><Icon name="trash" size={13}/></button>
          </div>

          <div className="plate-list">
            {currentPlate.length === 0 && (
              <div className="empty-state">
                <Icon name="utensils" size={28}/>
                <div>Plato vacío</div>
                <div style={{ fontSize: 11.5, marginTop: 4 }}>Arrastra alimentos desde la izquierda</div>
              </div>
            )}
            {currentPlate.map(item => {
              const food = FOODS.find(f => f.id === item.foodId);
              if (!food) return null;
              return (
                <div key={item.foodId} className="plate-row">
                  <div className="plate-row__emoji"><FoodIcon id={food.id} size={24}/></div>
                  <div style={{ minWidth: 0 }}>
                    <div className="plate-row__name">{food.name}</div>
                    <div className="plate-row__sub">{Math.round(food.kcal * item.qty)} kcal · {food.portion}</div>
                  </div>
                  <div className="plate-row__qty">
                    <button onClick={() => updateQty(item.foodId, -0.5)}>−</button>
                    <span>{item.qty}</span>
                    <button onClick={() => updateQty(item.foodId, 0.5)}>+</button>
                  </div>
                  <button className="plate-row__del" onClick={() => setShowSubs(item.foodId)} title="Ver sustituciones"><Icon name="refresh" size={13}/></button>
                </div>
              );
            })}
          </div>

          {currentPlate.length > 0 && (
            <div className="subs">
              <div className="subs__title">Sugerencia de equilibrio</div>
              <div style={{ fontSize: 12, color: 'var(--fg-default)', lineHeight: 1.5 }}>
                {totals.kcal > mealTarget * 1.15
                  ? `Plato excede en ${Math.round(totals.kcal - mealTarget)} kcal. Reducir carbohidratos.`
                  : totals.p < macroTarget.p * 0.6
                  ? 'Bajo en proteína. Agregue pollo, pescado, frijoles o huevo.'
                  : totals.c > macroTarget.c * 1.2
                  ? 'Alto en carbohidratos. Reduzca ½ porción de arroz/pasta.'
                  : '✓ Plato balanceado según método del plato.'}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: '1px solid var(--border-soft)' }}>
            <button className="btn btn-secondary sm" style={{ flex: 1 }} onClick={() => setShowSaveModal(true)}><Icon name="bookmark" size={13}/> Guardar como plantilla</button>
            <button className="btn btn-primary sm" style={{ flex: 1 }} onClick={() => toast.push('Plan del día guardado')}><Icon name="save" size={13}/> Guardar plan</button>
          </div>
        </div>
      </div>

      {showSubs && <SubstitutionsModal foodId={showSubs} onClose={() => setShowSubs(null)} onPick={(fid) => {
        // replace foodId in plate
        setPlates(p => ({ ...p, [activeMeal]: p[activeMeal].map(it => it.foodId === showSubs ? { ...it, foodId: fid } : it) }));
        setShowSubs(null);
        toast.push('Alimento sustituido');
      }}/>}
      {showSaveModal && <SavePlateModal mealLabel={MEALS.find(m => m.id === activeMeal).label} onClose={() => setShowSaveModal(false)} onSave={() => { setShowSaveModal(false); toast.push('Plantilla guardada en biblioteca'); }}/>}
    </>
  );
};

/* ===== Substitutions modal ===== */
const SubstitutionsModal = ({ foodId, onClose, onPick }) => {
  const food = FOODS.find(f => f.id === foodId);
  if (!food) return null;
  const subIds = SUBSTITUTIONS[foodId] || FOODS.filter(f => f.cat === food.cat && f.id !== foodId).slice(0, 5).map(f => f.id);
  return (
    <Modal title={`Sustituciones — ${food.name}`} onClose={onClose} footer={<button className="btn btn-secondary" onClick={onClose}>Cerrar</button>}>
      <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginBottom: 14 }}>
        Alimentos con valor nutricional similar. Seleccione uno para reemplazar.
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {subIds.map(sid => {
          const s = FOODS.find(f => f.id === sid);
          if (!s) return null;
          return (
            <div key={sid} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto auto', gap: 12, alignItems: 'center', padding: 10, border: '1px solid var(--border-default)', borderRadius: 'var(--r-md)' }}>
              <div className="food-item__icon" style={{ width: 44, height: 44 }}><FoodIcon id={s.id} size={36}/></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-strong)' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{s.portion}</div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{s.kcal} kcal</div>
              <button className="btn btn-secondary sm" onClick={() => onPick(sid)}>Usar</button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

const SavePlateModal = ({ mealLabel, onClose, onSave }) => (
  <Modal title="Guardar como plantilla" onClose={onClose} footer={
    <>
      <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" onClick={onSave}>Guardar plantilla</button>
    </>
  }>
    <div className="stack" style={{ gap: 14 }}>
      <Field label="Nombre de la plantilla">
        <Input defaultValue={`${mealLabel} balanceado — Ana Cruz`}/>
      </Field>
      <Field label="Categoría">
        <Select defaultValue="diabetes">
          <option value="diabetes">Diabetes / control glucémico</option>
          <option>Pérdida de peso</option>
          <option>Cardioprotector</option>
          <option>Hipertensión</option>
          <option>General balanceado</option>
        </Select>
      </Field>
      <Field label="Notas internas">
        <Textarea placeholder="Útil para… / observaciones para reutilizar este plato"/>
      </Field>
      <Checkbox checked={true} onChange={() => {}} label="Compartir en biblioteca de la clínica"/>
    </div>
  </Modal>
);

/* ===== Plan semanal ===== */
const PlanSemanal = () => {
  const days = ['Lun 26', 'Mar 27', 'Mié 28', 'Jue 29', 'Vie 30', 'Sáb 31', 'Dom 1'];
  const mealRows = [
    { label: 'Desayuno', icon: 'clock', items: ['Avena con banano + queso fresco', 'Tortilla + huevo revuelto + frijoles', 'Avena + manzana + nueces', 'Tostada integral + aguacate + huevo', 'Yogur + papaya + granola', 'Pan integral + queso + frutas', 'Pancakes de avena + frutas'] },
    { label: 'Snack AM', icon: 'apple', items: ['Manzana + 10 almendras', 'Yogur natural', 'Banano + maní', 'Mango', 'Galletas integrales + queso', 'Papaya', 'Fresas + yogur'] },
    { label: 'Almuerzo', icon: 'utensils', items: ['Pollo plancha + arroz + ensalada', 'Pescado + yuca + brócoli', 'Casamiento + pollo + repollo', 'Pollo + camote + ensalada', 'Carne asada + arroz + tomate', 'Sopa de res + tortilla', 'Pollo en salsa + arroz + ensalada'] },
    { label: 'Snack PM', icon: 'apple', items: ['Piña', '2 galletas integrales', 'Hummus + zanahoria', 'Té + 1 fruta', 'Yogur + fresas', 'Sandía', 'Fruta picada'] },
    { label: 'Cena', icon: 'moon', items: ['Tortilla + frijoles + queso', 'Sopa de verduras + huevo', 'Ensalada con atún', 'Tortilla + pollo desmenuzado', 'Sopa de frijoles + tortilla', 'Pizza casera vegetal', 'Sopa de pollo + tortilla'] },
  ];

  return (
    <div className="week-plan">
      <div className="week-plan__hcell"></div>
      {days.map(d => <div key={d} className="week-plan__hcell">{d}</div>)}
      {mealRows.map(row => (
        <React.Fragment key={row.label}>
          <div className="week-plan__rcell">
            <Icon name={row.icon} size={14} style={{ color: 'var(--sd-blue-600)' }}/>
            <span>{row.label}</span>
          </div>
          {row.items.map((it, i) => (
            <div key={i} className="week-plan__cell">
              <div style={{ fontSize: 11.5, color: 'var(--fg-default)', lineHeight: 1.35 }}>{it}</div>
              <div className="week-plan__pill" style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>{300 + Math.floor(Math.random() * 250)} kcal</div>
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

window.TabPlan = TabPlan;
