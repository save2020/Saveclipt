const express = require('express');
const { spawn } = require('child_process');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');

const router = express.Router();

router.post('/audio', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'La URL es requerida.' });
  }

  const tempFile = path.join(__dirname, '../downloads', `${Date.now()}.mp3`);

  try {
    console.log(`Iniciando extracción de audio desde: ${url}...`);

    await youtubedl(url, {
      format: 'bestaudio', // Descargar solo el audio
      extractAudio: true,  // Extraer únicamente el audio
      audioFormat: 'mp3',  // Convertir directamente a MP3
      output: tempFile,    // Archivo de salida
    });

    console.log(`Audio descargado y convertido a MP3: ${tempFile}`);

    res.download(tempFile, 'audio.mp3', (err) => {
      if (err) {
        console.error(`Error al enviar el archivo al cliente: ${err.message}`);
      } else {
        console.log('Archivo MP3 enviado al cliente correctamente.');
      }

      // Eliminar archivo temporal después de enviarlo
      fs.unlinkSync(tempFile);
    });
  } catch (error) {
    console.error('Error al extraer el audio:', error.message);
    res.status(500).json({ error: 'Error al extraer el audio.' });
  }
});

module.exports = router;
