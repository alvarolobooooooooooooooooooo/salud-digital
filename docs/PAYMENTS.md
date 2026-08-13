# Suscripciones y pagos

Sistema de suscripciones mensuales **desacoplado del procesador de pagos**. La
lógica de negocio no sabe si detrás hay PayPal, PixelPay, Tilopay o BAC: habla
con la interfaz `PaymentProvider` y con nada más.

---

## 1. Mapa del sistema

```
routes/billing.js ─────► lib/billing/subscription-service.js  (estados, planes, acceso)
   (API HTTP)            lib/billing/billing-service.js       (cobro por token + dunning)
                         lib/billing/webhook-service.js       (firma, idempotencia)
                         lib/billing/jobs.js                  (renovación periódica)
                         lib/billing/periods.js               (aritmética de fechas)
                                    │
                                    ▼
                    lib/payments/provider.js   ← interfaz + registro
                                    │
                    ┌───────────────┼────────────────┐
                    ▼               ▼                ▼
             providers/paypal.js  (pixelpay)     (tilopay)
                    │
                    ▼
             lib/paypal.js  ← cliente HTTP crudo, solo lo usa su provider
```

Regla: **ningún archivo fuera de `lib/payments/providers/` menciona un
procesador concreto.** Si un cambio te obliga a romperla, es que falta un método
en la interfaz.

---

## 2. Instalación

### Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `PAYMENTS_PROVIDER` | no (por defecto `paypal`) | Procesador activo |
| `APP_URL` | sí | Base para las URLs de retorno y del webhook |
| `BILLING_ENFORCEMENT` | no | `off` desactiva el bloqueo por impago |
| `BILLING_EXEMPT_CLINIC_IDS` | no | Clínicas que nunca se bloquean, p. ej. `1,5` |
| `BILLING_MAX_RETRIES` | no (3) | Intentos antes de dar el cobro por perdido |
| `BILLING_GRACE_DAYS` | no (3) | Días de acceso tras vencer el periodo sin pagar |
| `BILLING_RETRY_DAYS` | no (`1,3,5`) | Espera entre reintentos, en días |
| `BILLING_JOB_INTERVAL_MINUTES` | no (60) | Cada cuánto corre el ciclo de facturación |

Específicas de PayPal (las lee **solo** su provider):

| Variable | Para qué |
|---|---|
| `PAYPAL_ENV` | `sandbox` o `live` |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | Credenciales de la app |
| `PAYPAL_WEBHOOK_ID` | Id del webhook, para verificar firmas |
| `PAYPAL_PLAN_ID` | Respaldo: hoy el plan vive en la tabla `plans` |

### Puesta en marcha

```bash
npm install
node tools/paypal-setup.js        # crea producto, plan y webhook en PayPal
npm start                          # initDb() aplica el esquema solo
npm test                           # unitarios (sin BD)
BILLING_TEST_DB=1 npm run test:db  # + integración (crea y borra sus datos)
```

El esquema se aplica solo al arrancar (`initDb()` en `db.js`). No hay carpeta de
migraciones: es el patrón que ya usaba el proyecto y se ha respetado.

---

## 3. Base de datos

| Tabla | Qué guarda |
|---|---|
| `plans` | Catálogo: importe, moneda, intervalo, prueba y `provider_refs` (el id del plan en cada procesador) |
| `subscriptions` | Una por clínica: estado, periodo, próximo cobro, referencias del procesador |
| `payment_methods` | Tokens de tarjeta. **Nunca PAN ni CVV**: solo token, marca y últimos 4 |
| `payments` | Un intento de cobro por fila, con éxito o fallo, número de intento y motivo |
| `payment_events` | Todo webhook recibido: firma, payload, estado de proceso y reintentos |

### Estados de `subscriptions`

```
incomplete ──(1er cobro OK)──► active ──(cobro falla)──► past_due
     │                            │  ▲                      │
     │                            │  └──(cobro recuperado)──┤
     │                                                      ▼
     └──(abandonada)──► expired ◄──(fin de periodo)   payment_failed
                            ▲                               │
 active ──(cancela)──► cancelled ──────────────────────────┘
```

`trialing` y `paused` existen y están soportados por el modelo aunque hoy ningún
plan los use.

**El acceso lo decide la fecha pagada, no el estado.** Si cancelas a mitad de
mes conservas el acceso hasta `current_period_end`: cobrar el mes y cortar el
mismo día sería quedarse con el dinero. Lo implementa `subscription-service.access()`.

---

## 4. Seguridad (PCI DSS)

- El número de tarjeta y el CVV **nunca tocan este backend**. Los captura el
  widget del procesador (iframe/SDK) y lo que nos llega es un token.
- `payment_methods` tiene un `CHECK` que impide guardar más de 4 dígitos en
  `last4`, y no existe ninguna columna donde quepa un PAN.
- Los secretos del procesador viven en variables de entorno; el `client_id`
  público es lo único que se expone al navegador (`/api/billing/status`).
- El endpoint de webhook **verifica la firma** antes de procesar nada. Un evento
  con firma inválida se registra y se descarta con 400.
- **El frontend nunca decide si un pago fue bueno.** El estado se toma del
  webhook o de una relectura contra el procesador (`POST /api/billing/sync`).

---

## 5. Webhooks

`POST /api/billing/webhook` (o `/webhook/:provider` si hay varios).

1. `express.raw` captura el cuerpo **tal cual llegó** — la firma se calcula
   sobre los bytes originales, así que se monta antes del `express.json` global
   (ver `server.js`).
2. El provider verifica la firma y traduce el evento al vocabulario canónico.
3. Se inserta en `payment_events` con `UNIQUE (provider, provider_event_id)`:
   **ahí está la idempotencia**. Un reintento del procesador ve el conflicto,
   no procesa nada y responde 200.
4. Si procesarlo falla, el evento queda en `failed` con su error y lo reintenta
   el job (o `POST /api/billing/events/reprocess`, solo super admin).

Se responde 200 incluso cuando el proceso interno falla: el evento ya está
guardado y el fallo es nuestro. Devolver 5xx solo haría que el procesador
reintentara en bucle.

---

## 6. Renovación

Depende de lo que declare el provider en `capabilities.recurring`:

- **`native`** (PayPal): el procesador cobra, reintenta y avisa por webhook.
  El job **no programa nada** — hacerlo duplicaría cargos.
- **`token`** (PixelPay, Tilopay…): `BillingService` busca lo vencido
  (`next_billing_at <= now`) y cobra contra el token guardado.
- **`manual`** (`paypal_onetime`): no se puede cobrar sin el usuario. El job
  marca la suscripción vencida como `past_due` para que la pantalla le pida el
  pago, y respeta `BILLING_GRACE_DAYS` antes de cortar el acceso.

El job (`lib/billing/jobs.js`) corre dentro del proceso con `setInterval`, igual
que la purga de auditoría. Cada pasada: cobra lo vencido → caduca lo agotado →
reprocesa webhooks fallidos.

> **Si algún día hay más de una instancia** hay que añadir un lock antes de
> cobrar (`SELECT pg_try_advisory_lock(...)`), o dos instancias podrían cobrar
> el mismo periodo a la vez. Con una sola instancia, como hoy, no hace falta.

### Pagos fallidos (dunning)

1. Falla un cobro → `past_due`, se registra el intento en `payments` y se
   reprograma según `BILLING_RETRY_DAYS` (1, 3 y 5 días por defecto).
2. Se agotan los intentos (`BILLING_MAX_RETRIES`) → `payment_failed` y no se
   vuelve a intentar solo.
3. En todo momento, mientras quede periodo pagado, **el acceso se mantiene**.

---

## 7. Flujo completo de una suscripción

```
1. GET  /api/billing/plans          → catálogo
2. POST /api/billing/subscribe      → crea la suscripción en el procesador
                                      y una fila local en `incomplete`
                                      ← devuelve approve_url o datos de checkout
3. El usuario paga en el checkout del procesador
4. POST /api/billing/confirm        → el servidor RELEE del procesador (no se
                                      fía del navegador) y actualiza el estado
5. Webhook payment.succeeded        → `active`, se fija el periodo y se registra
                                      el pago en `payments`
6. Cada mes: cobro nativo o job     → nuevo `payments` + periodo avanzado
7. POST /api/billing/cancel         → sin más cobros; acceso hasta fin de periodo
8. Fin de periodo                   → `expired`, el guardián bloquea la app
```

### Endpoints

| Método | Ruta | Quién |
|---|---|---|
| GET | `/api/billing/plans` | autenticado |
| GET | `/api/billing/status` | autenticado (exento del bloqueo) |
| GET | `/api/billing/payments` | dueño de la cuenta |
| POST | `/api/billing/subscribe` | dueño |
| POST | `/api/billing/order` | dueño (procesadores 'manual') |
| POST | `/api/billing/capture` | dueño (procesadores 'manual') |
| POST | `/api/billing/confirm` | dueño |
| POST | `/api/billing/sync` | dueño |
| POST | `/api/billing/cancel` | dueño |
| POST | `/api/billing/change-plan` | dueño |
| POST | `/api/billing/retry` | dueño |
| POST | `/api/billing/webhook[/:provider]` | público (firmado) |
| GET | `/api/billing/events` | super admin |

---

## 8. Qué permite PayPal REALMENTE (y qué no)

Comprobado contra la cuenta del proyecto el **2026-08-13**, ejecutando el SDK
contra las credenciales reales:

```js
paypal.CardFields().isEligible()                    → false
paypal.Buttons({fundingSource: card}).isEligible()  → true
```

Y al pulsar el botón de tarjeta con una suscripción, PayPal responde:
*"¿No ve el navegador seguro de card? Abriremos la ventana nuevamente"*.

**Conclusión: el flujo `tarjeta → token → cobro recurrente` NO está disponible.**
Requiere *Advanced (Expanded) Checkout*, limitado a ~37 países entre los que no
está Honduras. No se intenta rodear la restricción.

| Función | ¿Disponible? | Consecuencia en el código |
|---|---|---|
| Suscripciones recurrentes nativas | Sí | `capabilities.recurring = 'native'` |
| Webhooks firmados | Sí | `handleWebhook()` verifica firma |
| Cambio de plan (`/revise`) | Sí | `updateSubscription()` |
| Botón de tarjeta alojado por PayPal | Sí | El comprador teclea la tarjeta en la ventana de PayPal |
| **Campos de tarjeta en nuestra web** | **No** | `capabilities.hostedFields = false` |
| **Token de tarjeta reutilizable** | **No** | `createPaymentMethod()` lanza `UnsupportedOperationError` |
| **Cobro iniciado por el comercio** | **No** | `charge()` lanza `UnsupportedOperationError` |
| Reembolsos por API | No implementado | Se hacen desde el panel de PayPal |

Por eso el sistema **no depende** de que PayPal habilite el cobro recurrente con
tarjeta: en cuanto se conecte un procesador local con tokenización, se cambia
`PAYMENTS_PROVIDER` y la lógica de suscripciones sigue igual. Ver
[ADDING_A_PROVIDER.md](ADDING_A_PROVIDER.md).

### 8.1 El provider de PAGO ÚNICO (`paypal_onetime`)

Segunda vía para la misma cuenta, activable con `PAYMENTS_PROVIDER=paypal_onetime`.
Usa órdenes (`intent=capture`) en lugar de suscripciones:

- **Permite pagar con tarjeta sin cuenta de PayPal**, igual que el otro.
- La plataforma lleva toda la estructura: planes, periodos, acceso, mora e
  historial. `capabilities.recurring = 'manual'`.
- **Cada renovación la paga el usuario pulsando un botón.** Sin tokenización no
  se puede cobrar sin él delante, y no se simula lo contrario. Cuando vence el
  periodo, el job pasa la suscripción a `past_due`, la pantalla pide el pago y
  hay `BILLING_GRACE_DAYS` (3 por defecto) antes de cortar el acceso.
- Endpoints propios: `POST /api/billing/order` (el servidor fija el importe
  desde el catálogo) y `POST /api/billing/capture`.

**Sobre el formulario de tarjeta embebido, con honestidad:** en una prueba con
las credenciales reales el botón de tarjeta desplegó el formulario DENTRO de la
página (el contenedor pasó de 48px a 664px, sin abrir ninguna ventana). Al
repetir la misma prueba más tarde, la misma página dejó de hacerlo y PayPal pasó
a ofrecer su ventana ("¿No ve el navegador seguro de card?"). Se descartaron por
medición el ancho del contenedor, el recorte CSS, el `backdrop-filter` de los
ancestros, quién crea la orden y el tamaño del viewport: **la decisión es de
PayPal**, no de nuestro código, y puede depender de señales de riesgo o de
experimentos suyos. Conviene comprobarlo en un navegador real antes de prometer
esa experiencia a nadie.

Idempotencia del pago único: la captura es idempotente en PayPal (misma
`PayPal-Request-Id`), si la orden ya estaba capturada se recupera la captura
existente, y `markPaymentSucceeded` no extiende el periodo si el cobro ya estaba
registrado. Hacen falta las tres para que un doble clic no regale un mes.

Candidatos para Honduras, ambos con tokenización y cobros recurrentes:
**PixelPay** (hondureño) y **Tilopay** (Centroamérica); el adquirente detrás
suele ser BAC Credomatic.

---

## 9. Auditoría

- `payments` guarda cada intento, con su motivo de fallo.
- `payment_events` guarda cada webhook con su payload íntegro.
- `audit_logs` recibe las acciones de negocio (`billing.subscription.started`,
  `billing.payment.succeeded`, `billing.payment.failed`,
  `billing.subscription.cancelled`, `billing.subscription.plan_changed`).
  Sus columnas `user_id`/`clinic_id` pasaron a admitir NULL porque los eventos
  del sistema (webhook, job) no tienen usuario detrás.
