// servidor express para scraping multi-nivel y extracción de texto
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const app = express();

app.use(bodyParser.json());

// Selector para los enlaces a los documentos de sección (LIBRO, CAPÍTULO, etc.) en la página índice
// Basado en tus capturas, parecen ser enlaces dentro de divs con clases 'opcion-nivel-02' o similares
// Podría ser necesario ajustar este selector si no encuentra los enlaces correctos en la página indice
const SELECTOR_ENLACES_DOCUMENTO_INDICE = 'div.panel-lista-opciones-nivel-02 a[href]'; // Ajustado basado en tus capturas del indice

// Selector para el contenedor del texto principal del documento en las páginas de documento (ej: ee_1_1.htm)
const SELECTOR_CONTENEDOR_TEXTO = 'div.panel-documento'; // ¡Este es el selector que encontramos!

app.post('/scrape', async (req, res) => {
  const { url: mainIndexUrl, fuente } = req.body; // Esperamos la URL de la página índice principal

  try {
    const documentos = [];
    const visitedUrls = new Set();
    const documentUrls = []; // Para guardar las URLs de las páginas de documento a visitar

    // --- PASO 1: Scrapear la página índice principal ---
    console.log(`Visitando página índice: ${mainIndexUrl}`);
    const mainResponse = await axios.get(mainIndexUrl);
    const $main = cheerio.load(mainResponse.data);
    visitedUrls.add(mainIndexUrl);

    const baseUrl = new URL(mainIndexUrl);

    // --- PASO 2: Encontrar enlaces a las páginas de documento en la página índice ---
    $main(SELECTOR_ENLACES_DOCUMENTO_INDICE).each((i, el) => {
      const href = $main(el).attr('href');
      if (href) {
        try {
          const docUrl = new URL(href, mainIndexUrl).href; // Resolver URL relativa/absoluta

          // Filtro para URLs de documento:
          // 1. Debe ser del mismo dominio.
          // 2. No debe ser la página índice principal.
          // 3. Parece que las URLs de documento en Compilación Única tienen '/docs/' en la ruta
          // 4. No debe haber sido ya añadido.
          if (new URL(docUrl).hostname === baseUrl.hostname &&
              docUrl !== mainIndexUrl &&
               docUrl.includes('/docs/') && // Heurística para filtrar URLs de documento
              !visitedUrls.has(docUrl))
          {
             documentUrls.push(docUrl);
             visitedUrls.add(docUrl); // Marcar como 'planificado para visitar'
             console.log(`  - Enlace de documento encontrado: ${docUrl}`);
          }
        } catch (e) {
          console.error(`Error procesando enlace en índice '${href}': ${e.message}`);
        }
      }
    });

    console.log(`Encontrados ${documentUrls.length} URLs de documento para visitar.`);

    // --- PASO 3: Visitar cada URL de documento y extraer el texto ---
    // Usamos Promise.all para visitar páginas concurrentemente
    const documentScrapePromises = documentUrls.map(async (docUrl) => {
        // Ya marcamos como visitada al añadir, pero verificamos por si acaso
        if (visitedUrls.has(docUrl) && docUrl !== mainIndexUrl) {
           // console.log(`Saltando URL ya visitada: ${docUrl}`);
           // return; // Si ya visitamos o planeamos visitar, no lo hagamos de nuevo
        }
        visitedUrls.add(docUrl); // Marcar como visitada justo antes de visitar

        try {
            console.log(`Visitando documento: ${docUrl}`);
            const docResponse = await axios.get(docUrl);
            const $doc = cheerio.load(docResponse.data);

            // Extraer el título del documento (podría estar en un <h1> o <title>, ajusta si es necesario)
            // Intentemos buscar un h1 o el texto de un elemento específico si hay un patrón claro
            let titulo = $doc('h1').text().trim() || $doc('title').text().trim() || 'Documento sin título';
             // Eliminar posibles partes extra del título, ej: nombre del sitio
            titulo = titulo.replace(/ - Gestor Normativo Alejandra 2\.0$/, '').trim();


            // --- Extraer texto del contenedor principal ---
            const textoContenedor = $doc(SELECTOR_CONTENEDOR_TEXTO);
            let contenido = '';
            if (textoContenedor.length > 0) {
                 contenido = textoContenedor.text().trim(); // Extrae todo el texto dentro del contenedor
                 console.log(`  - Texto extraído (inicio): "${contenido.substring(0, 100)}..."`);
            } else {
                 console.warn(`  - No se encontró el contenedor de texto '${SELECTOR_CONTENEDOR_TEXTO}' en ${docUrl}`);
            }


            documentos.push({
                titulo: titulo,
                url: docUrl, // URL de la página del documento
                fuente: fuente, // Mantener la fuente
                contenido: contenido, // Añadimos el texto extraído
                fecha_scrapeo: new Date().toISOString().split('T')[0] // Fecha de cuando se scrapeó
            });


        } catch (error) {
            console.error(`Error scrapeando documento ${docUrl}: ${error.message}`);
            // Continuar con otros documentos aunque uno falle
        }
    });

    // Esperar a que todas las promesas de scrapeo de documentos se completen
    await Promise.all(documentScrapePromises);

    console.log(`Terminado scrapeo de documentos. Procesados ${documentos.length}.`);

    // --- PASO 4: Devolver la lista de documentos con texto ---
    res.json({ fuente, documentos }); // Devolvemos la lista de documentos con su contenido


  } catch (error) {
    console.error(`Error durante el proceso de scrapeo principal del índice: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor de scraping activo en el puerto ${port}`);
});
