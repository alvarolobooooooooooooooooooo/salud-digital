/* Tab: Evaluación dietética — Recordatorio 24h + Frecuencia de consumo */

const TabDieta = () => {
  const [view, setView] = React.useState('r24');
  return (
    <div className="stack" style={{ gap: 16 }}>
      <SecHeader
        title="Evaluación dietética"
        sub="Recordatorio de 24 horas y frecuencia de consumo de alimentos"
        actions={
          <Seg value={view} onChange={setView} options={[
            { value: 'r24', label: 'Recordatorio 24h' },
            { value: 'freq', label: 'Frecuencia consumo' },
          ]}/>
        }
      />

      {view === 'r24' ? <Recordatorio24h/> : <FrecuenciaConsumo/>}
    </div>
  );
};

const Recordatorio24h = () => {
  const meals = [
    {
      id: 'desayuno', label: 'Desayuno', time: '07:30', place: 'Casa',
      items: [
        { food: 'Café con leche entera', qty: '1 taza (240 ml)', kcal: 130 },
        { food: 'Pan dulce (semita)', qty: '1 pieza (60 g)', kcal: 250 },
        { food: 'Frijoles fritos', qty: '½ taza', kcal: 165 },
        { food: 'Mantequilla crema', qty: '1 cda', kcal: 50 },
      ],
    },
    {
      id: 'snack-am', label: 'Media mañana', time: '10:30', place: 'Oficina',
      items: [
        { food: 'Galletas de soda', qty: '6 unidades', kcal: 140 },
        { food: 'Café con azúcar', qty: '1 taza', kcal: 50 },
      ],
    },
    {
      id: 'almuerzo', label: 'Almuerzo', time: '13:15', place: 'Oficina (traído de casa)',
      items: [
        { food: 'Arroz blanco', qty: '1 taza', kcal: 260 },
        { food: 'Pollo guisado', qty: '120 g', kcal: 200 },
        { food: 'Tajadas de maduro', qty: '4 rodajas', kcal: 170 },
        { food: 'Ensalada de repollo', qty: '½ taza', kcal: 18 },
        { food: 'Refresco de cola', qty: '1 vaso (350 ml)', kcal: 140 },
      ],
    },
    {
      id: 'snack-pm', label: 'Tarde', time: '16:30', place: 'Oficina',
      items: [
        { food: 'Tortillitas con queso', qty: '2 unidades', kcal: 220 },
      ],
    },
    {
      id: 'cena', label: 'Cena', time: '20:00', place: 'Casa',
      items: [
        { food: 'Baleada mixta (huevo)', qty: '1 unidad', kcal: 480 },
        { food: 'Banano', qty: '1 unidad', kcal: 105 },
      ],
    },
  ];

  const totalKcal = meals.reduce((a, m) => a + m.items.reduce((x, i) => x + i.kcal, 0), 0);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card title="Recordatorio del día anterior — lunes 20 may 2026" icon="clock"
          actions={<><button className="btn btn-secondary sm"><Icon name="copy" size={13}/> Duplicar día</button><button className="btn btn-primary sm"><Icon name="plus" size={13}/> Agregar comida</button></>}>
          <div className="stack" style={{ gap: 12 }}>
            {meals.map((m) => {
              const k = m.items.reduce((a, i) => a + i.kcal, 0);
              return (
                <div key={m.id} style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--sd-ink-50)', borderBottom: '1px solid var(--border-default)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)', fontWeight: 600 }}>{m.time}</div>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--fg-strong)' }}>{m.label}</div>
                      <Chip>{m.place}</Chip>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600, color: 'var(--sd-navy-700)' }}>{k} kcal</div>
                  </div>
                  <div>
                    {m.items.map((it, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, alignItems: 'center', padding: '10px 14px', borderBottom: i === m.items.length - 1 ? 0 : '1px solid var(--border-soft)' }}>
                        <div style={{ fontSize: 13 }}>{it.food}</div>
                        <div style={{ fontSize: 12, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{it.qty}</div>
                        <div style={{ fontSize: 12, color: 'var(--fg-strong)', fontFamily: 'var(--font-mono)', fontWeight: 600, minWidth: 60, textAlign: 'right' }}>{it.kcal} kcal</div>
                        <button className="btn btn-ghost sm" style={{ width: 26, padding: 0 }}><Icon name="more" size={13}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="stack" style={{ gap: 16, position: 'sticky', top: 0 }}>
          <Card title="Análisis del día" icon="sparkles">
            <Stat label="Energía total" value={totalKcal.toLocaleString('es-HN')} unit="kcal"/>
            <Notice kind="alert" icon="alert">
              <strong>Excede en {totalKcal - 1750} kcal</strong> la meta diaria recomendada (1,750 kcal).
            </Notice>

            <div style={{ marginTop: 12 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Distribución estimada</div>
              <div className="stack" style={{ gap: 8 }}>
                <MacroBar label="Carbohidratos" pct={62} target="45-55%" color="var(--sd-alert-500)" status="alto"/>
                <MacroBar label="Proteínas" pct={14} target="15-20%" color="var(--sd-blue-600)" status="bajo"/>
                <MacroBar label="Grasas" pct={24} target="25-30%" color="var(--sd-vital-500)" status="ok"/>
              </div>
            </div>

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Hallazgos clave</div>
              <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12.5, color: 'var(--fg-default)', lineHeight: 1.6 }}>
                <li>Alto consumo de carbohidratos refinados (pan, arroz, tajadas)</li>
                <li>Ingesta de azúcar agregada ≈ 48 g (refresco + pan dulce)</li>
                <li>Sin frutas ni vegetales frescos significativos</li>
                <li>Solo 3 g de fibra estimados (meta: ≥25 g)</li>
                <li>Cena tardía y densa en calorías (585 kcal)</li>
              </ul>
            </div>
          </Card>

          <Card title="Apetito y saciedad" icon="info" noPad>
            <div style={{ padding: '16px 20px' }}>
              <Field label="Apetito general">
                <Seg value="aum" onChange={() => {}} options={[
                  { value: 'dis', label: 'Disminuido' }, { value: 'norm', label: 'Normal' }, { value: 'aum', label: 'Aumentado' }
                ]}/>
              </Field>
              <Field label="¿Siente saciedad después de comer?" help="Escala 1 (nada) - 10 (totalmente)">
                <Input mono defaultValue="5"/>
              </Field>
              <Field label="Antojos frecuentes">
                <Input defaultValue="Dulce y harinas en la tarde/noche"/>
              </Field>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

const MacroBar = ({ label, pct, target, color, status }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, marginBottom: 4 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>{pct}% · meta {target}</span>
    </div>
    <div className="macro__bar"><span style={{ width: `${pct}%`, background: color }}/></div>
  </div>
);

const FrecuenciaConsumo = () => {
  const groups = [
    {
      group: 'Cereales y derivados',
      items: ['Tortilla de maíz', 'Tortilla de harina', 'Arroz blanco', 'Pan francés / dulce', 'Pasta', 'Avena', 'Cereales de caja']
    },
    {
      group: 'Tubérculos y plátanos',
      items: ['Yuca', 'Camote', 'Plátano verde (cocido)', 'Plátano maduro (tajadas)', 'Papa']
    },
    {
      group: 'Leguminosas',
      items: ['Frijoles rojos', 'Frijoles negros', 'Garbanzos', 'Lentejas']
    },
    {
      group: 'Carnes y huevo',
      items: ['Pollo', 'Carne de res', 'Carne de cerdo', 'Pescado / mariscos', 'Embutidos (chorizo, jamón)', 'Huevo']
    },
    {
      group: 'Lácteos',
      items: ['Leche entera', 'Leche descremada', 'Queso fresco / cuajada', 'Yogur', 'Mantequilla crema']
    },
    {
      group: 'Frutas',
      items: ['Banano', 'Mango', 'Papaya', 'Sandía', 'Piña', 'Naranja / mandarina', 'Manzana']
    },
    {
      group: 'Verduras',
      items: ['Tomate', 'Lechuga / repollo', 'Zanahoria', 'Pepino', 'Brócoli / coliflor', 'Chile dulce', 'Ayote / pipián']
    },
    {
      group: 'Grasas y aceites',
      items: ['Aguacate', 'Aceite vegetal', 'Manteca / mantequilla', 'Maní / nueces']
    },
    {
      group: 'Azúcares y otros',
      items: ['Azúcar blanca / panela', 'Refresco de cola', 'Jugos envasados', 'Café', 'Comida rápida', 'Snacks (papas, churros)', 'Postres / repostería']
    },
  ];

  const freqLabels = ['Nunca', '1x mes', '2-3 mes', '1x sem', '2-4 sem', 'Diario', '≥2x día'];

  return (
    <Card title="Cuestionario de frecuencia de consumo" icon="list" sub="Marque la frecuencia con la que el paciente consume cada alimento">
      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 240 }}>Alimento</th>
              {freqLabels.map(f => <th key={f} style={{ textAlign: 'center', minWidth: 64 }}>{f}</th>)}
              <th style={{ minWidth: 130 }}>Porción típica</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <React.Fragment key={g.group}>
                <tr>
                  <td colSpan={freqLabels.length + 2} style={{ background: 'var(--sd-blue-50)', fontWeight: 700, fontSize: 11.5, color: 'var(--sd-navy-700)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 12px' }}>
                    {g.group}
                  </td>
                </tr>
                {g.items.map((item, idx) => {
                  // pre-fill a "typical" mark
                  const mark = Math.floor((item.length * 7) % 7);
                  return (
                    <tr key={item}>
                      <td style={{ fontSize: 12.5 }}>{item}</td>
                      {freqLabels.map((_, i) => (
                        <td key={i} style={{ padding: '8px 4px' }}>
                          <div className="freq-cell">
                            <div className={`freq-dot ${mark === i ? 'on' : ''}`}/>
                          </div>
                        </td>
                      ))}
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>—</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

window.TabDieta = TabDieta;
