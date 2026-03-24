# Deploy en Plesk / Windows Server

## Requisitos del servidor

- Windows Server 2019/2022
- Node.js 18+ (instalar desde Plesk > Tools & Settings > Node.js)
- SQL Server 2019/2022 con acceso TCP/IP habilitado en puerto 1433
- Plesk Obsidian con extensión Node.js

---

## 1. Base de datos

Ejecutar los scripts SQL en SQL Server Management Studio (SSMS) en este orden:

```
database/001_create_database.sql
database/002_create_admin_users.sql
```

Crear un usuario SQL Server dedicado para la app:

```sql
USE CEPBadges;
CREATE LOGIN BadgesAppUser WITH PASSWORD = 'TuPasswordSeguro';
CREATE USER BadgesAppUser FOR LOGIN BadgesAppUser;
ALTER ROLE db_datareader ADD MEMBER BadgesAppUser;
ALTER ROLE db_datawriter ADD MEMBER BadgesAppUser;
```

---

## 2. Configurar el sitio en Plesk

1. **Crear dominio/subdominio** en Plesk (ej: `badges.tudominio.com`)
2. Ir a **Node.js** en el panel del dominio
3. Configurar:
   - **Node.js version**: 18.x o superior
   - **Document root**: `/` (raíz del proyecto)
   - **Application startup file**: `src/server.js`
   - **Application mode**: `production`

---

## 3. Subir el código

Opción A — Git:
```bash
cd /var/www/vhosts/tudominio.com/badges
git clone https://github.com/OnTechGit/Badges.git .
```

Opción B — Subir archivos por FTP/SFTP al document root del dominio.

---

## 4. Instalar dependencias

Desde el terminal de Plesk o por SSH:

```bash
npm install --production
```

---

## 5. Configurar variables de entorno

Copiar el template y editar con los valores reales:

```bash
copy .env.production.example .env
```

Editar `.env` con los valores de producción:
- `BASE_URL` y `APP_URL` = URL pública del sitio con HTTPS
- `JWT_SECRET` = generar uno aleatorio:
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- `DB_*` = credenciales de SQL Server
- `SMTP_*` = credenciales del servidor de correo

---

## 6. Generar claves Ed25519

```bash
npm run generate-keys
```

Esto crea `src/config/keys/keypair.json`. Este archivo NO debe subirse al repositorio.

**Importante**: respaldar `keypair.json` en un lugar seguro. Si se pierde, las credenciales emitidas previamente no podrán verificarse.

---

## 7. Crear el primer usuario admin

```bash
npm run create-admin -- admin@tudominio.com "PasswordSeguro123"
```

---

## 8. Configurar SSL

En Plesk, ir al dominio > **SSL/TLS Certificates** y activar Let's Encrypt.

Los endpoints de verificación (`/verify/:id`) y DID (`/.well-known/did.json`) requieren HTTPS para cumplir con los estándares W3C.

---

## 9. Proxy inverso (IIS → Node.js)

Plesk configura automáticamente el proxy de IIS a Node.js. Verificar que:

- El puerto interno (`PORT` en `.env`) no entre en conflicto con otros sitios
- El Application Pool del sitio está corriendo
- En **Web Server Settings** del dominio, el proxy a Node.js está activo

Si necesitas configurar manualmente el `web.config`:

```xml
<configuration>
  <system.webServer>
    <handlers>
      <add name="iisnode" path="src/server.js" verb="*" modules="iisnode" />
    </handlers>
    <rewrite>
      <rules>
        <rule name="NodeJS" stopProcessing="true">
          <match url=".*" />
          <action type="Rewrite" url="src/server.js" />
        </rule>
      </rules>
    </rewrite>
    <iisnode node_env="production" />
  </system.webServer>
</configuration>
```

---

## 10. Verificar el deploy

```bash
# Health check
curl https://badges.tudominio.com/health

# DID Document
curl https://badges.tudominio.com/.well-known/did.json

# Admin panel
# Abrir en navegador: https://badges.tudominio.com/admin
```

---

## Resumen de URLs

| URL | Descripción |
|-----|-------------|
| `/admin` | Panel de administración |
| `/health` | Health check |
| `/.well-known/did.json` | DID Document público |
| `/api/auth/login` | Login (JWT) |
| `/api/issuers` | CRUD Issuers |
| `/api/badge-classes` | CRUD Badge Classes |
| `/api/recipients` | CRUD Recipients |
| `/api/assertions` | Emisión y revocación |
| `/verify/:id` | Verificación pública |
| `/api/status-list` | Lista de revocaciones |

---

## Backup

Archivos críticos que NO están en el repositorio y deben respaldarse:

- `.env` — configuración de producción
- `src/config/keys/keypair.json` — claves de firma Ed25519
- Base de datos `CEPBadges` — backup regular desde SSMS
