# GHL → Google Drive Folder Structure Creator

Serverless function (Vercel) que crea automáticamente la estructura de carpetas de entrega para clientes de Accelerecom / Odes Growth cuando se dispara desde un webhook de GoHighLevel.

## Arquitectura

```
GHL Webhook → Vercel Serverless Function → Google Drive API (Service Account)
```

## Setup Paso a Paso

### 1. Crear Service Account en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto nuevo (o usa uno existente)
3. Habilita la **Google Drive API**:
   - Menú → APIs & Services → Library → busca "Google Drive API" → Enable
4. Crea un Service Account:
   - Menú → IAM & Admin → Service Accounts → Create Service Account
   - Nombre: `ghl-drive-creator`
   - Rol: no necesita rol de proyecto (solo usará Drive API)
   - Click "Done"
5. Genera la clave JSON:
   - Click en el service account creado
   - Keys → Add Key → Create new key → JSON
   - Descarga el archivo `.json` — lo necesitarás para las variables de entorno

### 2. Compartir carpeta raíz con el Service Account

Si quieres que las carpetas se creen DENTRO de una carpeta específica de tu Drive personal:
1. Crea una carpeta raíz en tu Google Drive (ej: "Clientes Accelerecom")
2. Click derecho → Compartir → agrega el email del service account (tiene formato: `ghl-drive-creator@tu-proyecto.iam.gserviceaccount.com`)
3. Dale permisos de **Editor**
4. Copia el ID de la carpeta (es el string largo en la URL después de `/folders/`)

### 3. Deploy en Vercel

```bash
# Clona o sube el proyecto
cd ghl-drive-folders

# Instala Vercel CLI si no la tienes
npm i -g vercel

# Deploy
vercel

# Configura variables de entorno en Vercel Dashboard o CLI:
vercel env add GOOGLE_SERVICE_ACCOUNT_EMAIL
vercel env add GOOGLE_PRIVATE_KEY
vercel env add GOOGLE_ROOT_FOLDER_ID
vercel env add WEBHOOK_SECRET
```

### 4. Variables de Entorno

| Variable | Descripción | Dónde obtenerla |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Email del service account | Archivo JSON descargado → campo `client_email` |
| `GOOGLE_PRIVATE_KEY` | Llave privada RSA | Archivo JSON → campo `private_key` (pegar completa, con `\n`) |
| `GOOGLE_ROOT_FOLDER_ID` | ID de la carpeta raíz donde se crean las subcarpetas | URL de Google Drive |
| `WEBHOOK_SECRET` | Token secreto para validar llamadas | Genera uno propio (ej: `openssl rand -hex 32`) |

> **Nota sobre `GOOGLE_PRIVATE_KEY` en Vercel:** Pega el valor completo incluyendo `-----BEGIN PRIVATE KEY-----` y `-----END PRIVATE KEY-----`. Vercel maneja los saltos de línea automáticamente.

### 5. Configurar Webhook en GHL

1. En GHL, ve a **Automation** → crea un nuevo workflow
2. Trigger: el evento que quieras (ej: "Pipeline Stage Changed", "Contact Created", etc.)
3. Agrega acción **Custom Webhook**:
   - URL: `https://tu-proyecto.vercel.app/api/create-folders`
   - Method: POST
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

### 6. Parámetros del Webhook

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `clientName` | string | ✅ | Nombre del cliente (se usa para nombrar la carpeta raíz) |
| `clientEmail` | string | ❌ | Email para compartir la carpeta automáticamente |
| `projectType` | string | ❌ | `"full"` (default), `"traffic_only"`, `"funnel_only"` |
| `parentFolderId` | string | ❌ | Override del root folder (para organización custom) |

### 7. Respuesta

```json
{
  "success": true,
  "rootFolderId": "1abc...",
  "rootFolderUrl": "https://drive.google.com/drive/folders/1abc...",
  "clientName": "Laura Navalón",
  "foldersCreated": 47,
  "sharedWith": "laura@example.com"
}
```

## Estructura de Carpetas Creada

```
📁 [Nombre del Cliente]
├── 📁 Entrega
│   ├── 📁 Tráfico
│   │   └── 📁 Anuncios
│   │       └── 📁 [Se crean carpetas semanales via endpoint separado]
│   ├── 📁 Embudo
│   │   ├── 📁 Oferta de Contenido
│   │   │   ├── 📁 Material Crudo (Guión, Diapositivas, Grabación)
│   │   │   └── 📁 Versión Final (Guión, Diapositivas, Edición Final)
│   │   └── 📁 Nutrición de Prospectos
│   │       ├── 📁 Email (Secuencias Automatizadas, Campañas Puntuales)
│   │       ├── 📁 Texto (Plantillas SMS, Plantillas WhatsApp)
│   │       └── 📁 Teléfono (Guiones de Llamadas, Mensaje de Voz, Micro Videos)
│   └── 📁 Oferta
│       ├── 📁 Oferta Núcleo (Investigación de Mercado, Diseño de Oferta)
│       └── 📁 Ventas (Guión de Ventas, Grabaciones de Llamadas)
├── 📁 Activos
│   ├── 📁 Marca (Paleta de Colores, Tipografía, Logotipos, Brandboard)
│   └── 📁 Prueba
│       ├── 📁 Testimonios (Capturas de Pantalla, Video, Audio)
│       └── 📁 Portafolio
└── 📁 Comunicación y Seguimiento
    ├── 📁 Reportes Semanales
    ├── 📁 Grabaciones de Sesiones de Revisión
    └── 📁 Cobranza
        └── 📁 Facturas
```

## Endpoints Adicionales

### Crear Carpeta Semanal de Anuncios
```
POST /api/create-weekly-ads
```
```json
{
  "clientRootFolderId": "1abc...",
  "weekLabel": "Semana 1 — 17-Mar / 23-Mar",
  "type": "weekly"
}
```

### Crear Carpeta de Reporte Semanal
```
POST /api/create-weekly-report
```
```json
{
  "clientRootFolderId": "1abc...",
  "weekNumber": 1,
  "dateRange": "17-Mar — 23-Mar"
}
```

## Desarrollo Local

```bash
npm install
npx vercel dev
```

Prueba con curl:
```bash
curl -X POST http://localhost:3000/api/create-folders \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: tu_secret" \
  -d '{"clientName": "Test Client", "clientEmail": "test@email.com"}'
```
