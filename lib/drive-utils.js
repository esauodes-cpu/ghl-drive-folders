const { google } = require("googleapis");

/**
 * Inicializa el cliente autenticado de Google Drive usando Service Account.
 * Lee credenciales desde variables de entorno de Vercel.
 */
function getDriveClient() {
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(
    /\\n/g,
    "\n"
  );

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
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
