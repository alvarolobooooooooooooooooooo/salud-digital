/* Tab: Seguimiento — histórico, evolución y receta imprimible */

const TabSeguimiento = () => {
  const [view, setView] = React.useState('historico');
  return (
    <div className="stack" style={{ gap: 16 }}>
      <SecHeader
        title="Seguimiento y receta"
        sub="Consultas previas · evolución de medidas · receta y plan imprimible"
        actions={
          <Seg value={view} onChange={setView} options={[
            { value: 'historico', label: 'Histórico' },
            { value: 'evolucion', label: 'Evolución' },
            { value: 'receta', label: 'Receta imprimible' },
          ]}/>
        }
      />

      {view === 'historico' && <Historico/>}
      {view === 'evolucion' && <Evolucion/>}
      {view === 'receta' && <RecetaImprimible/>}
    </div>
  );
};

const Historico = () => {
  const consultas = [
    {
      date: '9 may 2026', n: 4, type: 'Control mensual',
      summary: 'Buena adherencia al plan (86%). Reducción de 1.6 kg en 4 sem. Ajuste de objetivos para perfil glucémico.',
      changes: ['Peso: 76.4 → 74.8 kg', '% Grasa: 35.5 → 34.1%', 'Cintura: 95 → 92 cm']
    },
    {
      date: '11 abr 2026', n: 3, type: 'Evaluación dietética',
      summary: 'Recordatorio 24h reveló alto consumo de carbohidratos refinados en la cena. Bioquímica con glucosa en ayunas elevada (118 mg/dL).',
      changes: ['Diagnóstico: prediabetes confirmada', 'Ajuste de plan: limitar harinas refinadas en la noche']
    },
    {
      date: '28 mar 2026', n: 2, type: 'Seguimiento inicial',
      summary: 'Adherencia parcial. Refiere dificultad en mantener desayuno completo. Educación sobre porciones.',
      changes: ['Peso: 77.4 → 76.8 kg', 'Entrega material educativo método del plato']
    },
    {
      date: '14 mar 2026', n: 1, type: 'Primera consulta',
      summary: 'Paciente referida por endocrinología. Antropometría inicial y plan nutricional base. Solicitud de laboratorios completos.',
      changes: ['Peso inicial: 78.0 kg', 'IMC: 29.7', 'Plan inicial: 1,800 kcal hipocalórica']
    },
  ];

  return (
    <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 16 }}>
      <Card title="Línea de tiempo de consultas" icon="history" noPad>
        <div style={{ padding: '0 4px' }}>
          {consultas.map((c, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 14, padding: '18px 20px', borderBottom: i === consultas.length - 1 ? 0 : '1px solid var(--border-soft)' }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 999,
                  background: i === 0 ? 'var(--sd-blue-600)' : 'var(--sd-blue-100)',
                  color: i === 0 ? '#fff' : 'var(--sd-navy-700)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-display)'
                }}>{c.n}</div>
                {i !== consultas.length - 1 && (
                  <div style={{ position: 'absolute', top: 44, left: 19, bottom: -18, width: 2, background: 'var(--border-soft)' }}/>
                )}
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-strong)' }}>{c.type}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{c.date}</div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--fg-default)', lineHeight: 1.5, marginBottom: 10 }}>{c.summary}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {c.changes.map((ch, j) => <span key={j} className="tag tag--blue">{ch}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="stack" style={{ gap: 16 }}>
        <Card title="Resumen del progreso" icon="sparkles">
          <div className="stack" style={{ gap: 12 }}>
            <div style={{ padding: 12, background: 'var(--sd-vital-100)', borderRadius: 'var(--r-md)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--sd-vital-600)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Logros</div>
              <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: 12.5, lineHeight: 1.5 }}>
                <li>Pérdida del 4.1% del peso inicial</li>
                <li>Reducción de 3 cm en cintura</li>
                <li>HbA1c bajó de 7.1% a 6.7%</li>
                <li>Eliminó refrescos azucarados en el desayuno</li>
              </ul>
            </div>
            <div style={{ padding: 12, background: 'var(--sd-alert-100)', borderRadius: 'var(--r-md)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--sd-alert-600)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pendientes</div>
              <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: 12.5, lineHeight: 1.5 }}>
                <li>Incrementar consumo de agua a 2 L/día</li>
                <li>Mantener 3 sesiones de actividad/semana</li>
                <li>Mejorar calidad del sueño (6.4 → 7.5 h)</li>
              </ul>
            </div>
          </div>
        </Card>

        <Card title="Documentos adjuntos" icon="paperclip">
          <div className="stack" style={{ gap: 6 }}>
            {[
              { name: 'Laboratorios_12may2026.pdf', size: '342 KB' },
              { name: 'Plan_nutricional_v3.pdf', size: '128 KB' },
              { name: 'Foto_frente_21may.jpg', size: '1.2 MB' },
              { name: 'Foto_perfil_21may.jpg', size: '1.4 MB' },
              { name: 'Cuestionario_inicial.pdf', size: '89 KB' },
            ].map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--r-md)' }}>
                <Icon name="fileText" size={16} style={{ color: 'var(--sd-blue-600)' }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-muted)' }}>{d.size}</div>
                </div>
                <button className="btn btn-ghost sm" style={{ width: 28, padding: 0 }}><Icon name="download" size={13}/></button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

const Evolucion = () => {
  const data = {
    weight: [78.0, 77.4, 76.8, 76.4, 75.7, 75.0, 74.8],
    cintura: [98, 96, 95, 95, 94, 93, 92],
    grasa: [37.2, 36.5, 35.9, 35.5, 34.8, 34.4, 34.1],
    glucosa: [128, null, null, 118, null, null, null],
    labels: ['14 mar', '28 mar', '11 abr', '25 abr', '9 may', '16 may', '21 may'],
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-3">
        <EvoCard label="Peso" unit="kg" data={data.weight} labels={data.labels} target={70} color="var(--sd-blue-600)"/>
        <EvoCard label="Cintura" unit="cm" data={data.cintura} labels={data.labels} target={88} color="var(--sd-alert-500)"/>
        <EvoCard label="% Grasa" unit="%" data={data.grasa} labels={data.labels} target={30} color="var(--sd-vital-500)"/>
      </div>

      <Card title="Comparativa antropométrica" icon="users">
        <table className="table">
          <thead>
            <tr>
              <th>Parámetro</th>
              <th>Inicial</th>
              <th>Actual</th>
              <th>Cambio</th>
              <th>Meta</th>
              <th>Progreso</th>
            </tr>
          </thead>
          <tbody>
            {[
              { p: 'Peso', i: '78.0 kg', a: '74.8 kg', d: '−3.2 kg', m: '69.8 kg', pr: 39 },
              { p: 'IMC', i: '29.7', a: '28.5', d: '−1.2', m: '26.6', pr: 39 },
              { p: '% Grasa', i: '37.2%', a: '34.1%', d: '−3.1 pts', m: '30%', pr: 43 },
              { p: 'Cintura', i: '98 cm', a: '92 cm', d: '−6 cm', m: '88 cm', pr: 60 },
              { p: 'Glucosa ayuno', i: '128 mg/dL', a: '118 mg/dL', d: '−10 mg/dL', m: '<100', pr: 36 },
              { p: 'HbA1c', i: '7.1%', a: '6.7%', d: '−0.4%', m: '<6.0%', pr: 36 },
              { p: 'Triglicéridos', i: '230 mg/dL', a: '190 mg/dL', d: '−40 mg/dL', m: '<150', pr: 50 },
            ].map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{r.p}</td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>{r.i}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.a}</td>
                <td><span className="tag tag--green"><Icon name="arrowDown" size={11}/>{r.d}</span></td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>{r.m}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--sd-ink-100)', borderRadius: 999, minWidth: 80 }}>
                      <div style={{ width: `${r.pr}%`, height: '100%', background: 'var(--sd-blue-600)', borderRadius: 999 }}/>
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', fontWeight: 600 }}>{r.pr}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-2">
        <Card title="Fotografía de seguimiento" icon="user">
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div>
              <div style={{ aspectRatio: '3/4', background: 'linear-gradient(180deg, var(--sd-blue-100), var(--sd-ink-150))', borderRadius: 'var(--r-md)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="user" size={64} style={{ color: 'var(--sd-blue-300)' }}/>
                <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(11,20,36,0.7)', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 4 }}>14 MAR · 78 KG</span>
              </div>
              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--fg-muted)', marginTop: 6, fontWeight: 600 }}>Frente — inicial</div>
            </div>
            <div>
              <div style={{ aspectRatio: '3/4', background: 'linear-gradient(180deg, var(--sd-vital-100), var(--sd-ink-150))', borderRadius: 'var(--r-md)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="user" size={64} style={{ color: 'var(--sd-vital-500)' }}/>
                <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(11,20,36,0.7)', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 4 }}>21 MAY · 74.8 KG</span>
              </div>
              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--fg-muted)', marginTop: 6, fontWeight: 600 }}>Frente — actual</div>
            </div>
          </div>
          <button className="btn btn-secondary sm" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}><Icon name="plus" size={13}/> Agregar fotografía</button>
        </Card>

        <Card title="Adherencia al plan (8 semanas)" icon="chart">
          <AdhBars/>
        </Card>
      </div>
    </div>
  );
};

const EvoCard = ({ label, unit, data, labels, target, color }) => {
  const w = 280, h = 90;
  const valid = data.filter(d => d !== null);
  const max = Math.max(...valid, target) + 0.5;
  const min = Math.min(...valid, target) - 0.5;
  const x = (i) => (i / (data.length - 1)) * w;
  const y = (v) => h - ((v - min) / (max - min)) * h;
  const last = valid[valid.length - 1];
  const first = valid[0];
  const delta = last - first;
  const points = data.map((v, i) => v === null ? null : `${x(i)},${y(v)}`).filter(Boolean).join(' ');

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="stat__label">{label}</div>
        <span className={`stat__delta ${delta < 0 ? 'down' : 'up'}`} style={{ fontSize: 11 }}>
          <Icon name={delta < 0 ? 'arrowDown' : 'arrowUp'} size={11}/>{Math.abs(delta).toFixed(1)} {unit}
        </span>
      </div>
      <div className="stat__value" style={{ fontSize: 22 }}>{last}<span className="unit">{unit}</span></div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ marginTop: 8 }} preserveAspectRatio="none">
        <line x1="0" x2={w} y1={y(target)} y2={y(target)} stroke="var(--border-strong)" strokeDasharray="3 3"/>
        <polyline points={points} fill="none" stroke={color} strokeWidth="2"/>
        {data.map((v, i) => v !== null && (
          <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="#fff" stroke={color} strokeWidth="2"/>
        ))}
      </svg>
      <div style={{ fontSize: 10.5, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', marginTop: 4, textAlign: 'right' }}>meta: {target} {unit}</div>
    </Card>
  );
};

const AdhBars = () => {
  const weeks = [62, 70, 75, 71, 80, 78, 84, 86];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 180, padding: '8px 0' }}>
      {weeks.map((p, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--fg-muted)' }}>{p}%</div>
          <div style={{ width: '100%', height: `${p * 1.4}px`, background: p >= 80 ? 'var(--sd-vital-500)' : p >= 70 ? 'var(--sd-blue-500)' : 'var(--sd-alert-500)', borderRadius: '6px 6px 0 0', transition: 'all .3s' }}/>
          <div style={{ fontSize: 10, color: 'var(--fg-muted)' }}>S{i+1}</div>
        </div>
      ))}
    </div>
  );
};

/* ===== Receta imprimible ===== */
const RecetaImprimible = () => {
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-secondary"><Icon name="copy" size={14}/> Copiar de plantilla</button>
        <button className="btn btn-secondary"><Icon name="download" size={14}/> Descargar PDF</button>
        <button className="btn btn-primary" onClick={() => window.print()}><Icon name="printer" size={14}/> Imprimir</button>
      </div>

      <div className="recipe-page">
        <div className="recipe-page__head">
          <div>
            <div className="recipe-page__sub">Indicaciones nutricionales</div>
            <div className="recipe-page__title">Plan alimentario individualizado</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <img src="assets/logo-lockup.svg" style={{ height: 32 }}/>
            <div style={{ fontSize: 10, color: 'var(--fg-muted)', marginTop: 4 }}>Folio: <span style={{ fontFamily: 'var(--font-mono)' }}>SD-2026-04321</span></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 24, fontSize: 13 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Paciente</div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>Ana Lucía Cruz Mejía</div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>34 años · F · ID 0501-1991-04321</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fecha</div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>21 de mayo, 2026</div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>San Pedro Sula, Honduras</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Próxima cita</div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>4 de junio, 9:30 AM</div>
          </div>
        </div>

        <Section title="Diagnóstico nutricional">
          <p style={{ margin: 0, lineHeight: 1.6 }}>Sobrepeso (IMC 28.5 kg/m²) asociado a glucemia alterada en ayunas (118 mg/dL) y HbA1c 6.7%. Patrón alimentario alto en carbohidratos refinados y bajo en proteína de calidad y fibra. Carga familiar significativa para diabetes y enfermedad cardiovascular.</p>
        </Section>

        <Section title="Objetivos">
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
            <li>Reducir 5 kg en 16 semanas (meta: 69.8 kg).</li>
            <li>Mantener glucosa en ayunas &lt;100 mg/dL en 12 semanas.</li>
            <li>Incrementar consumo de agua a 2.0 L/día.</li>
            <li>Realizar 3 sesiones de actividad física semanales (40 min).</li>
          </ol>
        </Section>

        <Section title="Distribución calórica (1,750 kcal / día)">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <DistChip label="Carbohidratos" pct="45%" g="197 g" color="var(--sd-alert-500)"/>
            <DistChip label="Proteínas" pct="25%" g="109 g" color="var(--sd-blue-600)"/>
            <DistChip label="Grasas" pct="30%" g="58 g" color="var(--sd-vital-500)"/>
          </div>
        </Section>

        <Section title="Plan alimentario diario">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--sd-navy-700)' }}>
                <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 11, color: 'var(--sd-navy-700)', textTransform: 'uppercase', letterSpacing: '0.06em', width: 110 }}>Tiempo</th>
                <th style={{ textAlign: 'left', padding: '6px 0', fontSize: 11, color: 'var(--sd-navy-700)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sugerencia</th>
                <th style={{ textAlign: 'right', padding: '6px 0', fontSize: 11, color: 'var(--sd-navy-700)', textTransform: 'uppercase', letterSpacing: '0.06em', width: 80 }}>Kcal</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Desayuno 7:00', '½ taza de avena cocida en agua + 1 banano + 1 cda de mantequilla de maní + 1 huevo cocido + café sin azúcar.', 380],
                ['Snack 10:30', '1 manzana mediana + 10 almendras.', 150],
                ['Almuerzo 13:00', '100 g de pollo a la plancha + ½ taza de arroz integral + 1 taza de ensalada mixta con 1 cda de aceite de oliva + ½ aguacate.', 580],
                ['Snack 16:30', '1 taza de papaya + 1 yogur natural descremado.', 150],
                ['Cena 19:30', '1 tortilla de maíz + ½ taza de frijoles cocidos + 30 g de queso fresco + 1 taza de sopa de verduras.', 440],
              ].map(([t, s, k], i) => (
                <tr key={i} style={{ borderBottom: '1px dashed var(--border-soft)' }}>
                  <td style={{ padding: '10px 0', fontWeight: 600, verticalAlign: 'top' }}>{t}</td>
                  <td style={{ padding: '10px 0', lineHeight: 1.5 }}>{s}</td>
                  <td style={{ padding: '10px 0', fontFamily: 'var(--font-mono)', textAlign: 'right', verticalAlign: 'top', fontWeight: 600 }}>{k}</td>
                </tr>
              ))}
              <tr>
                <td colSpan="2" style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700 }}>Total diario</td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--sd-navy-700)' }}>1,700 kcal</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section title="Recomendaciones generales">
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Beba <strong>2.0 L de agua simple</strong> distribuidos durante el día.</li>
            <li>Evite refrescos azucarados, jugos envasados y bebidas con azúcar agregada.</li>
            <li>Limite tajadas, tortilla de harina y pan dulce a máximo 1 vez por semana.</li>
            <li>Prefiera <strong>preparaciones a la plancha, al horno o hervidas</strong> sobre frituras.</li>
            <li>Mastique despacio. Tiempo mínimo por comida: 20 minutos.</li>
            <li>No saltarse comidas — cada tiempo es importante para controlar la glucosa.</li>
            <li>Caminar 30 minutos después de almuerzo y cena.</li>
          </ul>
        </Section>

        <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid var(--border-default)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
          <div>
            <div style={{ height: 50, borderBottom: '1px solid var(--fg-strong)' }}></div>
            <div style={{ fontSize: 11.5, marginTop: 6, fontWeight: 600 }}>Lic. María José Andino, MSN</div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-muted)' }}>Nutricionista Clínica · Reg. Col. Profesional 8421</div>
          </div>
          <div>
            <div style={{ height: 50, borderBottom: '1px solid var(--fg-strong)' }}></div>
            <div style={{ fontSize: 11.5, marginTop: 6, fontWeight: 600 }}>Firma del paciente</div>
            <div style={{ fontSize: 10.5, color: 'var(--fg-muted)' }}>Recibí indicaciones y comprendí el plan</div>
          </div>
        </div>

        <div style={{ marginTop: 24, fontSize: 9.5, color: 'var(--fg-muted)', textAlign: 'center', borderTop: '1px solid var(--border-soft)', paddingTop: 12 }}>
          Salud Digital · Edificio Médico Mall Galerías, San Pedro Sula, Cortés · Tel. +504 2552-0000 · contacto@saluddigital.hn
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--sd-navy-700)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border-soft)' }}>{title}</div>
    <div style={{ fontSize: 12.5 }}>{children}</div>
  </div>
);

const DistChip = ({ label, pct, g, color }) => (
  <div style={{ padding: 12, border: `1.5px solid ${color}`, borderRadius: 'var(--r-md)' }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, marginTop: 2 }}>{pct}</div>
    <div style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)' }}>{g}/día</div>
  </div>
);

window.TabSeguimiento = TabSeguimiento;
