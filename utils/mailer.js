const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Escapa caracteres HTML para impedir inyección de etiquetas en correos.
// El nombre del doctor/clínica puede venir de un super_admin malicioso o de una cuenta comprometida.
function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

// Valida que el token no contenga caracteres que rompan la URL.
function safeToken(t) {
  return /^[a-f0-9]{16,128}$/i.test(String(t || '')) ? t : '';
}

async function sendDoctorInvitation({ to, doctorName, clinicName, token, role }) {
  const safeT = safeToken(token);
  const acceptUrl = safeT
    ? `${process.env.APP_URL}/accept-invitation.html?token=${safeT}`
    : `${process.env.APP_URL}/accept-invitation.html`;
  const roleLabel = role === 'clinic_admin' ? 'administrador' : 'médico';
  const safeDoctor = escapeHtml(doctorName);
  const safeClinic = escapeHtml(clinicName);
  const roleDescription = role === 'clinic_admin'
    ? `Has sido invitado a crear y administrar una clínica en la plataforma <b>Salud Digital</b>, donde podrás registrar la información de tu clínica, gestionar el personal, doctores y la operación de tu clínica.`
    : `Has sido invitado a unirte a <b>${safeClinic}</b> como médico en la plataforma <b>Salud Digital</b>, donde podrás gestionar tus pacientes y expedientes clínicos de forma segura.`;
  try {
    await sgMail.send({
      to,
      from: process.env.EMAIL_FROM,
      subject: `Invitación para administrar ${safeClinic} — Salud Digital`,
      trackingSettings: { clickTracking: { enable: false, enableText: false } },
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
          <h2 style="color:#1e3a5f;margin-bottom:8px">Bienvenido a Salud Digital</h2>
          <p style="color:#374151">Hola <b>${safeDoctor}</b>,</p>
          <p style="color:#374151">${roleDescription}</p>
          <p style="color:#374151">Haz clic en el botón para crear tu cuenta como ${roleLabel} y acceder:</p>
          <a href="${acceptUrl}" style="display:inline-block;margin:24px 0;background:#0891b2;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">
            Aceptar invitación
          </a>
          <p style="color:#6b7280;font-size:13px">Este enlace expira en 7 días. Si no esperabas esta invitación puedes ignorar este correo.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="color:#9ca3af;font-size:12px">Salud Digital · Portal Médico Seguro</p>
        </div>
      `,
    });
    console.log(`Invitation email sent to ${to}`);
  } catch (err) {
    const detail = err.response ? JSON.stringify(err.response.body) : err.message;
    console.error('SendGrid error:', detail);
    throw err;
  }
}

// ── Correos del alta sujeta a aprobación ──
//
// Ninguno de estos tres es crítico: si SendGrid está caído, la solicitud ya
// quedó guardada y el administrador la ve igual en su bandeja del panel. Por
// eso `enviar` se traga el fallo y solo deja rastro en los logs — al revés,
// un error del proveedor de correo cancelaría un alta legítima.
const APP = () => String(process.env.APP_URL || '').replace(/\/+$/, '');

async function enviar(mensaje, etiqueta) {
  if (!process.env.SENDGRID_API_KEY || !process.env.EMAIL_FROM) {
    console.warn(`[mailer] ${etiqueta}: SendGrid sin configurar, correo omitido`);
    return false;
  }
  try {
    await sgMail.send(Object.assign({ from: process.env.EMAIL_FROM }, mensaje));
    return true;
  } catch (err) {
    const detalle = err.response ? JSON.stringify(err.response.body) : err.message;
    console.error(`[mailer] ${etiqueta} no enviado:`, detalle);
    return false;
  }
}

function envoltorio(titulo, cuerpo) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
      <h2 style="color:#0e7490;margin-bottom:8px">${titulo}</h2>
      ${cuerpo}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">Salud Digital · Portal Médico Seguro</p>
    </div>`;
}

function boton(url, texto) {
  return `<a href="${url}" style="display:inline-block;margin:24px 0;background:#0891b2;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">${texto}</a>`;
}

// Al administrador de la plataforma: hay una solicitud esperando.
async function sendSignupPendingAlert({ doctorName, clinicName, email, specialty, city }) {
  const destino = process.env.ADMIN_ALERT_EMAIL || process.env.EMAIL_FROM;
  if (!destino) return false;
  const fila = (k, v) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">${k}</td><td style="padding:4px 0;color:#111827"><b>${escapeHtml(v || '—')}</b></td></tr>`;
  return enviar(
    {
      to: destino,
      subject: `Nueva solicitud de cuenta — ${escapeHtml(doctorName)}`,
      trackingSettings: { clickTracking: { enable: false, enableText: false } },
      html: envoltorio(
        'Nueva solicitud de cuenta',
        `<p style="color:#374151">Alguien acaba de registrarse y espera aprobación:</p>
         <table style="font-size:14px;border-collapse:collapse">
           ${fila('Nombre', doctorName)}
           ${fila('Correo', email)}
           ${fila('Consultorio', clinicName)}
           ${fila('Especialidad', specialty)}
           ${fila('Ciudad', city)}
         </table>
         ${boton(APP() + '/admin.html', 'Revisar la solicitud')}
         <p style="color:#6b7280;font-size:13px">Hasta que la apruebes, esa cuenta no puede iniciar sesión.</p>`,
      ),
    },
    'aviso de solicitud',
  );
}

// Al doctor: su cuenta ya está aceptada y puede entrar.
async function sendAccountApproved({ to, doctorName }) {
  return enviar(
    {
      to,
      subject: 'Tu cuenta de Salud Digital ya está activa',
      trackingSettings: { clickTracking: { enable: false, enableText: false } },
      html: envoltorio(
        'Tu cuenta ya está activa',
        `<p style="color:#374151">Hola <b>${escapeHtml(doctorName)}</b>,</p>
         <p style="color:#374151">Revisamos tu solicitud y tu cuenta quedó aprobada. Ya puedes entrar
         con el correo y la contraseña que elegiste al registrarte.</p>
         ${boton(APP() + '/login.html', 'Iniciar sesión')}
         <p style="color:#6b7280;font-size:13px">Para registrar pacientes, agendar citas y guardar
         consultas hay que activar la suscripción desde la propia plataforma.</p>`,
      ),
    },
    'cuenta aprobada',
  );
}

// Al doctor: su solicitud no se aceptó. El motivo es opcional y lo escribe el
// administrador; si no lo puso, no se inventa ninguno.
async function sendAccountRejected({ to, doctorName, reason }) {
  const motivo = String(reason || '').trim();
  return enviar(
    {
      to,
      subject: 'Sobre tu solicitud en Salud Digital',
      trackingSettings: { clickTracking: { enable: false, enableText: false } },
      html: envoltorio(
        'Tu solicitud no fue aprobada',
        `<p style="color:#374151">Hola <b>${escapeHtml(doctorName)}</b>,</p>
         <p style="color:#374151">Revisamos tu solicitud de cuenta y por ahora no podemos aprobarla.</p>
         ${motivo ? `<p style="color:#374151;background:#f9fafb;border-left:3px solid #0891b2;padding:12px 16px;margin:16px 0">${escapeHtml(motivo)}</p>` : ''}
         <p style="color:#6b7280;font-size:13px">Si crees que se trata de un error, responde a este
         correo y lo revisamos.</p>`,
      ),
    },
    'cuenta rechazada',
  );
}

module.exports = {
  sendDoctorInvitation,
  sendSignupPendingAlert,
  sendAccountApproved,
  sendAccountRejected,
};
