/**
 * Estructura completa de carpetas para entrega de servicio Accelerecom / Odes Growth.
 *
 * Cada nodo: { name: string, children?: node[] }
 * Los nodos hoja (sin children) son carpetas vacías listas para recibir archivos.
 * Las carpetas dinámicas ([Semana X], [Lanzamiento], etc.) NO se crean aquí —
 * se crean bajo demanda con endpoints separados.
 */

const FULL_STRUCTURE = [
  {
    name: "Entrega",
    children: [
      {
        name: "Tráfico",
        children: [
          {
            name: "Anuncios",
            // Las carpetas semanales/lanzamiento se crean dinámicamente
            children: [],
          },
        ],
      },
      {
        name: "Embudo",
        children: [
          {
            name: "Oferta de Contenido",
            children: [
              {
                name: "Material Crudo",
                children: [
                  { name: "Guión" },
                  { name: "Diapositivas" },
                  { name: "Grabación" },
                ],
              },
              {
                name: "Versión Final",
                children: [
                  { name: "Guión" },
                  { name: "Diapositivas" },
                  { name: "Edición Final" },
                ],
              },
            ],
          },
          {
            name: "Nutrición de Prospectos",
            children: [
              {
                name: "Email",
                children: [
                  {
                    name: "Secuencias Automatizadas",
                    children: [{ name: "Copy" }],
                  },
                  {
                    name: "Campañas Puntuales",
                    // Las carpetas semanales se crean dinámicamente
                    children: [],
                  },
                ],
              },
              {
                name: "Texto",
                children: [
                  { name: "Plantillas SMS" },
                  { name: "Plantillas WhatsApp" },
                ],
              },
              {
                name: "Teléfono",
                children: [
                  { name: "Guiones de Llamadas de Setters" },
                  { name: "Guiones de Mensaje de Voz" },
                  { name: "Guiones de Micro Videos de Presentación" },
                ],
              },
            ],
          },
        ],
      },
      {
        name: "Oferta",
        children: [
          {
            name: "Oferta Núcleo",
            children: [
              { name: "Investigación de Mercado" },
              { name: "Diseño de Oferta" },
            ],
          },
          {
            name: "Ventas",
            children: [
              { name: "Guión de Ventas" },
              { name: "Grabaciones de Llamadas" },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Activos",
    children: [
      {
        name: "Marca",
        children: [
          { name: "Paleta de Colores" },
          { name: "Tipografía" },
          { name: "Logotipos" },
          { name: "Brandboard" },
        ],
      },
      {
        name: "Prueba",
        children: [
          {
            name: "Testimonios",
            children: [
              { name: "Capturas de Pantalla" },
              { name: "Video" },
              { name: "Audio" },
            ],
          },
          { name: "Portafolio" },
        ],
      },
    ],
  },
  {
    name: "Comunicación y Seguimiento",
    children: [
      {
        name: "Reportes Semanales",
        // Las carpetas [SEMANA X] se crean dinámicamente
        children: [],
      },
      {
        name: "Grabaciones de Sesiones de Revisión",
        // Las carpetas [YY-MM-DD Sesión de Revisión] se crean dinámicamente
        children: [],
      },
      {
        name: "Cobranza",
        children: [
          {
            name: "Facturas",
            // Las carpetas por ciclo se crean dinámicamente
            children: [],
          },
        ],
      },
    ],
  },
];

/**
 * Subconjunto: Solo tráfico (anuncios)
 */
const TRAFFIC_ONLY = [FULL_STRUCTURE[0]];

/**
 * Subconjunto: Solo embudo
 */
const FUNNEL_ONLY = [
  {
    name: "Entrega",
    children: [FULL_STRUCTURE[0].children[1]], // Embudo
  },
];

/**
 * Estructura para una carpeta semanal de anuncios
 */
const WEEKLY_ADS_STRUCTURE = [
  {
    name: "Guiones",
    children: [{ name: "Imagen" }, { name: "Video" }],
  },
  {
    name: "Material Crudo",
    children: [{ name: "Imagen" }, { name: "Video" }],
  },
  {
    name: "Versión Final",
    children: [{ name: "Imagen" }, { name: "Video" }],
  },
];

/**
 * Estructura para una carpeta semanal de reportes
 */
const WEEKLY_REPORT_STRUCTURE = [
  { name: "Reporte Escrito" },
  { name: "Loom Semanal" },
];

/**
 * Estructura para carpeta semanal de campañas puntuales de email
 */
const WEEKLY_EMAIL_CAMPAIGN_STRUCTURE = [{ name: "Copy" }];

function getStructureByType(type) {
  switch (type) {
    case "traffic_only":
      return TRAFFIC_ONLY;
    case "funnel_only":
      return FUNNEL_ONLY;
    case "full":
    default:
      return FULL_STRUCTURE;
  }
}

module.exports = {
  FULL_STRUCTURE,
  TRAFFIC_ONLY,
  FUNNEL_ONLY,
  WEEKLY_ADS_STRUCTURE,
  WEEKLY_REPORT_STRUCTURE,
  WEEKLY_EMAIL_CAMPAIGN_STRUCTURE,
  getStructureByType,
};
