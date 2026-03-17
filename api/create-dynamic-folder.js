const {
  getDriveClient,
  createFolder,
  createFolderTree,
  validateWebhookSecret,
  sendResponse,
  sendError,
} = require("../lib/drive-utils");

const { WEEKLY_EMAIL_CAMPAIGN_STRUCTURE } = require("../lib/folder-structure");

/**
 * POST /api/create-dynamic-folder
 *
 * Endpoint genérico para crear carpetas dinámicas recurrentes:
 *   - Sesiones de revisión (YY-MM-DD Sesión de Revisión)
 *   - Ciclos de facturación (Ciclo — Día Inicial - Día Final)
 *   - Campañas puntuales de email (Semana — fecha)
 *
 * Body:
 *   parentFolderId (string, required) — ID de la carpeta padre
 *   folderType (string, required) — "review_session" | "billing_cycle" | "email_campaign"
 *   label (string, optional) — Override del nombre de carpeta
 *   dateStart (string, optional) — Fecha inicio (para billing_cycle)
 *   dateEnd (string, optional) — Fecha fin (para billing_cycle)
 */
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "Method not allowed. Use POST.");
  }

  if (!validateWebhookSecret(req)) {
    return sendError(res, 401, "Invalid webhook secret.");
  }

  const {
    parentFolderId,
    folderType,
    label,
    dateStart,
    dateEnd,
  } = req.body || {};

  if (!parentFolderId) {
    return sendError(res, 400, 'Missing "parentFolderId".');
  }

  if (!folderType) {
    return sendError(res, 400, 'Missing "folderType". Use: review_session, billing_cycle, email_campaign.');
  }

  let folderName;
  let children = [];

  switch (folderType) {
    case "review_session": {
      // Formato: "YY-MM-DD Sesión de Revisión"
      const now = new Date();
      folderName =
        label ||
        `${formatDateCompact(now)} Sesión de Revisión`;
      break;
    }

    case "billing_cycle": {
      // Formato: "Ciclo — DD-MMM-YYYY - DD-MMM-YYYY"
      if (dateStart && dateEnd) {
        folderName = label || `Ciclo — ${dateStart} - ${dateEnd}`;
      } else {
        // Auto: ciclo de 4 semanas desde hoy
        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + 27); // 4 semanas
        folderName =
          label ||
          `Ciclo — ${formatDateFull(start)} - ${formatDateFull(end)}`;
      }
      break;
    }

    case "email_campaign": {
      folderName = label || `Campaña — ${formatDateFull(new Date())}`;
      children = WEEKLY_EMAIL_CAMPAIGN_STRUCTURE;
      break;
    }

    default:
      return sendError(
        res,
        400,
        `Unknown folderType: "${folderType}". Use: review_session, billing_cycle, email_campaign.`
      );
  }

  try {
    const drive = getDriveClient();

    const folderId = await createFolder(drive, folderName, parentFolderId);

    let foldersCreated = 1;
    const folderMap = {};

    if (children.length > 0) {
      foldersCreated += await createFolderTree(
        drive,
        children,
        folderId,
        folderMap
      );
    }

    return sendResponse(res, 200, {
      success: true,
      folderId,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
      folderName,
      folderType,
      foldersCreated,
      folderMap,
    });
  } catch (err) {
    console.error("Error creating dynamic folder:", err);
    return sendError(res, 500, "Failed to create dynamic folder.", err.message);
  }
};

function formatDateCompact(d) {
  const yy = d.getFullYear().toString().slice(-2);
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatDateFull(d) {
  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  return `${d.getDate().toString().padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}
