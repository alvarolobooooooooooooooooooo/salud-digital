const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// El free tier de Render Postgres corta conexiones idle. Si pg detecta una
// conexión muerta y nadie escucha 'error', Node tira el proceso. Con este
// handler la log queda visible pero el server sigue corriendo; la próxima
// query simplemente abre una conexión nueva del pool.
pool.on('error', (err) => {
  console.error('[pg] idle connection error (ignored):', err.message);
});

const query = (text, params) => pool.query(text, params);

const initDb = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS clinics (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('super_admin', 'clinic_admin', 'doctor', 'receptionist', 'patient')),
        name TEXT DEFAULT '',
        clinic_id INTEGER,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id)
      );

      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        identity_number TEXT NOT NULL,
        age INTEGER NOT NULL DEFAULT 0,
        birth_date TEXT DEFAULT '',
        gender TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        clinic_id INTEGER NOT NULL,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id)
      );

      CREATE TABLE IF NOT EXISTS critical_info (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL UNIQUE,
        allergies TEXT DEFAULT '',
        medications TEXT DEFAULT '',
        conditions TEXT DEFAULT '',
        FOREIGN KEY (patient_id) REFERENCES patients(id)
      );

      CREATE TABLE IF NOT EXISTS consultations (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        notes TEXT DEFAULT '',
        diagnosis TEXT DEFAULT '',
        treatment TEXT DEFAULT '',
        clinic_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (clinic_id) REFERENCES clinics(id)
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        clinic_id INTEGER NOT NULL,
        specialty TEXT DEFAULT '',
        scheduled_at TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (doctor_id) REFERENCES users(id),
        FOREIGN KEY (clinic_id) REFERENCES clinics(id)
      );

      -- Índices para las tablas centrales (Postgres NO indexa columnas FK automáticamente).
      -- Aceleran la ficha de paciente, el calendario y los listados que filtran por
      -- clinic_id / patient_id / doctor_id. Compuestos donde la query también ordena.
      CREATE INDEX IF NOT EXISTS idx_patients_clinic ON patients(clinic_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_clinic_scheduled ON appointments(clinic_id, scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);
      CREATE INDEX IF NOT EXISTS idx_consultations_patient_clinic_created ON consultations(patient_id, clinic_id, created_at);

      CREATE TABLE IF NOT EXISTS invitations (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT DEFAULT '',
        specialty TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        clinic_id INTEGER,
        token TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id)
      );

      CREATE TABLE IF NOT EXISTS consent_templates (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER NOT NULL,
        doctor_id INTEGER,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id),
        FOREIGN KEY (doctor_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS patient_consents (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        template_id INTEGER NOT NULL,
        clinic_id INTEGER NOT NULL,
        signed_by TEXT DEFAULT '',
        signature_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'signed' CHECK(status IN ('pending', 'signed', 'expired')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (template_id) REFERENCES consent_templates(id),
        FOREIGN KEY (clinic_id) REFERENCES clinics(id)
      );

      CREATE TABLE IF NOT EXISTS appointment_reminders (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER NOT NULL,
        patient_id INTEGER NOT NULL,
        clinic_id INTEGER NOT NULL,
        channel TEXT NOT NULL DEFAULT 'whatsapp',
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'manual_sent')),
        sent_at TIMESTAMP,
        sent_by INTEGER,
        message_content TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (clinic_id) REFERENCES clinics(id),
        FOREIGN KEY (sent_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS appointment_confirmations (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER NOT NULL UNIQUE,
        patient_id INTEGER NOT NULL,
        clinic_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent', 'confirmed', 'declined')),
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_by INTEGER,
        responded_at TIMESTAMP,
        message_content TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (clinic_id) REFERENCES clinics(id),
        FOREIGN KEY (sent_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS consultation_images (
        id SERIAL PRIMARY KEY,
        consultation_id INTEGER NOT NULL,
        clinic_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id)
      );

      CREATE INDEX IF NOT EXISTS idx_consultation_images_consultation ON consultation_images(consultation_id, clinic_id);

      CREATE TABLE IF NOT EXISTS doctor_availability (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        slot_duration INTEGER DEFAULT 30,
        enabled BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Excepciones de un día concreto sobre el horario semanal: o el día entero
      -- cerrado, o una lista de horas ("HH:MM") que ese día no se ofrecen. Sin
      -- fila = el día sigue el horario semanal de doctor_availability.
      CREATE TABLE IF NOT EXISTS doctor_day_overrides (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER NOT NULL,
        override_date DATE NOT NULL,
        closed BOOLEAN NOT NULL DEFAULT FALSE,
        blocked_times JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (doctor_id, override_date),
        FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_doctor_day_overrides_doctor
        ON doctor_day_overrides(doctor_id, override_date);

      CREATE TABLE IF NOT EXISTS clinic_rooms (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'free' CHECK(status IN ('free', 'occupied', 'cleaning')),
        current_appointment_id INTEGER,
        occupied_since TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
        FOREIGN KEY (current_appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        image_url TEXT DEFAULT '',
        sku TEXT DEFAULT '',
        barcode TEXT DEFAULT '',
        category TEXT DEFAULT '',
        type TEXT DEFAULT 'otro',
        current_stock NUMERIC NOT NULL DEFAULT 0,
        min_stock NUMERIC NOT NULL DEFAULT 0,
        max_stock NUMERIC,
        unit TEXT DEFAULT 'unidades',
        low_stock_alert BOOLEAN DEFAULT TRUE,
        purchase_date DATE,
        expiration_date DATE,
        expiration_alert_days INTEGER DEFAULT 30,
        unit_cost NUMERIC NOT NULL DEFAULT 0,
        currency TEXT DEFAULT 'HNL',
        supplier_name TEXT DEFAULT '',
        invoice_number TEXT DEFAULT '',
        purchase_notes TEXT DEFAULT '',
        branch TEXT DEFAULT '',
        area TEXT DEFAULT '',
        exact_location TEXT DEFAULT '',
        responsible_user_id INTEGER,
        is_active BOOLEAN DEFAULT TRUE,
        is_archived BOOLEAN DEFAULT FALSE,
        requires_expiration_control BOOLEAN DEFAULT FALSE,
        requires_authorization_for_use BOOLEAN DEFAULT FALSE,
        allow_use_in_appointments BOOLEAN DEFAULT TRUE,
        internal_notes TEXT DEFAULT '',
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
        FOREIGN KEY (responsible_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS inventory_movements (
        id SERIAL PRIMARY KEY,
        inventory_item_id INTEGER NOT NULL,
        clinic_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('entrada','salida','ajuste','perdida','vencimiento','transferencia')),
        quantity NUMERIC NOT NULL,
        previous_stock NUMERIC NOT NULL DEFAULT 0,
        new_stock NUMERIC NOT NULL DEFAULT 0,
        reason TEXT DEFAULT '',
        note TEXT DEFAULT '',
        user_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_inventory_items_clinic ON inventory_items(clinic_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
      CREATE INDEX IF NOT EXISTS idx_inventory_items_archived ON inventory_items(is_archived);
      CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON inventory_movements(inventory_item_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_movements_clinic ON inventory_movements(clinic_id);

      CREATE TABLE IF NOT EXISTS consultation_inventory_usage (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER NOT NULL,
        consultation_id INTEGER NOT NULL,
        consultation_type TEXT DEFAULT 'general',
        patient_id INTEGER,
        inventory_item_id INTEGER NOT NULL,
        quantity_used NUMERIC NOT NULL DEFAULT 0,
        unit TEXT DEFAULT '',
        unit_cost NUMERIC NOT NULL DEFAULT 0,
        total_cost NUMERIC NOT NULL DEFAULT 0,
        stock_before NUMERIC,
        stock_after NUMERIC,
        notes TEXT DEFAULT '',
        stock_applied BOOLEAN DEFAULT FALSE,
        used_by_user_id INTEGER,
        used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
        FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
        FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
        FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_civ_consultation ON consultation_inventory_usage(consultation_id);
      CREATE INDEX IF NOT EXISTS idx_civ_inventory ON consultation_inventory_usage(inventory_item_id);
      CREATE INDEX IF NOT EXISTS idx_civ_clinic ON consultation_inventory_usage(clinic_id);

      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        jti TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        user_agent TEXT DEFAULT '',
        ip TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_jti ON user_sessions(jti);

      -- ===== Mensajería clínica interna (chat entre personal de la clínica) =====
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('directo','equipo','caso','interconsulta','anuncio')),
        title TEXT DEFAULT '',
        subtitle TEXT DEFAULT '',
        patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_chat_conv_clinic ON chat_conversations(clinic_id);

      CREATE TABLE IF NOT EXISTS chat_members (
        conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_at TIMESTAMP DEFAULT to_timestamp(0),
        PRIMARY KEY (conversation_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);

      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        kind TEXT NOT NULL DEFAULT 'text',
        body TEXT DEFAULT '',
        payload JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id, id);
    `);

    const alterCommands = [
      'ALTER TABLE patients ADD COLUMN IF NOT EXISTS created_by INTEGER',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty TEXT DEFAULT \'\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT \'\'',
      // Cuentas de paciente (plataforma del paciente, /paciente.html). El rol
      // 'patient' no existía en la constraint original (creada por CREATE TABLE);
      // en una BD ya existente hay que recrear la constraint con ALTER.
      // users_role_check es el nombre que Postgres asigna por defecto a un CHECK
      // inline sobre la columna role.
      'ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check',
      "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'clinic_admin', 'doctor', 'receptionist', 'patient'))",
      // Enlace opcional a su expediente en la clínica (se llena cuando el backend
      // del portal del paciente se conecte; hoy la app del paciente usa datos mock).
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS patient_id INTEGER',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS address TEXT DEFAULT \'\'',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS chairs INTEGER DEFAULT 1',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS specialties TEXT DEFAULT \'\'',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT \'\'',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS email TEXT DEFAULT \'\'',
      'ALTER TABLE invitations ADD COLUMN IF NOT EXISTS role TEXT DEFAULT \'doctor\'',
      'ALTER TABLE invitations ALTER COLUMN clinic_id DROP NOT NULL',
      'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS specialty TEXT DEFAULT \'\'',
      'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS odontogram_state TEXT DEFAULT \'{}\'',
      'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0',
      'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT \'pending\'',
      'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS lifestyle TEXT DEFAULT \'{}\'',
      'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS procedures TEXT DEFAULT \'\'',
      'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS radiography_notes TEXT DEFAULT \'\'',
      'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS observations TEXT DEFAULT \'\'',
      'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS doctor_id INTEGER',
      // El índice sobre doctor_id va aquí (no en el CREATE) porque la columna se
      // agrega por ALTER: en una BD nueva el índice fallaría si corriera antes.
      'CREATE INDEX IF NOT EXISTS idx_consultations_doctor ON consultations(doctor_id)',
      // Mismo motivo (payment_status es ALTER). Sostiene las tablas de Finanzas
      // (pagadas/pendientes) que filtran por clínica + estado y ordenan por fecha:
      // con paginación el motor puede leer solo la página pedida en vez de escanear
      // todo el historial de la clínica.
      'CREATE INDEX IF NOT EXISTS idx_consultations_clinic_status_created ON consultations(clinic_id, payment_status, created_at DESC)',
      'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS visit_reason TEXT DEFAULT \'\'',
      'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS appointment_id INTEGER',
      'ALTER TABLE patients ADD COLUMN IF NOT EXISTS odontogram_state TEXT DEFAULT \'{}\'',
      'ALTER TABLE patients ADD COLUMN IF NOT EXISTS whatsapp_number TEXT DEFAULT \'\'',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT FALSE',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS whatsapp_number TEXT DEFAULT \'\'',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS whatsapp_template TEXT DEFAULT \'Hola {{patientName}}, le recordamos su cita en {{clinicName}} el día {{appointmentDate}} a las {{appointmentTime}} con {{doctorName}}.\\n\\nPor favor confirme si podrá asistir. Gracias.\'',
      'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS payment_notes TEXT DEFAULT \'\'',
      'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS consent_id INTEGER',
      'ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS signature_data TEXT',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT \'professional\'',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT \'active\'',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT \'monthly\'',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS type TEXT DEFAULT \'\'',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS tax_id TEXT DEFAULT \'\'',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS city TEXT DEFAULT \'\'',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS info TEXT DEFAULT \'\'',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT \'#0891b2\'',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT \'HNL\'',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS website TEXT DEFAULT \'\'',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT \'\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_role TEXT DEFAULT \'\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT DEFAULT \'\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT \'\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS license TEXT DEFAULT \'\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS experience INTEGER DEFAULT 0',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS shift TEXT DEFAULT \'\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT \'\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS languages TEXT DEFAULT \'[]\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS focus TEXT DEFAULT \'[]\'',
      'ALTER TABLE consent_templates ADD COLUMN IF NOT EXISTS doctor_id INTEGER',
      'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT \'manual\'',
      'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT \'\'',
      'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS room_id INTEGER',
      'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP',
      'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS started_at TIMESTAMP',
      'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP',
      'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0',
      'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT \'pending\'',
      'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT \'\'',
      'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP',
      'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS paid_by INTEGER',
      'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_notes TEXT DEFAULT \'\'',
      'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_type TEXT DEFAULT \'seguimiento\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT DEFAULT NULL',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_pending_secret TEXT DEFAULT NULL',
      'ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sale_price NUMERIC NOT NULL DEFAULT 0',
      // Configuración avanzada del artículo (drawer "Editar artículo" → sección 6).
      // CREATE TABLE IF NOT EXISTS no agrega columnas a tablas preexistentes, así que
      // estos ALTER garantizan que las instancias antiguas también los tengan.
      'ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE',
      'ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS requires_expiration_control BOOLEAN DEFAULT FALSE',
      'ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS requires_authorization_for_use BOOLEAN DEFAULT FALSE',
      'ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS allow_use_in_appointments BOOLEAN DEFAULT TRUE',
      "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS internal_notes TEXT DEFAULT ''",
      'ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS is_sale BOOLEAN NOT NULL DEFAULT FALSE',
      'ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS unit_sale_price NUMERIC',
      'ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS unit_cost_at_sale NUMERIC',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS whatsapp_confirmation_template TEXT DEFAULT \'Hola {{patientName}}, le escribimos desde {{clinicName}} para confirmar su cita del {{appointmentDate}} a las {{appointmentTime}} con {{doctorName}}.\\n\\nPor favor confirme aquí: {{confirmLink}}\\n\\n¡Gracias!\'',
      // 'patient_link' cuando el paciente responde desde el link público, 'manual'
      // cuando el staff marca la confirmación a mano. Usado por la campanita del doctor
      // para mostrar solo confirmaciones reales del paciente.
      'ALTER TABLE appointment_confirmations ADD COLUMN IF NOT EXISTS confirmed_via TEXT',
      // ── Landing pública por clínica ──
      // slug: identificador URL-safe único (lowercase, alfanum + guiones). Se usa para
      // servir /c/<slug>. Nullable porque cada clínica lo configura cuando le interesa.
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS slug TEXT',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_clinics_slug ON clinics(slug) WHERE slug IS NOT NULL',
      // landing_data: blob JSON con todas las secciones editables (hero, servicios,
      // galería, testimonios, FAQ, horarios, social, etc.). Mantenerlo en una sola
      // columna evita decenas de migraciones a medida que evolucione el template.
      "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS landing_data JSONB DEFAULT '{}'::jsonb",
      "ALTER TABLE clinics ADD COLUMN IF NOT EXISTS landing_template TEXT DEFAULT 'aurora'",
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS landing_published BOOLEAN DEFAULT FALSE',
      // Coordenadas geocodificadas desde address/city via Nominatim (OSM). NULL = sin geocodear
      // o falló. geocoded_at evita reintentar en cada PUT. show_on_public_map permite opt-out
      // del mapa público /mapa por parte del admin de la clínica.
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMP',
      'ALTER TABLE clinics ADD COLUMN IF NOT EXISTS show_on_public_map BOOLEAN DEFAULT TRUE',
      'CREATE INDEX IF NOT EXISTS idx_clinics_geo ON clinics(latitude, longitude) WHERE latitude IS NOT NULL'
    ];

    // Leads (formulario de contacto público de la landing). Se modelan como tabla aparte
    // para indexar por clínica y permitir CRM básico desde el panel.
    await query(`
      CREATE TABLE IF NOT EXISTS clinic_integrations (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER NOT NULL,
        provider TEXT NOT NULL,
        external_account_id TEXT DEFAULT '',
        external_account_name TEXT DEFAULT '',
        access_token_encrypted TEXT DEFAULT '',
        refresh_token_encrypted TEXT DEFAULT '',
        token_expires_at TIMESTAMP,
        scopes TEXT DEFAULT '',
        meta TEXT DEFAULT '{}',
        status TEXT DEFAULT 'active' CHECK (status IN ('active','expired','revoked','error')),
        last_error TEXT DEFAULT '',
        connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        connected_by INTEGER,
        last_sync_at TIMESTAMP,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
        FOREIGN KEY (connected_by) REFERENCES users(id),
        UNIQUE (clinic_id, provider, external_account_id)
      );
      CREATE INDEX IF NOT EXISTS idx_clinic_integrations_clinic ON clinic_integrations(clinic_id);
      CREATE INDEX IF NOT EXISTS idx_clinic_integrations_status ON clinic_integrations(status);

      CREATE TABLE IF NOT EXISTS growth_campaigns (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER NOT NULL,
        integration_id INTEGER,
        provider TEXT NOT NULL,
        external_campaign_id TEXT DEFAULT '',
        name TEXT DEFAULT '',
        specialty TEXT DEFAULT '',
        status TEXT DEFAULT 'unknown',
        spent_hnl NUMERIC DEFAULT 0,
        leads_count INTEGER DEFAULT 0,
        period_start DATE,
        period_end DATE,
        raw TEXT DEFAULT '{}',
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
        FOREIGN KEY (integration_id) REFERENCES clinic_integrations(id) ON DELETE CASCADE,
        UNIQUE (provider, external_campaign_id, period_start)
      );
      CREATE INDEX IF NOT EXISTS idx_growth_campaigns_clinic ON growth_campaigns(clinic_id);
      CREATE INDEX IF NOT EXISTS idx_growth_campaigns_period ON growth_campaigns(clinic_id, period_start DESC);

      CREATE TABLE IF NOT EXISTS clinic_landing_leads (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        message TEXT DEFAULT '',
        source TEXT DEFAULT 'landing',
        status TEXT DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_landing_leads_clinic ON clinic_landing_leads(clinic_id);
      CREATE INDEX IF NOT EXISTS idx_landing_leads_created ON clinic_landing_leads(created_at DESC);

      -- ══════════════ FACTURACIÓN ══════════════
      -- Modelo AGNÓSTICO del procesador de pagos. Ninguna columna se llama
      -- "paypal_*": el proveedor va en la columna provider y sus identificadores
      -- en las columnas provider_*, para poder migrar a PixelPay/Tilopay/BAC sin
      -- tocar la lógica de negocio. Ver docs/PAYMENTS.md.

      -- Catálogo de planes. El importe vive aquí, no en el código, y
      -- provider_refs guarda el id del plan en CADA procesador:
      --   {"paypal": {"plan_id": "P-XXXX"}, "pixelpay": {...}}
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        amount NUMERIC(12,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        billing_interval TEXT NOT NULL DEFAULT 'month'
          CHECK (billing_interval IN ('day','week','month','year')),
        interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count > 0),
        trial_days INTEGER NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        provider_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Métodos de pago tokenizados. NUNCA se guarda el PAN completo ni el CVV:
      -- solo el token del procesador y los datos de presentación (marca y
      -- últimos 4) que él mismo devuelve. Si un procesador no tokeniza, aquí no
      -- se escribe nada y la suscripción va por su motor nativo.
      CREATE TABLE IF NOT EXISTS payment_methods (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER NOT NULL,
        user_id INTEGER,
        provider TEXT NOT NULL,
        provider_customer_id TEXT DEFAULT '',
        provider_token TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'card' CHECK (type IN ('card','wallet','bank')),
        brand TEXT DEFAULT '',
        last4 TEXT DEFAULT '' CHECK (char_length(last4) <= 4),
        exp_month INTEGER CHECK (exp_month BETWEEN 1 AND 12),
        exp_year INTEGER CHECK (exp_year BETWEEN 2000 AND 2100),
        holder_name TEXT DEFAULT '',
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','expired','revoked','invalid')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE (provider, provider_token)
      );
      CREATE INDEX IF NOT EXISTS idx_payment_methods_clinic ON payment_methods(clinic_id, is_default DESC);

      -- Suscripciones. La tabla venía de la primera iteración (acoplada a
      -- PayPal); se migra abajo con ALTER para no perder las filas existentes.
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER NOT NULL,
        user_id INTEGER,
        provider TEXT NOT NULL DEFAULT 'paypal',
        provider_subscription_id TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'incomplete',
        amount NUMERIC(12,2) DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- Un cobro = un intento. Se registra tanto el éxito como el fallo, con su
      -- número de intento, para poder auditar el dunning.
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER,
        clinic_id INTEGER NOT NULL,
        provider TEXT NOT NULL,
        provider_payment_id TEXT,
        provider_subscription_id TEXT DEFAULT '',
        payment_method_id INTEGER,
        amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','succeeded','failed','refunded','reversed','cancelled')),
        attempt INTEGER NOT NULL DEFAULT 1,
        failure_code TEXT DEFAULT '',
        failure_message TEXT DEFAULT '',
        period_start TIMESTAMP,
        period_end TIMESTAMP,
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
        FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
        FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
        UNIQUE (provider, provider_payment_id)
      );
      CREATE INDEX IF NOT EXISTS idx_payments_clinic ON payments(clinic_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payments_subscription ON payments(subscription_id, created_at DESC);

      -- Bitácora de webhooks: guarda TODO evento recibido (aunque falle su
      -- procesamiento) para idempotencia, auditoría y reproceso manual.
      CREATE TABLE IF NOT EXISTS payment_events (
        id SERIAL PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_event_id TEXT NOT NULL,
        event_type TEXT DEFAULT '',
        signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','processed','failed','ignored')),
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT DEFAULT '',
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        UNIQUE (provider, provider_event_id)
      );
      CREATE INDEX IF NOT EXISTS idx_payment_events_status ON payment_events(status, received_at);
    `);

    // ── Migración de la tabla subscriptions de la 1ª iteración ──
    // Los renombrados no son idempotentes: se comprueba el catálogo antes.
    // Con esto las filas existentes (intentos sin completar) se conservan.
    await query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name='subscriptions' AND column_name='external_id') THEN
          ALTER TABLE subscriptions RENAME COLUMN external_id TO provider_subscription_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name='subscriptions' AND column_name='plan_id'
                      AND data_type = 'text') THEN
          ALTER TABLE subscriptions RENAME COLUMN plan_id TO provider_plan_id;
        END IF;
      END $$;
    `);

    // Columnas del ciclo de facturación. A diferencia de `alterCommands`, estos
    // NO se ejecutan tragándose errores: si el esquema no queda como el código
    // espera, es mejor que el arranque falle a que los cobros se comporten raro.
    const billingAlters = [
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES plans(id)",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_plan_id TEXT DEFAULT ''",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_customer_id TEXT DEFAULT ''",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE SET NULL",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_interval TEXT NOT NULL DEFAULT 'month'",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS interval_count INTEGER NOT NULL DEFAULT 1",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMP",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_reason TEXT DEFAULT ''",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_error TEXT DEFAULT ''",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscriber_email TEXT DEFAULT ''",
      "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscriber_name TEXT DEFAULT ''",
      "CREATE INDEX IF NOT EXISTS idx_subscriptions_clinic ON subscriptions(clinic_id, created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)",
      // El job de renovación busca por aquí: sin índice haría un seq scan cada minuto.
      "CREATE INDEX IF NOT EXISTS idx_subscriptions_due ON subscriptions(next_billing_at) WHERE status IN ('active','past_due','trialing')",
    ];
    for (const cmd of billingAlters) await query(cmd);

    // Estados: la 1ª iteración guardaba los de PayPal en mayúsculas
    // (APPROVAL_PENDING, ACTIVE…). Se traducen al vocabulario interno, que es
    // el mismo sea cual sea el procesador.
    await query(`
      UPDATE subscriptions SET status = CASE upper(status)
        WHEN 'ACTIVE'           THEN 'active'
        WHEN 'APPROVAL_PENDING' THEN 'incomplete'
        WHEN 'APPROVED'         THEN 'incomplete'
        WHEN 'SUSPENDED'        THEN 'past_due'
        WHEN 'CANCELLED'        THEN 'cancelled'
        WHEN 'EXPIRED'          THEN 'expired'
        ELSE lower(status) END
      WHERE status <> lower(status)
    `);

    // Valores de las columnas viejas → nuevas, y fuera las viejas.
    await query(`
      UPDATE subscriptions
         SET current_period_start = COALESCE(current_period_start, start_time),
             next_billing_at      = COALESCE(next_billing_at, next_billing_time),
             current_period_end   = COALESCE(current_period_end, next_billing_time)
       WHERE start_time IS NOT NULL OR next_billing_time IS NOT NULL
    `).catch(() => {});
    for (const col of ['start_time', 'next_billing_time', 'last_payment_at', 'last_payment_amount']) {
      await query(`ALTER TABLE subscriptions DROP COLUMN IF EXISTS ${col}`);
    }

    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_status_check') THEN
          ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
            CHECK (status IN ('incomplete','trialing','active','past_due','payment_failed','paused','cancelled','expired'));
        END IF;
      END $$;
    `);

    // Tablas de la 1ª iteración → nuevas. Se copian las filas (si las hubiera) y
    // se retiran las viejas, para no dejar dos fuentes de verdad.
    await query(`
      INSERT INTO payments (subscription_id, clinic_id, provider, provider_payment_id,
                            provider_subscription_id, amount, currency, status, paid_at, created_at)
      SELECT sp.subscription_id, COALESCE(s.clinic_id, 0), 'paypal', sp.external_payment_id,
             sp.external_subscription_id, sp.amount, sp.currency,
             CASE upper(sp.status) WHEN 'COMPLETED' THEN 'succeeded'
                                   WHEN 'REFUNDED'  THEN 'refunded'
                                   WHEN 'REVERSED'  THEN 'reversed'
                                   ELSE 'failed' END,
             sp.paid_at, sp.created_at
        FROM subscription_payments sp
        LEFT JOIN subscriptions s ON s.id = sp.subscription_id
       WHERE s.clinic_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `).catch(() => {});
    await query(`
      INSERT INTO payment_events (provider, provider_event_id, event_type, signature_verified, status, received_at)
      SELECT 'paypal', event_id, event_type, TRUE, 'processed', received_at FROM paypal_webhook_events
      ON CONFLICT DO NOTHING
    `).catch(() => {});
    await query('DROP TABLE IF EXISTS subscription_payments');
    await query('DROP TABLE IF EXISTS paypal_webhook_events');

    // Plan por defecto: el catálogo pasa a la BD, pero el precio sigue saliendo
    // de las variables de entorno la primera vez para no cambiar el importe a
    // nadie por sorpresa. A partir de ahí, manda la tabla.
    const precioEnv = parseFloat(process.env.SUBSCRIPTION_PRICE || '19.99');
    const monedaEnv = (process.env.SUBSCRIPTION_CURRENCY || 'USD').toUpperCase();
    const refsPaypal = process.env.PAYPAL_PLAN_ID
      ? JSON.stringify({ paypal: { plan_id: process.env.PAYPAL_PLAN_ID } })
      : '{}';
    await query(
      `INSERT INTO plans (code, name, description, amount, currency, billing_interval, interval_count, provider_refs)
       VALUES ('individual-monthly', 'Plan Individual',
               'Acceso completo a Salud Digital para un profesional.', $1, $2, 'month', 1, $3::jsonb)
       ON CONFLICT (code) DO UPDATE
         SET provider_refs = plans.provider_refs || EXCLUDED.provider_refs`,
      [Number.isFinite(precioEnv) && precioEnv > 0 ? precioEnv : 19.99, monedaEnv, refsPaypal]
    );
    // Suscripciones antiguas sin plan → al plan por defecto.
    await query(
      `UPDATE subscriptions SET plan_id = (SELECT id FROM plans WHERE code = 'individual-monthly')
        WHERE plan_id IS NULL`
    );

    // audit_logs nació exigiendo user_id, pero los eventos de facturación los
    // origina el SISTEMA: un webhook del procesador o el job de renovación no
    // tienen usuario detrás. Sin esto, esas entradas se perdían en silencio
    // (el servicio de auditoría traga sus propios errores) y nos quedábamos
    // justo sin la traza de los cobros, que es la que más importa.
    await query('ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL');
    await query('ALTER TABLE audit_logs ALTER COLUMN clinic_id DROP NOT NULL');

    for (const cmd of alterCommands) {
      try {
        await query(cmd);
      } catch (e) {}
    }

    try {
      await query(
        `UPDATE appointments a
         SET cost = c.cost, payment_status = c.payment_status, payment_notes = c.payment_notes
         FROM consultations c
         WHERE a.id = c.appointment_id AND a.cost = 0 AND c.cost > 0`
      );
    } catch (e) {}

    const existingPatients = await query('SELECT COUNT(*) as count FROM patients');
    const dbEmpty = parseInt(existingPatients.rows[0].count) === 0;
    // Seeding solo si la BD está vacía Y el operador opta explícitamente con SEED_DEMO_DATA=true.
    // Evita que un deploy productivo recree cuentas demo con contraseñas débiles.
    const shouldInsertTestData = dbEmpty && process.env.SEED_DEMO_DATA === 'true';

    if (shouldInsertTestData) {
      console.warn('[DB] SEED_DEMO_DATA=true → insertando datos demo. NO usar en producción.');
      const adminHash = bcrypt.hashSync('admin123', 10);
      await query(
        'INSERT INTO users (email, password, role, name, clinic_id) VALUES ($1, $2, $3, $4, $5)',
        ['admin@saluddigital.com', adminHash, 'super_admin', 'Super Admin', null]
      );

      const c1 = await query('INSERT INTO clinics (name) VALUES ($1) RETURNING id', ['Clinica Norte']);
      const c2 = await query('INSERT INTO clinics (name) VALUES ($1) RETURNING id', ['Clinica Sur']);
      const clinic1Id = c1.rows[0].id;
      const clinic2Id = c2.rows[0].id;

      const h = bcrypt.hashSync('clinic123', 10);
      await query(
        'INSERT INTO users (email, password, role, name, clinic_id) VALUES ($1, $2, $3, $4, $5)',
        ['admin@clinicanorte.com', h, 'clinic_admin', 'Admin Norte', clinic1Id]
      );
      await query(
        'INSERT INTO users (email, password, role, name, clinic_id) VALUES ($1, $2, $3, $4, $5)',
        ['admin@clinicasur.com', h, 'clinic_admin', 'Admin Sur', clinic2Id]
      );

      const dh = bcrypt.hashSync('doctor123', 10);
      await query(
        'INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        ['dr.garcia@clinicanorte.com', dh, 'doctor', 'Álvaro Lobo', clinic1Id, 'Medicina General', '31515887']
      );
      await query(
        'INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        ['dr.carlos.lopez@clinicasur.com', dh, 'doctor', 'Carlos Lopez', clinic2Id, 'Pediatría', '18031789']
      );
      await query(
        'INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        ['dr.diego.lopez@clinicanorte.com', dh, 'doctor', 'Diego Lopez', clinic1Id, 'Dermatología', '27479949']
      );
      await query(
        'INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        ['dra.ochoa@clinicanorte.com', dh, 'doctor', 'Ochoa Espinoza', clinic1Id, 'Odontología', '8585494']
      );
      await query(
        'INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        ['dra.karla.moreno@clinicasur.com', dh, 'doctor', 'Karla Moreno', clinic2Id, 'Dermatología', '14824824']
      );
      await query(
        'INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        ['heysselm@clinicanorte.com', dh, 'doctor', 'Heysssel Molina', clinic1Id, 'Odontología', '31248379']
      );
      await query(
        'INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        ['dr.juan@clinicanorte.com', dh, 'doctor', 'Juan Martinez', clinic1Id, 'Medicina General', '31234567']
      );
      try {
        const result = await query(
          'INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
          ['dra.piedra@clinicanorte.com', dh, 'doctor', 'Sandra Piedra', clinic1Id, 'Podología', '31567890']
        );
        console.log('[DB] Created podiatry doctor:', result.rows[0]?.id);
      } catch(e) {
        console.error('[DB] Error creating podiatry doctor:', e.message);
      }

      const rh = bcrypt.hashSync('receptionist123', 10);
      await query(
        'INSERT INTO users (email, password, role, name, clinic_id) VALUES ($1, $2, $3, $4, $5)',
        ['recepcion@clinicanorte.com', rh, 'receptionist', 'Recepcionista Norte', clinic1Id]
      );
      await query(
        'INSERT INTO users (email, password, role, name, clinic_id) VALUES ($1, $2, $3, $4, $5)',
        ['recepcion@clinicasur.com', rh, 'receptionist', 'Recepcionista Sur', clinic2Id]
      );

      const insertPatient = async (name, id, age, dob, gender, phone, clinicId) => {
        const res = await query(
          'INSERT INTO patients (name, identity_number, age, birth_date, gender, phone, clinic_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
          [name, id, age, dob, gender, phone, clinicId]
        );
        return res.rows[0].id;
      };

      const p1 = await insertPatient('Maria González',   '0801-1979-12345', 45, '1979-03-15', 'Femenino',   '31515887', clinic1Id);
      const p2 = await insertPatient('Carlos Rodríguez', '0801-1962-87654', 62, '1962-07-22', 'Masculino',  '31877575', clinic1Id);
      const p3 = await insertPatient('Ana Martínez',     '0801-1986-11223', 38, '1986-11-05', 'Femenino',   '08439748', clinic2Id);
      const p4 = await insertPatient('Luis Herrera',     '0801-1990-44556', 34, '1990-06-18', 'Masculino',  '31894252', clinic1Id);
      const p5 = await insertPatient('Sofia Castro',     '0801-2000-77889', 24, '2000-09-30', 'Femenino',   '31234567', clinic1Id);
      const p6 = await insertPatient('Pedro Morales',    '0801-1975-99001', 49, '1975-12-01', 'Masculino',  '32112233', clinic1Id);
      const p7 = await insertPatient('Laura Reyes',      '0801-1995-33221', 29, '1995-04-14', 'Femenino',   '31998877', clinic1Id);

      await query(
        'INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES ($1, $2, $3, $4)',
        [p1, 'Penicilina, Aspirina', 'Metformina 500mg', 'Diabetes Tipo 2']
      );
      await query(
        'INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES ($1, $2, $3, $4)',
        [p2, '', 'Atorvastatina 20mg, Lisinopril 10mg', 'Hipertensión, Colesterol alto']
      );
      await query(
        'INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES ($1, $2, $3, $4)',
        [p3, 'Sulfas', '', '']
      );
      for (const p of [p4, p5, p6, p7]) {
        await query(
          'INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES ($1, $2, $3, $4)',
          [p, '', '', '']
        );
      }

      await query(
        'INSERT INTO consultations (patient_id, notes, diagnosis, treatment, clinic_id) VALUES ($1, $2, $3, $4, $5)',
        [p1, 'Paciente acude por control rutinario', 'Diabetes bajo control', 'Continuar con Metformina', clinic1Id]
      );

      const today = new Date().toISOString().split('T')[0];
      const d1Id = d1.rows[0].id;
      const d2Id = d2.rows[0].id;
      await query(
        'INSERT INTO appointments (patient_id, doctor_id, clinic_id, specialty, scheduled_at, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [p1, d1Id, clinic1Id, 'Medicina General', `${today}T10:00:00`, 'waiting']
      );
      await query(
        'INSERT INTO appointments (patient_id, doctor_id, clinic_id, specialty, scheduled_at, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [p2, d1Id, clinic1Id, 'Medicina General', `${today}T11:00:00`, 'pending']
      );
      await query(
        'INSERT INTO appointments (patient_id, doctor_id, clinic_id, specialty, scheduled_at, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [p3, d2Id, clinic2Id, 'Odontología', `${today}T09:30:00`, 'waiting']
      );

      for (const cId of [clinic1Id, clinic2Id]) {
        for (let i = 1; i <= 4; i++) {
          await query(
            'INSERT INTO clinic_rooms (clinic_id, name, status) VALUES ($1, $2, $3)',
            [cId, `Sala ${i}`, 'free']
          );
        }
      }
    }

    // Initialize conversation tables for NLU assistant
    await query(`
      CREATE TABLE IF NOT EXISTS conversation_sessions (
        id UUID PRIMARY KEY,
        user_id INTEGER NOT NULL,
        clinic_id INTEGER NOT NULL,
        user_role TEXT NOT NULL,
        state TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (clinic_id) REFERENCES clinics(id)
      );

      CREATE TABLE IF NOT EXISTS conversation_messages (
        id UUID PRIMARY KEY,
        session_id UUID NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES conversation_sessions(id)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        clinic_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        reason TEXT,
        tool_input TEXT,
        tool_output TEXT,
        error TEXT,
        duration_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (clinic_id) REFERENCES clinics(id)
      );

      CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user ON conversation_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_conversation_messages_session ON conversation_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    `);

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization error:', err);
    throw err;
  }
};

module.exports = { query, initDb, pool };
