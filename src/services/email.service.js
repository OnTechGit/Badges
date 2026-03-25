const https = require('https');

function httpsPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers,
    }, (resp) => {
      let data = '';
      resp.on('data', (c) => data += c);
      resp.on('end', () => resolve({ status: resp.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

let _tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }

  const tokenUrl = `https://login.microsoftonline.com/${process.env.MS365_TENANT_ID}/oauth2/v2.0/token`;
  const tokenBody = new URLSearchParams({
    client_id: process.env.MS365_CLIENT_ID,
    client_secret: process.env.MS365_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  }).toString();

  const resp = await httpsPost(tokenUrl, tokenBody, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });

  const data = JSON.parse(resp.body);
  if (!data.access_token) {
    throw new Error('Token error: ' + (data.error_description || data.error || resp.body));
  }

  _tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return _tokenCache.token;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

async function sendBadgeEmail(recipient, assertion, badgeClass, issuer) {
  if (!process.env.MS365_TENANT_ID) {
    console.warn('Email skipped: MS365_TENANT_ID not configured');
    return;
  }

  const appUrl = process.env.APP_URL || process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const verifyUrl = `${appUrl}/verify/${assertion.id}`;
  const widgetUrl = `${appUrl}/widget/${assertion.id}`;

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

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f7; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #2d1b3d; color: #ffffff; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .body { padding: 30px; }
    .badge-card { background: #f8f5fa; border-radius: 8px; padding: 24px; margin: 20px 0; border-left: 4px solid #79368f; }
    .badge-card h2 { margin: 0 0 8px 0; color: #2d1b3d; }
    .badge-card p { margin: 4px 0; color: #555; }
    .label { font-weight: bold; color: #333; }
    .btn { display: inline-block; text-decoration: none; padding: 12px 30px; border-radius: 6px; margin: 8px 4px; font-weight: bold; font-size: 14px; }
    .btn-verify { background: #79368f; color: #ffffff; }
    .btn-linkedin { background: #0077B5; color: #ffffff; }
    .btn-widget { background: #0094d4; color: #ffffff; }
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
        <a href="${verifyUrl}" class="btn btn-verify">Verificar credencial</a>
        <br>
        <a href="${linkedinUrl}" class="btn btn-linkedin">Agregar a LinkedIn</a>
        <br>
        <a href="${widgetUrl}" class="btn btn-widget">Ver mi badge</a>
      </div>
      <p style="font-size: 13px; color: #777; margin-top: 20px;">
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
    const token = await getAccessToken();
    const userId = process.env.MS365_USER_ID;
    const fromEmail = process.env.MS365_SHARED_MAILBOX || userId;
    const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}/sendMail`;

    const mailBody = JSON.stringify({
      message: {
        subject: `Credencial recibida: ${badgeClass.name}`,
        body: { contentType: 'HTML', content: html },
        from: { emailAddress: { address: fromEmail, name: issuer.name } },
        toRecipients: [{ emailAddress: { address: recipient.email, name: recipient.name } }],
      },
      saveToSentItems: true,
    });

    const resp = await httpsPost(graphUrl, mailBody, {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    });

    if (resp.status !== 202 && resp.status !== 200) {
      console.error('Email Graph error:', resp.status, resp.body);
    }
  } catch (err) {
    console.error('Email error:', err.message, err.code);
  }
}

module.exports = { sendBadgeEmail };
