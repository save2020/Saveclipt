const express = require('express');
const youtubedl = require('youtube-dl-exec');

const router = express.Router();

router.post('/info', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'La URL es requerida.' });
  }

  try {
    console.log(`Obteniendo información del video desde: ${url}...`);

    // Ejecutar youtube-dl para obtener información
    const info = await youtubedl(url, { dumpSingleJson: true });
    const desiredQualities = [360, 720, 1080];
    const formats = info.formats
      .filter((f) => f.ext === 'mp4' && desiredQualities.includes(f.height))
      .map((f) => ({
        quality: `${f.height}p`,
        format_id: f.format_id,
        url: f.url || null,
        has_audio: f.acodec !== 'none',
        requires_merge: f.acodec === 'none',
        filesize: f.filesize ? `${(f.filesize / (1024 * 1024)).toFixed(2)} MB` : 'Desconocido',
      }));

    // Responder con los datos relevantes del video
    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      formats,
    });
  } catch (error) {
    console.error('Error al obtener información del video:', error.message);
    res.status(500).json({ error: 'No se pudo obtener la información del video.' });
  }
});

module.exports = router;
