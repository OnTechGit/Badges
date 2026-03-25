# Open Badges Admin Panel — Instrucciones para Claude Code

## Contexto del proyecto

Este es un **sistema de credenciales digitales Open Badges 3.0** (API REST con Express + SQL Server). Ya tiene backend completo con:

- Issuers, Badge Classes, Recipients, Assertions con JSON-LD
- Firma criptográfica Ed25519
- Verificador público
- Revocation (Status List 2021)
- DID:web e Issuer Profile público
- Autenticación JWT
- Rate limiting
- Email de notificación con Gmail/SMTP

Ahora necesitamos construir un **panel de administración frontend (React SPA)** integrado en el mismo Express, más una **página pública de verificación** y un **portfolio público de badges por recipient**.

---

## Arquitectura: Frontend integrado en Express

El frontend se sirve desde el mismo servidor Express. NO es un proyecto separado.

### Estructura de carpetas a crear

```
Badges/
├── client/                    ← NUEVO: proyecto React
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/
│       │   └── client.js          ← Axios/fetch wrapper con JWT
│       ├── context/
│       │   └── AuthContext.jsx     ← Context de autenticación
│       ├── components/
│       │   ├── Layout.jsx          ← Sidebar + Header + Content
│       │   ├── Sidebar.jsx
│       │   ├── ProtectedRoute.jsx
│       │   ├── StatsCard.jsx
│       │   └── DataTable.jsx       ← Tabla reutilizable con paginación
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   ├── issuers/
│       │   │   ├── IssuerList.jsx
│       │   │   └── IssuerForm.jsx
│       │   ├── badges/
│       │   │   ├── BadgeList.jsx
│       │   │   └── BadgeForm.jsx
│       │   ├── recipients/
│       │   │   ├── RecipientList.jsx
│       │   │   └── RecipientForm.jsx
│       │   ├── assertions/
│       │   │   ├── AssertionList.jsx
│       │   │   ├── IssueCredential.jsx  ← Formulario para emitir
│       │   │   └── RevokeModal.jsx
│       │   └── public/
│       │       ├── VerifyBadge.jsx       ← Página pública de verificación
│       │       └── Portfolio.jsx         ← Portfolio público con stackable badges
│       └── styles/
│           └── index.css
├── src/                       ← Backend existente (NO MODIFICAR estructura)
│   ├── app.js                 ← MODIFICAR: agregar servir archivos estáticos
│   └── ...
└── package.json               ← Backend existente
```

### Dependencias del frontend (client/package.json)

```json
{
  "name": "badges-admin",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "lucide-react": "^0.460.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "vite": "^6.0.0"
  }
}
```

### Vite config (client/vite.config.js)

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/verify': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/.well-known': 'http://localhost:3000',
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
```

### Modificación a src/app.js (backend)

Agregar al final, ANTES del error handler:

```js
const path = require('path');

// Servir frontend en producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));

  // Rutas públicas del frontend
  app.get('/verify/*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
  app.get('/portfolio/*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
  
  // Catch-all para SPA (debe ir después de las rutas de API)
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}
```

---

## Secciones del Panel Admin

### 1. Login (/login)
- Formulario email + password
- Llama a `POST /api/auth/login`
- Guarda JWT en localStorage
- Redirige a dashboard

### 2. Dashboard (/)
- Requiere autenticación
- 4 tarjetas de estadísticas:
  - Total Issuers activos
  - Total Badge Classes activas
  - Total Recipients
  - Total Assertions (y cuántas revocadas)
- Tabla de últimas 10 assertions emitidas
- Para obtener estadísticas, necesitarás agregar un endpoint `GET /api/stats` en el backend:

```js
// NUEVO: src/routes/stats.routes.js
const { Router } = require('express');
const { requireAuth } = require('../middlewares/auth.middleware');
const { getPool } = require('../config/db');
const router = Router();

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM issuers WHERE is_active = 1) as total_issuers,
        (SELECT COUNT(*) FROM badge_classes WHERE is_active = 1) as total_badges,
        (SELECT COUNT(*) FROM recipients) as total_recipients,
        (SELECT COUNT(*) FROM assertions) as total_assertions,
        (SELECT COUNT(*) FROM assertions WHERE revoked = 1) as total_revoked
    `);
    res.json(result.recordset[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

Registrar en app.js: `app.use('/api/stats', require('./routes/stats.routes'));`

### 3. Gestión de Issuers (/issuers)
- Tabla con todos los issuers (nombre, URL, email, fecha creación)
- Botón "Nuevo Issuer" → formulario modal o página
- Campos: name (requerido), url (requerido), email, description, image_url
- API: `GET /api/issuers`, `POST /api/issuers`

### 4. Gestión de Badge Classes (/badges)
- Tabla con todos los badges activos
- Botón "Nuevo Badge" → formulario
- Campos: issuer_id (dropdown de issuers), name, description, image_url, criteria_narrative, criteria_url, achievement_type (dropdown: Certificate, Diploma, Badge, Certification, License, etc.), tags (input de tags separados por coma)
- Editar y desactivar (soft delete)
- Mostrar imagen preview si tiene image_url
- API: `GET /api/badge-classes`, `POST /api/badge-classes`, `PUT /api/badge-classes/:id`, `DELETE /api/badge-classes/:id`

### 5. Gestión de Recipients (/recipients)
- Tabla con todos los recipients
- Botón "Nuevo Recipient" → formulario
- Campos: name, email, url (portfolio/LinkedIn)
- Editar
- API: `GET /api/recipients`, `POST /api/recipients`, `PUT /api/recipients/:id`

### 6. Emisión de Credenciales (/assertions/new)
- Formulario con:
  - Dropdown de Badge Class (muestra nombre + issuer)
  - Dropdown de Recipient (muestra nombre + email)
  - expires_at (date picker, opcional)
  - evidence_url (opcional)
  - evidence_narrative (textarea, opcional)
- Al emitir, muestra la credencial JSON resultante con opción de copiar
- API: `POST /api/assertions`

### 7. Lista de Assertions (/assertions)
- Tabla con todas las assertions
- Columnas: Badge Name, Recipient, Fecha emisión, Estado (Activo/Revocado/Expirado)
- Filtros por estado
- Botón "Revocar" en cada fila activa → modal con campo "razón"
- Link a verificación pública
- API: `GET /api/assertions`, `POST /api/assertions/:id/revoke`

### 8. Página Pública de Verificación (/verify/:id)
- **NO requiere autenticación**
- Diseño profesional y confiable (como un certificado de verificación)
- Muestra:
  - Estado grande: ✓ VÁLIDO (verde) o ✗ INVÁLIDO (rojo)
  - Nombre del badge + descripción
  - Nombre del recipient
  - Nombre del issuer
  - Fecha de emisión
  - Fecha de expiración (si tiene)
  - Checks detallados: existe, no revocado, no expirado, firma válida
  - Badge image si tiene
- API: `GET /verify/:id`
- Debe verse bien cuando se comparte en LinkedIn/Twitter (meta tags OG)

### 9. Portfolio Público / Stackable Badges (/portfolio/:email)
- **NO requiere autenticación**
- Muestra todos los badges activos de un recipient
- Diseño tipo perfil/portfolio:
  - Nombre del recipient
  - Grid de badges ganados (cards con imagen, nombre, issuer, fecha)
  - Cada badge card es clickeable → lleva a la verificación
  - Contador total de badges
- Necesitarás un endpoint nuevo:

```js
// NUEVO: src/routes/portfolio.routes.js
const { Router } = require('express');
const { getPool, sql } = require('../config/db');
const router = Router();

router.get('/:email', async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar(255), req.params.email)
      .query(`
        SELECT
          r.name as recipient_name,
          r.email as recipient_email,
          r.url as recipient_url,
          a.id as assertion_id,
          a.issued_on,
          a.expires_at,
          bc.name as badge_name,
          bc.description as badge_description,
          bc.image_url as badge_image_url,
          bc.achievement_type,
          i.name as issuer_name,
          i.url as issuer_url
        FROM recipients r
        JOIN assertions a ON a.recipient_id = r.id
        JOIN badge_classes bc ON bc.id = a.badge_class_id
        JOIN issuers i ON i.id = bc.issuer_id
        WHERE r.email = @email
          AND a.revoked = 0
          AND bc.is_active = 1
        ORDER BY a.issued_on DESC
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No badges found for this email' });
    }

    res.json({
      recipient: {
        name: result.recordset[0].recipient_name,
        email: result.recordset[0].recipient_email,
        url: result.recordset[0].recipient_url,
      },
      badges: result.recordset.map(r => ({
        assertion_id: r.assertion_id,
        badge_name: r.badge_name,
        badge_description: r.badge_description,
        badge_image_url: r.badge_image_url,
        achievement_type: r.achievement_type,
        issuer_name: r.issuer_name,
        issuer_url: r.issuer_url,
        issued_on: r.issued_on,
        expires_at: r.expires_at,
      })),
      total: result.recordset.length,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

Registrar en app.js: `app.use('/api/portfolio', require('./routes/portfolio.routes'));`

---

## Diseño y Estilo

### Paleta de colores
- Primary: `#1a1a2e` (dark navy) — consistente con el email template existente
- Secondary: `#0f3460` (deep blue)
- Accent: `#e94560` (coral red para acciones destructivas)
- Success: `#10b981` (verde para verificación válida)
- Background: `#f8fafc` (gris muy claro)
- Cards: `#ffffff` con shadow sutil

### Tipografía (Tailwind defaults)
- Usar `font-sans` de Tailwind
- Títulos con `font-bold` o `font-semibold`

### Layout del Admin
- **Sidebar izquierda** fija (240px): logo/nombre, navegación, logout
- **Header superior**: breadcrumb, nombre de usuario
- **Content area**: padding generoso, max-width contenido

### Layout Público (Verificación + Portfolio)
- Sin sidebar, diseño centrado
- Header minimalista con el nombre del sistema
- Footer con "Powered by Open Badges 3.0"

---

## API Client (client/src/api/client.js)

```js
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  
  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const api = {
  get: (endpoint) => request(endpoint),
  post: (endpoint, data) => request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint, data) => request(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
};
```

---

## Routing (client/src/App.jsx)

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import IssuerList from './pages/issuers/IssuerList';
import IssuerForm from './pages/issuers/IssuerForm';
import BadgeList from './pages/badges/BadgeList';
import BadgeForm from './pages/badges/BadgeForm';
import RecipientList from './pages/recipients/RecipientList';
import RecipientForm from './pages/recipients/RecipientForm';
import AssertionList from './pages/assertions/AssertionList';
import IssueCredential from './pages/assertions/IssueCredential';
import VerifyBadge from './pages/public/VerifyBadge';
import Portfolio from './pages/public/Portfolio';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/verify/:id" element={<VerifyBadge />} />
          <Route path="/portfolio/:email" element={<Portfolio />} />
          
          {/* Rutas protegidas (admin) */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/issuers" element={<IssuerList />} />
            <Route path="/issuers/new" element={<IssuerForm />} />
            <Route path="/badges" element={<BadgeList />} />
            <Route path="/badges/new" element={<BadgeForm />} />
            <Route path="/badges/:id/edit" element={<BadgeForm />} />
            <Route path="/recipients" element={<RecipientList />} />
            <Route path="/recipients/new" element={<RecipientForm />} />
            <Route path="/recipients/:id/edit" element={<RecipientForm />} />
            <Route path="/assertions" element={<AssertionList />} />
            <Route path="/assertions/new" element={<IssueCredential />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

---

## Orden de ejecución sugerido

Pide a Claude Code que haga cada paso por separado, probando entre pasos:

1. **Scaffolding**: Crear `client/` con Vite + React + Tailwind + React Router. Verificar que `cd client && npm run dev` funciona.

2. **API Client + Auth**: Crear `api/client.js`, `AuthContext.jsx`, `Login.jsx`, `ProtectedRoute.jsx`. Probar login.

3. **Layout**: Crear `Layout.jsx` con sidebar y outlet. Crear `Dashboard.jsx` con datos estáticos primero.

4. **Backend: nuevos endpoints**: Crear `stats.routes.js` y `portfolio.routes.js`. Registrar en `app.js`. Probar con requests.http.

5. **Dashboard dinámico**: Conectar Dashboard con `/api/stats` y mostrar últimas assertions.

6. **CRUD Issuers**: `IssuerList.jsx` + `IssuerForm.jsx`. Probar crear y listar.

7. **CRUD Badge Classes**: `BadgeList.jsx` + `BadgeForm.jsx` con dropdown de issuers. Probar crear, editar, desactivar.

8. **CRUD Recipients**: `RecipientList.jsx` + `RecipientForm.jsx`. Probar crear, editar.

9. **Emisión de Credenciales**: `IssueCredential.jsx` con dropdowns de badges y recipients. Probar emitir.

10. **Lista de Assertions + Revocación**: `AssertionList.jsx` + `RevokeModal.jsx`. Probar revocar.

11. **Verificación Pública**: `VerifyBadge.jsx` — diseño profesional sin auth.

12. **Portfolio / Stackable Badges**: `Portfolio.jsx` — grid público de badges por email.

13. **Integración Express**: Modificar `app.js` para servir `dist/` en producción. Probar `cd client && npm run build` y luego `NODE_ENV=production node src/server.js`.

14. **Pulir**: Meta tags OG para compartir en LinkedIn, responsive design, loading states, error handling.

---

## Notas importantes para Claude Code

- **NO modificar** ningún archivo existente del backend excepto `src/app.js` (para servir estáticos y registrar nuevas rutas).
- **Los nuevos endpoints** (`stats`, `portfolio`) son adiciones, no modificaciones.
- **Tailwind CSS v3** con `@tailwindcss/forms` plugin si lo necesitas.
- **No usar** component libraries pesadas (Material UI, Ant Design). Solo Tailwind + Lucide icons.
- **El backend usa SQL Server** (mssql). Los nuevos queries deben usar parámetros como el código existente.
- **UUIDs**: el sistema usa `UNIQUEIDENTIFIER` de SQL Server, no autoincrement.
- **Iconos**: usar `lucide-react` que ya está en las dependencias.
- **En desarrollo**: el frontend corre en `:5173` con proxy a `:3000` (API). En producción: todo desde `:3000`.
