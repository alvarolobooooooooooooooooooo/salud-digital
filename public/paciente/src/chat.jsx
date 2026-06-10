// chat.jsx — Chat list + conversation thread
(function () {
  const { useState, useRef, useEffect } = React;
  const Icon = window.Icon;
  const { DocAvatar, Pill, TopBar, IconTile } = window;

  function ChatScreen() {
    const app = window.useApp();
    const { DB, go } = app;
    return (
      <div className="scroll">
        <TopBar title="Mensajes" large subtitle="Hable directo con sus médicos" />
        <div style={{ paddingBottom: 28 }}>
          <div className="pad" style={{ paddingTop: 4, paddingBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', background: 'var(--sd-vital-100)', borderRadius: 'var(--r-md)' }}>
              <Icon name="shield-check" size={18} color="var(--sd-vital-600)" />
              <span style={{ fontSize: 'var(--t-13)', color: 'var(--sd-ink-700)', lineHeight: 1.45 }}>Sus conversaciones son privadas y solo con su equipo médico.</span>
            </div>
          </div>
          {app.chats.map((c, i) => {
            const doc = DB.doctorById(c.doctor);
            const person = DB.personById(c.who);
            return (
              <button key={c.id} className="row focusable" onClick={() => { app.actions.readChat(c.id); go('chat', { id: c.id }); }} style={{ padding: '14px 20px' }}>
                <div style={{ position: 'relative' }}>
                  <DocAvatar doctor={doc} size={50} />
                  <span style={{ position: 'absolute', bottom: -1, right: -1, width: 13, height: 13, borderRadius: 999, background: 'var(--sd-vital-500)', border: '2px solid #fff' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-15)', color: 'var(--fg-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{doc.name}</span>
                    <span className="muted" style={{ fontSize: 'var(--t-12)', marginLeft: 'auto', flexShrink: 0 }}>{c.lastTime}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 'var(--t-12)', marginTop: 1 }}>{doc.specName} · {person.short}</div>
                  <div style={{ fontSize: 'var(--t-13)', color: c.unread ? 'var(--fg-strong)' : 'var(--fg-muted)', fontWeight: c.unread ? 600 : 400, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.last}</div>
                </div>
                {c.unread > 0 && <span style={{ width: 20, height: 20, borderRadius: 999, background: 'var(--sd-blue-600)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{c.unread}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function ChatThread() {
    const app = window.useApp();
    const { DB, cur, back } = app;
    const c = app.chats.find(x => x.id === cur.params.id);
    const [text, setText] = useState('');
    const scrollRef = useRef(null);
    const doc = c && DB.doctorById(c.doctor);
    const person = c && DB.personById(c.who);

    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [c && c.messages.length]);
    if (!c) return <div className="scroll"><TopBar title="Chat" onBack={back} /></div>;

    function send() {
      const t = text.trim(); if (!t) return;
      app.actions.sendMsg(c.id, t); setText('');
    }

    return (
      <div className="app" style={{ position: 'absolute', inset: 0 }}>
        {/* header */}
        <div className="topbar" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="focusable" onClick={back} aria-label="Atrás" style={{ width: 38, height: 38, borderRadius: 999, marginLeft: -6, display: 'grid', placeItems: 'center', background: 'var(--bg-subtle)', flexShrink: 0 }}><Icon name="chevron-left" size={22} color="var(--sd-navy-700)" /></button>
            <DocAvatar doctor={doc} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--t-15)', color: 'var(--fg-strong)' }}>{doc.name}</div>
              <div style={{ fontSize: 'var(--t-12)', color: 'var(--sd-vital-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--sd-vital-500)' }} />En línea</div>
            </div>
            <button className="focusable" aria-label="Llamar" style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--bg-subtle)', display: 'grid', placeItems: 'center' }}><Icon name="phone" size={19} color="var(--sd-navy-700)" /></button>
          </div>
        </div>

        {/* messages */}
        <div ref={scrollRef} className="scroll" style={{ padding: '16px 16px 8px', background: 'var(--bg-app)' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <span className="pill" style={{ fontSize: 11 }}>Conversación sobre {person.short}</span>
          </div>
          {c.messages.map((m, i) => <Bubble key={i} m={m} doc={doc} />)}
        </div>

        {/* composer */}
        <div style={{ padding: '10px 14px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border-soft)', background: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="focusable" aria-label="Adjuntar" style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--bg-subtle)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="paperclip" size={20} color="var(--sd-navy-700)" /></button>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Escriba un mensaje…" className="focusable"
            style={{ flex: 1, height: 44, borderRadius: 999, border: '1px solid var(--border-default)', padding: '0 16px', fontSize: 'var(--t-15)', outline: 'none', background: 'var(--bg-app)' }} />
          <button className="focusable" onClick={send} aria-label="Enviar" style={{ width: 44, height: 44, borderRadius: 999, background: text.trim() ? 'var(--sd-blue-600)' : 'var(--sd-ink-200)', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'background var(--dur-1)' }}><Icon name="send" size={20} color="#fff" /></button>
        </div>
      </div>
    );
  }

  function Bubble({ m, doc }) {
    const me = m.from === 'me';
    return (
      <div style={{ display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
        <div style={{ maxWidth: '78%' }}>
          <div style={{
            padding: m.attach ? 6 : '10px 14px', borderRadius: 18,
            borderBottomRightRadius: me ? 5 : 18, borderBottomLeftRadius: me ? 18 : 5,
            background: me ? 'var(--sd-blue-600)' : '#fff', color: me ? '#fff' : 'var(--fg-default)',
            border: me ? 'none' : '1px solid var(--border-default)', boxShadow: 'var(--shadow-xs)',
            fontSize: 'var(--t-15)', lineHeight: 1.45,
          }}>
            {m.attach === 'photo' && (
              <div className="photo" style={{ width: 180, height: 130, borderRadius: 13, marginBottom: m.text ? 8 : 0 }}><Icon name="camera" size={30} color="var(--sd-blue-400)" /></div>
            )}
            {m.text}
          </div>
          <div className="muted" style={{ fontSize: 10, marginTop: 3, textAlign: me ? 'right' : 'left', paddingInline: 4 }}>{m.time}</div>
        </div>
      </div>
    );
  }

  Object.assign(window, { ChatScreen, ChatThread });
})();
