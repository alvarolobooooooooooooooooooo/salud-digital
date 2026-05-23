/* Tab: Estilo de vida + Hábitos alimentarios */

const TabEstiloVida = () => {
  return (
    <div className="stack" style={{ gap: 16 }}>
      <SecHeader
        title="Estilo de vida"
        sub="Actividad física · sueño · hidratación · hábitos · entorno"
        actions={<button className="btn btn-primary"><Icon name="save" size={14}/> Guardar</button>}
      />

      {/* Resumen */}
      <div className="grid grid-4">
        <Card>
          <Stat label="Pasos / día (prom.)" value="4,820" delta="−620 vs. semana pasada" deltaDir="up"/>
        </Card>
        <Card>
          <Stat label="Sueño promedio" value="6.4" unit="h"/>
          <div style={{ fontSize: 12, color: 'var(--sd-alert-600)', fontWeight: 600, marginTop: 4 }}>● Insuficiente</div>
        </Card>
        <Card>
          <Stat label="Agua diaria" value="1.4" unit="L" delta="Meta: 2.2 L" deltaDir="flat"/>
        </Card>
        <Card>
          <Stat label="Sesiones ejercicio" value="2" unit="/sem" delta="Meta: 4" deltaDir="flat"/>
        </Card>
      </div>

      <div className="grid grid-2">
        {/* Actividad física */}
        <Card title="Actividad física" icon="activity">
          <div className="stack" style={{ gap: 14 }}>
            <Field label="Ocupación principal">
              <Select defaultValue="sedentaria">
                <option value="sedentaria">Sedentaria (oficina, escritorio)</option>
                <option>Ligera (caminar entre tareas)</option>
                <option>Moderada (pie, carga ocasional)</option>
                <option>Pesada (carga, esfuerzo continuo)</option>
              </Select>
            </Field>
            <Field label="Tipo de ejercicio que realiza">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['Caminata', 'Trotar', 'Bicicleta', 'Pesas / gimnasio', 'Yoga / pilates', 'Natación', 'Zumba / baile', 'Fútbol', 'Crossfit', 'Ninguno'].map((e, i) => (
                  <Checkbox key={i} checked={['Caminata', 'Zumba / baile'].includes(e)} onChange={() => {}} label={e}/>
                ))}
              </div>
            </Field>
            <div className="grid grid-2" style={{ gap: 12 }}>
              <Field label="Frecuencia"><Input defaultValue="2 días/semana" mono/></Field>
              <Field label="Duración por sesión"><Input defaultValue="40 minutos" mono/></Field>
              <Field label="Intensidad percibida">
                <Seg value="mod" onChange={() => {}} options={[
                  { value: 'baja', label: 'Baja' }, { value: 'mod', label: 'Moderada' }, { value: 'alta', label: 'Alta' }
                ]}/>
              </Field>
              <Field label="Pasos diarios (promedio)"><Input defaultValue="4820" mono suffix="pasos"/></Field>
            </div>
            <Field label="Limitaciones físicas o lesiones">
              <Textarea defaultValue="Dolor lumbar ocasional. Evitar impacto alto." rows="2"/>
            </Field>
          </div>
        </Card>

        {/* Sueño y descanso */}
        <Card title="Sueño y descanso" icon="moon">
          <div className="grid grid-2" style={{ gap: 12 }}>
            <Field label="Horas de sueño / noche"><Input mono defaultValue="6.5" suffix="h"/></Field>
            <Field label="Hora de dormir habitual"><Input mono defaultValue="23:30"/></Field>
            <Field label="Hora de despertar"><Input mono defaultValue="06:00"/></Field>
            <Field label="Calidad del sueño">
              <Select defaultValue="reg"><option>Excelente</option><option>Buena</option><option value="reg">Regular</option><option>Mala</option></Select>
            </Field>
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Hábitos nocturnos</div>
            <div className="stack" style={{ gap: 8 }}>
              <Checkbox checked onChange={() => {}} label="Usa pantallas hasta antes de dormir"/>
              <Checkbox checked={false} onChange={() => {}} label="Cena pesada (<2h antes de acostarse)"/>
              <Checkbox checked onChange={() => {}} label="Despertares nocturnos frecuentes"/>
              <Checkbox checked={false} onChange={() => {}} label="Ronquidos / apnea referida"/>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-2">
        {/* Hidratación */}
        <Card title="Hidratación" icon="droplet">
          <div className="grid grid-3" style={{ gap: 12 }}>
            <Field label="Agua simple"><Input mono defaultValue="1.4" suffix="L/día"/></Field>
            <Field label="Café / té"><Input mono defaultValue="2" suffix="tazas"/></Field>
            <Field label="Refrescos azucarados"><Input mono defaultValue="3" suffix="vasos/sem"/></Field>
            <Field label="Jugos naturales"><Input mono defaultValue="1" suffix="vaso/día"/></Field>
            <Field label="Bebidas energéticas"><Input mono defaultValue="0" suffix="/sem"/></Field>
            <Field label="Bebidas alcohólicas"><Input mono defaultValue="2" suffix="copas/sem"/></Field>
          </div>
          <Notice kind="alert">
            <strong>Ingesta de agua por debajo de la meta</strong> (1.4 L vs. 2.2 L). Sustituir refrescos azucarados por agua o aguas saborizadas naturales.
          </Notice>
        </Card>

        {/* Tabaco y alcohol */}
        <Card title="Tabaco, alcohol y otras sustancias" icon="cigarette">
          <div className="stack" style={{ gap: 14 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Tabaco</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Seg value="ex" onChange={() => {}} options={[
                  { value: 'no', label: 'Nunca' }, { value: 'ex', label: 'Ex-fumadora' }, { value: 'si', label: 'Activa' }
                ]}/>
                <Input mono defaultValue="Hace 4 años" placeholder="¿Hace cuánto?" style={{ flex: 1 }}/>
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Alcohol</div>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <Field label="Tipo principal"><Select defaultValue="cerv"><option value="cerv">Cerveza</option><option>Vino</option><option>Destilados</option><option>Ron</option></Select></Field>
                <Field label="Cantidad / semana"><Input mono defaultValue="2 copas"/></Field>
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Suplementos</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="tag tag--blue"><Icon name="pill" size={11}/> Vitamina D 5000 UI</span>
                <span className="tag tag--blue"><Icon name="pill" size={11}/> Multivitamínico</span>
                <span className="tag tag--blue"><Icon name="pill" size={11}/> Hierro (en pausa)</span>
                <button className="btn btn-ghost sm"><Icon name="plus" size={12}/> Agregar</button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Hábitos alimentarios generales */}
      <Card title="Hábitos alimentarios generales" icon="utensils">
        <div className="grid grid-3" style={{ gap: 14 }}>
          <Field label="Número de comidas al día"><Input mono defaultValue="3"/></Field>
          <Field label="Tiempo promedio por comida"><Input mono defaultValue="12 min" suffix=""/></Field>
          <Field label="¿Quién prepara los alimentos?"><Input defaultValue="Paciente (60%) / empleada (40%)"/></Field>
          <Field label="¿Dónde come la mayoría del tiempo?"><Select defaultValue="casa"><option value="casa">En casa</option><option>Trabajo</option><option>Restaurantes</option><option>Mixto</option></Select></Field>
          <Field label="Preferencias culinarias"><Input defaultValue="Comida tradicional hondureña"/></Field>
          <Field label="¿Sigue alguna dieta especial?"><Select defaultValue="no"><option value="no">Ninguna</option><option>Vegetariana</option><option>Vegana</option><option>Sin gluten</option><option>Cetogénica</option><option>Otra</option></Select></Field>
        </div>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Conductas alimentarias observadas</div>
          <div className="grid grid-2" style={{ gap: 14 }}>
            <div className="stack" style={{ gap: 8 }}>
              <Checkbox checked onChange={() => {}} label="Picoteo entre comidas"/>
              <Checkbox checked onChange={() => {}} label="Antojos de dulce al final del día"/>
              <Checkbox checked={false} onChange={() => {}} label="Atracones (binge eating)"/>
              <Checkbox checked onChange={() => {}} label="Come por estrés o aburrimiento"/>
              <Checkbox checked={false} onChange={() => {}} label="Restricción alimentaria"/>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <Checkbox checked={false} onChange={() => {}} label="Vómito autoinducido"/>
              <Checkbox checked={false} onChange={() => {}} label="Uso de laxantes / diuréticos"/>
              <Checkbox checked onChange={() => {}} label="Saltarse el desayuno"/>
              <Checkbox checked onChange={() => {}} label="Come viendo pantallas"/>
              <Checkbox checked={false} onChange={() => {}} label="Cuenta calorías obsesivamente"/>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
          <Field label="Observaciones adicionales sobre estilo de vida">
            <Textarea defaultValue="Paciente con jornadas laborales largas (8h frente a la computadora). Come en su escritorio. Refiere comer por estrés especialmente en cierres contables (fin de mes). Disfruta caminar los sábados por la mañana." rows="3"/>
          </Field>
        </div>
      </Card>
    </div>
  );
};

window.TabEstiloVida = TabEstiloVida;
