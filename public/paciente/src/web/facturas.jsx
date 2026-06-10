// web/facturas.jsx + WebPerfil — Facturas table + Perfil (desktop)
(function () {
  const Icon = window.Icon;
  const { Avatar, DocAvatar, Pill, Btn, IconTile } = window;

  function WebFacturas() {
    const app = window.useApp();
    const web = window.useWeb();
    const { DB, go } = app;
    const filter = (who) => web.person === 'all' || web.person === who;
    const facturas = app.facturas.filter(f => filter(f.who));
    const pend = facturas.filter(f => f.status === 'pendiente');
    const paid = facturas.filter(f => f.status === 'pagada');
    const totalPend = pend.reduce((s, f) => s + f.amount, 0);
    const totalYear = facturas.reduce((s, f) => s + f.amount, 0);

    const Row = (f) => {
      const person = DB.personById(f.who); const doc = f.doctor && DB.doctorById(f.doctor);
      return (
        <tr key={f.id} onClick={() => go('factura', { id: f.id })}>
          <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 11 }}><IconTile name="receipt" color={f.status === 'pendiente' ? '#C7811C' : '#8A93A4'} bg="var(--bg-subtle)" size={36} iconSize={18} radius={10} /><span><div style={{ fontWeight: 600, color: 'var(--fg-strong)' }}>{f.concept}</div>{doc && <div className="muted" style={{ fontSize: 'var(--t-12)' }}>{doc.name}</div>}</span></span></td>
          <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Avatar person={person} size={24} />{person.short}</span></td>
          <td className="muted">{f.date}</td>
          <td>{f.status === 'pendiente' ? <Pill tone="amber" dot>Pendiente</Pill> : <Pill tone="green" dot>Pagada</Pill>}</td>
          <td style={{ textAlign: 'right' }}><span className="t-mono" style={{ fontWeight: 700, color: 'var(--fg-strong)' }}>{DB.L(f.amount)}</span></td>
        </tr>
      );
    };

    return (
      <div className="web-scroll">
        <div className="web-page">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 24 }}>
            <div className="wcard stat"><IconTile name="alert-circle" color="#C7811C" bg="var(--sd-alert-100)" size={50} iconSize={24} radius={14} /><div><div className="muted" style={{ fontSize: 'var(--t-13)' }}>Saldo por pagar</div><div className="num t-mono" style={{ color: 'var(--sd-alert-600)', marginTop: 3 }}>{DB.L(totalPend)}</div></div></div>
            <div className="wcard stat"><IconTile name="check-circle" color="#198754" bg="var(--sd-vital-100)" size={50} iconSize={24} radius={14} /><div><div className="muted" style={{ fontSize: 'var(--t-13)' }}>Facturas pagadas</div><div className="num" style={{ marginTop: 3 }}>{paid.length}</div></div></div>
            <div className="wcard stat"><IconTile name="trending-up" color="#0080B0" bg="var(--sd-blue-100)" size={50} iconSize={24} radius={14} /><div><div className="muted" style={{ fontSize: 'var(--t-13)' }}>Total del año</div><div className="num t-mono" style={{ marginTop: 3 }}>{DB.L(totalYear)}</div></div></div>
          </div>

          {pend.length > 0 && <React.Fragment>
            <h3 className="web-h" style={{ marginBottom: 14 }}>Pendientes</h3>
            <div className="wcard wcard-flush" style={{ marginBottom: 28 }}>
              <table className="wtable"><thead><tr><th>Concepto</th><th>Paciente</th><th>Fecha</th><th>Estado</th><th style={{ textAlign: 'right' }}>Monto</th></tr></thead><tbody>{pend.map(Row)}</tbody></table>
            </div>
          </React.Fragment>}

          <h3 className="web-h" style={{ marginBottom: 14 }}>Historial</h3>
          <div className="wcard wcard-flush">
            <table className="wtable"><thead><tr><th>Concepto</th><th>Paciente</th><th>Fecha</th><th>Estado</th><th style={{ textAlign: 'right' }}>Monto</th></tr></thead><tbody>{paid.map(Row)}</tbody></table>
          </div>
          <p className="muted" style={{ fontSize: 'var(--t-12)', marginTop: 16, textAlign: 'center' }}>Las facturas son emitidas por cada clínica. Puede pagar en línea o en recepción.</p>
        </div>
      </div>
    );
  }

  function WebPerfil() {
    const app = window.useApp();
    const { DB, go } = app;
    const me = DB.personById('ana');
    const Setting = ({ icon, label, detail, danger, onClick }) => (
      <button className="wrow" onClick={onClick}>
        <IconTile name={icon} color={danger ? '#C2362C' : '#103A78'} bg={danger ? 'var(--sd-critical-100)' : 'var(--bg-subtle)'} size={38} iconSize={19} radius={10} />
        <span style={{ flex: 1, fontWeight: 600, fontSize: 'var(--t-14)', color: danger ? 'var(--sd-critical-600)' : 'var(--fg-strong)' }}>{label}</span>
        {detail && <span className="muted" style={{ fontSize: 'var(--t-13)' }}>{detail}</span>}
        <Icon name="chevron-right" size={18} color="var(--sd-ink-300)" />
      </button>
    );
    return (
      <div className="web-scroll">
        <div className="web-page" style={{ maxWidth: 920 }}>
          <div className="wcard" style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 22 }}>
            <Avatar person={me} size={76} style={{ fontSize: 28 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'var(--t-24)', color: 'var(--fg-strong)' }}>{me.name}</div>
              <div className="muted" style={{ fontSize: 'var(--t-14)', marginTop: 3 }}>{me.age} años · Tipo de sangre {me.blood} · {me.dob}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><Pill tone="blue"><Icon name="shield-check" size={12} color="currentColor" />Identidad verificada</Pill><Pill tone="gray"><Icon name="map" size={12} color="currentColor" />2 clínicas vinculadas</Pill></div>
            </div>
            <Btn variant="ghost" icon="edit">Editar</Btn>
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
            <div>
              <h3 className="web-h" style={{ marginBottom: 12 }}>Mi familia</h3>
              <div className="wcard wcard-flush" style={{ marginBottom: 20 }}>
                {DB.family.map(p => (
                  <button key={p.id} className="wrow" onClick={() => go('familiar', { id: p.id })}>
                    <Avatar person={p} size={42} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--fg-strong)' }}>{p.name}</div><div className="muted" style={{ fontSize: 'var(--t-13)' }}>{p.rel} · {p.age} años{p.note ? ' · ' + p.note : ''}</div></div>
                    <Icon name="chevron-right" size={18} color="var(--sd-ink-300)" />
                  </button>
                ))}
                <button className="wrow" onClick={() => go('familiar', { id: 'ana' })}>
                  <span style={{ width: 42, height: 42, borderRadius: 999, border: '1.5px dashed var(--border-strong)', display: 'grid', placeItems: 'center' }}><Icon name="plus" size={20} color="var(--sd-blue-600)" /></span>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 'var(--t-14)', color: 'var(--sd-blue-600)' }}>Agregar familiar</span>
                </button>
              </div>
            </div>
            <div>
              <h3 className="web-h" style={{ marginBottom: 12 }}>Cuenta</h3>
              <div className="wcard wcard-flush" style={{ marginBottom: 16 }}>
                <Setting icon="user" label="Mis datos" />
                <Setting icon="shield" label="Privacidad y permisos" />
                <Setting icon="bell" label="Notificaciones" detail="Activas" />
                <Setting icon="map" label="Clínicas vinculadas" detail="2" />
                <Setting icon="headphones" label="Ayuda y soporte" />
              </div>
              <div className="wcard wcard-flush">
                <Setting icon="log-out" label="Cerrar sesión" danger onClick={() => window.sdLogout && window.sdLogout()} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  Object.assign(window, { WebFacturas, WebPerfil });
})();
