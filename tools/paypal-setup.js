#!/usr/bin/env node
/*
 * paypal-setup.js — Prepara PayPal para cobrar la suscripción mensual.
 *
 * Crea (si no existen) el producto, LOS DOS PLANES del catálogo y el webhook, y
 * escupe las líneas que hay que pegar en .env / en las variables de Render:
 *
 *     Básico   SUBSCRIPTION_PRICE   → PAYPAL_PLAN_ID
 *     Premium  PREMIUM_PRICE (49.99)→ PAYPAL_PLAN_ID_PREMIUM
 *
 * En PayPal el precio vive DENTRO del plan, así que cada importe del catálogo
 * necesita su propio plan allí. Sin el de Premium, el cobro recurrente de ese
 * plan se niega a arrancar a propósito — antes cobraba el precio del Básico sin
 * dar ningún error, que es la peor forma posible de fallar.
 *
 *   node tools/paypal-setup.js              # entorno según PAYPAL_ENV (sandbox por defecto)
 *   PAYPAL_ENV=live node tools/paypal-setup.js
 *
 * Requiere PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en .env (los del entorno
 * correspondiente: las credenciales de sandbox NO sirven en live).
 *
 * Es seguro re-ejecutarlo: si ya hay un plan con el mismo nombre y precio, lo
 * reutiliza en vez de crear uno nuevo. Ojo: los planes de PayPal son
 * inmutables en precio — para cambiar los $19.99 hay que crear un plan nuevo
 * (cambia SUBSCRIPTION_PRICE, borra PAYPAL_PLAN_ID y vuelve a correr esto).
 */

require('dotenv').config();
const paypal = require('../lib/paypal');

const PRODUCT_NAME = process.env.SUBSCRIPTION_BRAND_NAME || 'Salud Digital';
const PLAN_NAME = 'Salud Digital — Plan Individual (mensual)';
const PLAN_NAME_PREMIUM = 'Salud Digital — Plan Premium (mensual)';

// El precio del Premium. Se puede pisar por entorno si algún día cambia, pero
// el valor de referencia es el que siembra db.js.
const PREMIUM_PRICE = parseFloat(process.env.PREMIUM_PRICE || '49.99');

// Eventos que necesita routes/billing.js para mantener el estado al día.
const EVENT_TYPES = [
  // Suscripciones nativas (provider "paypal")
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.RE-ACTIVATED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  'PAYMENT.SALE.COMPLETED',
  'PAYMENT.SALE.REFUNDED',
  'PAYMENT.SALE.REVERSED',
  // Pago único (provider "paypal_onetime"): cada renovación es una captura.
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.REFUNDED',
  'PAYMENT.CAPTURE.REVERSED',
  'CHECKOUT.ORDER.APPROVED',
];

function log(...args) { console.log(...args); }

async function main() {
  if (!paypal.isConfigured()) {
    console.error('\n✖ Faltan PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET en .env\n');
    process.exit(1);
  }

  const env = paypal.env();
  const price = paypal.price();
  const currency = paypal.currency();
  const appUrl = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');

  log('');
  log('─── PayPal setup ───────────────────────────────');
  log('  Entorno : ' + env + (env === 'sandbox' ? '  (pruebas)' : '  (DINERO REAL)'));
  log('  Precio  : ' + price.toFixed(2) + ' ' + currency + ' / mes');
  log('  App URL : ' + (appUrl || '(sin APP_URL — el webhook no se podrá crear)'));
  log('────────────────────────────────────────────────');
  log('');

  // ── 1. Plan ──
  let planId = process.env.PAYPAL_PLAN_ID || '';
  if (planId) {
    log('• PAYPAL_PLAN_ID ya está en .env → no se crea otro plan (' + planId + ')');
  } else {
    // El plan solo hace falta con suscripciones nativas (PAYMENTS_PROVIDER=paypal).
    // Hay cuentas que aceptan cobros pero no tienen la función habilitada: en ese
    // caso NO se aborta, porque el webhook —que sí sirve para ambos cobros— se
    // crea después y quedarse sin él por esto sería absurdo.
    try {
      log('• Creando producto…');
      const product = await paypal.createProduct({
        name: PRODUCT_NAME,
        description: 'Plataforma clínica Salud Digital — acceso individual para un profesional.',
      });
      log('  producto: ' + product.id);

      log('• Creando plan mensual…');
      const plan = await paypal.createPlan({
        productId: product.id,
        name: PLAN_NAME,
        description: 'Acceso completo a Salud Digital. Cobro mensual automático, cancelable en cualquier momento.',
        amount: price,
        currencyCode: currency,
      });
      planId = plan.id;
      log('  plan: ' + planId);
    } catch (err) {
      log('• No se pudo crear el plan de suscripción: ' + err.message);
      log('  Esta cuenta no tiene habilitadas las suscripciones (developer.paypal.com');
      log('  → Apps & Credentials → Live → tu app → Features → Subscriptions).');
      log('  Se continúa: sin plan solo se puede cobrar con PAYMENTS_PROVIDER=paypal_onetime.');
    }
  }

  // ── 1b. Plan Premium ──
  // Va aparte y no dentro del bloque de arriba porque son independientes: se
  // puede tener uno y no el otro, y re-ejecutar esto con el Básico ya creado
  // tiene que poder crear solo el que falta.
  let planIdPremium = process.env.PAYPAL_PLAN_ID_PREMIUM || '';
  if (planIdPremium) {
    log('• PAYPAL_PLAN_ID_PREMIUM ya está en .env → no se crea otro (' + planIdPremium + ')');
  } else {
    try {
      log('• Creando producto del Premium…');
      const productoPremium = await paypal.createProduct({
        name: PRODUCT_NAME + ' Premium',
        description: 'Plataforma clínica Salud Digital — plan Premium con migración de expedientes.',
      });
      log('  producto: ' + productoPremium.id);

      log('• Creando plan Premium (' + PREMIUM_PRICE.toFixed(2) + ' ' + currency + '/mes)…');
      const planPremium = await paypal.createPlan({
        productId: productoPremium.id,
        name: PLAN_NAME_PREMIUM,
        description: 'Salud Digital completo, más Migrar Expedientes y la migración de tu historial hecha por nuestro equipo.',
        amount: PREMIUM_PRICE,
        currencyCode: currency,
      });
      planIdPremium = planPremium.id;
      log('  plan: ' + planIdPremium);
    } catch (err) {
      log('• No se pudo crear el plan Premium: ' + err.message);
      log('  Sin él, el Premium solo se puede cobrar con PAYMENTS_PROVIDER=paypal_onetime.');
    }
  }

  // ── 2. Webhook ──
  let webhookId = process.env.PAYPAL_WEBHOOK_ID || '';
  const webhookUrl = appUrl ? appUrl + '/api/billing/webhook' : '';

  if (webhookId) {
    log('• PAYPAL_WEBHOOK_ID ya está en .env → no se toca (' + webhookId + ')');
  } else if (!webhookUrl) {
    log('• Sin APP_URL: sáltate el webhook por ahora y créalo cuando la app esté desplegada.');
  } else if (!/^https:\/\//i.test(webhookUrl)) {
    log('• APP_URL no es https:// — PayPal solo acepta webhooks HTTPS públicos.');
    log('  Crea el webhook cuando la app esté en su dominio real: ' + webhookUrl);
  } else {
    const existing = await paypal.listWebhooks().catch(() => ({ webhooks: [] }));
    const found = (existing.webhooks || []).find((w) => w.url === webhookUrl);
    if (found) {
      webhookId = found.id;
      log('• Webhook ya existente para esa URL → ' + webhookId);
    } else {
      log('• Creando webhook → ' + webhookUrl);
      const hook = await paypal.createWebhook({ url: webhookUrl, eventTypes: EVENT_TYPES });
      webhookId = hook.id;
      log('  webhook: ' + webhookId);
    }
  }

  // ── 3. Resultado ──
  log('');
  log('════════════════════════════════════════════════');
  log(' Pega esto en tu .env (y en las env vars de Render):');
  log('');
  log('   PAYPAL_ENV=' + env);
  log('   PAYPAL_PLAN_ID=' + planId);
  if (planIdPremium) log('   PAYPAL_PLAN_ID_PREMIUM=' + planIdPremium);
  if (webhookId) log('   PAYPAL_WEBHOOK_ID=' + webhookId);
  log('   SUBSCRIPTION_PRICE=' + price.toFixed(2));
  if (planIdPremium) log('   PREMIUM_PRICE=' + PREMIUM_PRICE.toFixed(2));
  log('   SUBSCRIPTION_CURRENCY=' + currency);
  log('════════════════════════════════════════════════');
  log('');
  if (!webhookId) {
    log('⚠ Sin PAYPAL_WEBHOOK_ID la app NO procesa los cobros mensuales');
    log('  automáticamente (el estado solo se refresca con "Actualizar estado").');
    log('  Vuelve a correr este script cuando APP_URL apunte al dominio real.');
    log('');
  }
}

main().catch((err) => {
  console.error('\n✖ ' + err.message + '\n');
  if (err.body) console.error(JSON.stringify(err.body, null, 2));
  process.exit(1);
});
