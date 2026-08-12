# Suscripción con PayPal — $19.99/mes

Salud Digital se vende como **plan individual**: un profesional = una clínica =
una suscripción mensual de **19.99 USD** cobrada automáticamente por PayPal.
Sin suscripción activa, la plataforma queda bloqueada.

---

## 1. Puesta en marcha (una sola vez)

### a) Credenciales

1. Entra a <https://developer.paypal.com> → **Apps & Credentials**.
2. Pestaña **Sandbox** (pruebas) o **Live** (dinero real) → *Create App* → tipo
   **Merchant**.
3. Copia el **Client ID** y el **Secret** al `.env`:

```bash
PAYPAL_ENV=sandbox           # cambia a "live" cuando vayas a cobrar de verdad
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
SUBSCRIPTION_PRICE=19.99
SUBSCRIPTION_CURRENCY=USD
```

> Las credenciales de sandbox **no** funcionan en live y viceversa: al pasar a
> producción hay que cambiar las tres variables (`PAYPAL_ENV`, id y secret) y
> volver a generar plan y webhook.

### b) Producto, plan y webhook

```bash
node tools/paypal-setup.js
```

Crea en PayPal el producto, el plan mensual de 19.99 USD y el webhook apuntando
a `APP_URL/api/billing/webhook`, e imprime las variables que faltan:

```bash
PAYPAL_PLAN_ID=P-XXXXXXXXXXXXXXX
PAYPAL_WEBHOOK_ID=WH-XXXXXXXXXXXX
```

Pégalas en `.env` **y** en las variables de entorno de Render. Reinicia el
servidor. Listo.

> El webhook necesita una URL pública HTTPS: si aún trabajas en local, corre el
> script otra vez cuando la app esté desplegada.

### c) Probar en sandbox

En developer.paypal.com → **Testing Tools → Sandbox Accounts** hay una cuenta
*personal* de prueba con saldo ficticio. Entra a `/plan.html`, pulsa
**Suscribirme**, paga con esa cuenta y vuelve: la página debe quedar en
**Activa**.

---

## 2. Cómo funciona

```
Doctor → /plan.html  ──POST /api/billing/subscribe──►  PayPal crea la suscripción
       ◄── approve_url ──                              (estado APPROVAL_PENDING)

Doctor paga en paypal.com  ──redirect──►  /plan.html?subscription_id=I-XXXX
                                          POST /api/billing/confirm
                                          (el servidor RE-CONSULTA a PayPal)

Cada mes:  PayPal cobra solo  ──webhook──►  POST /api/billing/webhook
                                            (firma verificada + idempotente)
```

Se usa el **flujo de redirección**, no el SDK JavaScript de PayPal: así el botón
mantiene el diseño de la plataforma y no hace falta abrir el CSP a scripts de
terceros. Nada del estado se acepta desde el navegador — siempre se verifica
contra la API de PayPal.

### Archivos

| Archivo | Qué hace |
|---|---|
| `lib/paypal.js` | Cliente REST: token, suscripciones, webhooks, alta de plan |
| `lib/subscription.js` | Estado/acceso, volcado de PayPal a la BD, caché de 60s |
| `middleware/subscription.js` | Guardián: 402 en `/api` si no hay plan activo |
| `routes/billing.js` | `/status`, `/subscribe`, `/confirm`, `/sync`, `/cancel`, `/payments`, `/webhook` |
| `public/plan.html` | Pantalla "Suscripción" (AJUSTES en el menú) |
| `tools/paypal-setup.js` | Crea producto + plan + webhook |

### Tablas

- `subscriptions` — una fila por suscripción de PayPal (`external_id` = `I-…`).
- `subscription_payments` — cada cobro mensual (llega por webhook, sin duplicados).
- `paypal_webhook_events` — ids de eventos ya procesados (idempotencia).

Las columnas `clinics.plan_status` / `plan_expires_at` se mantienen alineadas.

---

## 3. Bloqueo por impago

Sin suscripción activa, **toda** la API responde `402` y el frontend manda a
`/plan.html`. Quedan fuera del bloqueo:

- `/api/auth/*` (login, logout, 2FA) y `/api/billing/*` (para poder pagar)
- `/api/public/*` y `/api/confirmations/public/*` (enlaces ya enviados a pacientes)
- el rol `super_admin` (operador de la plataforma) y el rol `patient`
- clínicas listadas en `BILLING_EXEMPT_CLINIC_IDS`

Se considera **activa**: estado `ACTIVE`, o `CANCELLED`/`SUSPENDED` mientras la
fecha del próximo cobro siga en el futuro (el mes ya pagado se respeta).

El bloqueo solo se activa si hay credenciales de PayPal configuradas — en local,
sin credenciales, la app funciona normal.

### Palancas de emergencia

```bash
BILLING_ENFORCEMENT=off        # desactiva el bloqueo por completo
BILLING_EXEMPT_CLINIC_IDS=1,4  # clínicas que nunca se bloquean
```

---

## 4. Operación diaria

- **"Actualizar estado"** en `/plan.html` relee la suscripción desde PayPal. Úsalo
  si sospechas que se perdió un webhook.
- **Cancelar** detiene la renovación; el acceso sigue hasta el fin del mes pagado.
- **Cambiar el precio**: los planes de PayPal son inmutables. Cambia
  `SUBSCRIPTION_PRICE`, borra `PAYPAL_PLAN_ID` y vuelve a correr
  `node tools/paypal-setup.js`. Las suscripciones ya existentes siguen con el
  precio viejo hasta que el cliente se pase al plan nuevo.
- **Reembolsos y disputas** se gestionan desde el panel de PayPal; el webhook
  registra `REFUNDED` / `REVERSED` en el historial.
