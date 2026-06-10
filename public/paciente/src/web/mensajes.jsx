// web/mensajes.jsx — two-pane chat (desktop)
(function () {
  const { useState, useRef, useEffect } = React;
  const Icon = window.Icon;
  const { DocAvatar, Pill } = window;

  function WebMensajes() {
    const app = window.useApp();
    const { DB } = app;
    const [sel, setSel] = useState(app.chats[0] ? app.chats[0].id : null);
    const c = app.chats.find(x => x.id === sel);

    return (
      <div className="chat-2pane">
        {/* list */}
        <div className="chat-list">
          <div style={{ padding: '18px 18px 12px' }}>
            <div className="web-search" style={{ width: '100%' }}><Icon name="search" size={18} color="var(--fg-muted)" /><input placeholder="Buscar conversación…" /></div>
          </div>
          {app.chats.map(ch => {
            const doc = DB.doctorById(ch.doctor); const person = DB.personById(ch.who);
            const on = ch.id === sel;
            return (
              <button key={ch.id} className="wrow" style={{ background: on ? 'var(--sd-blue-50)' : 'transparent', borderLeft: on ? '3px solid var(--sd-blue-600)' : '3px solid transparent' }}
                onClick={() => { app.actions.readChat(ch.id); setSel(ch.id); }}>
                <div style={{ position: 'relative' }}>
                  <DocAvatar doctor={doc} size={46} />
                  <span style={{ position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderRadius: 999, background: 'var(--sd-vital-500)', border: '2px solid var(--bg-surface)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-14)', color: 'var(--fg-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{doc.name}</span>
                    <span className="muted" style={{ fontSize: 11, flexShrink: 0 }}>{ch.lastTime}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 1 }}>{doc.specName} · {person.short}</div>
                  <div style={{ fontSize: 'var(--t-13)', color: ch.unread ? 'var(--fg-strong)' : 'var(--fg-muted)', fontWeight: ch.unread ? 600 : 400, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.last}</div>
                </div>
                {ch.unread > 0 && <span style={{ width: 20, height: 20, borderRadius: 999, background: 'var(--sd-blue-600)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{ch.unread}</span>}
              </button>
            );
          })}
        </div>

        {/* thread */}
        {c ? <Thread app={app} c={c} /> : <div style={{ display: 'grid', placeItems: 'center', color: 'var(--fg-muted)' }}>Seleccione una conversación</div>}
      </div>
    );
  }

  function Thread({ app, c }) {
    const { DB } = app;
    const doc = DB.doctorById(c.doctor); const person = DB.personById(c.who);
    const [text, setText] = useState('');
    const ref = useRef(null);
    useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [c.messages.length, c.id]);
    function send() { const t = text.trim(); if (!t) return; app.actions.sendMsg(c.id, t); setText(''); }
    return (
      <div className="chat-main">
        {/* head */}
        <div style={{ height: 70, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-surface)' }}>
          <DocAvatar doctor={doc} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-16)', color: 'var(--fg-strong)' }}>{doc.name}</div>
            <div style={{ fontSize: 'var(--t-12)', color: 'var(--sd-vital-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--sd-vital-500)' }} />En línea · {doc.specName}</div>
          </div>
          <Pill tone="gray"><Icon name="user" size={13} color="currentColor" />Sobre {person.short}</Pill>
          <button className="icon-btn" aria-label="Llamar" onClick={() => { const a = app.appts.find(a => a.doctor === c.doctor); if (a) app.go('video', { apptId: a.id }); }}><Icon name="video" size={20} color="var(--sd-navy-700)" /></button>
        </div>

        {/* messages */}
        <div ref={ref} className="web-scroll" style={{ padding: '22px 28px', background: 'var(--bg-app)' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {c.messages.map((m, i) => <Bubble key={i} m={m} />)}
          </div>
        </div>

        {/* composer */}
        <div style={{ flexShrink: 0, padding: '14px 28px', borderTop: '1px solid var(--border-soft)', background: 'var(--bg-surface)' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="icon-btn" aria-label="Adjuntar"><Icon name="paperclip" size={20} color="var(--sd-navy-700)" /></button>
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Escriba un mensaje…"
              style={{ flex: 1, height: 46, borderRadius: 999, border: '1px solid var(--border-default)', padding: '0 18px', fontSize: 'var(--t-15)', outline: 'none', background: 'var(--bg-app)', color: 'var(--fg-strong)' }} />
            <button onClick={send} aria-label="Enviar" style={{ width: 46, height: 46, borderRadius: 999, background: text.trim() ? 'var(--sd-blue-600)' : 'var(--sd-ink-200)', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'background var(--dur-1)' }}><Icon name="send" size={20} color="#fff" /></button>
          </div>
        </div>
      </div>
    );
  }

  function Bubble({ m }) {
    const me = m.from === 'me';
    return (
      <div style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
        <div style={{ maxWidth: '70%' }}>
          <div style={{ padding: m.attach ? 6 : '11px 16px', borderRadius: 18, borderBottomRightRadius: me ? 5 : 18, borderBottomLeftRadius: me ? 18 : 5, background: me ? 'var(--sd-blue-600)' : 'var(--bg-surface)', color: me ? '#fff' : 'var(--fg-default)', border: me ? 'none' : '1px solid var(--border-default)', fontSize: 'var(--t-15)', lineHeight: 1.5 }}>
            {m.attach === 'photo' && <div className="photo" style={{ width: 200, height: 145, borderRadius: 13, marginBottom: m.text ? 8 : 0 }}><Icon name="camera" size={32} color="var(--sd-blue-400)" /></div>}
            {m.text}
          </div>
          <div className="muted" style={{ fontSize: 10, marginTop: 4, textAlign: me ? 'right' : 'left', paddingInline: 4 }}>{m.time}</div>
        </div>
      </div>
    );
  }

  window.WebMensajes = WebMensajes;
})();
