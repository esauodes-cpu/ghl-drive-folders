const { google } = require("googleapis");

// ============================================================
// AUTH — OAuth 2.0 con refresh token (ya existente)
// ============================================================

/**
 * Inicializa el cliente autenticado de Google Drive usando OAuth 2.0.
 * Usa un refresh token permanente para obtener access tokens automáticamente.
 */
function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:3000/api/auth/callback"
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}

// ============================================================
// CARPETAS — Crear y compartir (ya existente)
// ============================================================

/**
 * Crea una sola carpeta en Google Drive.
 */
async function createFolder(drive, name, parentId) {
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });
  return res.data.id;
}

/**
 * Crea recursivamente un árbol de carpetas.
 */
async function createFolderTree(
  drive,
  tree,
  parentId,
  folderMap = {},
  currentPath = ""
) {
  let count = 0;

  for (const node of tree) {
    const folderPath = currentPath ? `${currentPath}/${node.name}` : node.name;
    const folderId = await createFolder(drive, node.name, parentId);
    folderMap[folderPath] = folderId;
    count++;

    if (node.children && node.children.length > 0) {
      count += await createFolderTree(
        drive,
        node.children,
        folderId,
        folderMap,
        folderPath
      );
    }
  }

  return count;
}

/**
 * Comparte una carpeta con un email específico.
 */
async function shareFolder(drive, folderId, email, role = "writer") {
  await drive.permissions.create({
    fileId: folderId,
    requestBody: {
      type: "user",
      role,
      emailAddress: email,
    },
    sendNotificationEmail: true,
  });
}

/**
 * Busca una carpeta por nombre dentro de un parent. Si no existe, la crea.
 */
async function getOrCreateFolder(drive, folderName, parentId) {
  const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const searchRes = await drive.files.list({
    q: query,
    fields: "files(id, name)",
  });

  if (searchRes.data.files && searchRes.data.files.length > 0) {
    return searchRes.data.files[0].id;
  }

  return createFolder(drive, folderName, parentId);
}

// ============================================================
// ARCHIVOS — Upload, Copy, List (NUEVO para survey-upload)
// ============================================================

/**
 * Sube un archivo (buffer) a Google Drive.
 * Usa el SDK de googleapis con stream para manejar el upload limpiamente.
 */
async function uploadFile(drive, fileBuffer, fileName, mimeType, parentFolderId) {
  const { Readable } = require("stream");

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentFolderId],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: "id, name, webViewLink",
  });

  return res.data;
}

/**
 * Copia un archivo que ya existe en Drive a otra carpeta.
 * Requiere que el archivo sea accesible (link sharing "anyone with link").
 */
async function copyDriveFile(drive, sourceFileId, destFolderId, newName = null) {
  const requestBody = { parents: [destFolderId] };
  if (newName) requestBody.name = newName;

  const res = await drive.files.copy({
    fileId: sourceFileId,
    requestBody,
    fields: "id, name, webViewLink",
  });

  return res.data;
}

/**
 * Lista archivos dentro de una carpeta de Google Drive.
 */
async function listFolderFiles(drive, folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id, name, mimeType, size)",
  });

  return res.data.files || [];
}

/**
 * Extrae el fileId o folderId de una URL de Google Drive.
 * Soporta: /file/d/{id}, /folders/{id}, /document/d/{id},
 *          /spreadsheets/d/{id}, /presentation/d/{id}, ?id={id}
 */
function extractDriveId(url) {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Determina si una URL de Drive apunta a una carpeta.
 */
function isDriveFolder(url) {
  return /\/folders\//.test(url);
}

// ============================================================
// HELPERS — Validación y respuestas HTTP (ya existente)
// ============================================================

function validateWebhookSecret(req) {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return true;

  const authHeader = req.headers["authorization"] || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const headerSecret = req.headers["x-webhook-secret"];

  return bearerToken === expected || headerSecret === expected;
}

function sendResponse(res, status, data) {
  return res.status(status).json(data);
}

function sendError(res, status, message, details = null) {
  const body = { success: false, error: message };
  if (details) body.details = details;
  return res.status(status).json(body);
}

module.exports = {
  // Auth
  getDriveClient,
  // Carpetas (existente)
  createFolder,
  createFolderTree,
  shareFolder,
  getOrCreateFolder,
  // Archivos (nuevo)
  uploadFile,
  copyDriveFile,
  listFolderFiles,
  extractDriveId,
  isDriveFolder,
  // Helpers
  validateWebhookSecret,
  sendResponse,
  sendError,
};
