// store.jsx — app state + navigation stack, exposed via window.useApp().
(function () {
  const { useState, useCallback, createContext, useContext } = React;
  const DB = window.DB;
  const Ctx = createContext(null);

  function AppProvider({ children }) {
    // ---- navigation stack: array of { name, params } ----
    const [stack, setStack] = useState([{ name: 'home', params: {} }]);
    const cur = stack[stack.length - 1];
    const tab = (() => {
      // base tab = first item in stack
      return stack[0].name;
    })();

    const go = useCallback((name, params = {}) => {
      setStack(s => [...s, { name, params }]);
    }, []);
    const back = useCallback(() => {
      setStack(s => (s.length > 1 ? s.slice(0, -1) : s));
    }, []);
    const setTab = useCallback((name) => {
      setStack([{ name, params: {} }]);
    }, []);
    const resetTo = useCallback((name, params = {}) => {
      setStack([{ name: name, params }]);
    }, []);

    // ---- onboarding gate ----
    // En la plataforma real el registro/login lo maneja /login.html, así que el
    // paciente ya entra autenticado: por defecto saltamos el onboarding de diseño.
    // (Sigue disponible: poner sd_onboarded='0' o llamar restartOnboarding().)
    const [onboarded, setOnboarded] = useState(() => {
      try { return localStorage.getItem('sd_onboarded') !== '0'; } catch (e) { return true; }
    });
    const finishOnboarding = useCallback(() => {
      try { localStorage.setItem('sd_onboarded', '1'); } catch (e) {}
      setOnboarded(true);
    });
    const restartOnboarding = useCallback(() => {
      try { localStorage.setItem('sd_onboarded', '0'); } catch (e) {}
      setOnboarded(false);
    });

    // ---- mutable data store ----
    const [taken, setTaken] = useState(() => {
      const o = {}; DB.meds.forEach(m => o[m.id] = m.taken); return o;
    });
    const [readIds, setReadIds] = useState(() => {
      const o = {}; DB.results.forEach(r => o[r.id] = !r.unread); return o;
    });
    const [diary, setDiary] = useState(DB.diario);
    const [appts, setAppts] = useState(DB.appointments);
    const [preDone, setPreDone] = useState({});
    const [chats, setChats] = useState(() => JSON.parse(JSON.stringify(DB.chats)));
    const [facturas, setFacturas] = useState(DB.facturas);
    const [activePerson, setActivePerson] = useState('ana');

    const actions = {
      toggleMed: (id) => setTaken(t => ({ ...t, [id]: !t[id] })),
      markRead: (id) => setReadIds(r => ({ ...r, [id]: true })),
      addDiary: (entry) => setDiary(d => [{ ...entry, id: 'd' + Date.now() }, ...d]),
      addAppt: (a) => setAppts(list => [...list, { ...a, id: 'a' + Date.now() }].sort((x, y) => x.date.localeCompare(y.date))),
      completePre: (apptId) => setPreDone(p => ({ ...p, [apptId]: true })),
      sendMsg: (chatId, text) => setChats(cs => cs.map(c => c.id === chatId
        ? { ...c, unread: 0, messages: [...c.messages, { from: 'me', text, time: nowTime() }] }
        : c)),
      readChat: (chatId) => setChats(cs => cs.map(c => c.id === chatId ? { ...c, unread: 0 } : c)),
      payFactura: (id) => setFacturas(fs => fs.map(f => f.id === id ? { ...f, status: 'pagada' } : f)),
    };

    function nowTime() {
      const d = new Date(); return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    }

    // ---- derived: pending items for the home "día de salud" ----
    const pending = [];
    // unread results
    DB.results.forEach(r => { if (!readIds[r.id]) pending.push({ kind: 'result', id: r.id, who: r.who, title: 'Leer resultado: ' + r.title }); });
    // preconsulta needed
    appts.forEach(a => { if (a.preconsulta && !preDone[a.id]) pending.push({ kind: 'pre', id: a.id, who: a.who, title: 'Completar pre-consulta', sub: DB.doctorById(a.doctor).specName }); });
    // meds due today (not taken)
    DB.meds.forEach(m => { if (!taken[m.id]) pending.push({ kind: 'med', id: m.id, who: m.who, title: 'Tomar ' + m.name + ' ' + m.dose, sub: m.schedule }); });

    // adherence: meds taken / total
    const totalMeds = DB.meds.length;
    const takenCount = DB.meds.filter(m => taken[m.id]).length;

    const value = {
      stack, cur, tab, go, back, setTab, resetTo,
      onboarded, finishOnboarding, restartOnboarding,
      taken, readIds, diary, appts, preDone, chats, facturas, activePerson, setActivePerson,
      actions, pending, totalMeds, takenCount, DB,
    };
    return React.createElement(Ctx.Provider, { value }, children);
  }

  window.AppProvider = AppProvider;
  window.useApp = () => useContext(Ctx);
})();
