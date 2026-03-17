const {
  getDriveClient,
  createFolder,
  createFolderTree,
  validateWebhookSecret,
  sendResponse,
  sendError,
} = require("../lib/drive-utils");

const { WEEKLY_REPORT_STRUCTURE } = require("../lib/folder-structure");

/**
 * POST /api/create-weekly-report
 *
 * Crea una carpeta de reporte semanal dentro de
 * Comunicación y Seguimiento > Reportes Semanales
 * con subcarpetas: Reporte Escrito, Loom Semanal
 *
 * Body:
 *   reportesFolderId (string, required) — ID de "Reportes Semanales"
 *   weekNumber (number, optional) — Número de semana (ej: 1)
 *   dateRange (string, optional) — Rango de fechas (ej: "17-Mar — 23-Mar")
 */
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "Method not allowed. Use POST.");
  }

  if (!validateWebhookSecret(req)) {
    return sendError(res, 401, "Invalid webhook secret.");
  }

  const { reportesFolderId, weekNumber, dateRange } = req.body || {};

  if (!reportesFolderId) {
    return sendError(res, 400, 'Missing "reportesFolderId".');
  }

  // Generar nombre: "SEMANA X → DD1-MM1 — DD2-MM2"
  const weekNum = weekNumber || "X";
  const range = dateRange || generateCurrentWeekRange();
  const folderName = `SEMANA ${weekNum} → ${range}`;

  try {
    const drive = getDriveClient();

    const weekFolderId = await createFolder(drive, folderName, reportesFolderId);

    const folderMap = {};
    const count = await createFolderTree(
      drive,
      WEEKLY_REPORT_STRUCTURE,
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
    console.error("Error creating weekly report folder:", err);
    return sendError(res, 500, "Failed to create weekly report folder.", err.message);
  }
};

function generateCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];

  const fmt = (d) =>
    `${d.getDate().toString().padStart(2, "0")}-${months[d.getMonth()]}`;

  return `${fmt(monday)} — ${fmt(sunday)}`;
}
