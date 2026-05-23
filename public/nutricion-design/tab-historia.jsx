/* Tab: Historia clínica — datos personales, antecedentes, medicamentos, bioquímica */

const TabHistoria = () => {
  return (
    <div className="stack" style={{ gap: 16 }}>
      <SecHeader
        title="Historia clínica"
        sub="Datos personales · antecedentes médicos y familiares · medicamentos · bioquímica"
        actions={<>
          <button className="btn btn-secondary"><Icon name="paperclip" size={14}/> Adjuntar laboratorios</button>
          <button className="btn btn-primary"><Icon name="save" size={14}/> Guardar cambios</button>
        </>}
      />

      {/* Datos personales */}
      <Card title="Datos personales" icon="user">
        <div className="grid grid-3" style={{ gap: 14 }}>
          <Field label="Primer nombre" required><Input defaultValue="Ana"/></Field>
          <Field label="Segundo nombre"><Input defaultValue="Lucía"/></Field>
          <Field label="Primer apellido" required><Input defaultValue="Cruz"/></Field>
          <Field label="Segundo apellido"><Input defaultValue="Mejía"/></Field>
          <Field label="Fecha de nacimiento" required><Input type="date" defaultValue="1991-09-14" mono/></Field>
          <Field label="Edad" help="Calculada automáticamente"><Input value="34 años" disabled mono/></Field>
          <Field label="Sexo biológico" required>
            <Seg value="F" onChange={() => {}} options={[{value:'F',label:'Femenino'},{value:'M',label:'Masculino'}]}/>
          </Field>
          <Field label="Estado civil"><Select defaultValue="casada"><option value="soltera">Soltera</option><option value="casada">Casada</option><option value="union">Unión libre</option><option value="divorciada">Divorciada</option><option value="viuda">Viuda</option></Select></Field>
          <Field label="Escolaridad"><Select defaultValue="univ"><option>Primaria</option><option>Secundaria</option><option>Bachillerato</option><option value="univ">Universidad</option><option>Posgrado</option></Select></Field>
          <Field label="Ocupación"><Input defaultValue="Contadora pública"/></Field>
          <Field label="Identidad nacional" required help="13 dígitos · formato hondureño"><Input mono defaultValue="0501-1991-04321"/></Field>
          <Field label="RTN"><Input mono defaultValue="0501199104321"/></Field>
        </div>
      </Card>

      {/* Contacto */}
      <Card title="Contacto y dirección" icon="mapPin">
        <div className="grid grid-3" style={{ gap: 14 }}>
          <Field label="Teléfono móvil" required><Input mono defaultValue="+504 9876-5432"/></Field>
          <Field label="Teléfono fijo"><Input mono defaultValue="+504 2552-3344"/></Field>
          <Field label="Correo electrónico"><Input type="email" defaultValue="ana.cruz@correo.hn"/></Field>
          <Field label="Departamento" required>
            <Select defaultValue="cortes">
              <option value="atlantida">Atlántida</option>
              <option value="cortes">Cortés</option>
              <option value="fm">Francisco Morazán</option>
              <option value="copan">Copán</option>
              <option value="comayagua">Comayagua</option>
              <option value="other">Otro</option>
            </Select>
          </Field>
          <Field label="Municipio"><Input defaultValue="San Pedro Sula"/></Field>
          <Field label="Colonia / Barrio"><Input defaultValue="Colonia Trejo"/></Field>
          <Field label="Dirección completa" help="Calles, avenidas, referencias"><Input defaultValue="11 calle, 12 avenida NO, casa #245"/></Field>
          <Field label="Aseguradora / seguro"><Select defaultValue="ihss"><option value="particular">Particular</option><option value="ihss">IHSS</option><option value="palic">PALIC Seguros</option><option value="ficohsa">Ficohsa Seguros</option><option value="otro">Otro</option></Select></Field>
          <Field label="No. afiliación IHSS"><Input mono defaultValue="0501-91-04321"/></Field>
        </div>
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Contacto de emergencia</div>
          <div className="grid grid-3" style={{ gap: 14 }}>
            <Field label="Nombre"><Input defaultValue="Roberto Cruz Mejía"/></Field>
            <Field label="Parentesco"><Input defaultValue="Esposo"/></Field>
            <Field label="Teléfono"><Input mono defaultValue="+504 9988-7766"/></Field>
          </div>
        </div>
      </Card>

      {/* Motivo de consulta */}
      <Card title="Motivo de consulta y referencia" icon="clipboard">
        <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
          <Field label="Motivo principal" required>
            <Textarea defaultValue="Pérdida de peso y control de glucosa en ayunas. Refiere fatiga vespertina, antojos de carbohidratos al final del día y aumento progresivo de peso (8 kg en los últimos 2 años)."/>
          </Field>
          <div className="stack" style={{ gap: 14 }}>
            <Field label="Referido por">
              <Select defaultValue="endocrino">
                <option value="propia">Acude por iniciativa propia</option>
                <option value="endocrino">Endocrinología</option>
                <option value="medicina-general">Medicina general</option>
                <option value="cardiologia">Cardiología</option>
                <option value="ginecologia">Ginecología</option>
                <option value="otro">Otro especialista</option>
              </Select>
            </Field>
            <Field label="Médico referente"><Input defaultValue="Dra. Patricia López — Hospital CEMESA"/></Field>
            <Field label="Centro hospitalario"><Select defaultValue="cemesa"><option value="cemesa">Hospital CEMESA — SPS</option><option value="hondureno">Hospital Hondureño Médico</option><option value="vianey">Hospital del Valle</option><option value="mariaarmida">Hospital María — SPS</option><option value="escuela">Hospital Escuela Universitario</option><option value="otro">Otro</option></Select></Field>
          </div>
        </div>
      </Card>

      {/* Antecedentes personales */}
      <div className="grid grid-2">
        <Card title="Antecedentes personales patológicos" icon="heart">
          <div className="stack" style={{ gap: 10 }}>
            {[
              { name: 'Diabetes mellitus tipo 2', year: 'Diag. 2024', tag: 'red' },
              { name: 'Hipertensión arterial', year: 'Diag. 2023', tag: 'amber' },
              { name: 'Dislipidemia mixta', year: 'Diag. 2023', tag: 'amber' },
              { name: 'Hipotiroidismo subclínico', year: 'En control', tag: 'blue' },
              { name: 'Anemia ferropénica (resuelta)', year: '2022', tag: '' },
            ].map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--sd-ink-50)', borderRadius: 'var(--r-md)' }}>
                <Checkbox checked onChange={() => {}} label=""/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{d.year}</div>
                </div>
                {d.tag && <span className={`tag tag--${d.tag}`}>Activo</span>}
              </div>
            ))}
            <button className="btn btn-ghost sm" style={{ alignSelf: 'flex-start' }}><Icon name="plus" size={13}/> Agregar antecedente</button>
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
            <Field label="Cirugías previas">
              <Textarea defaultValue="Cesárea (2018) — sin complicaciones. Apendicectomía (2010)." rows="2"/>
            </Field>
          </div>
        </Card>

        <Card title="Antecedentes heredo-familiares" icon="family">
          <div className="stack" style={{ gap: 8 }}>
            {[
              { rel: 'Padre', cond: 'Diabetes tipo 2, IAM (60a)', tag: 'red' },
              { rel: 'Madre', cond: 'Hipertensión, dislipidemia', tag: 'amber' },
              { rel: 'Hermana mayor', cond: 'Diabetes gestacional', tag: 'amber' },
              { rel: 'Abuela materna', cond: 'Obesidad, ECV', tag: 'red' },
              { rel: 'Hijos (1)', cond: 'Sin patologías', tag: 'green' },
            ].map((d, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 1fr auto', gap: 10, padding: '8px 10px', alignItems: 'center', borderBottom: '1px solid var(--border-soft)' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-strong)' }}>{d.rel}</span>
                <span style={{ fontSize: 12.5, color: 'var(--fg-default)' }}>{d.cond}</span>
                <span className={`tag tag--${d.tag}`}>{d.tag === 'green' ? 'Sano' : 'Riesgo'}</span>
              </div>
            ))}
          </div>
          <Notice kind="alert" icon="alert">
            <strong>Carga familiar significativa</strong> para enfermedad cardiovascular y diabetes. Considerar tamizaje anual de perfil glucémico y lipídico.
          </Notice>
        </Card>
      </div>

      {/* Ginecobstétricos */}
      <Card title="Antecedentes ginecobstétricos" icon="baby">
        <div className="grid grid-4" style={{ gap: 14 }}>
          <Field label="Menarquia"><Input mono defaultValue="12 años" suffix=""/></Field>
          <Field label="Ciclo menstrual"><Input defaultValue="Regular 28/4"/></Field>
          <Field label="Gestas"><Input mono defaultValue="1"/></Field>
          <Field label="Partos / Cesáreas / Abortos"><Input mono defaultValue="0 / 1 / 0"/></Field>
          <Field label="Lactancia (meses)"><Input mono defaultValue="14"/></Field>
          <Field label="Anticoncepción">
            <Select defaultValue="ninguno"><option>DIU</option><option>Anticonceptivo oral</option><option>Inyección</option><option value="ninguno">Ninguno</option></Select>
          </Field>
          <Field label="Última citología"><Input type="date" mono defaultValue="2026-01-15"/></Field>
          <Field label="Mamografía"><Input type="date" mono defaultValue="2025-09-08"/></Field>
        </div>
      </Card>

      {/* Bioquímica */}
      <Card title="Estudios bioquímicos" icon="flask" sub="Última actualización: 12 may 2026 · Lab. Hondulab"
        actions={<><button className="btn btn-secondary sm"><Icon name="paperclip" size={13}/> Adjuntar PDF</button><button className="btn btn-secondary sm"><Icon name="plus" size={13}/> Agregar estudio</button></>}>
        <LabsTable/>
      </Card>
    </div>
  );
};

const LabsTable = () => {
  const labs = [
    { name: 'Glucosa en ayunas', val: 118, unit: 'mg/dL', refLow: 70, refHigh: 100, scaleMin: 60, scaleMax: 200, status: 'alto' },
    { name: 'Hemoglobina glicosilada (HbA1c)', val: 6.7, unit: '%', refLow: 4.0, refHigh: 5.6, scaleMin: 4, scaleMax: 12, status: 'alto' },
    { name: 'Colesterol total', val: 218, unit: 'mg/dL', refLow: 100, refHigh: 200, scaleMin: 100, scaleMax: 300, status: 'alto' },
    { name: 'HDL', val: 38, unit: 'mg/dL', refLow: 40, refHigh: 100, scaleMin: 20, scaleMax: 100, status: 'bajo' },
    { name: 'LDL', val: 142, unit: 'mg/dL', refLow: 0, refHigh: 100, scaleMin: 30, scaleMax: 200, status: 'alto' },
    { name: 'Triglicéridos', val: 190, unit: 'mg/dL', refLow: 0, refHigh: 150, scaleMin: 50, scaleMax: 400, status: 'alto' },
    { name: 'Creatinina', val: 0.8, unit: 'mg/dL', refLow: 0.6, refHigh: 1.1, scaleMin: 0.4, scaleMax: 1.5, status: 'normal' },
    { name: 'TSH', val: 4.8, unit: 'µUI/mL', refLow: 0.4, refHigh: 4.0, scaleMin: 0, scaleMax: 8, status: 'alto' },
    { name: 'Vitamina D (25-OH)', val: 22, unit: 'ng/mL', refLow: 30, refHigh: 100, scaleMin: 10, scaleMax: 80, status: 'bajo' },
    { name: 'Hemoglobina', val: 13.2, unit: 'g/dL', refLow: 12.0, refHigh: 15.5, scaleMin: 8, scaleMax: 18, status: 'normal' },
  ];

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.1fr 1.3fr 0.6fr', gap: 12, padding: '8px 12px 10px', borderBottom: '1px solid var(--border-default)', fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--sd-ink-50)', borderRadius: '6px 6px 0 0' }}>
        <div>Parámetro</div>
        <div>Resultado</div>
        <div>Rango referencia</div>
        <div>Visualización</div>
        <div style={{ textAlign: 'right' }}>Estado</div>
      </div>
      {labs.map((l, i) => {
        const pos = Math.max(0, Math.min(100, ((l.val - l.scaleMin) / (l.scaleMax - l.scaleMin)) * 100));
        const rangeStart = ((l.refLow - l.scaleMin) / (l.scaleMax - l.scaleMin)) * 100;
        const rangeEnd = ((l.refHigh - l.scaleMin) / (l.scaleMax - l.scaleMin)) * 100;
        const borderColor = l.status === 'normal' ? 'var(--sd-vital-500)' : l.status === 'alto' ? 'var(--sd-critical-500)' : 'var(--sd-alert-500)';
        return (
          <div key={i} className="lab-row">
            <div className="lab-row__name">{l.name}</div>
            <div className="lab-row__val" style={{ color: l.status === 'normal' ? 'var(--fg-strong)' : borderColor }}>{l.val} <span style={{ color: 'var(--fg-muted)', fontWeight: 400, fontSize: 11 }}>{l.unit}</span></div>
            <div className="lab-row__ref">{l.refLow}-{l.refHigh} {l.unit}</div>
            <div className="lab-row__bar">
              <div className="range" style={{ left: `${rangeStart}%`, right: `${100 - rangeEnd}%` }}/>
              <span style={{ left: `${pos}%`, borderColor }}/>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={`tag ${l.status === 'normal' ? 'tag--green' : l.status === 'alto' ? 'tag--red' : 'tag--amber'}`}>
                {l.status === 'normal' ? 'Normal' : l.status === 'alto' ? '↑ Alto' : '↓ Bajo'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

window.TabHistoria = TabHistoria;
