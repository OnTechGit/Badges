/* ============================================
   Open Badges 3.0 Admin Panel — Client
   ============================================ */

const API = window.location.origin;

// ---- Auth helpers ----
function getToken() { return localStorage.getItem('ob3_token'); }
function setToken(t) { localStorage.setItem('ob3_token', t); }
function clearToken() { localStorage.removeItem('ob3_token'); }

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + getToken(),
  };
}

async function api(method, path, body) {
  const opts = { method, headers: authHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ---- Toast ----
function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  setTimeout(() => el.classList.add('hidden'), 3000);
}

// ---- Toggle form ----
function toggleForm(id) {
  document.getElementById(id).classList.toggle('hidden');
}

// ---- Modal ----
function openModal(title, bodyHtml, footerHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footerHtml || '';
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ---- Format date ----
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function truncate(str, len) {
  if (!str) return '—';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

// ============================================
// LOGIN
// ============================================
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(API + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    setToken(data.token);
    showDashboard();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  clearToken();
  showLogin();
});

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('dashboard').classList.add('hidden');
}

function showDashboard() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  loadIssuers();
}

// ============================================
// NAVIGATION
// ============================================
const sections = { issuers: 'sec-issuers', badges: 'sec-badges', recipients: 'sec-recipients', assertions: 'sec-assertions', users: 'sec-users' };
const loaders = { issuers: loadIssuers, badges: loadBadges, recipients: loadRecipients, assertions: loadAssertions, users: loadUsers };

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const sec = item.dataset.section;

    document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
    item.classList.add('active');

    Object.values(sections).forEach((id) => document.getElementById(id).classList.add('hidden'));
    document.getElementById(sections[sec]).classList.remove('hidden');

    loaders[sec]();
  });
});

// ============================================
// ISSUERS
// ============================================
async function loadIssuers() {
  try {
    const data = await api('GET', '/api/issuers');
    const rows = data.length
      ? data.map((i) => `<tr>
          <td><strong>${i.name}</strong></td>
          <td>${i.url}</td>
          <td>${i.email || '—'}</td>
          <td>${truncate(i.description, 50)}</td>
          <td>${fmtDate(i.created_at)}</td>
          <td><button class="btn btn-danger btn-sm" onclick="deleteIssuer('${i.id}', '${i.name.replace(/'/g, "\\'")}')">Eliminar</button></td>
        </tr>`).join('')
      : '<tr class="empty-row"><td colspan="6">No hay issuers registrados</td></tr>';

    document.getElementById('issuers-table').innerHTML = `<table>
      <thead><tr><th>Nombre</th><th>URL</th><th>Email</th><th>Descripción</th><th>Creado</th><th>Acciones</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  } catch (err) { toast(err.message, 'error'); }
}

async function createIssuer(e) {
  e.preventDefault();
  try {
    await api('POST', '/api/issuers', {
      name: document.getElementById('iss-name').value,
      url: document.getElementById('iss-url').value,
      email: document.getElementById('iss-email').value || undefined,
      description: document.getElementById('iss-desc').value || undefined,
      image_url: document.getElementById('iss-image').value || undefined,
    });
    toast('Issuer creado', 'success');
    toggleForm('issuer-form');
    e.target.reset();
    loadIssuers();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteIssuer(id, name) {
  openModal(
    'Eliminar Issuer',
    `<p>¿Eliminar a <strong>${name}</strong> y todos sus badge classes sin assertions?</p>
     <p style="color:var(--text-light);font-size:13px;margin-top:8px">Si tiene badges con assertions emitidas no se podrá eliminar.</p>`,
    `<button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-danger" onclick="confirmDeleteIssuer('${id}')">Eliminar</button>`
  );
}

async function confirmDeleteIssuer(id) {
  try {
    await api('DELETE', '/api/issuers/' + id);
    toast('Issuer eliminado', 'success');
    closeModal();
    loadIssuers();
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================
// BADGE CLASSES
// ============================================
async function loadBadges() {
  try {
    const [badges, issuers] = await Promise.all([
      api('GET', '/api/badge-classes'),
      api('GET', '/api/issuers'),
    ]);

    // Populate issuer selector
    const sel = document.getElementById('bc-issuer');
    sel.innerHTML = '<option value="">Seleccionar issuer...</option>'
      + issuers.map((i) => `<option value="${i.id}">${i.name}</option>`).join('');

    const issuerMap = {};
    issuers.forEach((i) => issuerMap[i.id] = i.name);

    const rows = badges.length
      ? badges.map((b) => `<tr>
          <td><strong>${b.name}</strong></td>
          <td>${truncate(b.description, 40)}</td>
          <td>${issuerMap[b.issuer_id] || '—'}</td>
          <td>${b.achievement_type ? `<span class="tag tag-type">${b.achievement_type}</span>` : '—'}</td>
          <td>${fmtDate(b.created_at)}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="editBadge('${b.id}')">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="deleteBadge('${b.id}', '${b.name.replace(/'/g, "\\'")}')">Eliminar</button>
          </td>
        </tr>`).join('')
      : '<tr class="empty-row"><td colspan="6">No hay badge classes</td></tr>';

    document.getElementById('badges-table').innerHTML = `<table>
      <thead><tr><th>Nombre</th><th>Descripción</th><th>Issuer</th><th>Tipo</th><th>Creado</th><th>Acciones</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  } catch (err) { toast(err.message, 'error'); }
}

// ---- Design config elements ----
const DESIGN_ELEMENTS = [
  { key: 'badgeName',     label: 'Nombre del Badge', hasRequired: false },
  { key: 'recipientName', label: 'Nombre del Recipient', hasRequired: true },
  { key: 'issueDate',     label: 'Fecha de Emisión', hasRequired: false },
  { key: 'expiryDate',    label: 'Fecha de Expiración', hasRequired: false },
  { key: 'criteria',      label: 'Criterios', hasRequired: false },
];

const DESIGN_DEFAULTS = {
  badgeName:     { x: 50, y: 45, fontSize: 32, color: '#ffffff', align: 'center', visible: true },
  recipientName: { x: 50, y: 55, fontSize: 24, color: '#ffffff', align: 'center', visible: true, required: false },
  issueDate:     { x: 50, y: 65, fontSize: 16, color: '#cccccc', align: 'center', visible: true },
  expiryDate:    { x: 50, y: 70, fontSize: 16, color: '#cccccc', align: 'center', visible: false },
  criteria:      { x: 50, y: 80, fontSize: 14, color: '#aaaaaa', align: 'center', visible: false },
};

function buildDesignControls() {
  const wrap = document.getElementById('design-controls-wrap');
  if (!wrap) return;
  wrap.innerHTML = DESIGN_ELEMENTS.map((el) => {
    const d = DESIGN_DEFAULTS[el.key];
    const reqHtml = el.hasRequired
      ? `<div class="el-field" style="grid-column:1/-1"><label>Req</label>
           <label class="el-toggle"><input type="checkbox" id="dc-${el.key}-req" ${d.required ? 'checked' : ''} onchange="updatePreview()"><span class="slider"></span></label>
           <span style="font-size:11px;color:var(--text-light)">Obligatorio</span></div>`
      : '';
    return `<div class="el-block" id="el-block-${el.key}">
      <div class="el-block-header">
        <span>${el.label}</span>
        <label class="el-toggle"><input type="checkbox" id="dc-${el.key}-vis" ${d.visible ? 'checked' : ''} onchange="updatePreview()"><span class="slider"></span></label>
      </div>
      <div class="el-block-body" id="dc-${el.key}-body">
        <div class="el-field"><label>X%</label><input type="range" id="dc-${el.key}-x" min="0" max="100" value="${d.x}" oninput="updatePreview()"><span class="val" id="dc-${el.key}-x-val">${d.x}</span></div>
        <div class="el-field"><label>Y%</label><input type="range" id="dc-${el.key}-y" min="0" max="100" value="${d.y}" oninput="updatePreview()"><span class="val" id="dc-${el.key}-y-val">${d.y}</span></div>
        <div class="el-field"><label>Px</label><input type="range" id="dc-${el.key}-fs" min="10" max="72" value="${d.fontSize}" oninput="updatePreview()"><span class="val" id="dc-${el.key}-fs-val">${d.fontSize}</span></div>
        <div class="el-field"><label style="min-width:16px"></label><input type="color" id="dc-${el.key}-color" value="${d.color}" oninput="updatePreview()">
          <select id="dc-${el.key}-align" onchange="updatePreview()">
            <option value="left" ${d.align==='left'?'selected':''}>Izq</option>
            <option value="center" ${d.align==='center'?'selected':''}>Centro</option>
            <option value="right" ${d.align==='right'?'selected':''}>Der</option>
          </select>
        </div>
        ${reqHtml}
      </div>
    </div>`;
  }).join('');
}

function getDesignConfig() {
  const elements = {};
  DESIGN_ELEMENTS.forEach((el) => {
    const vis = document.getElementById(`dc-${el.key}-vis`);
    const x = document.getElementById(`dc-${el.key}-x`);
    const y = document.getElementById(`dc-${el.key}-y`);
    const fs = document.getElementById(`dc-${el.key}-fs`);
    const color = document.getElementById(`dc-${el.key}-color`);
    const align = document.getElementById(`dc-${el.key}-align`);
    if (!vis) return;
    elements[el.key] = {
      x: parseInt(x.value), y: parseInt(y.value),
      fontSize: parseInt(fs.value), color: color.value,
      align: align.value, visible: vis.checked,
    };
    if (el.hasRequired) {
      const req = document.getElementById(`dc-${el.key}-req`);
      elements[el.key].required = req ? req.checked : false;
    }
  });
  return {
    backgroundImageUrl: document.getElementById('dc-bg-url').value || null,
    elements,
  };
}

async function uploadBgImage(input) {
  const file = input.files[0];
  if (!file) return;
  const form = new FormData();
  form.append('image', file);
  try {
    const res = await fetch(API + '/api/upload/badge-bg', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + getToken() },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    document.getElementById('dc-bg-url').value = data.url;
    document.getElementById('dc-bg-thumb').src = data.url;
    document.getElementById('dc-bg-preview-wrap').style.display = 'flex';
    _bgImage = new Image();
    _bgImage.onload = updatePreview;
    _bgImage.src = data.url;
    toast('Imagen subida', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

function clearBgImage() {
  document.getElementById('dc-bg-url').value = '';
  document.getElementById('dc-bg-file').value = '';
  document.getElementById('dc-bg-preview-wrap').style.display = 'none';
  _bgImage = null;
  updatePreview();
}

function onTypeChange() {
  const type = document.getElementById('bc-type').value;
  const isCertOrDiploma = type === 'Certificate' || type === 'Diploma';
  const reqCheckbox = document.getElementById('dc-recipientName-req');
  if (reqCheckbox) {
    reqCheckbox.checked = isCertOrDiploma;
  }
  updatePreview();
}

let _editingBadgeId = null;

function resetBadgeForm() {
  _editingBadgeId = null;
  const form = document.querySelector('#badge-form form');
  if (form) form.reset();
  clearBgImage();
  buildDesignControls();
  document.querySelector('#badge-form h3').textContent = 'Crear Badge Class';
  updatePreview();
}

function setDesignControlValues(dc) {
  if (!dc || !dc.elements) return;
  // Background
  if (dc.backgroundImageUrl) {
    document.getElementById('dc-bg-url').value = dc.backgroundImageUrl;
    document.getElementById('dc-bg-thumb').src = dc.backgroundImageUrl;
    document.getElementById('dc-bg-preview-wrap').style.display = 'flex';
    _bgImage = new Image();
    _bgImage.onload = updatePreview;
    _bgImage.src = dc.backgroundImageUrl;
  }
  // Elements
  DESIGN_ELEMENTS.forEach((el) => {
    const vals = dc.elements[el.key];
    if (!vals) return;
    const setVal = (suffix, value) => {
      const input = document.getElementById(`dc-${el.key}-${suffix}`);
      if (input) input.value = value;
    };
    setVal('vis', ''); // checkbox
    const vis = document.getElementById(`dc-${el.key}-vis`);
    if (vis) vis.checked = !!vals.visible;
    setVal('x', vals.x != null ? vals.x : 50);
    setVal('y', vals.y != null ? vals.y : 50);
    setVal('fs', vals.fontSize || 16);
    setVal('color', vals.color || '#ffffff');
    setVal('align', vals.align || 'center');
    if (el.hasRequired) {
      const req = document.getElementById(`dc-${el.key}-req`);
      if (req) req.checked = !!vals.required;
    }
  });
}

async function editBadge(id) {
  try {
    const badge = await api('GET', '/api/badge-classes/' + id);
    _editingBadgeId = id;

    // Show form
    const formCard = document.getElementById('badge-form');
    if (formCard.classList.contains('hidden')) formCard.classList.remove('hidden');

    document.querySelector('#badge-form h3').textContent = 'Editar Badge Class';

    // Fill fields
    document.getElementById('bc-issuer').value = badge.issuer_id;
    document.getElementById('bc-name').value = badge.name;
    document.getElementById('bc-desc').value = badge.description || '';
    document.getElementById('bc-type').value = badge.achievement_type || '';

    document.getElementById('bc-criteria').value = badge.criteria_narrative || '';

    // Reset design controls then load saved config
    buildDesignControls();
    clearBgImage();

    let dc = null;
    try { dc = badge.design_config ? JSON.parse(badge.design_config) : null; } catch (_) {}
    if (dc) setDesignControlValues(dc);

    updatePreview();

    // Scroll to form
    formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) { toast(err.message, 'error'); }
}

async function saveBadge(e) {
  e.preventDefault();
  const data = {
    issuer_id: document.getElementById('bc-issuer').value,
    name: document.getElementById('bc-name').value,
    description: document.getElementById('bc-desc').value,
    achievement_type: document.getElementById('bc-type').value || undefined,
    criteria_narrative: document.getElementById('bc-criteria').value || undefined,
    design_config: getDesignConfig(),
  };

  try {
    if (_editingBadgeId) {
      await api('PUT', '/api/badge-classes/' + _editingBadgeId, data);
      toast('Badge class actualizado', 'success');
    } else {
      await api('POST', '/api/badge-classes', data);
      toast('Badge class creado', 'success');
    }
    toggleForm('badge-form');
    resetBadgeForm();
    loadBadges();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteBadge(id, name) {
  openModal(
    'Eliminar Badge Class',
    `<p>¿Eliminar <strong>${name}</strong>?</p>
     <p style="color:var(--text-light);font-size:13px;margin-top:8px">Solo se puede eliminar si no tiene assertions emitidas.</p>`,
    `<button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-danger" onclick="confirmDeleteBadge('${id}')">Eliminar</button>`
  );
}

async function confirmDeleteBadge(id) {
  try {
    await api('DELETE', '/api/badge-classes/' + id);
    toast('Badge class eliminado', 'success');
    closeModal();
    loadBadges();
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================
// RECIPIENTS
// ============================================
async function loadRecipients() {
  try {
    const data = await api('GET', '/api/recipients');
    const rows = data.length
      ? data.map((r) => `<tr>
          <td><strong>${r.name}</strong></td>
          <td>${r.email}</td>
          <td>${r.url || '—'}</td>
          <td>${fmtDate(r.created_at)}</td>
        </tr>`).join('')
      : '<tr class="empty-row"><td colspan="4">No hay recipients</td></tr>';

    document.getElementById('recipients-table').innerHTML = `<table>
      <thead><tr><th>Nombre</th><th>Email</th><th>URL</th><th>Creado</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  } catch (err) { toast(err.message, 'error'); }
}

async function createRecipient(e) {
  e.preventDefault();
  try {
    await api('POST', '/api/recipients', {
      name: document.getElementById('rec-name').value,
      email: document.getElementById('rec-email').value,
      url: document.getElementById('rec-url').value || undefined,
    });
    toast('Recipient creado', 'success');
    toggleForm('recipient-form');
    e.target.reset();
    loadRecipients();
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================
// ASSERTIONS
// ============================================
async function loadAssertions() {
  try {
    const [assertions, badges, recipients] = await Promise.all([
      api('GET', '/api/assertions'),
      api('GET', '/api/badge-classes'),
      api('GET', '/api/recipients'),
    ]);

    // Populate selectors
    document.getElementById('as-badge').innerHTML = '<option value="">Seleccionar badge...</option>'
      + badges.map((b) => `<option value="${b.id}">${b.name}</option>`).join('');
    document.getElementById('as-recipient').innerHTML = '<option value="">Seleccionar recipient...</option>'
      + recipients.map((r) => `<option value="${r.id}">${r.name} (${r.email})</option>`).join('');

    const badgeMap = {};
    badges.forEach((b) => badgeMap[b.id] = b.name);
    const recMap = {};
    recipients.forEach((r) => recMap[r.id] = r.name);

    const rows = assertions.length
      ? assertions.map((a) => {
        const status = a.revoked
          ? '<span class="tag tag-revoked">Revocada</span>'
          : '<span class="tag tag-active">Activa</span>';
        const revokeBtn = a.revoked
          ? ''
          : `<button class="btn btn-danger btn-sm" onclick="revokeAssertion('${a.id}')">Revocar</button>`;
        const linkedinBtn = a.revoked
          ? ''
          : `<button class="btn btn-sm" style="background:#0077B5;color:#fff" onclick="shareLinkedIn('${a.id}')">LinkedIn</button>`;
        return `<tr>
          <td>${badgeMap[a.badge_class_id] || '—'}</td>
          <td>${recMap[a.recipient_id] || '—'}</td>
          <td>${fmtDate(a.issued_on)}</td>
          <td>${status}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="viewAssertion('${a.id}')">Ver</button>
            ${linkedinBtn}
            ${revokeBtn}
          </td>
        </tr>`;
      }).join('')
      : '<tr class="empty-row"><td colspan="5">No hay assertions</td></tr>';

    document.getElementById('assertions-table').innerHTML = `<table>
      <thead><tr><th>Badge</th><th>Recipient</th><th>Emitido</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  } catch (err) { toast(err.message, 'error'); }
}

async function createAssertion(e) {
  e.preventDefault();
  try {
    const result = await api('POST', '/api/assertions', {
      badge_class_id: document.getElementById('as-badge').value,
      recipient_id: document.getElementById('as-recipient').value,
      evidence_url: document.getElementById('as-evidence-url').value || undefined,
      evidence_narrative: document.getElementById('as-evidence-text').value || undefined,
      expires_at: document.getElementById('as-expires').value || undefined,
    });
    toast('Badge emitido exitosamente', 'success');
    toggleForm('assertion-form');
    e.target.reset();

    openModal('Credencial emitida', `<pre>${JSON.stringify(result, null, 2)}</pre>`, '');
    loadAssertions();
  } catch (err) { toast(err.message, 'error'); }
}

async function viewAssertion(id) {
  try {
    const data = await api('GET', '/verify/' + id);
    const statusBadge = data.valid
      ? '<span class="tag tag-active">Verificada</span>'
      : '<span class="tag tag-revoked">No válida</span>';
    openModal(
      'Detalle de Assertion',
      `<p style="margin-bottom:12px">Estado: ${statusBadge} — ${data.reason}</p>
       <pre>${JSON.stringify(data.credential || data, null, 2)}</pre>`,
      ''
    );
  } catch (err) { toast(err.message, 'error'); }
}

async function revokeAssertion(id) {
  openModal(
    'Revocar Assertion',
    `<div class="form-group">
       <label>Motivo de revocación *</label>
       <textarea id="revoke-reason" rows="3" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius);font-family:inherit"></textarea>
     </div>`,
    `<button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-danger" onclick="confirmRevoke('${id}')">Revocar</button>`
  );
}

async function confirmRevoke(id) {
  const reason = document.getElementById('revoke-reason').value;
  if (!reason) { toast('El motivo es obligatorio', 'error'); return; }
  try {
    await api('POST', '/api/assertions/' + id + '/revoke', { reason });
    toast('Assertion revocada', 'success');
    closeModal();
    loadAssertions();
  } catch (err) { toast(err.message, 'error'); }
}

async function shareLinkedIn(id) {
  try {
    const res = await fetch(API + '/api/assertions/' + id + '/linkedin', {
      headers: authHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to get LinkedIn URL' }));
      toast(err.error, 'error');
      return;
    }
    const data = await res.json();
    if (data.url) {
      window.open(data.url, '_blank');
    } else {
      toast('LinkedIn URL not returned', 'error');
    }
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================
// USERS
// ============================================
async function loadUsers() {
  try {
    const data = await api('GET', '/api/auth/users');
    const rows = data.length
      ? data.map((u) => `<tr>
          <td><strong>${u.email}</strong></td>
          <td>${fmtDate(u.created_at)}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}', '${u.email}')">Eliminar</button>
          </td>
        </tr>`).join('')
      : '<tr class="empty-row"><td colspan="3">No hay usuarios</td></tr>';

    document.getElementById('users-table').innerHTML = `<table>
      <thead><tr><th>Email</th><th>Creado</th><th>Acciones</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  } catch (err) { toast(err.message, 'error'); }
}

async function createUser(e) {
  e.preventDefault();
  try {
    await api('POST', '/api/auth/register', {
      email: document.getElementById('usr-email').value,
      password: document.getElementById('usr-password').value,
    });
    toast('Usuario creado', 'success');
    toggleForm('user-form');
    e.target.reset();
    loadUsers();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteUser(id, email) {
  openModal(
    'Eliminar usuario',
    `<p>¿Estás seguro de eliminar a <strong>${email}</strong>?</p>
     <p style="color:var(--text-light);font-size:13px;margin-top:8px">Esta acción no se puede deshacer.</p>`,
    `<button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
     <button class="btn btn-danger" onclick="confirmDeleteUser('${id}')">Eliminar</button>`
  );
}

async function confirmDeleteUser(id) {
  try {
    await api('DELETE', '/api/auth/users/' + id);
    toast('Usuario eliminado', 'success');
    closeModal();
    loadUsers();
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================
// BADGE PREVIEW (Canvas with scale factor)
// ============================================

// Real output sizes (must match badge-designer.service.js SIZES)
const REAL_SIZES = {
  Badge:         { w: 600,  h: 600 },
  Certification: { w: 600,  h: 600 },
  Certificate:   { w: 1056, h: 816 },
  Diploma:       { w: 1056, h: 816 },
};

// Canvas preview sizes (smaller for UI)
const PREVIEW_SIZES = {
  Badge:         { w: 400, h: 400 },
  Certification: { w: 400, h: 400 },
  Certificate:   { w: 440, h: 340 },
  Diploma:       { w: 440, h: 340 },
  '':            { w: 400, h: 400 },
};

let _bgImage = null;

function wrapCanvasText(ctx, text, maxW) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else { line = test; }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function updatePreview() {
  const canvas = document.getElementById('badge-preview');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const type = document.getElementById('bc-type').value || 'Badge';
  const preview = PREVIEW_SIZES[type] || PREVIEW_SIZES[''];
  const real = REAL_SIZES[type] || REAL_SIZES.Badge;
  canvas.width = preview.w;
  canvas.height = preview.h;
  const w = preview.w, h = preview.h;

  // Scale factor: canvas pixels / real image pixels
  const S = w / real.w;

  // Update slider value displays and visibility
  DESIGN_ELEMENTS.forEach((el) => {
    ['x','y','fs'].forEach((prop) => {
      const input = document.getElementById(`dc-${el.key}-${prop}`);
      const valEl = document.getElementById(`dc-${el.key}-${prop}-val`);
      if (input && valEl) valEl.textContent = input.value;
    });
    const vis = document.getElementById(`dc-${el.key}-vis`);
    const body = document.getElementById(`dc-${el.key}-body`);
    if (vis && body) {
      body.classList.toggle('hidden-body', !vis.checked);
    }
  });

  const cfg = getDesignConfig();

  // Background
  if (_bgImage && _bgImage.complete && _bgImage.naturalWidth) {
    ctx.drawImage(_bgImage, 0, 0, w, h);
  } else {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#2d1b3d');
    grad.addColorStop(1, '#79368f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,148,212,0.06)';
    ctx.beginPath(); ctx.arc(w * 0.8, h * 0.15, w * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,148,212,0.04)';
    ctx.beginPath(); ctx.arc(w * 0.2, h * 0.85, w * 0.1, 0, Math.PI * 2); ctx.fill();
  }

  // Sample text values for preview
  const sampleTexts = {
    badgeName: document.getElementById('bc-name').value || 'Nombre del Badge',
    recipientName: 'Juan Pérez',
    issueDate: new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }),
    expiryDate: '31 de diciembre de 2027',
    criteria: document.getElementById('bc-criteria').value || 'Completar los requisitos del programa',
  };

  // Draw each visible element with scale factor applied to fontSize
  if (cfg.elements) {
    Object.entries(cfg.elements).forEach(([key, el]) => {
      if (!el.visible || !sampleTexts[key]) return;

      // x% and y% are percentages of the canvas (same math as sharp: x/100 * dimension)
      const px = (el.x / 100) * w;
      const py = (el.y / 100) * h;

      // fontSize from config is in real pixels — scale down for preview canvas
      const realFs = el.fontSize || 16;
      const scaledFs = Math.round(realFs * S);

      ctx.fillStyle = el.color;
      ctx.font = (realFs >= 24 ? 'bold ' : '') + scaledFs + 'px Arial';
      ctx.textAlign = el.align || 'center';

      const maxTextW = w - (20 * S * 2);
      const lines = wrapCanvasText(ctx, sampleTexts[key], maxTextW);
      lines.forEach((line, i) => {
        ctx.fillText(line, px, py + i * (scaledFs * 1.3));
      });

      // Subtle position crosshair
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px, py - scaledFs); ctx.lineTo(px, py + 4);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }
}

// ============================================
// INIT
// ============================================
buildDesignControls();

if (getToken()) {
  showDashboard();
} else {
  showLogin();
}

setTimeout(updatePreview, 100);
