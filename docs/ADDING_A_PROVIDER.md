# Añadir un procesador de pagos

Guía para conectar PixelPay, Tilopay, BAC o cualquier otro **sin tocar la lógica
de suscripciones**. Si en algún momento necesitas modificar
`subscription-service.js`, `billing-service.js` o `routes/billing.js`, para y
reconsidera: casi seguro falta algo en el provider.

---

## Paso 1 — Crear la clase

`lib/payments/providers/pixelpay.js`:

```js
const { PaymentProvider, PaymentError, EVENT } = require('../provider');

class PixelPayProvider extends PaymentProvider {
  get name() { return 'pixelpay'; }   // = valor de la columna `provider`

  get capabilities() {
    return {
      recurring: 'token',   // ← NOSOTROS cobramos cada periodo con el token
      tokenizesCards: true,
      hostedFields: true,   // campos de tarjeta embebidos en nuestra web
      webhooks: true,
      refunds: true,
      planChanges: false,   // no tiene planes: el importe lo ponemos nosotros
    };
  }

  isConfigured() {
    return !!(process.env.PIXELPAY_KEY && process.env.PIXELPAY_SECRET);
  }

  publicConfig() {
    return { provider: 'pixelpay', checkout: 'hosted_fields',
             public_key: process.env.PIXELPAY_PUBLIC_KEY, environment: '…' };
  }

  async createCustomer({ clinicId, email, name }) { /* … */ }
  async createPaymentMethod({ token, customerId }) { /* … */ }
  async charge({ amount, currency, paymentMethodToken, idempotencyKey }) { /* … */ }
  async handleWebhook({ headers, rawBody }) { /* … */ }
}

module.exports = PixelPayProvider;
```

## Paso 2 — Registrarlo

En `lib/payments/provider.js`, una línea:

```js
const REGISTRO = {
  paypal:   () => require('./providers/paypal'),
  pixelpay: () => require('./providers/pixelpay'),   // ← nueva
};
```

## Paso 3 — Mapear los planes

Cada plan guarda sus equivalentes por procesador en `provider_refs`:

```sql
UPDATE plans
   SET provider_refs = provider_refs || '{"pixelpay":{"plan_id":"XYZ"}}'::jsonb
 WHERE code = 'individual-monthly';
```

Si el procesador **no tiene planes** (cobras un importe suelto cada mes), no
hace falta: `BillingService` usa `subscriptions.amount`.

## Paso 4 — Checkout en el frontend

En `public/plan.html`, `montarPaypal()` comprueba `st.proveedor`. Añade el
montaje del nuevo y devuelve el control al respaldo si no se reconoce. Todo lo
demás de la pantalla (estados, historial, cancelación) ya es agnóstico.

## Paso 5 — Cambiar el procesador activo

```
PAYMENTS_PROVIDER=pixelpay
```

Las suscripciones ya existentes conservan su `provider`, así que **conviven**:
las viejas siguen renovándose por PayPal y las nuevas nacen en PixelPay.

---

## Contrato que debe cumplir

| Método | Debe devolver | Si no aplica |
|---|---|---|
| `createCustomer` | `{customerId}` | Un id sintético (`clinic:<id>`) |
| `createPaymentMethod` | `{token, brand, last4, expMonth, expYear}` | `UnsupportedOperationError` |
| `charge` | `{id, status:'succeeded'\|'failed', amount, currency}` | `UnsupportedOperationError` |
| `createSubscription` | `{id, status, approvalUrl?, currentPeriodEnd?}` | — |
| `cancelSubscription` | `{cancelled:true}` | — |
| `updateSubscription` | `{approvalUrl?}` | `UnsupportedOperationError` |
| `getSubscription` | estado normalizado | — |
| `handleWebhook` | `{eventId, type, verified, subscriptionRef, paymentRef, amount, currency}` | — |

`type` debe ser una de las constantes `EVENT` de `provider.js`. Si el
procesador manda algo que no encaja, usa `EVENT.UNKNOWN`: se guardará el evento
sin actuar, que es el comportamiento seguro.

### Reglas irrompibles

1. **Nunca** devuelvas ni guardes PAN o CVV. Solo tokens.
2. **Nunca** simules una capacidad que el procesador no tiene: decláralo en
   `capabilities` y lanza `UnsupportedOperationError`. El sistema está preparado
   para funcionar con procesadores limitados.
3. `charge()` debe respetar `idempotencyKey`: si el procesador tiene cabecera de
   idempotencia, úsala. Es lo que impide cobrar dos veces el mismo periodo.
4. Marca `retryable: true` en los `PaymentError` que puedan salir bien más tarde
   (fondos insuficientes, timeout) y `false` en los definitivos (tarjeta
   inválida). De eso depende que el dunning reintente o se detenga.
5. `handleWebhook` **debe** verificar la firma y reflejarlo en `verified`. Si
   devuelve `true` sin comprobar nada, cualquiera podría activarse la
   suscripción gratis.

---

## Tests

`tests/subscription-flow.test.js` trae un `ProviderFalso` con
`recurring: 'token'`: cópialo como base para probar el tuyo sin tocar la red.
Los tests de ciclo de vida (alta, fallo, reintento, cambio de plan,
cancelación, expiración) valen igual para cualquier procesador — si pasan con el
tuyo, la integración está bien hecha.

```bash
npm test                           # unitarios, sin BD
BILLING_TEST_DB=1 npm run test:db  # + integración
```
