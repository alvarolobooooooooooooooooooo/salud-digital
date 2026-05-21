// ── /api/growth — Pulso Clínico (AI Growth Copilot) ──
// Devuelve métricas reales derivadas de la BD (appointments, clinic_landing_leads,
// appointment_confirmations) + un layer derivado de campañas y atribución.
// Las "campañas" son por ahora derivadas heurísticamente del campo
// appointments.source y de leads de la landing (source). Cuando se integre Meta/Google
// API, este archivo será el único punto donde se cambie la fuente.

const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

function ensureGrowthAccess(req, res, next) {
  if (!['clinic_admin', 'doctor', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  next();
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// Margen y ticket promedio razonables (HNL) por especialidad — calibrables.
// Usados para estimar ingresos atribuidos cuando appointments.cost = 0.
const SPECIALTY_DEFAULTS = {
  'dermatología':       { ticket: 900,  margin: 0.55, ltv: 3200 },
  'odontología':        { ticket: 1200, margin: 0.45, ltv: 5800 },
  'ginecología':        { ticket: 850,  margin: 0.50, ltv: 2400 },
  'pediatría':          { ticket: 650,  margin: 0.40, ltv: 4500 },
  'cardiología':        { ticket: 1500, margin: 0.55, ltv: 5200 },
  'medicina general':   { ticket: 500,  margin: 0.35, ltv: 1800 },
  'nutrición':          { ticket: 700,  margin: 0.50, ltv: 4200 },
  'psicología':         { ticket: 800,  margin: 0.55, ltv: 6400 },
  'estética médica':    { ticket: 2200, margin: 0.60, ltv: 7800 },
  'ortopedia':          { ticket: 1100, margin: 0.45, ltv: 3200 },
};
function defaultsFor(specialty) {
  const k = (specialty || '').toString().trim().toLowerCase();
  return SPECIALTY_DEFAULTS[k] || { ticket: 700, margin: 0.4, ltv: 2500 };
}

// Detecta si appointment fue atribuible a una campaña pagada (rough heuristic).
// `source` es 'manual' por default; lo no manual lo tratamos como adquirido.
function isAcquired(source) {
  if (!source) return false;
  const s = String(source).toLowerCase();
  return s !== 'manual' && s !== '';
}

// Inversión estimada por canal (HNL diarios) — placeholder cuando aún no hay integración
// activa con Meta/Google API. Cuando exista una fila en growth_campaigns para la clínica
// en el período, getRealSpend() la usa y este fallback queda inerte.
const CHANNEL_DAILY_SPEND_HNL = {
  meta:       1200,
  google:     800,
  tiktok:     400,
  landing:    0,       // orgánico (sitio web propio)
  whatsapp:   0,
  referral:   0,
  manual:     0,
};
function spendForEstimated(channel, days = 30) {
  const k = (channel || 'manual').toLowerCase();
  const daily = CHANNEL_DAILY_SPEND_HNL[k] != null ? CHANNEL_DAILY_SPEND_HNL[k] : 600;
  return daily * days;
}

// Devuelve { source: 'real'|'estimated', spendByChannel: { meta: 1234.56, ... } }
// Si la clínica tiene growth_campaigns sincronizadas en el período, gana lo real.
// Si no, devuelve estimaciones para los canales con citas atribuidas.
async function getSpendByChannel(clinicId, channels, days = 30) {
  const out = {};
  let source = 'estimated';
  try {
    const r = await query(
      `SELECT provider, COALESCE(SUM(spent_hnl),0) AS spent
         FROM growth_campaigns
        WHERE clinic_id = $1
          AND period_start >= CURRENT_DATE - ($2::int || ' days')::interval
        GROUP BY provider`,
      [clinicId, days]
    );
    if (r.rows.length > 0) {
      source = 'real';
      for (const row of r.rows) {
        out[(row.provider || '').toLowerCase()] = Number(row.spent) || 0;
      }
    }
  } catch (_) { /* tabla puede no existir aún */ }
  // Completar canales que no aparecieron en la BD real (fallback estimado)
  for (const ch of channels) {
    const k = (ch || '').toLowerCase();
    if (out[k] == null && isAcquired(k)) {
      out[k] = spendForEstimated(k, days);
    }
  }
  return { source, spendByChannel: out };
}

// ─── /summary — KPIs principales ───────────────────────────────────────────
router.get('/summary', authenticate, ensureGrowthAccess, async (req, res) => {
  try {
    const clinicId = req.user.clinic_id;
    if (!clinicId) return res.json(emptySummary());

    // Citas del mes
    const monthApps = await query(
      `SELECT a.specialty, a.status, a.cost, a.payment_status, a.source, a.scheduled_at
         FROM appointments a
        WHERE a.clinic_id = $1
          AND a.scheduled_at::date >= date_trunc('month', CURRENT_DATE)`,
      [clinicId]
    );

    // Leads del mes (landing + cualquier otra fuente)
    let leadsCount = 0;
    try {
      const r = await query(
        `SELECT COUNT(*)::int AS c
           FROM clinic_landing_leads
          WHERE clinic_id = $1
            AND created_at >= date_trunc('month', CURRENT_DATE)`,
        [clinicId]
      );
      leadsCount = r.rows[0]?.c || 0;
    } catch (_) {}

    let attended = 0, scheduled = 0, completed = 0, noShows = 0;
    let acquiredAttended = 0;
    let revenueMonth = 0;
    let estimatedRevenue = 0;

    for (const a of monthApps.rows) {
      scheduled++;
      const status = (a.status || '').toLowerCase();
      const acquired = isAcquired(a.source);
      const def = defaultsFor(a.specialty);
      const ticket = Number(a.cost) > 0 ? Number(a.cost) : def.ticket;

      if (['completed', 'waiting', 'in_progress', 'finished', 'paid'].includes(status)) {
        attended++;
        if (acquired) acquiredAttended++;
        if (status === 'completed' || status === 'finished' || status === 'paid' || a.payment_status === 'paid') {
          completed++;
          revenueMonth += Number(a.cost) || 0;
        }
        estimatedRevenue += ticket;
      } else if (['no_show', 'noshow', 'no-show'].includes(status)) {
        noShows++;
      }
    }

    // Inversión publicitaria del mes — real si hay integración activa, estimada si no.
    const channels = new Set(monthApps.rows.map(r => (r.source || 'manual').toLowerCase()));
    const { source: spendSource, spendByChannel } = await getSpendByChannel(clinicId, channels, 30);
    let spendMonth = 0;
    for (const v of Object.values(spendByChannel)) spendMonth += Number(v) || 0;

    const roi = spendMonth > 0 ? +(estimatedRevenue / spendMonth).toFixed(2) : 0;
    const cppa = acquiredAttended > 0 ? Math.round(spendMonth / acquiredAttended) : 0;
    const attendanceRate = scheduled > 0 ? Math.round((attended / scheduled) * 100) : 0;
    const noShowRate = scheduled > 0 ? Math.round((noShows / scheduled) * 100) : 0;

    res.json({
      invested_month: Math.round(spendMonth),
      revenue_month: Math.round(revenueMonth),
      revenue_estimated: Math.round(estimatedRevenue),
      patients_attended: attended,
      patients_acquired: acquiredAttended,
      leads_month: leadsCount,
      appointments_month: scheduled,
      roi,
      cppa,
      attendance_rate: attendanceRate,
      no_show_rate: noShowRate,
      spend_source: spendSource, // 'real' | 'estimated'
    });
  } catch (err) {
    console.error('[growth/summary]', err);
    res.json(emptySummary());
  }
});

function emptySummary() {
  return {
    invested_month: 0, revenue_month: 0, revenue_estimated: 0,
    patients_attended: 0, patients_acquired: 0, leads_month: 0,
    appointments_month: 0, roi: 0, cppa: 0,
    attendance_rate: 0, no_show_rate: 0,
  };
}

// ─── /occupancy — Ocupación de agenda por especialidad ─────────────────────
router.get('/occupancy', authenticate, ensureGrowthAccess, async (req, res) => {
  try {
    const clinicId = req.user.clinic_id;
    if (!clinicId) return res.json([]);

    // Cupos teóricos: sumamos 30 cupos/semana por doctor activo en una especialidad.
    // Es una aproximación; cuando exista una tabla `doctor_availability` rica, se reemplaza.
    const doctors = await query(
      `SELECT specialty, COUNT(*)::int AS doctors
         FROM users
        WHERE clinic_id = $1 AND role = 'doctor' AND specialty <> ''
        GROUP BY specialty`,
      [clinicId]
    );

    // Citas próximas 7 días por especialidad
    const upcoming = await query(
      `SELECT specialty, COUNT(*)::int AS booked
         FROM appointments
        WHERE clinic_id = $1
          AND scheduled_at::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
          AND status NOT IN ('canceled','cancelled')
        GROUP BY specialty`,
      [clinicId]
    );

    const bookedMap = Object.fromEntries(upcoming.rows.map(r => [r.specialty || '', r.booked || 0]));

    const result = doctors.rows.map(d => {
      const totalSlots = (d.doctors || 0) * 30;          // 30 cupos/semana por doctor
      const booked = bookedMap[d.specialty] || 0;
      const occ = totalSlots > 0 ? Math.min(100, Math.round((booked / totalSlots) * 100)) : 0;
      const def = defaultsFor(d.specialty);
      return {
        specialty: d.specialty,
        doctors: d.doctors,
        total_slots: totalSlots,
        booked,
        free: Math.max(0, totalSlots - booked),
        occupancy: occ,
        ticket: def.ticket,
        margin: def.margin,
      };
    }).sort((a, b) => a.occupancy - b.occupancy);

    res.json(result);
  } catch (err) {
    console.error('[growth/occupancy]', err);
    res.json([]);
  }
});

// ─── /funnel — Embudo de pacientes (30 días) ───────────────────────────────
router.get('/funnel', authenticate, ensureGrowthAccess, async (req, res) => {
  try {
    const clinicId = req.user.clinic_id;
    if (!clinicId) return res.json([]);

    let leads = 0, responded = 0;
    try {
      const r = await query(
        `SELECT
            COUNT(*)::int AS leads,
            COUNT(*) FILTER (WHERE status <> 'new')::int AS responded
           FROM clinic_landing_leads
          WHERE clinic_id = $1
            AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
        [clinicId]
      );
      leads = r.rows[0]?.leads || 0;
      responded = r.rows[0]?.responded || 0;
    } catch (_) {}

    const apps = await query(
      `SELECT a.status, a.payment_status,
              COALESCE(ac.status, '') AS conf_status
         FROM appointments a
         LEFT JOIN appointment_confirmations ac ON ac.appointment_id = a.id
        WHERE a.clinic_id = $1
          AND a.scheduled_at::date >= CURRENT_DATE - INTERVAL '30 days'`,
      [clinicId]
    );

    let scheduled = 0, confirmed = 0, attended = 0, paid = 0;
    for (const a of apps.rows) {
      scheduled++;
      if (a.conf_status === 'confirmed') confirmed++;
      const s = (a.status || '').toLowerCase();
      if (['completed','waiting','in_progress','finished','paid'].includes(s)) attended++;
      if (a.payment_status === 'paid' || s === 'paid') paid++;
    }

    const total = Math.max(leads, scheduled);
    const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;

    res.json([
      { stage: 'Leads',       value: leads,     pct: pct(leads) || 100 },
      { stage: 'Respondidos', value: responded, pct: pct(responded) },
      { stage: 'Agendados',   value: scheduled, pct: pct(scheduled) },
      { stage: 'Confirmados', value: confirmed, pct: pct(confirmed) },
      { stage: 'Asistieron',  value: attended,  pct: pct(attended) },
      { stage: 'Pagaron',     value: paid,      pct: pct(paid) },
    ]);
  } catch (err) {
    console.error('[growth/funnel]', err);
    res.json([]);
  }
});

// ─── /campaigns — Mock derivado por canal (provisional hasta integrar APIs) ─
router.get('/campaigns', authenticate, ensureGrowthAccess, async (req, res) => {
  try {
    const clinicId = req.user.clinic_id;
    if (!clinicId) return res.json([]);

    // Agregamos appointments por (source, specialty) en los últimos 30 días
    const rows = await query(
      `SELECT
          COALESCE(NULLIF(a.source,''),'manual') AS channel,
          COALESCE(NULLIF(a.specialty,''),'general') AS specialty,
          COUNT(*)::int AS appointments,
          COUNT(*) FILTER (WHERE LOWER(a.status) IN ('completed','waiting','in_progress','finished','paid'))::int AS attended,
          COALESCE(SUM(a.cost),0)::numeric AS revenue
         FROM appointments a
        WHERE a.clinic_id = $1
          AND a.scheduled_at::date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY channel, specialty
        ORDER BY attended DESC, appointments DESC
        LIMIT 12`,
      [clinicId]
    );

    // Inversión por canal (real si hay integración activa, estimada si no)
    const channelSet = new Set(rows.rows.map(r => (r.channel || '').toLowerCase()));
    const { spendByChannel } = await getSpendByChannel(clinicId, channelSet, 30);

    // Reparte el gasto del canal proporcionalmente entre las (channel, specialty) que lo usaron
    const apptsByChannel = {};
    for (const r of rows.rows) {
      const k = (r.channel || '').toLowerCase();
      apptsByChannel[k] = (apptsByChannel[k] || 0) + (r.appointments || 0);
    }

    const campaigns = rows.rows
      .filter(r => isAcquired(r.channel) || r.attended > 0)
      .map((r, i) => {
        const def = defaultsFor(r.specialty);
        const k = (r.channel || '').toLowerCase();
        const totalSpend = spendByChannel[k] || 0;
        const share = apptsByChannel[k] > 0 ? (r.appointments / apptsByChannel[k]) : 0;
        const spent = Math.round(totalSpend * share);
        const revenue = Number(r.revenue) > 0
          ? Number(r.revenue)
          : (r.attended * def.ticket);
        const cppa = r.attended > 0 ? Math.round(spent / r.attended) : 0;
        const roi = spent > 0 ? +(revenue / spent).toFixed(2) : 0;

        let status = 'green';
        if (roi < 1.0 && spent > 0) status = 'red';
        else if (roi < 2.0) status = 'amber';

        const name = `${capitalize(r.specialty)} · ${labelChannel(r.channel)}`;
        return {
          id: `c${i+1}`,
          name,
          channel: labelChannel(r.channel),
          specialty: r.specialty,
          spent: Math.round(spent),
          appointments: r.appointments,
          attended: r.attended,
          cppa,
          roi,
          status,
        };
      });

    res.json(campaigns);
  } catch (err) {
    console.error('[growth/campaigns]', err);
    res.json([]);
  }
});

function labelChannel(c) {
  const k = (c || '').toLowerCase();
  if (k === 'meta' || k === 'facebook' || k === 'instagram') return 'Meta';
  if (k === 'google' || k === 'google_ads') return 'Google';
  if (k === 'tiktok') return 'TikTok';
  if (k === 'landing') return 'Landing';
  if (k === 'whatsapp') return 'WhatsApp';
  if (k === 'referral') return 'Referido';
  if (k === 'manual') return 'Manual';
  return c || '—';
}
function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── /recommendations — Reglas IF-THEN-WHY ─────────────────────────────────
router.get('/recommendations', authenticate, ensureGrowthAccess, async (req, res) => {
  try {
    const clinicId = req.user.clinic_id;
    const recs = [];
    if (!clinicId) return res.json(recs);

    // Reusa los endpoints internos para no duplicar lógica
    const occupancy = await getOccupancy(clinicId);
    const summary = await getSummary(clinicId);

    // R1: especialidad con agenda < 60% Y margen alto → activar campaña
    for (const o of occupancy) {
      if (o.occupancy < 60 && o.margin >= 0.45 && o.free >= 5) {
        const expected = Math.round(o.free * o.ticket * 0.6);
        recs.push({
          id: `r-empty-${o.specialty}`,
          title: `Activar campaña de ${capitalize(o.specialty)}`,
          detail: `Tenés ${o.free} cupos libres esta semana y margen ${Math.round(o.margin*100)}%. Una campaña ligera podría llenar parte de la agenda.`,
          impact_hnl: expected,
          priority: 1,
          action: 'generate_ad',
          payload: { specialty: o.specialty },
        });
      }
    }

    // R2: tasa de no-show alta
    if (summary.no_show_rate >= 20 && summary.appointments_month >= 10) {
      recs.push({
        id: 'r-noshow',
        title: 'Reducir no-shows con depósito o confirmación 24h',
        detail: `Tu tasa de no-shows es ${summary.no_show_rate}%. Activar recordatorio 24h + 2h antes y/o pedir depósito simbólico puede recuperar ingresos.`,
        impact_hnl: Math.round(summary.appointments_month * (summary.no_show_rate/100) * 500),
        priority: 2,
        action: 'configure_reminders',
      });
    }

    // R3: ROI alto general → escalar
    if (summary.roi >= 3.5 && summary.invested_month > 0) {
      recs.push({
        id: 'r-scale',
        title: 'Aumentar presupuesto 20% en campañas activas',
        detail: `Tu ROI es ${summary.roi}x. Aumentar presupuesto en campañas ganadoras suele mantener eficiencia con más volumen.`,
        impact_hnl: Math.round(summary.revenue_estimated * 0.2),
        priority: 3,
        action: 'scale_budget',
      });
    }

    // R4: pocos asistidos pero muchos leads → revisar WhatsApp/copy
    if (summary.leads_month >= 30 && summary.patients_attended > 0 &&
        summary.patients_attended / summary.leads_month < 0.15) {
      recs.push({
        id: 'r-funnel',
        title: 'Revisar respuesta de recepción y copy del anuncio',
        detail: `Llegan ${summary.leads_month} leads pero solo ${summary.patients_attended} asistieron (${Math.round((summary.patients_attended/summary.leads_month)*100)}%). Revisar tiempo de respuesta en WhatsApp y el copy del anuncio.`,
        impact_hnl: Math.round(summary.leads_month * 0.1 * 700),
        priority: 2,
        action: 'audit_whatsapp',
      });
    }

    // R5: sin datos → onboarding
    if (recs.length === 0 && summary.appointments_month === 0) {
      recs.push({
        id: 'r-onboarding',
        title: 'Conectá tu primer canal para activar Pulso AI',
        detail: 'Aún no detectamos campañas activas. Configurá WhatsApp Business o Meta Ads para empezar a recibir recomendaciones personalizadas.',
        impact_hnl: 0,
        priority: 1,
        action: 'connect_integrations',
      });
    }

    recs.sort((a, b) => b.impact_hnl - a.impact_hnl || a.priority - b.priority);
    res.json(recs.slice(0, 6));
  } catch (err) {
    console.error('[growth/recommendations]', err);
    res.json([]);
  }
});

// ─── /alerts — Alertas en tiempo real ──────────────────────────────────────
router.get('/alerts', authenticate, ensureGrowthAccess, async (req, res) => {
  try {
    const clinicId = req.user.clinic_id;
    const alerts = [];
    if (!clinicId) return res.json(alerts);

    // A1: leads sin atender > 24h
    try {
      const r = await query(
        `SELECT COUNT(*)::int AS c
           FROM clinic_landing_leads
          WHERE clinic_id = $1
            AND status = 'new'
            AND created_at < NOW() - INTERVAL '24 hours'`,
        [clinicId]
      );
      const c = r.rows[0]?.c || 0;
      if (c > 0) {
        alerts.push({
          tone: 'red',
          text: `${c} lead${c>1?'s':''} sin respuesta hace más de 24h. Cada hora pierde un 7% de probabilidad de cita.`,
        });
      }
    } catch (_) {}

    // A2: agenda mañana < 40% en cualquier especialidad
    const occupancy = await getOccupancy(clinicId);
    for (const o of occupancy) {
      if (o.occupancy < 40 && o.total_slots > 5) {
        alerts.push({
          tone: 'amber',
          text: `${capitalize(o.specialty)} tiene ${o.free} cupos libres esta semana (${o.occupancy}% ocupación).`,
        });
      }
    }

    // A3: no-show rate alto
    const summary = await getSummary(clinicId);
    if (summary.no_show_rate >= 25) {
      alerts.push({
        tone: 'red',
        text: `Tasa de no-show: ${summary.no_show_rate}%. Considerá depósito o confirmación previa.`,
      });
    }

    // A4: positiva — ROI alto
    if (summary.roi >= 3.5) {
      alerts.push({
        tone: 'sky',
        text: `ROI global ${summary.roi}x. Vas en buen camino — considerá escalar las campañas ganadoras.`,
      });
    }

    if (alerts.length === 0) {
      alerts.push({ tone: 'sky', text: 'Sin alertas críticas. Pulso seguirá monitoreando tu agenda y campañas.' });
    }

    res.json(alerts.slice(0, 6));
  } catch (err) {
    console.error('[growth/alerts]', err);
    res.json([]);
  }
});

// ─── /opportunities — Próximas oportunidades de crecimiento ────────────────
router.get('/opportunities', authenticate, ensureGrowthAccess, async (req, res) => {
  try {
    const clinicId = req.user.clinic_id;
    if (!clinicId) return res.json([]);
    const occupancy = await getOccupancy(clinicId);

    const ops = occupancy
      .filter(o => o.free > 0 && o.total_slots > 0)
      .slice(0, 5)
      .map(o => ({
        title: `${capitalize(o.specialty)}: ${o.free} cupos libres`,
        impact_hnl: Math.round(o.free * o.ticket * 0.5),
        tone: o.occupancy < 50 ? 'green' : 'sky',
      }));
    res.json(ops);
  } catch (err) {
    console.error('[growth/opportunities]', err);
    res.json([]);
  }
});

// ─── /ad-templates — Generador de anuncios por especialidad ────────────────
router.get('/ad-templates/:specialty', authenticate, ensureGrowthAccess, (req, res) => {
  const tpl = AD_TEMPLATES[req.params.specialty.toLowerCase()] || AD_TEMPLATES['medicina general'];
  res.json(tpl);
});

const AD_TEMPLATES = {
  'dermatología': {
    angle: 'Recuperá tu piel sin parches mágicos.',
    title: 'Adiós al acné. Hola a tu piel real.',
    body: 'Evaluación dermatológica con plan personalizado desde L. 450. Atención por especialista certificado.',
    cta: 'Agendar por WhatsApp',
    whatsapp: '¡Hola! Vi tu interés en nuestro tratamiento de piel. ¿Te gustaría agendar tu evaluación esta semana?',
    audience: 'Mujeres y hombres, 16-45, Tegucigalpa/SPS, intereses en skincare.',
    disclaimer: 'Evitar promesas de "curación garantizada"; los resultados varían.',
  },
  'odontología': {
    angle: 'Sonríe sin pensarlo dos veces.',
    title: 'Blanqueamiento profesional, sin sensibilidad.',
    body: 'Tu sonrisa en 1 sesión desde L. 1,800. Odontólogos certificados.',
    cta: 'Reservar cita',
    whatsapp: '¡Hola! ¿Te gustaría conocer cómo funciona nuestro blanqueamiento? Te explico en 2 minutos.',
    audience: '22-55, urbanos, profesionales.',
    disclaimer: 'No mostrar antes/después extremos sin disclaimer.',
  },
  'ginecología': {
    angle: 'Tu salud, sin pena ni demoras.',
    title: 'Chequeo ginecológico completo.',
    body: 'Papanicolaou, ecografía y consulta desde L. 850. Trato cálido, especialista mujer.',
    cta: 'Agendar por WhatsApp',
    whatsapp: 'Hola, soy del equipo de la Dra. [Nombre]. ¿Querés agendar tu chequeo? Atendemos con total privacidad.',
    audience: 'Mujeres 18-55.',
    disclaimer: 'Lenguaje respetuoso, evitar urgentismo médico.',
  },
  'pediatría': {
    angle: 'Tu hijo, en manos calmadas.',
    title: 'Control de niño sano, con pediatra que escucha.',
    body: 'Atención integral desde el primer mes. Vacunas y crecimiento.',
    cta: 'Agendar consulta',
    whatsapp: '¡Hola mamá/papá! ¿Querés agendar la consulta? Decime la edad de tu peque y te confirmo cupo.',
    audience: 'Padres 24-42.',
    disclaimer: 'Nunca prometer cura ni desincentivar vacunación.',
  },
  'cardiología': {
    angle: 'Tu corazón no avisa. Adelantate.',
    title: 'Chequeo cardiológico completo.',
    body: 'Electro + consulta + indicaciones. Especialista en hipertensión y arritmias.',
    cta: 'Agendar chequeo',
    whatsapp: 'Hola, ¿querés agendar tu chequeo cardiológico? Te ayudo con el cupo más cercano.',
    audience: '40+ urbanos, familiares de hipertensos.',
    disclaimer: 'No prometer diagnóstico sin evaluación. No alarmar.',
  },
  'medicina general': {
    angle: 'Cuando algo no cuadra, empezá aquí.',
    title: 'Consulta médica general con resultados claros.',
    body: 'Atendido por médicos colegiados. Estudios e indicaciones claras.',
    cta: 'Agendar consulta',
    whatsapp: '¡Hola! Soy del equipo médico. ¿Qué te trae por aquí hoy?',
    audience: '25-65 urbano.',
    disclaimer: 'No reemplazar especialistas en mensajes.',
  },
  'nutrición': {
    angle: 'Sin dietas locas. Resultados que duran.',
    title: 'Plan nutricional personalizado.',
    body: 'Plan adaptado a tu rutina. Seguimiento semanal.',
    cta: 'Agendar evaluación',
    whatsapp: 'Hola, ¿te gustaría conocer cómo trabajamos en consulta? Sin pasarte dietas genéricas.',
    audience: '22-55.',
    disclaimer: 'Evitar "bajá X kilos en Y semanas".',
  },
  'psicología': {
    angle: 'Hablar también es cuidarse.',
    title: 'Terapia con profesional certificado.',
    body: 'Sesiones presenciales y online. Espacio seguro.',
    cta: 'Reservar primera sesión',
    whatsapp: 'Hola, gracias por escribir. Si querés, agendamos una primera sesión para conocernos.',
    audience: '18-50.',
    disclaimer: 'Nunca diagnosticar por chat. Lenguaje empático.',
  },
  'estética médica': {
    angle: 'Vos, pero más descansada.',
    title: 'Tratamientos estéticos con criterio médico.',
    body: 'Procedimientos evaluados por médico estético. Sin promesas exageradas.',
    cta: 'Solicitar información',
    whatsapp: 'Hola, ¿qué tratamiento te interesa? Te paso opciones y precios.',
    audience: 'Mujeres 28-55.',
    disclaimer: 'No usar antes/después dramáticos. Mencionar contraindicaciones.',
  },
};

// ─── helpers internos para reusar lógica de endpoints ──────────────────────
async function getOccupancy(clinicId) {
  const doctors = await query(
    `SELECT specialty, COUNT(*)::int AS doctors
       FROM users
      WHERE clinic_id = $1 AND role = 'doctor' AND specialty <> ''
      GROUP BY specialty`,
    [clinicId]
  );
  const upcoming = await query(
    `SELECT specialty, COUNT(*)::int AS booked
       FROM appointments
      WHERE clinic_id = $1
        AND scheduled_at::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        AND status NOT IN ('canceled','cancelled')
      GROUP BY specialty`,
    [clinicId]
  );
  const bookedMap = Object.fromEntries(upcoming.rows.map(r => [r.specialty || '', r.booked || 0]));
  return doctors.rows.map(d => {
    const totalSlots = (d.doctors || 0) * 30;
    const booked = bookedMap[d.specialty] || 0;
    const occ = totalSlots > 0 ? Math.min(100, Math.round((booked / totalSlots) * 100)) : 0;
    const def = defaultsFor(d.specialty);
    return {
      specialty: d.specialty,
      doctors: d.doctors,
      total_slots: totalSlots,
      booked,
      free: Math.max(0, totalSlots - booked),
      occupancy: occ,
      ticket: def.ticket,
      margin: def.margin,
    };
  });
}

async function getSummary(clinicId) {
  // versión interna minimal — duplicación mínima para no tener side-effects de Express
  const monthApps = await query(
    `SELECT a.specialty, a.status, a.cost, a.payment_status, a.source
       FROM appointments a
      WHERE a.clinic_id = $1
        AND a.scheduled_at::date >= date_trunc('month', CURRENT_DATE)`,
    [clinicId]
  );
  let leadsCount = 0;
  try {
    const r = await query(
      `SELECT COUNT(*)::int AS c FROM clinic_landing_leads
        WHERE clinic_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)`,
      [clinicId]
    );
    leadsCount = r.rows[0]?.c || 0;
  } catch (_) {}

  let attended = 0, scheduled = 0, noShows = 0, acquiredAttended = 0;
  let estimatedRevenue = 0;
  for (const a of monthApps.rows) {
    scheduled++;
    const s = (a.status || '').toLowerCase();
    const def = defaultsFor(a.specialty);
    if (['completed','waiting','in_progress','finished','paid'].includes(s)) {
      attended++;
      if (isAcquired(a.source)) acquiredAttended++;
      estimatedRevenue += (Number(a.cost) > 0 ? Number(a.cost) : def.ticket);
    } else if (['no_show','noshow','no-show'].includes(s)) {
      noShows++;
    }
  }
  const channels = new Set(monthApps.rows.map(r => (r.source || 'manual').toLowerCase()));
  const { spendByChannel } = await getSpendByChannel(clinicId, channels, 30);
  let spendMonth = 0;
  for (const v of Object.values(spendByChannel)) spendMonth += Number(v) || 0;
  const roi = spendMonth > 0 ? +(estimatedRevenue / spendMonth).toFixed(2) : 0;
  return {
    invested_month: spendMonth,
    revenue_estimated: estimatedRevenue,
    patients_attended: attended,
    patients_acquired: acquiredAttended,
    leads_month: leadsCount,
    appointments_month: scheduled,
    roi,
    no_show_rate: scheduled > 0 ? Math.round((noShows / scheduled) * 100) : 0,
  };
}

module.exports = router;
