#!/usr/bin/env node
/**
 * ── Radiografía de la cuenta de PayPal configurada ──
 *
 * Responde, con hechos y contra la API real, la única pregunta que importa
 * antes de encender el cobro: ¿esta cuenta puede cobrar, y de qué formas?
 *
 *     node tools/paypal-check.js
 *
 * Existe porque una cuenta puede autenticar perfectamente (token 200) y aun
 * así rechazar todos los cobros por estar restringida, o no tener habilitadas
 * las suscripciones. Eso no se ve hasta que se intenta, y descubrirlo con un
 * cliente delante sale caro: encender el guardián con una cuenta que no puede
 * cobrar deja a las clínicas encerradas sin forma de pagar para salir.
 *
 * NO mueve dinero: la orden de prueba se crea pero jamás se captura (PayPal la
 * deja caducar sola), y la suscripción de prueba se queda esperando aprobación.
 */

require('dotenv').config({ quiet: true });

const BASES = {
  live: 'https://api-m.paypal.com',
  sandbox: 'https://api-m.sandbox.paypal.com',
};

const entorno = String(process.env.PAYPAL_ENV || 'sandbox').trim().toLowerCase() === 'live' ? 'live' : 'sandbox';
const BASE = BASES[entorno];
const CLIENT_ID = String(process.env.PAYPAL_CLIENT_ID || '').trim();
const CLIENT_SECRET = String(process.env.PAYPAL_CLIENT_SECRET || '').trim();
const APP_URL = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');

const OK = '✅';
const NO = '❌';

function linea(etiqueta, valor) {
  console.log('  ' + (etiqueta + ' ').padEnd(34, '·') + ' ' + valor);
}

async function llamar(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      // Sin esto PayPal devuelve el detalle del error recortado.
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let cuerpo = null;
  try { cuerpo = await res.json(); } catch (_) {}
  return { status: res.status, ok: res.ok, cuerpo };
}

/** El mensaje útil de un error de PayPal, no el JSON entero. */
function motivo(r) {
  const c = r.cuerpo || {};
  const detalle = (c.details && c.details[0] && (c.details[0].description || c.details[0].issue)) || '';
  return [c.message, detalle].filter(Boolean).join(' — ') || ('HTTP ' + r.status);
}

(async () => {
  console.log('\n─── Radiografía de la cuenta PayPal ───────────────────');
  linea('Entorno', entorno === 'live' ? 'LIVE (dinero real)' : 'sandbox (pruebas)');
  linea('Client ID', CLIENT_ID ? CLIENT_ID.slice(0, 10) + '…  (' + CLIENT_ID.length + ' caracteres)' : NO + ' vacío');
  linea('App URL', APP_URL || NO + ' sin APP_URL');
  console.log('───────────────────────────────────────────────────────\n');

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log(NO + ' Faltan PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET en el .env.\n');
    process.exit(1);
  }

  // ── 1. Autenticación ──
  const auth = Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64');
  const rt = await fetch(BASE + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const tj = await rt.json().catch(() => ({}));

  if (!rt.ok) {
    console.log(NO + ' Las credenciales NO autentican (' + rt.status + '): ' + (tj.error_description || tj.error || ''));
    console.log('   Revisa que sean del entorno correcto: las de sandbox no sirven en live.\n');
    process.exit(1);
  }
  const token = tj.access_token;
  console.log(OK + ' Autenticación correcta');

  // Los permisos concedidos delatan qué features tiene activada la app.
  const scopes = String(tj.scope || '').split(' ').filter(Boolean);
  const tieneSuscripciones = scopes.some((s) => /subscription/i.test(s));
  const tieneBilling = scopes.some((s) => /billing/i.test(s));

  // ── 2. ¿Puede cobrar un pago único? ──
  // Es la prueba que destapa una cuenta restringida: autentica bien y aun así
  // rechaza crear la orden.
  const orden = await llamar(token, 'POST', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [{ amount: { currency_code: 'USD', value: '19.99' }, description: 'Prueba de diagnóstico' }],
  });
  const puedeCobrarSuelto = orden.ok;
  console.log(
    (puedeCobrarSuelto ? OK : NO) +
      ' Pago único' +
      (puedeCobrarSuelto ? ' — orden ' + orden.cuerpo.id + ' creada (sin capturar, no se cobra)' : ' — ' + motivo(orden)),
  );

  // ── 3. ¿Puede manejar suscripciones? ──
  const planes = await llamar(token, 'GET', '/v1/billing/plans?page_size=1');
  const puedeSuscripciones = planes.ok;
  console.log(
    (puedeSuscripciones ? OK : NO) +
      ' Suscripciones' +
      (puedeSuscripciones
        ? ' — la cuenta tiene la función habilitada'
        : ' — ' + motivo(planes) + (tieneSuscripciones ? '' : ' (la app no pide el permiso "subscriptions")')),
  );

  // ── 4. Webhook ──
  const hooks = await llamar(token, 'GET', '/v1/notifications/webhooks');
  const esperado = APP_URL ? APP_URL + '/api/billing/webhook' : null;
  const mio = ((hooks.cuerpo && hooks.cuerpo.webhooks) || []).find((w) => w.url === esperado);
  const configurado = String(process.env.PAYPAL_WEBHOOK_ID || '').trim();

  if (!hooks.ok) {
    console.log(NO + ' Webhooks — ' + motivo(hooks));
  } else if (!mio) {
    console.log(NO + ' Webhook — no hay ninguno apuntando a ' + esperado);
    console.log('     créalo con:  node tools/paypal-setup.js');
  } else if (mio.id !== configurado) {
    console.log(NO + ' Webhook — existe (' + mio.id + ') pero PAYPAL_WEBHOOK_ID dice "' + configurado + '"');
    console.log('     corrige la variable, o la firma de los eventos no se podrá verificar');
  } else {
    const eventos = (mio.event_types || []).map((e) => e.name);
    const clave = 'PAYMENT.CAPTURE.COMPLETED';
    console.log(OK + ' Webhook ' + mio.id + ' — ' + eventos.length + ' eventos' + (eventos.includes(clave) ? '' : '  ' + NO + ' falta ' + clave));
  }

  // ── Veredicto ──
  console.log('\n─── Qué puedes vender con esta cuenta ─────────────────');
  if (!puedeCobrarSuelto && !puedeSuscripciones) {
    console.log('  ' + NO + ' NADA. La cuenta no acepta cobros.');
    console.log('     Si el error habla de "merchant account is restricted", la limitación');
    console.log('     la puso PayPal: entra a paypal.com → Centro de Resoluciones.');
    console.log('     NO enciendas BILLING_ENFORCEMENT: dejarías a las clínicas');
    console.log('     bloqueadas sin forma de pagar para salir.');
  } else {
    console.log('  ' + (puedeSuscripciones ? OK : NO) + ' Suscripción automática (PAYMENTS_PROVIDER=paypal)');
    console.log('       PayPal cobra cada mes solo, reintenta y avisa por webhook.');
    console.log('  ' + (puedeCobrarSuelto ? OK : NO) + ' Pago mes a mes (PAYMENTS_PROVIDER=paypal_onetime)');
    console.log('       El cliente paga pulsando un botón cada periodo; no hay cobro automático.');
    if (puedeSuscripciones && !String(process.env.PAYPAL_PLAN_ID || '').trim()) {
      console.log('\n  Falta el plan mensual: node tools/paypal-setup.js');
    }
  }
  console.log('───────────────────────────────────────────────────────\n');

  if (!tieneBilling && !tieneSuscripciones) {
    console.log('Nota: el token solo trae permisos de pagos. Para suscripciones, la app');
    console.log('debe crearse en developer.paypal.com y activar "Subscriptions" en Features.\n');
  }
})().catch((err) => {
  console.error('\n' + NO + ' La comprobación falló:', err.message, '\n');
  process.exit(1);
});
