const { google } = require("googleapis");

/**
 * GET /api/auth/authorize
 *
 * Genera la URL de autorización de Google OAuth 2.0.
 * Solo se usa UNA VEZ durante el setup inicial para obtener el refresh token.
 *
 * Abre esta URL en tu navegador, autoriza con tu cuenta de Google,
 * y serás redirigido al callback que te mostrará el refresh token.
 *
 * IMPORTANTE: Este endpoint solo se usa en desarrollo local (vercel dev).
 * Después de obtener el refresh token, puedes eliminarlo o dejarlo —
 * no afecta la funcionalidad en producción.
 */
module.exports = async function handler(req, res) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:3000/api/auth/callback"
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline", // Esto es lo que genera el refresh token
    prompt: "consent", // Fuerza mostrar el consent para obtener refresh token
    scope: ["https://www.googleapis.com/auth/drive"],
  });

  // Redirige directamente a Google
  res.redirect(authUrl);
};
