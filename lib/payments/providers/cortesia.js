// ── "Procesador" de cortesía: las pruebas que regala el administrador ──
//
// No cobra. No existe fuera de esta plataforma. Está aquí porque la columna
// `subscriptions.provider` es obligatoria y TODO el motor de facturación hace
// `getProvider(sub.provider)` antes de decidir nada: sin una implementación
// registrada, un periodo de prueba concedido a mano hacía saltar
// "Procesador de pagos desconocido" en sitios tan lejanos como la pantalla de
// suscripción del doctor o el job nocturno.
//
// Declara TODO como no soportado, que es la verdad: una prueba de cortesía no
// se cobra, no se reintenta, no se renueva y no manda webhooks. Los servicios
// ya saben leer eso —`capabilities.recurring: 'none'` la deja fuera del ciclo
// de cobro, y `cancelSubscription` lanza UnsupportedOperationError, que
// `cancel()` se traga a propósito— así que no hace falta ninguna excepción
// repartida por el código: basta con este objeto.
//
// El fin de la prueba NO lo vigila este archivo: lo hace `expireOverdue()` por
// fecha, igual que con cualquier otra suscripción vencida.

const { PaymentProvider, UnsupportedOperationError } = require('../provider');

class CortesiaProvider extends PaymentProvider {
  get name() {
    return 'cortesia';
  }

  get capabilities() {
    return {
      // 'none' es la pieza clave: BillingService.findDue y markManualOverdue
      // filtran por capacidad, así que una prueba de cortesía nunca entra en
      // el ciclo de cobro ni se marca como "renovación pendiente de pago".
      recurring: 'none',
      tokenizesCards: false,
      hostedFields: false,
      webhooks: false,
      refunds: false,
      planChanges: false,
    };
  }

  // Nunca "está configurado": no hay credenciales que tener. Esto es lo que
  // impide que se ofrezca como forma de pago en ninguna pantalla.
  isConfigured() {
    return false;
  }

  publicConfig() {
    return { provider: this.name, checkout: 'none' };
  }

  // Cancelar una prueba de cortesía en "el procesador" no significa nada; el
  // estado local ya lo cambia SubscriptionService. Se lanza la excepción
  // canónica en vez de devolver un ok falso: simular una operación que no
  // existe es justo lo que prohíbe la cabecera de provider.js.
  async cancelSubscription() {
    throw new UnsupportedOperationError(this.name, 'cancelSubscription', 'una prueba de cortesía no se gestiona en ningún procesador');
  }
}

module.exports = CortesiaProvider;
