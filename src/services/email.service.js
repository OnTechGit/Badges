const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transporter;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

async function sendBadgeEmail(recipient, assertion, badgeClass, issuer) {
  if (!process.env.SMTP_HOST) return;

  const appUrl = process.env.APP_URL || process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const verifyUrl = `${appUrl}/verify/${assertion.id}`;
  const from = process.env.SMTP_FROM || `"Open Badges" <${process.env.SMTP_USER}>`;

  // LinkedIn Add to Profile URL
  const issued = new Date(assertion.issued_on);
  const liParams = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: badgeClass.name,
    organizationName: issuer.name,
    issueYear: String(issued.getFullYear()),
    issueMonth: String(issued.getMonth() + 1),
    certUrl: verifyUrl,
    certId: assertion.id,
  });
  if (assertion.expires_at) {
    const exp = new Date(assertion.expires_at);
    liParams.set('expirationYear', String(exp.getFullYear()));
    liParams.set('expirationMonth', String(exp.getMonth() + 1));
  }
  const linkedinUrl = `https://www.linkedin.com/profile/add?${liParams.toString()}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f7; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #1a1a2e; color: #ffffff; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .body { padding: 30px; }
    .badge-card { background: #f8f9fa; border-radius: 8px; padding: 24px; margin: 20px 0; border-left: 4px solid #0f3460; }
    .badge-card h2 { margin: 0 0 8px 0; color: #1a1a2e; }
    .badge-card p { margin: 4px 0; color: #555; }
    .label { font-weight: bold; color: #333; }
    .verify-btn { display: inline-block; background: #0f3460; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; margin: 20px 0; font-weight: bold; }
    .footer { background: #f4f4f7; padding: 20px; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>¡Has recibido una credencial digital!</h1>
    </div>
    <div class="body">
      <p>Hola <strong>${recipient.name}</strong>,</p>
      <p>${issuer.name} te ha otorgado la siguiente credencial verificable:</p>

      <div class="badge-card">
        <h2>${badgeClass.name}</h2>
        <p>${badgeClass.description}</p>
        <p><span class="label">Emisor:</span> ${issuer.name}</p>
        <p><span class="label">Fecha de emisión:</span> ${formatDate(assertion.issued_on)}</p>
        ${badgeClass.criteria_narrative ? `<p><span class="label">Criterios cumplidos:</span> ${badgeClass.criteria_narrative}</p>` : ''}
        ${assertion.expires_at ? `<p><span class="label">Válido hasta:</span> ${formatDate(assertion.expires_at)}</p>` : ''}
      </div>

      <p>Esta credencial cumple con el estándar <strong>Open Badges 3.0</strong> y está firmada criptográficamente.</p>

      <div style="text-align: center;">
        <a href="${verifyUrl}" class="verify-btn">Verificar credencial</a>
        <br>
        <a href="${linkedinUrl}" style="display: inline-block; background: #0077B5; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; margin: 10px 0; font-weight: bold;">Agregar a LinkedIn</a>
      </div>

      <p style="font-size: 13px; color: #777;">
        También puedes verificarla en: <a href="${verifyUrl}">${verifyUrl}</a>
      </p>
    </div>
    <div class="footer">
      <p>Emitido por ${issuer.name} · Powered by Open Badges 3.0</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await getTransporter().sendMail({
      from,
      to: recipient.email,
      subject: `Credencial recibida: ${badgeClass.name}`,
      html,
    });
  } catch (err) {
    console.error('Email error:', err.message, err.code);
  }
}

module.exports = { sendBadgeEmail };
