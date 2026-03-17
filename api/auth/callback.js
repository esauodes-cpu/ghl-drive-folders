const { google } = require("googleapis");

/**
 * GET /api/auth/callback
 *
 * Callback de Google OAuth 2.0. Recibe el authorization code,
 * lo intercambia por tokens, y muestra el refresh token en pantalla
 * para que lo copies a tus variables de entorno de Vercel.
 *
 * SOLO SE USA UNA VEZ durante el setup inicial.
 */
module.exports = async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`
      <html>
        <body style="font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc2626;">Error de Autorización</h1>
          <p>Google devolvió un error: <strong>${error}</strong></p>
          <p>Intenta de nuevo visitando <a href="/api/auth/authorize">/api/auth/authorize</a></p>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send(`
      <html>
        <body style="font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h1>Falta el código de autorización</h1>
          <p>Visita <a href="/api/auth/authorize">/api/auth/authorize</a> para iniciar el flujo.</p>
        </body>
      </html>
    `);
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      "http://localhost:3000/api/auth/callback"
    );

    const { tokens } = await oauth2Client.getToken(code);

    res.status(200).send(`
      <html>
        <body style="font-family: system-ui; padding: 40px; max-width: 800px; margin: 0 auto;">
          <h1 style="color: #16a34a;">✅ Autorización Exitosa</h1>
          
          <h2>Tu Refresh Token:</h2>
          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 14px; border: 1px solid #cbd5e1;">
            ${tokens.refresh_token || "⚠️ No se generó refresh token. Asegúrate de que el consent screen pidió access_type=offline y prompt=consent."}
          </div>
          
          <h2 style="margin-top: 24px;">Próximos pasos:</h2>
          <ol style="line-height: 2;">
            <li>Copia el refresh token de arriba</li>
            <li>Ve a tu proyecto en <strong>Vercel Dashboard → Settings → Environment Variables</strong></li>
            <li>Agrega la variable <code>GOOGLE_REFRESH_TOKEN</code> con ese valor</li>
            <li>Haz redeploy del proyecto</li>
            <li>¡Listo! Ya puedes usar los endpoints desde GHL</li>
          </ol>

          <details style="margin-top: 24px;">
            <summary style="cursor: pointer; color: #6b7280;">Ver todos los tokens (debug)</summary>
            <pre style="background: #f8fafc; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 12px;">${JSON.stringify(tokens, null, 2)}</pre>
          </details>

          <p style="margin-top: 32px; color: #9ca3af; font-size: 14px;">
            Este endpoint solo se usa durante el setup inicial. 
            El refresh token no expira a menos que lo revoques manualmente.
          </p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Error exchanging code for tokens:", err);
    res.status(500).send(`
      <html>
        <body style="font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #dc2626;">Error al obtener tokens</h1>
          <p>${err.message}</p>
          <p>Intenta de nuevo: <a href="/api/auth/authorize">/api/auth/authorize</a></p>
        </body>
      </html>
    `);
  }
};
