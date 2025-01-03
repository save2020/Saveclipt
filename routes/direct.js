const express = require('express');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Cargar proxies para descargas directas
const proxiesDirectas = JSON.parse(fs.readFileSync(path.join(__dirname, '../proxis_directas.json'), 'utf-8'));

// Función para seleccionar un proxy aleatorio
function getRandomProxy(proxies, usedProxies) {
  const availableProxies = proxies.filter((proxy) => !usedProxies.includes(proxy.ip));
  if (availableProxies.length === 0) return null; // No hay más proxies disponibles
  const randomIndex = Math.floor(Math.random() * availableProxies.length);
  const proxy = availableProxies[randomIndex];

  if (proxy.username && proxy.password) {
    return `${proxy.username}:${proxy.password}@${proxy.ip}:${proxy.port}`;
  }
  return `${proxy.ip}:${proxy.port}`;
}

// Función para garantizar que el directorio `downloads` exista
function ensureDownloadsDir() {
  const downloadsDir = path.join(__dirname, '../downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
    console.log(`Directorio creado: ${downloadsDir}`);
  }
  return downloadsDir;
}

// Ruta para descargas directas
router.post('/direct', async (req, res) => {
  const { direct_url } = req.body;

  if (!direct_url) {
    return res.status(400).json({ error: 'La URL directa es requerida.' });
  }

  const downloadsDir = ensureDownloadsDir();
  const tempFile = path.join(downloadsDir, `${Date.now()}_direct.mp4`);
  const usedProxies = [];
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    const proxy = getRandomProxy(proxiesDirectas, usedProxies);
    if (!proxy) {
      console.error('No hay más proxies disponibles para descargas directas.');
      break;
    }
    usedProxies.push(proxy);
    console.log(`Usando proxy directo: ${proxy} (Intento ${attempt + 1}/${maxRetries})`);

    try {
      await youtubedl(direct_url, {
        output: tempFile,
        proxy: `http://${proxy}`,
      });

      if (!fs.existsSync(tempFile)) {
        throw new Error('El archivo no se creó correctamente.');
      }

      return res.download(tempFile, 'video_directo.mp4', () => {
        fs.unlinkSync(tempFile);
        console.log('Archivo directo eliminado.');
      });
    } catch (error) {
      console.error(`Error con proxy directo ${proxy}: ${error.message}`);
      attempt++;
    }
  }

  return res.status(500).json({ error: 'Error al descargar el archivo directamente.' });
});

module.exports = router;
