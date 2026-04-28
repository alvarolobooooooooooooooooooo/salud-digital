const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendDoctorInvitation({ to, doctorName, clinicName, token, role }) {
  const acceptUrl = `${process.env.APP_URL}/accept-invitation.html?token=${token}`;
  const roleLabel = role === 'clinic_admin' ? 'administrador' : 'médico';
  const roleDescription = role === 'clinic_admin'
    ? `Has sido invitado a crear y administrar una clínica en la plataforma <b>Salud Digital</b>, donde podrás registrar la información de tu clínica, gestionar el personal, doctores y la operación de tu clínica.`
    : `Has sido invitado a unirte a <b>${clinicName}</b> como médico en la plataforma <b>Salud Digital</b>, donde podrás gestionar tus pacientes y expedientes clínicos de forma segura.`;
  try {
    await sgMail.send({
      to,
      from: process.env.EMAIL_FROM,
      subject: `Invitación para administrar ${clinicName} — Salud Digital`,
      trackingSettings: { clickTracking: { enable: false, enableText: false } },
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px">
          <h2 style="color:#1e3a5f;margin-bottom:8px">Bienvenido a Salud Digital</h2>
          <p style="color:#374151">Hola <b>${doctorName}</b>,</p>
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

module.exports = { sendDoctorInvitation };
