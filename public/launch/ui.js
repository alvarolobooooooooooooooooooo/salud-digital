/* ═══════════════════════════════════════════════════════════════════
   launch/ui.js — La interfaz REAL de Salud Digital, en miniatura
   ─────────────────────────────────────────────────────────────────
   No es una UI inventada para el vídeo: son las mismas secciones, los
   mismos rótulos del sidebar (layout.js), las mismas tarjetas del
   Inicio (dashboard.html) y las mismas alertas clínicas (style.css),
   reconstruidas con los tokens del tema oscuro (theme-dark.css) para
   que la cámara pueda atravesarlas en 3D sin arrastrar el layout fijo
   de la plataforma.

   Los datos son los de la clínica de demostración: ningún paciente
   real aparece en el film.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const LX = window.LX;
  const el = LX.el;

  /* ── Iconos (mismo trazo 1.9–2 y remates redondos de icons.js) ── */
  const I = {
    home: '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    wallet: '<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22M17 14h.01"/>',
    staff: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="13" x2="12" y2="17"/><line x1="9" y1="15" x2="15" y2="15"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>',
    archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    creditCard: '<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    shield: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/>',
    pill: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M8.5 8.5 15.5 15.5"/>',
    flask: '<path d="M9 3h6M10 3v6L5 19a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 19l-5-10V3"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  };
  const svg = (name, size, w) =>
    '<svg viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) +
    '" fill="none" stroke="currentColor" stroke-width="' + (w || 1.9) +
    '" stroke-linecap="round" stroke-linejoin="round">' + I[name] + '</svg>';

  /* ── Logotipo de marca en SVG ────────────────────────────────────
     Misma geometría que icons/logo-mark.png (cuatro bloques en cruz,
     centro vacío, el del oeste marino). En SVG porque el film necesita
     dibujarlo, escalarlo y transformarlo sin perder filo. */
  function logoSVG(size, opts) {
    opts = opts || {};
    const B = LX.LOGO_BLOCKS;
    const path = (b) => {
      const [r1, r2, r3, r4] = b.r;
      return 'M' + (b.x + r1) + ' ' + b.y +
        'H' + (b.x + b.w - r2) + 'a' + r2 + ' ' + r2 + ' 0 0 1 ' + r2 + ' ' + r2 +
        'V' + (b.y + b.h - r3) + 'a' + r3 + ' ' + r3 + ' 0 0 1 ' + -r3 + ' ' + r3 +
        'H' + (b.x + r4) + 'a' + r4 + ' ' + r4 + ' 0 0 1 ' + -r4 + ' ' + -r4 +
        'V' + (b.y + r1) + 'a' + r1 + ' ' + r1 + ' 0 0 1 ' + r1 + ' ' + -r1 + 'Z';
    };
    const id = 'lg' + Math.random().toString(36).slice(2, 7);
    return '<svg class="lx-logo-svg" viewBox="0 0 512 512" width="' + size + '" height="' + size + '" aria-label="Salud Digital">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#22d3ee"/><stop offset="55%" stop-color="#10befb"/><stop offset="100%" stop-color="#0891b2"/>' +
      '</linearGradient>' +
      '<linearGradient id="' + id + 'n" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#2e7be0"/><stop offset="100%" stop-color="#04347c"/>' +
      '</linearGradient></defs>' +
      B.map((b, i) => '<path class="lx-logo-blk" data-blk="' + i + '" d="' + path(b) + '" fill="url(#' + id + (b.c === 'navy' ? 'n' : '') + ')"' +
        (opts.draw ? ' stroke="#10befb" stroke-width="6"' : '') + '/>').join('') +
      '</svg>';
  }

  /* ── Sidebar real (rótulos exactos de layout.js, rol doctor) ──── */
  function sidebar(active) {
    const groups = [
      { label: 'GENERAL', items: [['home', 'Inicio'], ['calendar', 'Citas'], ['users', 'Pacientes'], ['wallet', 'Finanzas']] },
      { label: 'CLÍNICA', items: [['staff', 'Personal'], ['fileText', 'Consentimientos'], ['check', 'Confirmaciones'], ['calendar', 'Citas Online'], ['globe', 'Mi Sitio Web']] },
      { label: 'AJUSTES', items: [['archive', 'Migrar Expedientes'], ['settings', 'Configuración'], ['creditCard', 'Suscripción']] },
    ];
    return '<aside class="lx-sb">' +
      '<div class="lx-sb-logo"><span class="lx-sb-logo-i">' + logoSVG(30) + '</span><span>Salud Digital</span></div>' +
      '<div class="lx-sb-profile"><div class="lx-sb-av">FR</div><div><div class="lx-sb-spec">Podología</div>' +
      '<div class="lx-sb-name">Dra. Fabiola Rivera</div><div class="lx-sb-clinic">Clínica Centro</div></div></div>' +
      groups.map((g) =>
        '<div class="lx-sb-group"><div class="lx-sb-glabel">' + g.label + '</div>' +
        g.items.map((it) =>
          '<div class="lx-sb-item' + (it[1] === active ? ' on' : '') + '" data-nav="' + it[1] + '">' +
          svg(it[0], 17) + '<span>' + it[1] + '</span></div>').join('') +
        '</div>').join('') +
      '</aside>';
  }

  /* ── Inicio: el dashboard real ─────────────────────────────────── */
  function statCard(icon, label, value, sub, id) {
    return '<div class="lx-stat"><div class="lx-stat-ico">' + svg(icon, 26) + '</div>' +
      '<div><div class="lx-stat-label">' + label + '</div>' +
      '<div class="lx-stat-value"' + (id ? ' data-count="' + id + '"' : '') + '>' + value + '</div>' +
      '<div class="lx-stat-sub">' + sub + '</div></div></div>';
  }

  const APPTS = [
    ['08:30', 'Andrea Guardado', 'Control post-operatorio', 'confirmed', 'Confirmada'],
    ['09:15', 'Carlos Ramírez', 'Primera consulta', 'confirmed', 'Confirmada'],
    ['10:00', 'María Fernanda López', 'Curación', 'waiting', 'En espera'],
    ['11:30', 'José Antonio Cruz', 'Onicomicosis · control', 'pending', 'Pendiente'],
    ['14:00', 'Lucía Mejía', 'Estudio de la pisada', 'confirmed', 'Confirmada'],
    ['15:20', 'Roberto Zelaya', 'Pie diabético · revisión', 'pending', 'Pendiente'],
  ];

  function apptRow(a, extra) {
    return '<div class="lx-appt' + (extra || '') + '"><div class="lx-appt-time">' + a[0] + '</div>' +
      '<div class="lx-appt-body"><div class="lx-appt-name">' + a[1] + '</div>' +
      '<div class="lx-appt-note">' + a[2] + '</div></div>' +
      '<span class="lx-badge s-' + a[3] + '"><i></i>' + a[4] + '</span></div>';
  }

  function donut() {
    return '<svg class="lx-donut" viewBox="0 0 200 200">' +
      '<defs><linearGradient id="lxDonut" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#0891b2"/><stop offset="100%" stop-color="#22d3ee"/></linearGradient></defs>' +
      '<circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="22"/>' +
      '<circle class="lx-donut-arc" cx="100" cy="100" r="80" fill="none" stroke="url(#lxDonut)" stroke-width="22"' +
      ' stroke-linecap="round" transform="rotate(-90 100 100)" stroke-dasharray="502.65" stroke-dashoffset="502.65"/>' +
      '</svg>';
  }

  function miniCal() {
    let cells = '';
    const dows = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
    dows.forEach((d) => (cells += '<span class="lx-cal-dow">' + d + '</span>'));
    for (let i = 0; i < 3; i++) cells += '<span class="lx-cal-d off"></span>';
    for (let d = 1; d <= 28; d++) {
      const dot = [4, 9, 12, 18, 21, 24, 27].indexOf(d) >= 0;
      cells += '<span class="lx-cal-d' + (d === 21 ? ' today' : '') + (dot ? ' has' : '') + '">' + d + '</span>';
    }
    return '<div class="lx-cal">' + cells + '</div>';
  }

  function sectionInicio() {
    return '<div class="lx-banner">' +
      '<div class="lx-banner-orb a"></div><div class="lx-banner-orb b"></div>' +
      '<div class="lx-banner-txt"><div class="lx-banner-badge">Lunes, 21 de agosto</div>' +
      '<h2>Buenos días, Dra. Rivera</h2><p>Tienes 6 citas hoy · 2 pendientes de confirmar</p></div>' +
      '<div class="lx-banner-mini">' +
      '<div class="lx-mini"><div class="lx-mini-ico">' + svg('calendar', 18) + '</div><b data-count="hoy">6</b><span>Citas hoy</span></div>' +
      '<div class="lx-mini"><div class="lx-mini-ico">' + svg('users', 18) + '</div><b data-count="pac">428</b><span>Pacientes</span></div>' +
      '</div></div>' +
      '<div class="lx-stats">' +
      statCard('users', 'Total Pacientes', '428', 'Registrados en el sistema', 'pac2') +
      statCard('calendar', 'Citas de Hoy', '6', 'Programadas para hoy', 'hoy2') +
      statCard('wallet', 'Ingresos del Mes', 'L. 84,250', 'Consultas pagadas', 'ing') +
      '</div>' +
      '<div class="lx-row2">' +
      '<div class="lx-card"><div class="lx-card-hdr"><span class="lx-card-title">Resumen de Pacientes</span>' +
      '<span class="lx-card-badge">428 total</span></div>' +
      '<div class="lx-donut-wrap">' + donut() +
      '<div class="lx-donut-c"><b data-count="donut">6</b><span>con cita hoy</span></div>' +
      '<div class="lx-legend">' +
      '<div class="lx-lg"><span class="lx-lg-l">Con cita hoy</span><span class="lx-lg-v">6 · 1.4%</span><div class="lx-lg-bar"><i style="width:0%" data-bar="6"></i></div></div>' +
      '<div class="lx-lg"><span class="lx-lg-l">Sin cita hoy</span><span class="lx-lg-v">422 · 98.6%</span><div class="lx-lg-bar"><i style="width:0%" data-bar="98"></i></div></div>' +
      '</div></div></div>' +
      '<div class="lx-card"><div class="lx-card-hdr"><span class="lx-card-title">Citas de Hoy</span>' +
      '<span class="lx-card-badge">6</span></div>' +
      '<div class="lx-appts">' + APPTS.slice(0, 3).map((a) => apptRow(a)).join('') + '</div></div>' +
      '</div>' +
      '<div class="lx-row3">' +
      '<div class="lx-card"><div class="lx-card-hdr"><span class="lx-card-title">Próximo Paciente</span>' +
      '<span class="lx-badge s-waiting"><i></i>En espera</span></div>' +
      '<div class="lx-next"><div class="lx-next-av">MF</div><div><b>María Fernanda López</b><span>10:00 · Curación</span></div></div>' +
      '<div class="lx-next-meta"><span>' + svg('phone', 14) + ' 9812-4471</span><span>' + svg('clock', 14) + ' 30 min</span></div></div>' +
      '<div class="lx-card"><div class="lx-card-hdr"><span class="lx-card-title">Agosto 2026</span>' +
      '<span class="lx-card-badge">Hoy 21</span></div>' + miniCal() + '</div>' +
      '<div class="lx-card"><div class="lx-card-hdr"><span class="lx-card-title">Pulso clínico</span>' +
      '<span class="lx-card-badge">En vivo</span></div>' +
      '<svg class="lx-spark" viewBox="0 0 300 70" preserveAspectRatio="none">' +
      '<defs><linearGradient id="lxSpk" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#06b6d4" stop-opacity=".28"/><stop offset="100%" stop-color="#06b6d4" stop-opacity="0"/></linearGradient></defs>' +
      '<path class="lx-spark-fill" d="M0 55 L30 52 L55 48 L80 50 L105 34 L120 60 L135 12 L150 62 L165 40 L195 42 L225 30 L260 34 L300 22 L300 70 L0 70 Z" fill="url(#lxSpk)" opacity="0"/>' +
      '<path class="lx-spark-line" d="M0 55 L30 52 L55 48 L80 50 L105 34 L120 60 L135 12 L150 62 L165 40 L195 42 L225 30 L260 34 L300 22" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>' +
      '<div class="lx-spark-meta"><span>Consultas / semana</span><b>+18%</b></div></div>' +
      '</div>';
  }

  /* ── Pacientes ─────────────────────────────────────────────────── */
  const PATIENTS = [
    ['AG', 'Andrea Guardado', '9945-1120', '18 ago 2026', 'Pie diabético'],
    ['CR', 'Carlos Ramírez', '3312-8890', '17 ago 2026', 'Onicocriptosis'],
    ['ML', 'María Fernanda López', '9812-4471', '14 ago 2026', 'Curación'],
    ['JC', 'José Antonio Cruz', '8874-2210', '12 ago 2026', 'Onicomicosis'],
    ['LM', 'Lucía Mejía', '9120-5567', '09 ago 2026', 'Estudio de la pisada'],
    ['RZ', 'Roberto Zelaya', '3345-9902', '05 ago 2026', 'Control mensual'],
    ['DS', 'Daniela Suazo', '9987-1123', '02 ago 2026', 'Primera consulta'],
  ];
  function sectionPacientes() {
    return '<div class="lx-sec-hdr"><h2>Pacientes</h2>' +
      '<div class="lx-sec-tools"><span class="lx-search">' + svg('users', 15) + 'Buscar paciente…</span>' +
      '<span class="lx-btn">Nuevo paciente</span></div></div>' +
      '<div class="lx-card lx-flat"><table class="lx-table"><thead><tr>' +
      '<th>Paciente</th><th>Teléfono</th><th>Última visita</th><th>Motivo</th><th></th></tr></thead><tbody>' +
      PATIENTS.map((p, i) =>
        '<tr class="lx-tr' + (i === 2 ? ' hl' : '') + '"><td><div class="lx-cellp"><span class="lx-av">' + p[0] + '</span>' + p[1] + '</div></td>' +
        '<td class="num">' + p[2] + '</td><td class="num">' + p[3] + '</td><td>' + p[4] + '</td>' +
        '<td class="ra">' + svg('fileText', 15) + '</td></tr>').join('') +
      '</tbody></table></div>';
  }

  /* ── Citas ─────────────────────────────────────────────────────── */
  function sectionCitas() {
    return '<div class="lx-sec-hdr"><h2>Citas</h2>' +
      '<div class="lx-sec-tools"><span class="lx-seg"><i class="on">Día</i><i>Semana</i><i>Mes</i></span>' +
      '<span class="lx-btn">Nueva cita</span></div></div>' +
      '<div class="lx-agenda">' +
      '<div class="lx-card lx-flat lx-agenda-list">' + APPTS.map((a) => apptRow(a)).join('') + '</div>' +
      '<div class="lx-card lx-flat lx-agenda-grid">' +
      ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'].map((h, i) =>
        '<div class="lx-slot"><span>' + h + '</span><div class="lx-slot-line">' +
        (i === 0 ? '<div class="lx-blk a" style="left:36%;width:26%">Andrea G.</div>' : '') +
        (i === 1 ? '<div class="lx-blk b" style="left:14%;width:30%">Carlos R.</div>' : '') +
        (i === 2 ? '<div class="lx-blk c" style="left:2%;width:38%">M. Fernanda L.</div>' : '') +
        (i === 3 ? '<div class="lx-blk a" style="left:48%;width:24%">José A. C.</div>' : '') +
        (i === 6 ? '<div class="lx-blk b" style="left:6%;width:34%">Lucía M.</div>' : '') +
        (i === 7 ? '<div class="lx-blk c" style="left:30%;width:28%">Roberto Z.</div>' : '') +
        '</div></div>').join('') +
      '</div></div>';
  }

  /* ── Expediente clínico (con las alertas reales de style.css) ──── */
  function sectionExpediente() {
    return '<div class="lx-sec-hdr"><h2>Expediente · Andrea Guardado</h2>' +
      '<div class="lx-sec-tools"><span class="lx-badge s-confirmed"><i></i>Historial completo</span>' +
      '<span class="lx-btn">Nueva consulta</span></div></div>' +
      '<div class="lx-alerts">' +
      '<div class="lx-alert allergy"><b>Alergia</b> Penicilina — reacción cutánea documentada</div>' +
      '<div class="lx-alert med"><b>Medicación</b> Metformina 850 mg · 2 veces al día</div>' +
      '<div class="lx-alert cond"><b>Condición</b> Diabetes tipo 2 · control desde 2021</div>' +
      '</div>' +
      '<div class="lx-row2">' +
      '<div class="lx-card"><div class="lx-card-hdr"><span class="lx-card-title">Consultas</span>' +
      '<span class="lx-card-badge">12 registros</span></div>' +
      '<table class="lx-table sm"><thead><tr><th>Fecha</th><th>Diagnóstico</th><th>Doctor</th></tr></thead><tbody>' +
      [['18 ago 2026', 'Úlcera plantar grado 1', 'Dra. Rivera'],
       ['04 ago 2026', 'Control pie diabético', 'Dra. Rivera'],
       ['21 jul 2026', 'Curación y descarga', 'Dr. Mendoza'],
       ['08 jul 2026', 'Valoración inicial', 'Dra. Rivera']]
        .map((r) => '<tr class="lx-tr"><td class="num">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('') +
      '</tbody></table></div>' +
      '<div class="lx-card"><div class="lx-card-hdr"><span class="lx-card-title">Signos vitales</span>' +
      '<span class="lx-card-badge">Hoy</span></div>' +
      '<div class="lx-vitals">' +
      [['Glucosa', '112', 'mg/dL'], ['Presión', '124/78', 'mmHg'], ['Peso', '68.4', 'kg'], ['Sat. O₂', '98', '%']]
        .map((v) => '<div class="lx-vital"><span>' + v[0] + '</span><b>' + v[1] + '</b><i>' + v[2] + '</i></div>').join('') +
      '</div>' +
      '<div class="lx-imgnote">' + svg('shield', 15) + ' Cifrado en reposo · acceso registrado</div>' +
      '</div></div>';
  }

  /* ── Personal ──────────────────────────────────────────────────── */
  function sectionPersonal() {
    const staff = [
      ['FR', 'Dra. Fabiola Rivera', 'Podología', 'on'],
      ['JM', 'Dr. Julio Mendoza', 'Podología', 'on'],
      ['AM', 'Dra. Ana Mejía', 'Nutrición', 'off'],
      ['SP', 'Sofía Portillo', 'Recepción', 'on'],
      ['EC', 'Dr. Enrique Cálix', 'Ortodoncia', 'off'],
      ['MV', 'Marcela Vargas', 'Asistente', 'on'],
    ];
    return '<div class="lx-sec-hdr"><h2>Personal</h2>' +
      '<div class="lx-sec-tools"><span class="lx-badge s-confirmed"><i></i>6 activos</span>' +
      '<span class="lx-btn">Invitar</span></div></div>' +
      '<div class="lx-staff">' + staff.map((s) =>
        '<div class="lx-card lx-staff-c"><span class="lx-av lg">' + s[0] + '</span>' +
        '<b>' + s[1] + '</b><span class="lx-staff-spec">' + s[2] + '</span>' +
        '<span class="lx-dot ' + s[3] + '"></span></div>').join('') + '</div>';
  }

  /* ── Finanzas ──────────────────────────────────────────────────── */
  function sectionFinanzas() {
    const bars = [42, 58, 36, 71, 64, 88, 76, 95, 62, 80, 91, 100];
    return '<div class="lx-sec-hdr"><h2>Finanzas</h2>' +
      '<div class="lx-sec-tools"><span class="lx-seg"><i>7 días</i><i class="on">Mes</i><i>Año</i></span></div></div>' +
      '<div class="lx-stats">' +
      statCard('wallet', 'Ingresos del Mes', 'L. 84,250', '+18% vs. julio') +
      statCard('activity', 'Ganancia del mes', 'L. 61,900', 'Margen 73%') +
      statCard('fileText', 'Consultas por Pagar', '7', 'L. 5,400 pendientes') +
      '</div>' +
      '<div class="lx-card"><div class="lx-card-hdr"><span class="lx-card-title">Ingresos últimos 12 meses</span>' +
      '<span class="lx-card-badge">Lempiras</span></div>' +
      '<div class="lx-bars">' + bars.map((b) =>
        '<div class="lx-bar"><i style="height:' + b + '%"></i></div>').join('') + '</div>' +
      '<div class="lx-bars-x">' + ['S', 'O', 'N', 'D', 'E', 'F', 'M', 'A', 'M', 'J', 'J', 'A']
        .map((m) => '<span>' + m + '</span>').join('') + '</div></div>';
  }

  /* ── Envoltura de sección: cromo de ventana + sidebar ──────────── */
  function frame(title, inner, opts) {
    opts = opts || {};
    return '<div class="lx-app' + (opts.cls ? ' ' + opts.cls : '') + '">' +
      '<div class="lx-chrome"><span class="lx-dotr"></span><span class="lx-doty"></span><span class="lx-dotg"></span>' +
      '<span class="lx-url">' + svg('shield', 12) + ' portalsaluddigital.com/' + (opts.path || '') + '</span></div>' +
      '<div class="lx-body">' + (opts.noSb ? '' : sidebar(title)) +
      '<main class="lx-main">' + inner + '</main></div>' +
      '</div>';
  }

  LX.UI = {
    svg, icons: I, logoSVG, sidebar, frame,
    inicio: sectionInicio, pacientes: sectionPacientes, citas: sectionCitas,
    expediente: sectionExpediente, personal: sectionPersonal, finanzas: sectionFinanzas,
    apptRow, APPTS, PATIENTS,
  };
})();
