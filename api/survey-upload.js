const {
  getDriveClient,
  getOrCreateFolder,
  uploadFile,
  copyDriveFile,
  listFolderFiles,
  extractDriveId,
  isDriveFolder,
  validateWebhookSecret,
  sendResponse,
  sendError,
} = require("../lib/drive-utils");

// ============================================================
// CONFIGURACIÓN
// ============================================================

const ROOT_FOLDER_ID = process.env.GOOGLE_ROOT_FOLDER_ID;

// ============================================================
// DETECCIÓN DE TIPO DE FUENTE
// ============================================================

function isGoogleDriveLink(url) {
  return /drive\.google\.com|docs\.google\.com/.test(url);
}

function isGHLHostedFile(url) {
  return /msgsndr\.com|storage\.googleapis\.com|leadconnectorhq/.test(url);
}

function isExternalCloudLink(url) {
  return /dropbox\.com|onedrive\.live\.com|sharepoint\.com|wetransfer\.com|icloud\.com/.test(url);
}

function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

function guessFilename(url) {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    const decoded = decodeURIComponent(last);
    if (decoded && decoded.includes(".")) return decoded;
    return `file_${Date.now()}`;
  } catch {
    return `file_${Date.now()}`;
  }
}

function guessMimeType(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const types = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    csv: "text/csv",
    txt: "text/plain",
  };
  return types[ext] || "application/octet-stream";
}

// ============================================================
// PROCESAMIENTO POR TIPO
// ============================================================

/**
 * Archivo subido directamente a GHL → descargar y subir a Drive.
 */
async function handleDirectFile(drive, fileUrl, folderId) {
  const filename = guessFilename(fileUrl);
  const mimeType = guessMimeType(filename);

  const downloadRes = await fetch(fileUrl);
  if (!downloadRes.ok) {
    throw new Error(`Failed to download: ${downloadRes.status}`);
  }

  const buffer = Buffer.from(await downloadRes.arrayBuffer());
  const driveFile = await uploadFile(drive, buffer, filename, mimeType, folderId);

  return { type: "file_upload", filename, driveFileId: driveFile.id, link: driveFile.webViewLink };
}

/**
 * Enlace a un archivo individual de Google Drive → copiar.
 */
async function handleDriveFileLink(drive, url, folderId) {
  const sourceFileId = extractDriveId(url);
  if (!sourceFileId) throw new Error(`Could not extract Drive ID from: ${url}`);

  const copied = await copyDriveFile(drive, sourceFileId, folderId);
  return { type: "drive_copy", name: copied.name, driveFileId: copied.id, link: copied.webViewLink };
}

/**
 * Enlace a una carpeta de Google Drive → copiar cada archivo.
 */
async function handleDriveFolderLink(drive, url, folderId) {
  const sourceFolderId = extractDriveId(url);
  if (!sourceFolderId) throw new Error(`Could not extract folder ID from: ${url}`);

  const files = await listFolderFiles(drive, sourceFolderId);
  const results = [];
  const errors = [];

  for (const file of files) {
    if (file.mimeType === "application/vnd.google-apps.folder") continue;

    try {
      const copied = await copyDriveFile(drive, file.id, folderId);
      results.push({ name: copied.name, driveFileId: copied.id });
    } catch (err) {
      errors.push({ name: file.name, error: err.message });
    }
  }

  return { type: "drive_folder_copy", totalFiles: files.length, copied: results.length, results, errors };
}

/**
 * Enlace externo (Dropbox, OneDrive, etc.) → intentar descargar y subir.
 * Si falla, guarda un archivo .url como referencia.
 */
async function handleExternalLink(drive, url, folderId) {
  try {
    const downloadRes = await fetch(url, { redirect: "follow" });

    if (!downloadRes.ok) throw new Error(`Download failed: ${downloadRes.status}`);

    const contentType = downloadRes.headers.get("content-type") || "application/octet-stream";
    if (contentType.includes("text/html")) {
      throw new Error("External link returned HTML — likely a preview page.");
    }

    const buffer = Buffer.from(await downloadRes.arrayBuffer());
    const filename = guessFilename(url);
    const driveFile = await uploadFile(drive, buffer, filename, contentType, folderId);

    return { type: "external_download", filename, driveFileId: driveFile.id };
  } catch (err) {
    // Fallback: guardar enlace como referencia
    const refContent = `[InternetShortcut]\nURL=${url}\n`;
    const refFilename = `external_link_${Date.now()}.url`;
    const driveFile = await uploadFile(
      drive, Buffer.from(refContent, "utf-8"), refFilename, "text/plain", folderId
    );

    return { type: "external_link_ref", note: "Could not download, saved link as reference", driveFileId: driveFile.id, originalError: err.message };
  }
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

/**
 * POST /api/survey-upload
 *
 * Recibe un webhook de GHL cuando un survey con file upload se completa.
 * Detecta si el valor es un archivo o un enlace y lo sube a Google Drive.
 *
 * Body (formato directo desde workflow HTTP action):
 *   contactId (string, required)
 *   contactName (string, optional) — para nombrar la carpeta
 *   files (array, required) — [{ fieldName, value: "https://..." }]
 *
 * También acepta el formato nativo de GHL survey webhooks.
 */
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "Method not allowed. Use POST.");
  }

  if (!validateWebhookSecret(req)) {
    return sendError(res, 401, "Invalid webhook secret.");
  }

  if (!ROOT_FOLDER_ID) {
    return sendError(res, 500, "Server misconfigured: GOOGLE_ROOT_FOLDER_ID not set.");
  }

  try {
    const payload = parsePayload(req.body);

    if (!payload.contactId) {
      return sendError(res, 400, 'Missing "contactId" in payload.');
    }
    if (!payload.files || payload.files.length === 0) {
      return sendError(res, 400, "No files or links found in payload.");
    }

    const drive = getDriveClient();

    // Crear/obtener carpeta del contacto
    const folderName = payload.contactName
      ? `${payload.contactName}_${payload.contactId}`
      : payload.contactId;

    const contactFolderId = await getOrCreateFolder(drive, folderName, ROOT_FOLDER_ID);

    // Procesar cada archivo/enlace
    const results = [];
    const errors = [];

    for (const file of payload.files) {
      const url = file.value;

      if (!url || !isValidUrl(url)) {
        errors.push({ field: file.fieldName, error: "Invalid or empty URL", value: url });
        continue;
      }

      try {
        let result;

        if (isGHLHostedFile(url)) {
          result = await handleDirectFile(drive, url, contactFolderId);

        } else if (isGoogleDriveLink(url)) {
          result = isDriveFolder(url)
            ? await handleDriveFolderLink(drive, url, contactFolderId)
            : await handleDriveFileLink(drive, url, contactFolderId);

        } else if (isExternalCloudLink(url)) {
          result = await handleExternalLink(drive, url, contactFolderId);

        } else {
          result = await handleDirectFile(drive, url, contactFolderId);
        }

        results.push({ field: file.fieldName, ...result });
      } catch (err) {
        console.error(`Error processing ${file.fieldName}:`, err.message);
        errors.push({ field: file.fieldName, error: err.message, url });
      }
    }

    return sendResponse(res, 200, {
      success: errors.length === 0,
      contactId: payload.contactId,
      folderId: contactFolderId,
      folderUrl: `https://drive.google.com/drive/folders/${contactFolderId}`,
      processed: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("Survey upload handler error:", err);
    return sendError(res, 500, "Failed to process survey upload.", err.message);
  }
};

// ============================================================
// PAYLOAD PARSER
// ============================================================

/**
 * Normaliza el payload del webhook de GHL a formato interno.
 *
 * Soporta 3 formatos:
 *   1. Directo: { contactId, files: [{ fieldName, value }] }
 *   2. GHL nativo: { contact_id, others: { campo: "url" } }
 *   3. Custom wrapper: { customData: { ... } }
 */
function parsePayload(body) {
  if (!body) return { contactId: null, files: [] };

  // Formato 1: Directo (desde workflow HTTP action)
  if (body.contactId && body.files) {
    return {
      contactId: body.contactId,
      contactName: body.contactName || null,
      files: body.files,
    };
  }

  // Formato 2: GHL survey/form webhook nativo
  if (body.contact_id || body.contact?.id) {
    const contactId = body.contact_id || body.contact?.id;
    const contactName = body.full_name || body.contact?.name || body.contact?.full_name || null;

    const surveyData = body.others || body;
    const files = [];

    for (const [key, value] of Object.entries(surveyData)) {
      if (["contact_id", "location_id", "full_name", "email", "phone", "contact", "others"].includes(key)) {
        continue;
      }

      if (typeof value === "string" && isValidUrl(value)) {
        files.push({ fieldName: key, value });
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string" && isValidUrl(item)) {
            files.push({ fieldName: key, value: item });
          }
        }
      }
    }

    return { contactId, contactName, files };
  }

  // Formato 3: Custom data wrapper
  if (body.customData) {
    return parsePayload(body.customData);
  }

  return { contactId: null, files: [] };
}
