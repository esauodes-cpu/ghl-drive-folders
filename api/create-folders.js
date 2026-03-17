const {
  getDriveClient,
  createFolder,
  createFolderTree,
  shareFolder,
  validateWebhookSecret,
  sendResponse,
  sendError,
} = require("../lib/drive-utils");

const { getStructureByType } = require("../lib/folder-structure");

/**
 * POST /api/create-folders
 *
 * Crea la estructura completa de carpetas de entrega para un nuevo cliente.
 * Diseñado para ser llamado desde un Custom Webhook de GHL.
 *
 * Body:
 *   clientName (string, required) — Nombre del cliente
 *   clientEmail (string, optional) — Email para compartir la carpeta
 *   projectType (string, optional) — "full" | "traffic_only" | "funnel_only"
 *   parentFolderId (string, optional) — Override del root folder ID
 *
 * Headers:
 *   x-webhook-secret — Token de autenticación
 */
module.exports = async function handler(req, res) {
  // --- Solo POST ---
  if (req.method !== "POST") {
    return sendError(res, 405, "Method not allowed. Use POST.");
  }

  // --- Validar webhook secret ---
  if (!validateWebhookSecret(req)) {
    return sendError(res, 401, "Invalid webhook secret.");
  }

  // --- Parsear y validar body ---
  const {
    clientName,
    clientEmail,
    projectType = "full",
    parentFolderId,
  } = req.body || {};

  if (!clientName || typeof clientName !== "string" || !clientName.trim()) {
    return sendError(res, 400, 'Missing or invalid "clientName" in request body.');
  }

  const sanitizedName = clientName.trim();
  const rootParentId = parentFolderId || process.env.GOOGLE_ROOT_FOLDER_ID;

  if (!rootParentId) {
    return sendError(
      res,
      500,
      "No root folder configured. Set GOOGLE_ROOT_FOLDER_ID env var or pass parentFolderId."
    );
  }

  try {
    const drive = getDriveClient();

    // 1. Crear carpeta raíz del cliente
    const clientFolderId = await createFolder(drive, sanitizedName, rootParentId);

    // 2. Crear el árbol de subcarpetas
    const structure = getStructureByType(projectType);
    const folderMap = {};
    const foldersCreated = await createFolderTree(
      drive,
      structure,
      clientFolderId,
      folderMap
    );

    // 3. Compartir con el cliente si se proporcionó email
    let sharedWith = null;
    if (clientEmail && typeof clientEmail === "string" && clientEmail.includes("@")) {
      await shareFolder(drive, clientFolderId, clientEmail.trim(), "writer");
      sharedWith = clientEmail.trim();
    }

    // 4. Compartir con tu propia cuenta (owner del Drive) si es diferente al service account
    const ownerEmail = process.env.OWNER_EMAIL;
    if (ownerEmail && ownerEmail !== process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      await shareFolder(drive, clientFolderId, ownerEmail, "writer");
    }

    // 5. Respuesta exitosa
    return sendResponse(res, 200, {
      success: true,
      rootFolderId: clientFolderId,
      rootFolderUrl: `https://drive.google.com/drive/folders/${clientFolderId}`,
      clientName: sanitizedName,
      projectType,
      foldersCreated: foldersCreated + 1, // +1 por la carpeta raíz del cliente
      sharedWith,
      folderMap, // Mapa de rutas → IDs (útil para crear subcarpetas dinámicas después)
    });
  } catch (err) {
    console.error("Error creating folder structure:", err);
    return sendError(res, 500, "Failed to create folder structure.", err.message);
  }
};
