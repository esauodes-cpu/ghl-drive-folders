# GHL → Google Drive Folder Structure Creator

Serverless function (Vercel) que crea automáticamente la estructura de carpetas de entrega para clientes de Accelerecom / Odes Growth cuando se dispara desde un webhook de GoHighLevel.

## Arquitectura

```
GHL Webhook → Vercel Serverless Function → Google Drive API (OAuth 2.0)
```

Usa OAuth 2.0 con refresh token — autorizas una sola vez con tu cuenta de Google y el refresh token se encarga de renovar el acceso automáticamente en cada ejecución.

---

## Setup Paso a Paso

### Paso 1: Crear OAuth Credentials en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/) → selecciona tu proyecto **GHL-Drive-Creator**
2. Habilita la **Google Drive API** (si no lo has hecho):
   - Menú → **APIs & Services → Library** → busca "Google Drive API" → **Enable**
3. Configura la pantalla de consentimiento:
   - Menú → **APIs & Services → OAuth consent screen**
   - User Type: **Internal** (si usas Workspace) o **External**
   - Llena nombre de app: "GHL Drive Creator", tu email, etc.
   - En **Scopes**, agrega: `https://www.googleapis.com/auth/drive`
   - Si elegiste External, agrégarte como **Test User**
   - Guarda
4. Crea las credenciales OAuth:
   - Menú → **APIs & Services → Credentials**
   - Click **"+ Create Credentials" → "OAuth client ID"**
   - Application type: **Web application**
   - Nombre: "GHL Drive Creator"
   - Authorized redirect URIs: agrega **`http://localhost:3000/api/auth/callback`**
   - Click **Create**
   - Copia el **Client ID** y **Client Secret** — los necesitas para el siguiente paso

### Paso 2: Configurar Variables de Entorno Locales

Crea un archivo `.env.local` en la raíz del proyecto (NO lo subas a git):

```env
GOOGLE_CLIENT_ID=tu-client-id-aqui.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-tu-secret-aqui
GOOGLE_ROOT_FOLDER_ID=id-de-tu-carpeta-raiz
WEBHOOK_SECRET=tu-token-secreto
```

### Paso 3: Obtener el Refresh Token

Este paso se hace UNA SOLA VEZ:

```bash
# Instala dependencias
npm install

# Levanta el servidor local
npx vercel dev
```

Abre en tu navegador:
```
http://localhost:3000/api/auth/authorize
```

Esto te redirige a Google → autorizas con tu cuenta → te muestra una página con tu **refresh token**. Cópialo.

### Paso 4: Configurar Variables en Vercel

Ve a tu proyecto en Vercel Dashboard → **Settings → Environment Variables** y agrega:

| Variable | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | El Client ID del Paso 1 |
| `GOOGLE_CLIENT_SECRET` | El Client Secret del Paso 1 |
| `GOOGLE_REFRESH_TOKEN` | El refresh token del Paso 3 |
| `GOOGLE_ROOT_FOLDER_ID` | ID de tu carpeta raíz en Drive (ver abajo) |
| `WEBHOOK_SECRET` | Un token secreto que tú elijas |

### Paso 5: Obtener el Root Folder ID

1. Abre Google Drive en el navegador
2. Crea (o navega a) la carpeta donde quieres que se creen las carpetas de clientes
3. La URL se verá así:
   ```
   https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ
   ```
4. El ID es todo después de `/folders/`: `1aBcDeFgHiJkLmNoPqRsTuVwXyZ`

> Con OAuth 2.0, las carpetas se crean directamente en TU Google Drive (a diferencia de Service Account donde se crean en la cuenta del service account). No necesitas compartir la carpeta raíz con nadie.

### Paso 6: Deploy

```bash
vercel --prod
```

### Paso 7: Configurar Webhook en GHL

1. En GHL → **Automation** → nuevo workflow
2. Trigger: el evento que quieras (ej: Pipeline Stage Changed)
3. Agrega acción **Custom Webhook**:
   - URL: `https://ghl-drive-folders.vercel.app/api/create-folders`
   - Method: **POST**
   - Headers:
     ```
     Content-Type: application/json
     x-webhook-secret: TU_WEBHOOK_SECRET
     ```
   - Body:
     ```json
     {
       "clientName": "{{contact.name}}",
       "clientEmail": "{{contact.email}}",
       "projectType": "full"
     }
     ```

---

## Endpoints

### `POST /api/create-folders` — Crear estructura completa

El endpoint principal. Crea toda la estructura de carpetas para un nuevo cliente.

**Body:**
| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `clientName` | string | ✅ | Nombre del cliente |
| `clientEmail` | string | ❌ | Email para compartir la carpeta |
| `projectType` | string | ❌ | `"full"` (default), `"traffic_only"`, `"funnel_only"` |
| `parentFolderId` | string | ❌ | Override del root folder |

**Respuesta:**
```json
{
  "success": true,
  "rootFolderId": "1abc...",
  "rootFolderUrl": "https://drive.google.com/drive/folders/1abc...",
  "clientName": "Laura Navalón",
  "foldersCreated": 47,
  "sharedWith": "laura@example.com",
  "folderMap": { "Entrega/Tráfico/Anuncios": "1xyz..." }
}
```

> **Importante:** Guarda el `folderMap` de la respuesta — contiene los IDs de cada carpeta, que necesitarás para crear subcarpetas dinámicas después.

### `POST /api/create-weekly-ads` — Carpeta semanal de anuncios

**Body:**
| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `anunciosFolderId` | string | ✅ | ID de la carpeta "Anuncios" (del folderMap) |
| `weekLabel` | string | ❌ | Nombre custom (default: auto-genera con fecha) |
| `type` | string | ❌ | `"weekly"` (default) o `"launch"` |
| `launchName` | string | ❌ | Nombre del lanzamiento |

### `POST /api/create-weekly-report` — Carpeta de reporte semanal

**Body:**
| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `reportesFolderId` | string | ✅ | ID de "Reportes Semanales" |
| `weekNumber` | number | ❌ | Número de semana |
| `dateRange` | string | ❌ | Rango de fechas |

### `POST /api/create-dynamic-folder` — Carpetas dinámicas

**Body:**
| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `parentFolderId` | string | ✅ | ID de la carpeta padre |
| `folderType` | string | ✅ | `"review_session"`, `"billing_cycle"`, `"email_campaign"` |
| `label` | string | ❌ | Override del nombre |
| `dateStart` | string | ❌ | Fecha inicio (billing_cycle) |
| `dateEnd` | string | ❌ | Fecha fin (billing_cycle) |

### `GET /api/auth/authorize` — Setup OAuth (solo local)

Redirige a Google para autorizar. Solo se usa una vez durante el setup.

### `GET /api/auth/callback` — Callback OAuth (solo local)

Muestra el refresh token después de autorizar.

---

## Desarrollo Local

```bash
npm install
npx vercel dev

# Probar:
curl -X POST http://localhost:3000/api/create-folders \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: tu_secret" \
  -d '{"clientName": "Test Client"}'
```
