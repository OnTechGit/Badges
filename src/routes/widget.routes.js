const { Router } = require('express');
const assertionModel = require('../models/assertion.model');
const lpModel = require('../models/learning-path.model');
const { port } = require('../config/env');

const router = Router();

function getBaseUrl() {
  return process.env.APP_URL || process.env.BASE_URL || `http://localhost:${port}`;
}

router.get('/:id', async (req, res, next) => {
  try {
    const full = await assertionModel.findFullById(req.params.id);
    if (!full) return res.status(404).send('Badge not found');

    const baseUrl = getBaseUrl();
    const imageUrl = `${baseUrl}/api/assertions/${full.id}/image`;
    const verifyUrl = `${baseUrl}/verify/${full.id}`;
    const linkedinUrl = `${baseUrl}/api/assertions/${full.id}/linkedin`;
    const dateStr = new Date(full.issued_on).toLocaleDateString('es-ES', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    // Learning path info
    let pathHtml = '';
    try {
      const paths = await lpModel.findPathsForBadge(full.badge_class_id);
      if (paths.length > 0) {
        const path = paths[0];
        const progress = await lpModel.getRecipientProgress(full.recipient_id, path.id);
        const stepsHtml = progress.badges.map((b) => {
          const earned = b.earned;
          return `<div class="path-step ${earned ? 'earned' : 'pending'}">
            <div class="step-dot">${earned ? '&#10003;' : ''}</div>
            <div class="step-label">${b.name}</div>
          </div>`;
        }).join('<div class="step-line"></div>');

        pathHtml = `<div class="path-section">
          <div class="path-title">Parte de: ${path.name}</div>
          <div class="path-progress-bar">
            <div class="path-progress-fill" style="width:${progress.percentage}%"></div>
          </div>
          <div class="path-progress-text">${progress.completed}/${progress.total} completados (${progress.percentage}%)</div>
          <div class="path-steps">${stepsHtml}</div>
        </div>`;
      }
    } catch (_) {}

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${full.badge_name} — ${full.recipient_name}</title>
<meta property="og:title" content="${full.badge_name}">
<meta property="og:description" content="Credencial emitida por ${full.issuer_name} a ${full.recipient_name}">
<meta property="og:image" content="${imageUrl}">
<meta property="og:type" content="website">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f2f5;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
.card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.1);max-width:420px;width:100%;overflow:hidden}
.card-img{width:100%;display:block;background:#2d1b3d}
.card-body{padding:24px}
.badge-name{font-size:20px;font-weight:700;color:#2d1b3d;margin-bottom:4px}
.issuer{font-size:14px;color:#636e72;margin-bottom:12px}
.meta{display:flex;gap:16px;margin-bottom:20px;font-size:13px;color:#636e72}
.meta-item{display:flex;align-items:center;gap:4px}
.recipient{font-size:16px;font-weight:600;color:#79368f;margin-bottom:8px}
.actions{display:flex;gap:10px}
.btn{flex:1;padding:10px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;text-align:center;text-decoration:none;display:inline-block;transition:opacity .2s}
.btn:hover{opacity:.85}
.btn-verify{background:#79368f;color:#fff}
.btn-linkedin{background:#0077B5;color:#fff}
.footer{text-align:center;padding:12px;font-size:11px;color:#b2bec3;border-top:1px solid #f0f2f5}
.footer a{color:#79368f;text-decoration:none}
.path-section{padding:16px 24px 0;border-top:1px solid #f0f2f5}
.path-title{font-size:13px;font-weight:700;color:#2d1b3d;margin-bottom:8px}
.path-progress-bar{height:6px;background:#e0e0e0;border-radius:3px;overflow:hidden;margin-bottom:4px}
.path-progress-fill{height:100%;background:linear-gradient(90deg,#79368f,#0094d4);border-radius:3px;transition:width .3s}
.path-progress-text{font-size:11px;color:#636e72;margin-bottom:12px}
.path-steps{display:flex;align-items:flex-start;gap:0;flex-wrap:nowrap;overflow-x:auto;padding-bottom:8px}
.path-step{display:flex;flex-direction:column;align-items:center;min-width:60px;flex-shrink:0}
.step-dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;border:2px solid #ddd;color:#ddd;background:#fff}
.path-step.earned .step-dot{background:#00b894;border-color:#00b894;color:#fff}
.step-label{font-size:9px;color:#636e72;text-align:center;margin-top:4px;max-width:70px;line-height:1.2}
.step-line{width:20px;height:2px;background:#ddd;margin-top:14px;flex-shrink:0}
</style>
</head>
<body>
<div class="card">
  <img class="card-img" src="${imageUrl}" alt="${full.badge_name}">
  <div class="card-body">
    <div class="badge-name">${full.badge_name}</div>
    <div class="issuer">Emitido por ${full.issuer_name}</div>
    <div class="recipient">${full.recipient_name}</div>
    <div class="meta">
      <span class="meta-item">${dateStr}</span>
      ${full.revoked ? '<span class="meta-item" style="color:#d63031">Revocada</span>' : '<span class="meta-item" style="color:#00b894">Verificada</span>'}
    </div>
    <div class="actions">
      <a class="btn btn-verify" href="${verifyUrl}" target="_blank">Verificar</a>
      <a class="btn btn-linkedin" href="#" onclick="addToLinkedIn(event)">Agregar a LinkedIn</a>
    </div>
  </div>
  ${pathHtml}
  <div class="footer">Credencial Open Badges 3.0 &middot; <a href="${verifyUrl}" target="_blank">Verificar autenticidad</a></div>
</div>
<script>
async function addToLinkedIn(e){
  e.preventDefault();
  try{
    const r=await fetch('${linkedinUrl}');
    const d=await r.json();
    if(d.url)window.open(d.url,'_blank');
  }catch(err){alert('Error al generar enlace de LinkedIn')}
}
</script>
</body>
</html>`;

    res.type('html').send(html);
  } catch (err) { next(err); }
});

router.get('/:id/embed', (req, res) => {
  const baseUrl = getBaseUrl();
  const widgetUrl = `${baseUrl}/widget/${req.params.id}`;

  res.type('html').send(`<p>Copia y pega este snippet en tu sitio web:</p>
<pre style="background:#f5f5f5;padding:12px;border-radius:8px;font-size:13px;overflow-x:auto">&lt;script src="${baseUrl}/widget/${req.params.id}/embed.js"&gt;&lt;/script&gt;</pre>
<p style="margin-top:8px"><a href="${widgetUrl}" target="_blank">Ver widget</a></p>`);
});

router.get('/:id/embed.js', (req, res) => {
  const baseUrl = getBaseUrl();
  const widgetUrl = `${baseUrl}/widget/${req.params.id}`;

  const js = `(function(){
  var d=document,s=d.currentScript||d.scripts[d.scripts.length-1],
  f=d.createElement('iframe');
  f.src='${widgetUrl}';
  f.style.cssText='border:none;width:100%;max-width:420px;height:580px;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.08)';
  f.setAttribute('title','Open Badge');
  f.setAttribute('loading','lazy');
  s.parentNode.insertBefore(f,s);
})();`;

  res.type('application/javascript').send(js);
});

module.exports = router;
