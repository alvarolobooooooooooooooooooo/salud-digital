# Suscripción con PayPal — $19.99/mes

> **Nota:** este documento describe la integración concreta con PayPal.
> La arquitectura del sistema de suscripciones (agnóstica del procesador),
> el esquema de base de datos y cómo conectar otro procesador están en
> [docs/PAYMENTS.md](docs/PAYMENTS.md) y
> [docs/ADDING_A_PROVIDER.md](docs/ADDING_A_PROVIDER.md).


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
Doctor pulsa un botón en /plan.html (SDK de PayPal, dentro de la página)
   └─ createSubscription ──POST /api/billing/subscribe──►  PayPal crea la
                                                           suscripción
                                                           (APPROVAL_PENDING)
   └─ paga en la ventana superpuesta de PayPal (cuenta o tarjeta)
   └─ onApprove ──POST /api/billing/confirm──►  el servidor RE-CONSULTA a PayPal

Cada mes:  PayPal cobra solo  ──webhook──►  POST /api/billing/webhook
                                            (firma verificada + idempotente)
```

**El pago ocurre sobre la propia página**: el SDK (`vault=true&intent=subscription`)
pinta dos botones — cuenta de PayPal y *Tarjeta de débito o crédito* — y abre el
checkout en una ventana superpuesta, sin navegar fuera de la app ni tener que
volver. Requiere que el CSP permita los dominios de PayPal (ver `server.js`).

Los campos de tarjeta embebidos en NUESTRO HTML (componente `card-fields`) no son
una opción: PayPal solo los admite para pedidos sueltos (`intent=capture`), no
para suscripciones. De ahí que la tarjeta se cobre por el botón negro, que abre
el formulario de PayPal en modo invitado (sin crear cuenta). Su disponibilidad la
decide PayPal según el país del comprador y de la cuenta: si no aplica,
`isEligible()` es falso, el botón no se pinta y la página lo explica.

Se conserva el **flujo de redirección** como respaldo: se usa si el SDK no carga
(red, bloqueador, CSP) y en la app de escritorio, donde las ventanas emergentes
no funcionan bien dentro del WKWebView empaquetado.

Nada del estado se acepta desde el navegador — siempre se verifica contra la API
de PayPal.

### Archivos

| Archivo | Qué hace |
|---|---|
| `lib/paypal.js` | Cliente REST crudo: token, suscripciones, webhooks, alta de plan |
| `lib/payments/providers/paypal.js` | **Único** sitio que traduce PayPal ↔ vocabulario propio |
| `lib/payments/provider.js` | Interfaz `PaymentProvider` + registro de procesadores |
| `lib/billing/*` | Suscripciones, cobros, webhooks y job — sin saber de PayPal |
| `middleware/subscription.js` | Guardián: 402 en `/api` si no hay plan activo |
| `routes/billing.js` | API de facturación |
| `public/plan.html` | Pantalla "Suscripción" (AJUSTES en el menú) |
| `tools/paypal-setup.js` | Crea producto + plan + webhook en PayPal |

### Tablas

`plans`, `subscriptions`, `payment_methods`, `payments` y `payment_events`.
El detalle del esquema y los estados está en [docs/PAYMENTS.md](docs/PAYMENTS.md).
Las columnas `clinics.plan_status` / `plan_expires_at` se mantienen alineadas por
compatibilidad con pantallas anteriores.

---

## 3. Bloqueo por impago

Sin suscripción activa, **toda** la API responde `402` y el frontend manda a
`/plan.html`. Quedan fuera del bloqueo:

- `/api/auth/*` (login, logout, 2FA) y `/api/billing/*` (para poder pagar)
- `/api/public/*` y `/api/confirmations/public/*` (enlaces ya enviados a pacientes)
- el rol `super_admin` (operador de la plataforma) y el rol `patient`
- clínicas listadas en `BILLING_EXEMPT_CLINIC_IDS`

Se considera **con acceso**: `active`/`trialing`, o `past_due`/`cancelled`/`paused`
mientras el periodo ya pagado siga vigente (el mes cobrado se respeta).

El bloqueo solo se activa si hay un procesador configurado — en local, sin
credenciales, la app funciona normal.

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
  registra el reembolso en el historial de `payments`.
