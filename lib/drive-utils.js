const { google } = require("googleapis");

/**
 * Inicializa el cliente autenticado de Google Drive usando OAuth 2.0.
 * Usa un refresh token permanente para obtener access tokens automáticamente.
 *
 * Variables de entorno requeridas:
 *   GOOGLE_CLIENT_ID — OAuth Client ID
 *   GOOGLE_CLIENT_SECRET — OAuth Client Secret
 *   GOOGLE_REFRESH_TOKEN — Refresh token obtenido en el setup inicial
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

/**
 * Crea una sola carpeta en Google Drive.
 * @param {object} drive - Cliente de Drive autenticado
 * @param {string} name - Nombre de la carpeta
 * @param {string} parentId - ID de la carpeta padre
 * @returns {string} ID de la carpeta creada
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
 * @param {object} drive - Cliente de Drive autenticado
 * @param {object} tree - Estructura tipo { name: string, children?: tree[] }
 * @param {string} parentId - ID del padre donde crear
 * @param {object} folderMap - Acumulador de IDs { path: id }
 * @param {string} currentPath - Path acumulado para el map
 * @returns {number} Total de carpetas creadas
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
 * @param {object} drive - Cliente de Drive autenticado
 * @param {string} folderId - ID de la carpeta a compartir
 * @param {string} email - Email del destinatario
 * @param {string} role - 'reader', 'writer', o 'commenter'
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
 * Valida el webhook secret contra el header de la request.
 */
function validateWebhookSecret(req) {
  const secret = req.headers["x-webhook-secret"];
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return true; // Si no hay secret configurado, permitir (dev)
  return secret === expected;
}

/**
 * Helper para respuestas HTTP consistentes.
 */
function sendResponse(res, status, data) {
  return res.status(status).json(data);
}

/**
 * Helper para errores HTTP consistentes.
 */
function sendError(res, status, message, details = null) {
  const body = { success: false, error: message };
  if (details) body.details = details;
  return res.status(status).json(body);
}

module.exports = {
  getDriveClient,
  createFolder,
  createFolderTree,
  shareFolder,
  validateWebhookSecret,
  sendResponse,
  sendError,
};
