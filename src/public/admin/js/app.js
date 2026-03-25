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
          <td><button class="btn btn-danger btn-sm" onclick="deleteBadge('${b.id}', '${b.name.replace(/'/g, "\\'")}')">Eliminar</button></td>
        </tr>`).join('')
      : '<tr class="empty-row"><td colspan="6">No hay badge classes</td></tr>';

    document.getElementById('badges-table').innerHTML = `<table>
      <thead><tr><th>Nombre</th><th>Descripción</th><th>Issuer</th><th>Tipo</th><th>Creado</th><th>Acciones</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  } catch (err) { toast(err.message, 'error'); }
}

async function createBadge(e) {
  e.preventDefault();
  try {
    await api('POST', '/api/badge-classes', {
      issuer_id: document.getElementById('bc-issuer').value,
      name: document.getElementById('bc-name').value,
      description: document.getElementById('bc-desc').value,
      achievement_type: document.getElementById('bc-type').value || undefined,
      image_url: document.getElementById('bc-image').value || undefined,
      criteria_narrative: document.getElementById('bc-criteria').value || undefined,
    });
    toast('Badge class creado', 'success');
    toggleForm('badge-form');
    e.target.reset();
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
    const data = await api('GET', '/api/assertions/' + id + '/linkedin');
    window.open(data.url, '_blank');
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
// INIT
// ============================================
if (getToken()) {
  showDashboard();
} else {
  showLogin();
}
