const {
  getDriveClient,
  createFolder,
  createFolderTree,
  validateWebhookSecret,
  sendResponse,
  sendError,
} = require("../lib/drive-utils");

const { WEEKLY_ADS_STRUCTURE } = require("../lib/folder-structure");

/**
 * POST /api/create-weekly-ads
 *
 * Crea una carpeta semanal o de lanzamiento dentro de
 * Entrega > Tráfico > Anuncios, con las subcarpetas de
 * Guiones, Material Crudo y Versión Final.
 *
 * Body:
 *   anunciosFolderId (string, required) — ID de la carpeta "Anuncios"
 *   weekLabel (string, optional) — Nombre de la carpeta (ej: "Semana 1 — 17-Mar / 23-Mar")
 *   type (string, optional) — "weekly" (default) o "launch"
 *   launchName (string, optional) — Nombre del lanzamiento (si type === "launch")
 *
 * Si no se pasa weekLabel y type es "weekly", se genera automáticamente
 * con la fecha de la semana actual.
 */
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "Method not allowed. Use POST.");
  }

  if (!validateWebhookSecret(req)) {
    return sendError(res, 401, "Invalid webhook secret.");
  }

  const {
    anunciosFolderId,
    weekLabel,
    type = "weekly",
    launchName,
  } = req.body || {};

  if (!anunciosFolderId) {
    return sendError(res, 400, 'Missing "anunciosFolderId" — ID de la carpeta Anuncios.');
  }

  // Generar nombre de la carpeta
  let folderName;
  if (type === "launch") {
    folderName = launchName
      ? `Lanzamiento — ${launchName}`
      : `Lanzamiento — ${formatDate(new Date())}`;
  } else {
    folderName = weekLabel || generateWeekLabel();
  }

  try {
    const drive = getDriveClient();

    // Crear la carpeta semanal / lanzamiento
    const weekFolderId = await createFolder(drive, folderName, anunciosFolderId);

    // Crear subcarpetas (Guiones, Material Crudo, Versión Final)
    const folderMap = {};
    const count = await createFolderTree(
      drive,
      WEEKLY_ADS_STRUCTURE,
      weekFolderId,
      folderMap
    );

    return sendResponse(res, 200, {
      success: true,
      folderId: weekFolderId,
      folderUrl: `https://drive.google.com/drive/folders/${weekFolderId}`,
      folderName,
      foldersCreated: count + 1,
      folderMap,
    });
  } catch (err) {
    console.error("Error creating weekly ads folder:", err);
    return sendError(res, 500, "Failed to create weekly ads folder.", err.message);
  }
};

/**
 * Genera etiqueta de semana actual: "Semana — DD-MMM / DD-MMM"
 */
function generateWeekLabel() {
  const now = new Date();
  const monday = getMonday(now);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const fmt = (d) =>
    `${d.getDate().toString().padStart(2, "0")}-${getMonthAbbr(d.getMonth())}`;

  return `Semana — ${fmt(monday)} / ${fmt(sunday)}`;
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
}

function getMonthAbbr(monthIndex) {
  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  return months[monthIndex];
}

function formatDate(d) {
  return `${d.getDate().toString().padStart(2, "0")}-${getMonthAbbr(d.getMonth())}-${d.getFullYear()}`;
}
