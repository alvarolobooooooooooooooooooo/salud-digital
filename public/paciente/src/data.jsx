// data.jsx — mock data for Salud Digital · Paciente. Honduras context, Lempiras.
(function () {
  // ---- People: the account holder + family profiles ----
  const family = [
    { id: 'ana', name: 'Ana Ruiz Mejía', short: 'Ana', rel: 'Titular', age: 34, sex: 'F',
      initials: 'AR', color: '#0080B0', bg: '#D2E9F5', blood: 'O+', dob: '14 mar 1992' },
    { id: 'mateo', name: 'Mateo Ruiz', short: 'Mateo', rel: 'Hijo', age: 6, sex: 'M',
      initials: 'M', color: '#198754', bg: '#E3F4EC', blood: 'O+', dob: '2 ago 2019' },
    { id: 'carmen', name: 'Carmen Mejía', short: 'Doña Carmen', rel: 'Madre', age: 68, sex: 'F',
      initials: 'C', color: '#C7811C', bg: '#FBEFDB', blood: 'A+', dob: '9 nov 1957',
      note: 'Hipertensión' },
  ];

  // ---- Specialties for booking ----
  const specialties = [
    { id: 'general', name: 'Medicina general', icon: 'stethoscope', from: 600 },
    { id: 'pediatria', name: 'Pediatría', icon: 'baby', from: 700 },
    { id: 'derma', name: 'Dermatología', icon: 'sun', from: 850 },
    { id: 'cardio', name: 'Cardiología', icon: 'heart-pulse', from: 1100 },
    { id: 'gineco', name: 'Ginecología', icon: 'heart', from: 900 },
    { id: 'nutricion', name: 'Nutrición', icon: 'leaf', from: 650 },
    { id: 'odonto', name: 'Odontología', icon: 'sparkles', from: 700 },
    { id: 'psico', name: 'Psicología', icon: 'smile', from: 800 },
    { id: 'oftalmo', name: 'Oftalmología', icon: 'eye', from: 750 },
  ];

  // ---- Clinics ----
  const clinics = [
    { id: 'laslomas', name: 'Centro Médico Las Lomas', zone: 'Col. Las Lomas, Tegucigalpa', km: 2.4 },
    { id: 'hmc', name: 'Honduras Medical Center', zone: 'Blvd. Suyapa, Tegucigalpa', km: 5.1 },
    { id: 'valle', name: 'Hospital del Valle', zone: 'San Pedro Sula', km: 0 },
  ];

  // ---- Doctors ----
  const doctors = [
    { id: 'sofia', name: 'Dra. Sofía Mendoza', spec: 'derma', specName: 'Dermatología',
      initials: 'SM', color: '#0080B0', clinic: 'laslomas', rating: 4.9, reviews: 212,
      fee: 850, next: 'Mañana', tags: ['Acné', 'Dermatoscopía', 'Piel sensible'], years: 11 },
    { id: 'andino', name: 'Dr. Carlos Andino', spec: 'pediatria', specName: 'Pediatría',
      initials: 'CA', color: '#198754', clinic: 'laslomas', rating: 4.8, reviews: 340,
      fee: 700, next: 'Hoy', tags: ['Control de niño sano', 'Vacunas', 'Asma infantil'], years: 16 },
    { id: 'calix', name: 'Dr. Roberto Cálix', spec: 'cardio', specName: 'Cardiología',
      initials: 'RC', color: '#C2362C', clinic: 'hmc', rating: 4.9, reviews: 178,
      fee: 1100, next: 'Jue 14', tags: ['Hipertensión', 'Telemedicina', 'Adulto mayor'], years: 22 },
    { id: 'lopez', name: 'Dra. Patricia López', spec: 'general', specName: 'Medicina general',
      initials: 'PL', color: '#103A78', clinic: 'laslomas', rating: 4.7, reviews: 96,
      fee: 600, next: 'Hoy', tags: ['Medicina familiar', 'Chequeo general'], years: 9 },
    { id: 'nunez', name: 'Dra. Gabriela Núñez', spec: 'nutricion', specName: 'Nutrición',
      initials: 'GN', color: '#2BA86A', clinic: 'hmc', rating: 5.0, reviews: 64,
      fee: 650, next: 'Vie 15', tags: ['Plan alimenticio', 'Diabetes', 'Peso saludable'], years: 7 },
  ];

  const doctorById = (id) => doctors.find(d => d.id === id);
  const clinicById = (id) => clinics.find(c => c.id === id);
  const personById = (id) => family.find(p => p.id === id);

  // ---- Appointments ----
  const appointments = [
    { id: 'a1', who: 'ana', doctor: 'sofia', date: '2026-05-09', day: 'Sábado 9 may', time: '14:30',
      mode: 'presencial', clinic: 'laslomas', status: 'confirmada', preconsulta: false, soon: true },
    { id: 'a2', who: 'mateo', doctor: 'andino', date: '2026-05-12', day: 'Martes 12 may', time: '10:00',
      mode: 'presencial', clinic: 'laslomas', status: 'confirmada', preconsulta: true, reason: 'Control de niño sano' },
    { id: 'a3', who: 'carmen', doctor: 'calix', date: '2026-05-14', day: 'Jueves 14 may', time: '09:15',
      mode: 'video', clinic: 'hmc', status: 'confirmada', preconsulta: true, reason: 'Control de presión arterial' },
  ];

  const past = [
    { id: 'p1', who: 'ana', doctor: 'lopez', day: '21 abr 2026', time: '11:00', specName: 'Medicina general', mode: 'presencial' },
    { id: 'p2', who: 'carmen', doctor: 'calix', day: '2 abr 2026', time: '09:00', specName: 'Cardiología', mode: 'presencial' },
    { id: 'p3', who: 'mateo', doctor: 'andino', day: '10 mar 2026', time: '15:30', specName: 'Pediatría', mode: 'presencial' },
  ];

  // ---- Medications / treatment (patient layer, with reminders) ----
  const meds = [
    { id: 'm1', who: 'carmen', name: 'Losartán', dose: '50 mg', form: '1 tableta',
      schedule: 'Cada día · 8:00', times: ['08:00'], taken: false, color: '#0080B0',
      reason: 'Presión arterial', doctor: 'calix', left: 12, of: 30 },
    { id: 'm2', who: 'carmen', name: 'Atorvastatina', dose: '20 mg', form: '1 tableta',
      schedule: 'Cada noche · 21:00', times: ['21:00'], taken: false, color: '#103A78',
      reason: 'Colesterol', doctor: 'calix', left: 18, of: 30 },
    { id: 'm3', who: 'ana', name: 'Loratadina', dose: '10 mg', form: '1 tableta',
      schedule: 'Cada día · 9:00', times: ['09:00'], taken: true, color: '#2BA86A',
      reason: 'Alergia estacional', doctor: 'lopez', left: 5, of: 14 },
  ];

  // ---- Lab results SHARED by the doctor (read-only to patient) ----
  const results = [
    { id: 'r1', who: 'ana', title: 'Hemograma completo', lab: 'Laboratorio Las Lomas',
      date: '22 abr 2026', sharedBy: 'lopez', status: 'normal', unread: true,
      note: 'Todo dentro de rangos normales. No requiere seguimiento. Cualquier duda, escríbame por el chat.',
      items: [
        { k: 'Hemoglobina', v: '13.8', u: 'g/dL', ref: '12–16', flag: 'ok' },
        { k: 'Hematocrito', v: '41', u: '%', ref: '36–46', flag: 'ok' },
        { k: 'Leucocitos', v: '6.9', u: '10³/µL', ref: '4–11', flag: 'ok' },
        { k: 'Plaquetas', v: '255', u: '10³/µL', ref: '150–400', flag: 'ok' },
      ] },
    { id: 'r2', who: 'carmen', title: 'Perfil lipídico', lab: 'Laboratorio HMC',
      date: '2 abr 2026', sharedBy: 'calix', status: 'atencion', unread: false,
      note: 'El colesterol LDL está levemente alto. Mantenga el Losartán y continuamos con Atorvastatina por la noche. Repetimos el perfil en 3 meses.',
      items: [
        { k: 'Colesterol total', v: '224', u: 'mg/dL', ref: '<200', flag: 'high' },
        { k: 'LDL', v: '142', u: 'mg/dL', ref: '<130', flag: 'high' },
        { k: 'HDL', v: '52', u: 'mg/dL', ref: '>40', flag: 'ok' },
        { k: 'Triglicéridos', v: '160', u: 'mg/dL', ref: '<150', flag: 'high' },
      ] },
  ];

  // ---- Prescriptions shared by doctor ----
  const recetas = [
    { id: 'rx1', who: 'carmen', doctor: 'calix', date: '2 abr 2026', folio: 'RX-2026-04812',
      items: [
        { name: 'Losartán 50 mg', instr: '1 tableta cada mañana · 30 días' },
        { name: 'Atorvastatina 20 mg', instr: '1 tableta cada noche · 30 días' },
      ] },
    { id: 'rx2', who: 'ana', doctor: 'lopez', date: '21 abr 2026', folio: 'RX-2026-05140',
      items: [
        { name: 'Loratadina 10 mg', instr: '1 tableta al día por 14 días' },
      ] },
  ];

  // ---- Post-visit summaries (what the doctor chooses to share) ----
  const resumenes = [
    { id: 's1', who: 'ana', doctor: 'lopez', date: '21 abr 2026', specName: 'Medicina general',
      motivo: 'Congestión nasal y estornudos de 2 semanas.',
      hallazgos: 'Signos vitales normales. Cuadro compatible con rinitis alérgica estacional.',
      indicaciones: ['Loratadina 10 mg una vez al día por 14 días', 'Evitar exposición a polvo', 'Volver si aparece fiebre o dificultad para respirar'],
      proxima: 'Control en 2 semanas si no hay mejoría.' },
  ];

  // ---- Patient's OWN health diary (the layer they own) ----
  const diario = [
    { id: 'd1', who: 'carmen', type: 'presion', label: 'Presión arterial', value: '128/82', u: 'mmHg', date: 'Hoy · 8:10', icon: 'heart-pulse', color: '#0080B0' },
    { id: 'd2', who: 'carmen', type: 'peso', label: 'Peso', value: '64.2', u: 'kg', date: 'Ayer · 7:30', icon: 'scale', color: '#103A78' },
    { id: 'd3', who: 'ana', type: 'animo', label: 'Ánimo', value: 'Bien', u: '', date: 'Hoy · 9:00', icon: 'smile', color: '#2BA86A' },
    { id: 'd4', who: 'carmen', type: 'presion', label: 'Presión arterial', value: '134/86', u: 'mmHg', date: '7 may · 8:05', icon: 'heart-pulse', color: '#0080B0' },
  ];

  // ---- Chat threads with doctors / clinic ----
  const chats = [
    { id: 'c-sofia', doctor: 'sofia', who: 'ana', unread: 1, last: 'Perfecto, la espero mañana entonces. Recuerde venir sin maquillaje.', lastTime: '8:32',
      messages: [
        { from: 'doc', text: 'Buenos días, Ana. Vi que agendó su cita de dermatología para mañana.', time: '8:20' },
        { from: 'me', text: 'Sí doctora, buenos días. Tengo una zona en la mejilla que me preocupa.', time: '8:28' },
        { from: 'doc', text: '¿La puede fotografiar con buena luz y enviármela? Así la valoro antes.', time: '8:29' },
        { from: 'me', text: 'Claro, ahorita se la mando.', time: '8:30', attach: 'photo' },
        { from: 'doc', text: 'Perfecto, la espero mañana entonces. Recuerde venir sin maquillaje.', time: '8:32' },
      ] },
    { id: 'c-andino', doctor: 'andino', who: 'mateo', unread: 0, last: 'Mateo puede tomar el jarabe cada 8 horas. Cualquier fiebre arriba de 38.5°, me avisa.', lastTime: 'Ayer',
      messages: [
        { from: 'me', text: 'Doctor, Mateo amaneció con un poco de tos. ¿Le doy el jarabe?', time: 'Ayer 7:40' },
        { from: 'doc', text: 'Mateo puede tomar el jarabe cada 8 horas. Cualquier fiebre arriba de 38.5°, me avisa.', time: 'Ayer 8:05' },
      ] },
    { id: 'c-calix', doctor: 'calix', who: 'carmen', unread: 0, last: 'Los valores de presión que registró se ven bien. Seguimos igual.', lastTime: 'Lun',
      messages: [
        { from: 'doc', text: 'Doña Carmen, gracias por registrar su presión a diario. Los valores se ven bien. Seguimos igual.', time: 'Lun 16:10' },
      ] },
  ];

  // ---- Invoices / billing (view only) ----
  const facturas = [
    { id: 'f1', who: 'ana', concept: 'Consulta · Dermatología', doctor: 'sofia', date: '9 may 2026', amount: 850, status: 'pendiente', clinic: 'laslomas' },
    { id: 'f2', who: 'carmen', concept: 'Perfil lipídico (laboratorio)', date: '2 abr 2026', amount: 1200, status: 'pagada', clinic: 'hmc' },
    { id: 'f3', who: 'ana', concept: 'Consulta · Medicina general', doctor: 'lopez', date: '21 abr 2026', amount: 600, status: 'pagada', clinic: 'laslomas' },
    { id: 'f4', who: 'mateo', concept: 'Consulta · Pediatría', doctor: 'andino', date: '10 mar 2026', amount: 700, status: 'pagada', clinic: 'laslomas' },
  ];

  // money formatter (Lempiras)
  const L = (n) => 'L\u00a0' + n.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // time slots generator for booking
  const slots = ['08:00', '08:30', '09:00', '09:30', '10:30', '11:00', '14:00', '14:30', '15:00', '16:00', '16:30'];
  const bookDays = [
    { id: 'd0', dow: 'Hoy', dom: '8', mon: 'may', open: 3 },
    { id: 'd1', dow: 'Vie', dom: '9', mon: 'may', open: 6 },
    { id: 'd2', dow: 'Sáb', dom: '10', mon: 'may', open: 2 },
    { id: 'd3', dow: 'Lun', dom: '12', mon: 'may', open: 8 },
    { id: 'd4', dow: 'Mar', dom: '13', mon: 'may', open: 5 },
    { id: 'd5', dow: 'Mié', dom: '14', mon: 'may', open: 7 },
  ];

  // pre-consulta symptom chips
  const symptomChips = ['Dolor', 'Fiebre', 'Tos', 'Comezón', 'Manchas en la piel', 'Cansancio', 'Mareo', 'Náusea', 'Dolor de cabeza', 'Falta de aire'];

  window.DB = {
    family, specialties, clinics, doctors, appointments, past, meds, results,
    recetas, resumenes, diario, chats, facturas, slots, bookDays, symptomChips,
    doctorById, clinicById, personById, L,
  };
})();
