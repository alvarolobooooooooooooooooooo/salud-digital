/* Tab: Antropometría — peso, talla, IMC, GET, pliegues, circunferencias, evolución */

const TabAntropometria = () => {
  const [weight, setWeight] = React.useState(74.8);
  const [height, setHeight] = React.useState(162);
  const [age, setAge] = React.useState(34);
  const [sex, setSex] = React.useState('F');
  const [activity, setActivity] = React.useState(1.375);
  const [formula, setFormula] = React.useState('mifflin');

  // IMC
  const imc = weight / Math.pow(height / 100, 2);
  const imcRound = imc.toFixed(1);
  const imcStatus = imc < 18.5 ? { label: 'Bajo peso', color: 'var(--sd-blue-500)' }
    : imc < 25 ? { label: 'Peso normal', color: 'var(--sd-vital-600)' }
    : imc < 30 ? { label: 'Sobrepeso', color: 'var(--sd-alert-600)' }
    : imc < 35 ? { label: 'Obesidad I', color: 'var(--sd-critical-500)' }
    : imc < 40 ? { label: 'Obesidad II', color: 'var(--sd-critical-600)' }
    : { label: 'Obesidad III', color: 'var(--sd-critical-600)' };

  // GEB
  const geb = formula === 'mifflin'
    ? (sex === 'F'
        ? 10 * weight + 6.25 * height - 5 * age - 161
        : 10 * weight + 6.25 * height - 5 * age + 5)
    : (sex === 'F'
        ? 655.1 + 9.563 * weight + 1.85 * height - 4.676 * age
        : 66.5 + 13.75 * weight + 5.003 * height - 6.775 * age);
  const get = geb * activity;

  // Peso ideal (Lorentz / Broca)
  const pesoIdeal = sex === 'F'
    ? (height - 100) - ((height - 150) / 2.5)
    : (height - 100) - ((height - 150) / 4);

  // Marker position on IMC meter (scale 15 to 40 → 0-100%)
  const markerPos = Math.max(0, Math.min(100, ((imc - 15) / 25) * 100));

  // Mock chart data: weight history
  const weightHistory = [
    { date: 'Mar 14', w: 78.0 }, { date: 'Mar 28', w: 77.4 },
    { date: 'Abr 11', w: 76.4 }, { date: 'Abr 25', w: 75.7 },
    { date: 'May 9', w: 75.0 }, { date: 'May 21', w: 74.8 },
  ];

  return (
    <div className="stack" style={{ gap: 16 }}>
      <SecHeader
        title="Antropometría y composición corporal"
        sub="Mediciones del 21 may 2026 · paciente sin calzado, ropa ligera"
        actions={<>
          <button className="btn btn-secondary"><Icon name="copy" size={14}/> Copiar de última</button>
          <button className="btn btn-primary"><Icon name="save" size={14}/> Guardar medición</button>
        </>}
      />

      {/* Quick stats row */}
      <div className="grid grid-4">
        <Card>
          <Stat label="Peso actual" value={weight.toFixed(1)} unit="kg" delta="−3.2 kg · 68 días" deltaDir="down"/>
        </Card>
        <Card>
          <Stat label="Talla" value={height} unit="cm" delta="Estable" deltaDir="flat"/>
        </Card>
        <Card>
          <Stat label="IMC" value={imcRound} unit="kg/m²"/>
          <div style={{ fontSize: 12, color: imcStatus.color, fontWeight: 600, marginTop: 4 }}>● {imcStatus.label}</div>
        </Card>
        <Card>
          <Stat label="Peso ideal teórico" value={pesoIdeal.toFixed(1)} unit="kg" delta={`Diferencia: ${(weight - pesoIdeal).toFixed(1)} kg`} deltaDir="flat"/>
        </Card>
      </div>

      {/* Medición + IMC chart */}
      <div className="grid" style={{ gridTemplateColumns: '1.1fr 1fr', gap: 16 }}>
        <Card title="Medición actual" icon="scale" sub="Edite cualquier campo y los cálculos se actualizan en vivo">
          <div className="grid grid-2" style={{ gap: 12 }}>
            <Field label="Peso" required>
              <Input type="number" value={weight} step="0.1" suffix="kg" mono onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}/>
            </Field>
            <Field label="Talla" required>
              <Input type="number" value={height} suffix="cm" mono onChange={(e) => setHeight(parseFloat(e.target.value) || 0)}/>
            </Field>
            <Field label="Edad" required>
              <Input type="number" value={age} suffix="años" mono onChange={(e) => setAge(parseInt(e.target.value) || 0)}/>
            </Field>
            <Field label="Sexo biológico">
              <Seg value={sex} onChange={setSex} options={[
                { value: 'F', label: 'Femenino' }, { value: 'M', label: 'Masculino' }
              ]}/>
            </Field>
            <Field label="Circunferencia cintura">
              <Input type="number" defaultValue="92" suffix="cm" mono/>
            </Field>
            <Field label="Circunferencia cadera">
              <Input type="number" defaultValue="108" suffix="cm" mono/>
            </Field>
            <Field label="Índice cintura/cadera" help="Mujeres: ideal < 0.85 · Hombres: < 0.90">
              <Input value="0.85" mono disabled/>
            </Field>
            <Field label="Circunferencia brazo">
              <Input type="number" defaultValue="30" suffix="cm" mono/>
            </Field>
          </div>
        </Card>

        <Card title="Clasificación IMC (OMS)" icon="target" sub={`${imcRound} kg/m² · ${imcStatus.label}`}>
          <div style={{ marginTop: 8, marginBottom: 20 }}>
            <div className="imc-meter">
              <div className="imc-meter__marker" style={{ left: `${markerPos}%` }}/>
            </div>
            <div className="imc-meter__labels">
              <span>15</span><span>18.5</span><span>25</span><span>30</span><span>40</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--sd-blue-300)' }}/>Bajo peso (&lt;18.5)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--sd-vital-500)' }}/>Normal (18.5-25)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--sd-alert-500)' }}/>Sobrepeso (25-30)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--sd-critical-500)' }}/>Obesidad (≥30)</div>
          </div>
          <Notice kind="info" icon="info">
            La paciente se encuentra en <strong>{imcStatus.label.toLowerCase()}</strong>.
            Recomendación: reducir 5-7% del peso corporal en 6 meses para mejorar perfil glucémico.
          </Notice>
        </Card>
      </div>

      {/* Pliegues + GET */}
      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <Card title="Pliegues cutáneos — método Durnin-Womersley (4 pliegues)" icon="dna">
          <div className="grid grid-4" style={{ gap: 12 }}>
            <Field label="Bicipital">
              <Input type="number" defaultValue="14" suffix="mm" mono/>
            </Field>
            <Field label="Tricipital">
              <Input type="number" defaultValue="22" suffix="mm" mono/>
            </Field>
            <Field label="Subescapular">
              <Input type="number" defaultValue="20" suffix="mm" mono/>
            </Field>
            <Field label="Suprailíaco">
              <Input type="number" defaultValue="24" suffix="mm" mono/>
            </Field>
          </div>
          <div className="grid grid-3" style={{ gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
            <Stat label="Suma de pliegues" value="80" unit="mm"/>
            <Stat label="% Grasa corporal" value="34.1" unit="%" delta="−1.8 pts" deltaDir="down"/>
            <Stat label="Masa magra" value="49.3" unit="kg"/>
          </div>
          <Notice kind="alert" icon="info">
            <strong>% Grasa elevado</strong> para mujer adulta (rango saludable 21-32%). Reducir junto con el peso total.
          </Notice>
        </Card>

        <Card
          title="Gasto energético"
          icon="fire"
          sub={`Fórmula ${formula === 'mifflin' ? 'Mifflin-St Jeor' : 'Harris-Benedict'}`}
          actions={
            <Seg value={formula} onChange={setFormula} options={[
              { value: 'mifflin', label: 'Mifflin' }, { value: 'harris', label: 'Harris' }
            ]}/>
          }
        >
          <Field label="Nivel de actividad física">
            <Select value={activity} onChange={(e) => setActivity(parseFloat(e.target.value))}>
              <option value="1.2">Sedentaria (oficina, sin ejercicio)</option>
              <option value="1.375">Ligera (1-3 días/sem ejercicio)</option>
              <option value="1.55">Moderada (3-5 días/sem)</option>
              <option value="1.725">Intensa (6-7 días/sem)</option>
              <option value="1.9">Muy intensa (trabajo físico + ejercicio)</option>
            </Select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
            <div style={{ padding: 14, background: 'var(--sd-ink-50)', borderRadius: 'var(--r-md)' }}>
              <div className="stat__label">GEB</div>
              <div className="stat__value" style={{ fontSize: 22 }}>{Math.round(geb)}<span className="unit">kcal/día</span></div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>Metabolismo basal</div>
            </div>
            <div style={{ padding: 14, background: 'var(--sd-blue-100)', borderRadius: 'var(--r-md)', border: '1px solid var(--sd-blue-200)' }}>
              <div className="stat__label" style={{ color: 'var(--sd-navy-700)' }}>GET</div>
              <div className="stat__value" style={{ fontSize: 22, color: 'var(--sd-navy-700)' }}>{Math.round(get)}<span className="unit" style={{ color: 'var(--sd-blue-700)' }}>kcal/día</span></div>
              <div style={{ fontSize: 11, color: 'var(--sd-blue-700)', marginTop: 4 }}>Gasto energético total</div>
            </div>
          </div>
          <Notice kind="info">
            Para pérdida de peso: <strong>{Math.round(get - 500)} kcal/día</strong> (déficit de 500 kcal ≈ 0.5 kg/semana).
          </Notice>
        </Card>
      </div>

      {/* Chart de evolución */}
      <Card
        title="Evolución del peso"
        icon="chart"
        actions={<Seg value="3m" onChange={() => {}} options={[
          { value: '1m', label: '1 mes' }, { value: '3m', label: '3 meses' }, { value: 'all', label: 'Todo' }
        ]}/>}
      >
        <WeightChart data={weightHistory} target={70}/>
      </Card>
    </div>
  );
};

const WeightChart = ({ data, target }) => {
  const w = 800, h = 240;
  const pad = { l: 50, r: 20, t: 20, b: 30 };
  const maxW = Math.max(...data.map(d => d.w), target) + 1;
  const minW = Math.min(...data.map(d => d.w), target) - 1;
  const range = maxW - minW;
  const x = (i) => pad.l + (i / (data.length - 1)) * (w - pad.l - pad.r);
  const y = (val) => pad.t + (1 - (val - minW) / range) * (h - pad.t - pad.b);
  const pts = data.map((d, i) => `${x(i)},${y(d.w)}`).join(' ');
  const areaPts = `${x(0)},${h - pad.b} ${pts} ${x(data.length - 1)},${h - pad.b}`;
  const ticks = 4;

  return (
    <div className="chart-area" style={{ height: h }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
        <defs>
          <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--sd-blue-500)" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="var(--sd-blue-500)" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {/* Y grid */}
        {Array.from({ length: ticks }).map((_, i) => {
          const val = minW + (range * (ticks - 1 - i)) / (ticks - 1);
          return (
            <g key={i}>
              <line x1={pad.l} x2={w - pad.r} y1={y(val)} y2={y(val)} stroke="var(--sd-ink-150)" strokeWidth="1"/>
              <text x={pad.l - 8} y={y(val) + 4} fill="var(--fg-muted)" fontSize="10" textAnchor="end" fontFamily="var(--font-mono)">{val.toFixed(1)}</text>
            </g>
          );
        })}
        {/* Target line */}
        <line x1={pad.l} x2={w - pad.r} y1={y(target)} y2={y(target)} stroke="var(--sd-vital-500)" strokeWidth="1.5" strokeDasharray="4 4"/>
        <text x={w - pad.r} y={y(target) - 6} fill="var(--sd-vital-600)" fontSize="10.5" fontWeight="600" textAnchor="end">Objetivo: {target} kg</text>
        {/* Area */}
        <polygon points={areaPts} fill="url(#weightGrad)"/>
        {/* Line */}
        <polyline points={pts} fill="none" stroke="var(--sd-blue-600)" strokeWidth="2.5" strokeLinejoin="round"/>
        {/* Points */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.w)} r="5" fill="#fff" stroke="var(--sd-blue-600)" strokeWidth="2.5"/>
            <text x={x(i)} y={y(d.w) - 12} fill="var(--fg-strong)" fontSize="10.5" fontWeight="600" textAnchor="middle" fontFamily="var(--font-mono)">{d.w}</text>
            <text x={x(i)} y={h - 8} fill="var(--fg-muted)" fontSize="10.5" textAnchor="middle">{d.date}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

window.TabAntropometria = TabAntropometria;
