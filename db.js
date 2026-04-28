const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
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
        role TEXT NOT NULL CHECK(role IN ('super_admin', 'clinic_admin', 'doctor', 'receptionist')),
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
    `);

    const alterCommands = [
      'ALTER TABLE patients ADD COLUMN IF NOT EXISTS created_by INTEGER',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty TEXT DEFAULT \'\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT \'\'',
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
      'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS visit_reason TEXT DEFAULT \'\'',
      'ALTER TABLE consultations ADD COLUMN IF NOT EXISTS appointment_id INTEGER',
      'ALTER TABLE patients ADD COLUMN IF NOT EXISTS odontogram_state TEXT DEFAULT \'{}\''
    ];

    for (const cmd of alterCommands) {
      try {
        await query(cmd);
      } catch (e) {}
    }

    const existingPatients = await query('SELECT COUNT(*) as count FROM patients');
    const shouldInsertTestData = parseInt(existingPatients.rows[0].count) === 0;

    if (shouldInsertTestData) {
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
