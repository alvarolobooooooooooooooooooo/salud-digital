const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'salud_digital.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS clinics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('super_admin', 'clinic_admin', 'doctor', 'receptionist')),
    name TEXT DEFAULT '',
    clinic_id INTEGER,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id)
  );

  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL UNIQUE,
    allergies TEXT DEFAULT '',
    medications TEXT DEFAULT '',
    conditions TEXT DEFAULT '',
    FOREIGN KEY (patient_id) REFERENCES patients(id)
  );

  CREATE TABLE IF NOT EXISTS consultations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    notes TEXT DEFAULT '',
    diagnosis TEXT DEFAULT '',
    treatment TEXT DEFAULT '',
    clinic_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (clinic_id) REFERENCES clinics(id)
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT DEFAULT '',
    specialty TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    clinic_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (clinic_id) REFERENCES clinics(id)
  );
`);

// Add user fields
try { db.exec('ALTER TABLE users ADD COLUMN specialty TEXT DEFAULT ""'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ""'); } catch {}

// Add dental consultation columns
try { db.exec('ALTER TABLE consultations ADD COLUMN specialty TEXT DEFAULT ""'); } catch {}
try { db.exec('ALTER TABLE consultations ADD COLUMN odontogram_state TEXT DEFAULT "{}"'); } catch {}
try { db.exec('ALTER TABLE consultations ADD COLUMN cost REAL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE consultations ADD COLUMN payment_status TEXT DEFAULT "pending"'); } catch {}
try { db.exec('ALTER TABLE consultations ADD COLUMN lifestyle TEXT DEFAULT "{}"'); } catch {}
try { db.exec('ALTER TABLE consultations ADD COLUMN procedures TEXT DEFAULT ""'); } catch {}
try { db.exec('ALTER TABLE consultations ADD COLUMN radiography_notes TEXT DEFAULT ""'); } catch {}
try { db.exec('ALTER TABLE consultations ADD COLUMN observations TEXT DEFAULT ""'); } catch {}
try { db.exec('ALTER TABLE consultations ADD COLUMN doctor_id INTEGER'); } catch {}
try { db.exec('ALTER TABLE consultations ADD COLUMN visit_reason TEXT DEFAULT ""'); } catch {}
try { db.exec('ALTER TABLE consultations ADD COLUMN appointment_id INTEGER'); } catch {}

// Add patient odontogram
try { db.exec('ALTER TABLE patients ADD COLUMN odontogram_state TEXT DEFAULT "{}"'); } catch {}

// Only insert test data on first initialization (no existing patients)
const existingPatients = db.prepare('SELECT COUNT(*) as count FROM patients').get();
const shouldInsertTestData = existingPatients.count === 0;

if (shouldInsertTestData) {
  const adminHash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (email, password, role, name, clinic_id) VALUES (?, ?, ?, ?, NULL)')
    .run('admin@saluddigital.com', adminHash, 'super_admin', 'Super Admin');

  const c1 = db.prepare('INSERT INTO clinics (name) VALUES (?)').run('Clinica Norte');
  const c2 = db.prepare('INSERT INTO clinics (name) VALUES (?)').run('Clinica Sur');

  const h = bcrypt.hashSync('clinic123', 10);
  db.prepare('INSERT INTO users (email, password, role, name, clinic_id) VALUES (?, ?, ?, ?, ?)')
    .run('admin@clinicanorte.com', h, 'clinic_admin', 'Admin Norte', c1.lastInsertRowid);
  db.prepare('INSERT INTO users (email, password, role, name, clinic_id) VALUES (?, ?, ?, ?, ?)')
    .run('admin@clinicasur.com', h, 'clinic_admin', 'Admin Sur', c2.lastInsertRowid);

  const dh = bcrypt.hashSync('doctor123', 10);
  const d1 = db.prepare('INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('dr.garcia@clinicanorte.com', dh, 'doctor', 'Álvaro Lobo', c1.lastInsertRowid, 'Medicina General', '31515887');
  const d2 = db.prepare('INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('dr.carlos.lopez@clinicasur.com', dh, 'doctor', 'Carlos Lopez', c2.lastInsertRowid, 'Pediatría', '18031789');

  const d3 = db.prepare('INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('dr.diego.lopez@clinicanorte.com', dh, 'doctor', 'Diego Lopez', c1.lastInsertRowid, 'Dermatología', '27479949');

  const d4 = db.prepare('INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('dra.ochoa@clinicanorte.com', dh, 'doctor', 'Ochoa Espinoza', c1.lastInsertRowid, 'Odontología', '8585494');

  const d5 = db.prepare('INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('dra.karla.moreno@clinicasur.com', dh, 'doctor', 'Karla Moreno', c2.lastInsertRowid, 'Dermatología', '14824824');

  const d6 = db.prepare('INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('heysselm@clinicanorte.com', dh, 'doctor', 'Heysssel Molina', c1.lastInsertRowid, 'Odontología', '31248379');

  const d7 = db.prepare('INSERT INTO users (email, password, role, name, clinic_id, specialty, phone) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('dr.juan@clinicanorte.com', dh, 'doctor', 'Juan Martinez', c1.lastInsertRowid, 'Medicina General', '31234567');

  const rh = bcrypt.hashSync('receptionist123', 10);
  db.prepare('INSERT INTO users (email, password, role, name, clinic_id) VALUES (?, ?, ?, ?, ?)')
    .run('recepcion@clinicanorte.com', rh, 'receptionist', 'Recepcionista Norte', c1.lastInsertRowid);
  db.prepare('INSERT INTO users (email, password, role, name, clinic_id) VALUES (?, ?, ?, ?, ?)')
    .run('recepcion@clinicasur.com', rh, 'receptionist', 'Recepcionista Sur', c2.lastInsertRowid);

  // Patients with full fields
  const insertPatient = db.prepare(
    'INSERT INTO patients (name, identity_number, age, birth_date, gender, phone, clinic_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const p1 = insertPatient.run('Maria González',   '0801-1979-12345', 45, '1979-03-15', 'Femenino',   '31515887', c1.lastInsertRowid);
  const p2 = insertPatient.run('Carlos Rodríguez', '0801-1962-87654', 62, '1962-07-22', 'Masculino',  '31877575', c1.lastInsertRowid);
  const p3 = insertPatient.run('Ana Martínez',     '0801-1986-11223', 38, '1986-11-05', 'Femenino',   '08439748', c2.lastInsertRowid);
  const p4 = insertPatient.run('Luis Herrera',     '0801-1990-44556', 34, '1990-06-18', 'Masculino',  '31894252', c1.lastInsertRowid);
  const p5 = insertPatient.run('Sofia Castro',     '0801-2000-77889', 24, '2000-09-30', 'Femenino',   '31234567', c1.lastInsertRowid);
  const p6 = insertPatient.run('Pedro Morales',    '0801-1975-99001', 49, '1975-12-01', 'Masculino',  '32112233', c1.lastInsertRowid);
  const p7 = insertPatient.run('Laura Reyes',      '0801-1995-33221', 29, '1995-04-14', 'Femenino',   '31998877', c1.lastInsertRowid);

  // Critical info
  db.prepare('INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES (?, ?, ?, ?)')
    .run(p1.lastInsertRowid, 'Penicilina, Aspirina', 'Metformina 500mg', 'Diabetes Tipo 2');
  db.prepare('INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES (?, ?, ?, ?)')
    .run(p2.lastInsertRowid, '', 'Atorvastatina 20mg, Lisinopril 10mg', 'Hipertensión, Colesterol alto');
  db.prepare('INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES (?, ?, ?, ?)')
    .run(p3.lastInsertRowid, 'Sulfas', '', '');
  [p4, p5, p6, p7].forEach(p => {
    db.prepare('INSERT INTO critical_info (patient_id, allergies, medications, conditions) VALUES (?, ?, ?, ?)')
      .run(p.lastInsertRowid, '', '', '');
  });

  // Consultation
  db.prepare('INSERT INTO consultations (patient_id, notes, diagnosis, treatment, clinic_id) VALUES (?, ?, ?, ?, ?)')
    .run(p1.lastInsertRowid, 'Paciente acude por control rutinario', 'Diabetes bajo control', 'Continuar con Metformina', c1.lastInsertRowid);

  // Appointments for today
  const today = new Date().toISOString().split('T')[0];
  db.prepare('INSERT INTO appointments (patient_id, doctor_id, clinic_id, specialty, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(p1.lastInsertRowid, d1.lastInsertRowid, c1.lastInsertRowid, 'Medicina General', `${today}T10:00:00`, 'waiting');
  db.prepare('INSERT INTO appointments (patient_id, doctor_id, clinic_id, specialty, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(p2.lastInsertRowid, d1.lastInsertRowid, c1.lastInsertRowid, 'Medicina General', `${today}T11:00:00`, 'pending');
  db.prepare('INSERT INTO appointments (patient_id, doctor_id, clinic_id, specialty, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(p3.lastInsertRowid, d2.lastInsertRowid, c2.lastInsertRowid, 'Odontología', `${today}T09:30:00`, 'waiting');
}

module.exports = db;
