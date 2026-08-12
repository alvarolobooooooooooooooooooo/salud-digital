#!/usr/bin/env node
/*
 * paypal-setup.js — Prepara PayPal para cobrar la suscripción mensual.
 *
 * Crea (si no existen) el producto, el plan de $19.99/mes y el webhook, y
 * escupe las líneas que hay que pegar en .env / en las variables de Render.
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

// Eventos que necesita routes/billing.js para mantener el estado al día.
const EVENT_TYPES = [
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
  if (webhookId) log('   PAYPAL_WEBHOOK_ID=' + webhookId);
  log('   SUBSCRIPTION_PRICE=' + price.toFixed(2));
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
