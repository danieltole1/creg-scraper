const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
// Render asigna el puerto a través de una variable de entorno. Esto es crucial.
const port = process.env.PORT || 3000;
const BASE_URL = 'https://gestornormativo.creg.gov.co/gestor/entorno/';

app.use(express.json());

// La única ruta que necesitamos: /scrape
app.post('/scrape', async (req, res) => {
  // Esperamos una clave "url" que contiene la ruta relativa, ej: "resolucion_unica_ee.html"
  const { url: relativeUrl } = req.body;

  // Log para saber que la petición llegó
  console.log(`[INFO] Petición recibida para la ruta: ${relativeUrl}`);

  if (!relativeUrl) {
    console.error('[ERROR] No se recibió una URL en el cuerpo de la petición.');
    return res.status(400).json({ error: 'La URL es requerida en el body' });
  }

  // Construimos la URL completa que vamos a visitar
  const fullUrl = `${BASE_URL}${relativeUrl}`;
  console.log(`[INFO] Intentando scrapear la URL completa: ${fullUrl}`);

  try {
    const { data: html } = await axios.get(fullUrl);
    const $ = cheerio.load(html);

    // Extraemos el título y el contenido
    const titulo = $('title').text().trim();
    const contenido = $('body').text().trim();

    console.log(`[SUCCESS] Scraping de ${fullUrl} completado con éxito.`);

    // Devolvemos la respuesta a n8n
    res.json({
      fuente: "CREG",
      titulo: titulo,
      url: fullUrl,
      contenido: contenido,
      fecha_scrapeo: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[FATAL ERROR] Fallo al scrapear ${fullUrl}: ${error.message}`);
    res.status(500).json({ error: 'Fallo durante el scraping de la página de destino.', details: error.message });
  }
});

// El servidor debe escuchar en '0.0.0.0' para ser accesible en Render
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor de scraping simple activo y escuchando en el puerto ${port}`);
});
