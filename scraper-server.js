const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 3000; // Correcto para Render y local
const BASE_URL = 'https://gestornormativo.creg.gov.co/gestor/entorno/';

app.use(express.json()); // El método moderno, reemplaza a body-parser

// Esta es la única ruta que necesitamos
app.post('/scrape', async (req, res) => {
  // Esperamos una clave "url" que contiene la ruta relativa
  const { url: relativeUrl } = req.body;

  console.log(`[INFO] Petición recibida para la ruta: ${relativeUrl}`);

  if (!relativeUrl) {
    console.error('[ERROR] No se recibió una URL en el cuerpo.');
    return res.status(400).json({ error: 'La URL es requerida en el body' });
  }

  // Construimos la URL completa para visitar
  const fullUrl = `${BASE_URL}${relativeUrl}`;
  console.log(`[INFO] Scrapeando la URL completa: ${fullUrl}`);

  try {
    const { data: html } = await axios.get(fullUrl);
    const $ = cheerio.load(html);

    // Extraemos el título y el contenido de la página final
    const titulo = $('title').text().trim();
    const contenido = $('body').text().trim();

    console.log(`[SUCCESS] Scraping de ${fullUrl} completado.`);

    // Devolvemos una respuesta exitosa a n8n
    res.json({
      fuente: "CREG",
      titulo: titulo,
      url: fullUrl,
      contenido: contenido,
      fecha_scrapeo: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[ERROR] Fallo al scrapear ${fullUrl}: ${error.message}`);
    res.status(500).json({ error: 'Fallo durante el scraping de la página', details: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor de scraping simple activo en el puerto ${port}`);
});
