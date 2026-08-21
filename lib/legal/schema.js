// ── Esquema del sistema legal y de aceptación ──
//
// Cinco tablas que sostienen técnicamente lo que los documentos legales
// prometen. La regla que ordena todo esto: si el contrato dice que existe un
// historial, el historial tiene que existir DE VERDAD y nadie —tampoco el
// administrador de la plataforma— debe poder reescribirlo.
//
//   legal_documents          — qué documentos hay (tipo × audiencia × país × idioma)
//   legal_document_versions  — cada versión con su contenido y su hash, inmutable
//   legal_acceptances        — quién aceptó qué versión, cuándo y desde dónde
//   legal_audit_events       — la bitácora del sistema legal, append-only
//   account_closure_requests — el flujo de cancelación de cuenta
//
// La inmutabilidad no se pide por favor desde la aplicación: se impone con
// triggers en Postgres. Un UPDATE sobre una aceptación revienta aunque venga de
// psql. Si por permisos del entorno los triggers no se pueden instalar, el
// arranque NO se rompe (la app tiene que seguir en pie) pero queda un aviso
// gritando en los logs, porque en ese caso la promesa de append-only está sin
// respaldo técnico.
//
// Ninguna sentencia de aquí es destructiva: todo es CREATE ... IF NOT EXISTS.

const TABLAS = `
  -- ── Documentos ──
  -- La identidad de un documento es (tipo, audiencia, país, idioma). El país
  -- vacío es la versión global: la que se sirve mientras no exista una
  -- específica para la jurisdicción del usuario. Así el día que haga falta un
  -- "TERMS para México" se añade una fila, sin tocar ni una línea de código.
  CREATE TABLE IF NOT EXISTS legal_documents (
    id SERIAL PRIMARY KEY,
    doc_key TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    audience TEXT NOT NULL DEFAULT 'doctor',
    country TEXT NOT NULL DEFAULT '',
    jurisdiction TEXT NOT NULL DEFAULT '',
    locale TEXT NOT NULL DEFAULT 'es',
    -- mandatory  → sin aceptarlo no se puede usar la plataforma
    -- optional   → marketing y similares: se pide aparte y se puede retirar
    consent_category TEXT NOT NULL DEFAULT 'mandatory',
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ,
    CONSTRAINT legal_documents_category_check
      CHECK (consent_category IN ('mandatory', 'optional')),
    CONSTRAINT legal_documents_audience_check
      CHECK (audience IN ('doctor', 'patient', 'platform'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS legal_documents_scope_uq
    ON legal_documents(type, audience, country, locale);

  -- ── Versiones ──
  -- El contenido vive aquí, no en el disco: el archivo .md del repositorio es
  -- solo la semilla. Una vez publicada, la fila es la fuente de verdad y no se
  -- puede tocar (ver el trigger de más abajo).
  CREATE TABLE IF NOT EXISTS legal_document_versions (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES legal_documents(id),
    version TEXT NOT NULL,
    content TEXT NOT NULL,
    content_format TEXT NOT NULL DEFAULT 'markdown',
    -- SHA-256 en hexadecimal del contenido EXACTO. Es lo que permite demostrar
    -- después que el texto aceptado es este y no otro.
    content_hash TEXT NOT NULL,
    summary_of_changes TEXT NOT NULL DEFAULT '',
    -- Un cambio de erratas no debería frenar a todo el mundo con un modal; un
    -- cambio de obligaciones sí. Lo decide quien publica, no el sistema.
    requires_new_acceptance BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ,
    effective_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_by INTEGER,
    published_by INTEGER,
    CONSTRAINT legal_document_versions_status_check
      CHECK (status IN ('draft', 'published', 'archived')),
    CONSTRAINT legal_document_versions_version_uq UNIQUE (document_id, version)
  );

  CREATE INDEX IF NOT EXISTS idx_legal_versions_doc
    ON legal_document_versions(document_id, status);
  CREATE INDEX IF NOT EXISTS idx_legal_versions_hash
    ON legal_document_versions(content_hash);

  -- ── Aceptaciones ──
  -- Append-only. Nunca se actualiza una fila anterior: aceptar la v2.0 añade una
  -- fila, no pisa la de la v1.0. Retirar un consentimiento opcional también
  -- añade fila (action='withdrawn'), para que la retirada quede fechada igual
  -- que el otorgamiento.
  --
  -- Los campos document_type / document_version / document_hash están
  -- duplicados a propósito: la evidencia tiene que sostenerse sola aunque
  -- mañana alguien renombre el documento.
  CREATE TABLE IF NOT EXISTS legal_acceptances (
    id BIGSERIAL PRIMARY KEY,
    acceptance_uid UUID NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    clinic_id INTEGER,
    -- 'user' hoy. Cuando existan consentimientos de pacientes en la plataforma,
    -- entran aquí con subject_type='patient' SIN mezclarse con los del doctor.
    subject_type TEXT NOT NULL DEFAULT 'user',
    subject_id INTEGER,
    document_id INTEGER NOT NULL REFERENCES legal_documents(id),
    document_version_id INTEGER NOT NULL REFERENCES legal_document_versions(id),
    document_type TEXT NOT NULL,
    document_name TEXT NOT NULL DEFAULT '',
    document_version TEXT NOT NULL,
    document_hash TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'accepted',
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    -- Dónde y cómo se dio el clic: registro, modal de nueva versión, ajustes…
    acceptance_method TEXT NOT NULL DEFAULT 'checkbox',
    locale TEXT NOT NULL DEFAULT 'es',
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT legal_acceptances_action_check
      CHECK (action IN ('accepted', 'withdrawn', 'declined'))
  );

  CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user
    ON legal_acceptances(user_id, document_id, accepted_at DESC);
  CREATE INDEX IF NOT EXISTS idx_legal_acceptances_version
    ON legal_acceptances(document_version_id);
  CREATE INDEX IF NOT EXISTS idx_legal_acceptances_when
    ON legal_acceptances(accepted_at DESC);

  -- ── Bitácora del sistema legal ──
  -- Deliberadamente separada de audit_logs: aquella se purga a los 90 días
  -- (lib/retention.js) y esta NO se purga nunca. Borrar la prueba de que
  -- alguien aceptó un contrato a los tres meses dejaría el contrato sin
  -- respaldo justo cuando hace falta.
  CREATE TABLE IF NOT EXISTS legal_audit_events (
    id BIGSERIAL PRIMARY KEY,
    event TEXT NOT NULL,
    actor_user_id INTEGER,
    actor_role TEXT NOT NULL DEFAULT '',
    subject_user_id INTEGER,
    clinic_id INTEGER,
    document_id INTEGER,
    document_version_id INTEGER,
    document_type TEXT NOT NULL DEFAULT '',
    document_version TEXT NOT NULL DEFAULT '',
    document_hash TEXT NOT NULL DEFAULT '',
    acceptance_uid UUID,
    ip TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_legal_audit_when
    ON legal_audit_events(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_legal_audit_subject
    ON legal_audit_events(subject_user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_legal_audit_event
    ON legal_audit_events(event, created_at DESC);

  -- ── Cancelación de cuenta ──
  -- Cerrar la cuenta NO borra el expediente. Esta tabla es el expediente del
  -- propio cierre: cuándo se pidió, cuándo se exportó, hasta cuándo hay que
  -- conservar por obligación legal y cuándo (si procede) se eliminó.
  CREATE TABLE IF NOT EXISTS account_closure_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    clinic_id INTEGER,
    status TEXT NOT NULL DEFAULT 'requested',
    reason TEXT NOT NULL DEFAULT '',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    requested_by INTEGER,
    export_generated_at TIMESTAMPTZ,
    -- Hasta cuándo hay que conservar la historia clínica. Lo fija la ley de la
    -- jurisdicción del profesional, no la plataforma: por eso es una fecha
    -- guardada, no una constante en el código.
    clinical_retention_until TIMESTAMPTZ,
    retention_basis TEXT NOT NULL DEFAULT '',
    data_deleted_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    decided_by INTEGER,
    notes TEXT NOT NULL DEFAULT '',
    CONSTRAINT account_closure_status_check
      CHECK (status IN ('requested', 'export_ready', 'retention_hold', 'cancelled', 'closed'))
  );

  CREATE INDEX IF NOT EXISTS idx_closure_user
    ON account_closure_requests(user_id, requested_at DESC);
  CREATE INDEX IF NOT EXISTS idx_closure_status
    ON account_closure_requests(status, requested_at DESC);
`;

// ── Guardianes de inmutabilidad ──
//
// Estos triggers son la diferencia entre "el sistema es append-only" y "el
// sistema es append-only porque nadie ha escrito todavía el UPDATE". Corren
// dentro de Postgres, así que aplican también a un script suelto, a una consola
// de administración o a una ruta futura que se olvide de la regla.
const GUARDIANES = `
  -- Una versión publicada es piedra: contenido, hash, número y fechas de
  -- publicación no se mueven. Lo único que puede cambiar es pasar a 'archived'.
  CREATE OR REPLACE FUNCTION legal_versions_guard() RETURNS trigger AS $guardia$
  BEGIN
    IF TG_OP = 'DELETE' THEN
      IF OLD.status <> 'draft' THEN
        RAISE EXCEPTION 'legal_document_versions: una versión % no se puede borrar (id=%)', OLD.status, OLD.id;
      END IF;
      RETURN OLD;
    END IF;

    IF OLD.status <> 'draft' THEN
      IF NEW.content <> OLD.content
         OR NEW.content_hash <> OLD.content_hash
         OR NEW.version <> OLD.version
         OR NEW.document_id <> OLD.document_id
         OR NEW.published_at IS DISTINCT FROM OLD.published_at
         OR NEW.effective_at IS DISTINCT FROM OLD.effective_at THEN
        RAISE EXCEPTION 'legal_document_versions: el contenido de una versión publicada es inmutable (id=%)', OLD.id;
      END IF;
      IF NEW.status <> OLD.status AND NEW.status <> 'archived' THEN
        RAISE EXCEPTION 'legal_document_versions: transición de estado no permitida (% -> %)', OLD.status, NEW.status;
      END IF;
    END IF;

    RETURN NEW;
  END;
  $guardia$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS legal_versions_guard_trg ON legal_document_versions;
  CREATE TRIGGER legal_versions_guard_trg
    BEFORE UPDATE OR DELETE ON legal_document_versions
    FOR EACH ROW EXECUTE FUNCTION legal_versions_guard();

  -- Una aceptación no se edita y no se borra. Punto. Ni la fecha, ni la IP, ni
  -- el usuario, ni la versión, ni el hash. Si algo se registró mal, se añade
  -- otra fila que lo corrija; la anterior se queda como prueba de lo ocurrido.
  CREATE OR REPLACE FUNCTION legal_append_only_guard() RETURNS trigger AS $guardia$
  BEGIN
    RAISE EXCEPTION '%: registro histórico de solo escritura; % no está permitido', TG_TABLE_NAME, TG_OP;
  END;
  $guardia$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS legal_acceptances_guard_trg ON legal_acceptances;
  CREATE TRIGGER legal_acceptances_guard_trg
    BEFORE UPDATE OR DELETE ON legal_acceptances
    FOR EACH ROW EXECUTE FUNCTION legal_append_only_guard();

  DROP TRIGGER IF EXISTS legal_audit_guard_trg ON legal_audit_events;
  CREATE TRIGGER legal_audit_guard_trg
    BEFORE UPDATE OR DELETE ON legal_audit_events
    FOR EACH ROW EXECUTE FUNCTION legal_append_only_guard();
`;

/**
 * Crea (o completa) el esquema legal. Idempotente: se puede llamar en cada
 * arranque. Devuelve si los guardianes quedaron instalados, para que el
 * arranque pueda dejar constancia.
 */
async function migrate(query) {
  await query(TABLAS);

  // Postgres viejo o rol sin permiso para crear funciones: la app tiene que
  // seguir arrancando, pero que nadie crea que el append-only está garantizado.
  let guardianes = true;
  try {
    await query(GUARDIANES);
  } catch (err) {
    guardianes = false;
    console.error(
      '[legal] AVISO GRAVE: no se pudieron instalar los guardianes de inmutabilidad ' +
        '(las aceptaciones y la bitácora legal quedan modificables a nivel de base): ' +
        err.message,
    );
  }
  return { guardianes };
}

module.exports = { migrate, TABLAS, GUARDIANES };
