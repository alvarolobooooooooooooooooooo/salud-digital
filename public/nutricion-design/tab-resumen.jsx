/* Tab: Resumen — paciente summary, alertas, próxima cita, atajos */
const { useState: _useState1 } = React;

const TabResumen = ({ patient, goTo }) => {
  return (
    <div className="stack" style={{ gap: 16 }}>
      <SecHeader
        title="Resumen del expediente"
        sub="Visión general de Ana Lucía — última actualización hoy, 14:30"
        actions={<>
          <button className="btn btn-secondary"><Icon name="history" size={14}/> Ver historial</button>
          <button className="btn btn-primary"><Icon name="plus" size={14}/> Nueva consulta</button>
        </>}
      />

      {/* Alert row */}
      <Notice kind="alert" icon="alert">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <strong>Glucosa en ayunas elevada (118 mg/dL).</strong> Resultado de laboratorio del 12 may 2026 está por encima del rango.
            Vincular con plan nutricional para diabetes tipo 2.
          </div>
          <button className="btn btn-secondary sm" onClick={() => goTo('historia')}>Ver bioquímica</button>
        </div>
      </Notice>

      {/* Top stat grid */}
      <div className="grid grid-4">
        <Card>
          <Stat label="Peso actual" value="74.8" unit="kg" delta="−3.2 kg en 8 sem." deltaDir="down"/>
        </Card>
        <Card>
          <Stat label="IMC" value="28.5" unit="kg/m²" delta="Sobrepeso" deltaDir="flat"/>
        </Card>
        <Card>
          <Stat label="% Grasa" value="34.1" unit="%" delta="−1.8 pts" deltaDir="down"/>
        </Card>
        <Card>
          <Stat label="Adherencia plan" value="86" unit="%" delta="+12 pts" deltaDir="up"/>
        </Card>
      </div>

      <div className="grid grid-2">
        {/* Próxima cita */}
        <Card
          title="Próxima consulta"
          icon="calendar"
          actions={<button className="btn btn-ghost sm"><Icon name="more" size={14}/></button>}
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '4px 0' }}>
            <div style={{
              flex: '0 0 64px', height: 64,
              background: 'var(--sd-blue-100)', borderRadius: 'var(--r-md)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: 'var(--sd-navy-700)'
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>JUN</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>04</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-strong)' }}>Control de seguimiento — 4 semanas</div>
              <div style={{ display: 'flex', gap: 10, fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 4 }}>
                <span><Icon name="clock" size={12} style={{ verticalAlign: '-2px', marginRight: 3 }}/> 09:30</span>
                <span>·</span>
                <span>Consultorio Edificio Médico Mall Galerías</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <Chip kind="info">Presencial</Chip>
                <Chip>45 min</Chip>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
            <button className="btn btn-secondary sm"><Icon name="phone" size={13}/> Llamar paciente</button>
            <button className="btn btn-secondary sm"><Icon name="mail" size={13}/> Reenviar recordatorio</button>
            <button className="btn btn-ghost sm" style={{ marginLeft: 'auto' }}>Reagendar</button>
          </div>
        </Card>

        {/* Diagnóstico actual */}
        <Card title="Diagnóstico nutricional" icon="clipboard">
          <div className="stack" style={{ gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Diagnóstico primario</div>
              <div style={{ fontSize: 14, color: 'var(--fg-strong)', marginTop: 4, lineHeight: 1.5 }}>
                Sobrepeso (IMC 28.5) asociado a glucemia alterada en ayunas y patrón
                alimentario alto en carbohidratos refinados, secundario a hábitos sedentarios.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="tag tag--amber">E66.9 Obesidad</span>
              <span className="tag tag--amber">R73.0 Glucosa alterada</span>
              <span className="tag">Z71.3 Consejería nutricional</span>
            </div>
            <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-soft)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Objetivo principal</div>
              <div style={{ fontSize: 13.5, color: 'var(--fg-strong)', marginTop: 4 }}>
                Pérdida del 7% del peso corporal (≈5 kg) en 16 semanas, manteniendo glucosa &lt;100 mg/dL.
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-2">
        {/* Alergias y medicamentos */}
        <Card title="Alergias, intolerancias y restricciones" icon="alert">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <span className="tag tag--red"><Icon name="alert" size={12}/> Penicilina</span>
            <span className="tag tag--red"><Icon name="alert" size={12}/> Mariscos</span>
            <span className="tag tag--amber">Intolerancia lactosa</span>
            <span className="tag">No consume cerdo</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 12, marginBottom: 6 }}>Medicamentos actuales</div>
          <div className="stack" style={{ gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
              <Icon name="pill" size={14} style={{ color: 'var(--sd-blue-600)', flex: '0 0 14px' }}/>
              <span style={{ fontWeight: 600 }}>Metformina 500 mg</span>
              <span style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>1-0-1 c/12h con alimentos</span>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
              <Icon name="pill" size={14} style={{ color: 'var(--sd-blue-600)', flex: '0 0 14px' }}/>
              <span style={{ fontWeight: 600 }}>Losartán 50 mg</span>
              <span style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>1-0-0 en la mañana</span>
            </div>
          </div>
        </Card>

        {/* Atajos */}
        <Card title="Atajos rápidos" icon="zap">
          <div className="grid grid-2" style={{ gap: 10 }}>
            <button className="btn btn-secondary" style={{ height: 60, justifyContent: 'flex-start', padding: '10px 12px', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }} onClick={() => goTo('plan')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="utensils" size={16} style={{color: 'var(--sd-blue-600)'}}/><span style={{ fontSize: 13 }}>Armar plato del día</span></div>
              <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 400 }}>Constructor visual</span>
            </button>
            <button className="btn btn-secondary" style={{ height: 60, justifyContent: 'flex-start', padding: '10px 12px', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }} onClick={() => goTo('antropometria')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="scale" size={16} style={{color: 'var(--sd-blue-600)'}}/><span style={{ fontSize: 13 }}>Registrar medidas</span></div>
              <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 400 }}>Peso, talla, pliegues</span>
            </button>
            <button className="btn btn-secondary" style={{ height: 60, justifyContent: 'flex-start', padding: '10px 12px', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }} onClick={() => goTo('seguimiento')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="fileText" size={16} style={{color: 'var(--sd-blue-600)'}}/><span style={{ fontSize: 13 }}>Generar receta</span></div>
              <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 400 }}>PDF imprimible</span>
            </button>
            <button className="btn btn-secondary" style={{ height: 60, justifyContent: 'flex-start', padding: '10px 12px', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }} onClick={() => goTo('dieta')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="clock" size={16} style={{color: 'var(--sd-blue-600)'}}/><span style={{ fontSize: 13 }}>Recordatorio 24h</span></div>
              <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 400 }}>Evaluación dietética</span>
            </button>
          </div>
        </Card>
      </div>

      {/* Timeline de consultas */}
      <Card title="Consultas recientes" icon="history" actions={<button className="btn btn-link sm">Ver todas →</button>}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 110 }}>Fecha</th>
              <th>Motivo</th>
              <th style={{ width: 90 }}>Peso</th>
              <th style={{ width: 90 }}>IMC</th>
              <th style={{ width: 130 }}>Estado</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>9 may 2026</td>
              <td>Control mensual + ajuste plan</td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>74.8 kg</td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>28.5</td>
              <td><Chip kind="active">Completada</Chip></td>
              <td><button className="btn btn-ghost sm" style={{ width: 28, padding: 0 }}><Icon name="chevronRight" size={14}/></button></td>
            </tr>
            <tr>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>11 abr 2026</td>
              <td>Evaluación dietética + bioquímica</td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>76.4 kg</td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>29.1</td>
              <td><Chip kind="active">Completada</Chip></td>
              <td><button className="btn btn-ghost sm" style={{ width: 28, padding: 0 }}><Icon name="chevronRight" size={14}/></button></td>
            </tr>
            <tr>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>14 mar 2026</td>
              <td>Primera consulta</td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>78.0 kg</td>
              <td style={{ fontFamily: 'var(--font-mono)' }}>29.7</td>
              <td><Chip kind="active">Completada</Chip></td>
              <td><button className="btn btn-ghost sm" style={{ width: 28, padding: 0 }}><Icon name="chevronRight" size={14}/></button></td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
};

window.TabResumen = TabResumen;
