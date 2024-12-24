const express = require('express');
const youtubedl = require('youtube-dl-exec');

const router = express.Router();

// Variable global para rastrear el progreso
let progress = 0;

// Endpoint para rastrear el progreso de información
router.get('/progress', (req, res) => {
  res.json({ progress });
});

// Endpoint para obtener información del video
router.post('/info', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'La URL es requerida.' });
  }

  try {
    progress = 0; // Inicializar progreso

    // Simular progreso mediante intervalos mientras se procesa la información
    const interval = setInterval(() => {
      if (progress < 100) {
        progress += 20; // Incrementar el progreso
      }
    }, 500);

    // Obtener información del video
    const info = await youtubedl(url, { dumpSingleJson: true });

    clearInterval(interval); // Detener el incremento del progreso
    progress = 100; // Marcar progreso como completo

    const desiredQualities = [360, 720, 1080];
    const formats = info.formats
      .filter((f) => f.ext === 'mp4' && desiredQualities.includes(f.height)) // Solo MP4 y calidades deseadas
      .map((f) => ({
        quality: `${f.height}p`,
        format_id: f.format_id,
        url: f.url || null,
        has_audio: f.acodec !== 'none',
        requires_merge: f.acodec === 'none',
        filesize: f.filesize ? `${(f.filesize / (1024 * 1024)).toFixed(2)} MB` : 'Desconocido',
      }));

    // Separar formatos en dos grupos: los que requieren y los que no requieren conversión
    const groupNoMerge = [];
    const seenNoMerge = new Set();

    formats.forEach((format) => {
      if (!format.requires_merge && format.has_audio && !seenNoMerge.has(format.quality)) {
        seenNoMerge.add(format.quality);
        groupNoMerge.push(format);
      }
    });

    // Obtener duración del video
    const videoDuration = info.duration; // Duración en segundos
    const durationInMinutes = Math.floor(videoDuration / 60);

    // Si el video dura más de 50 minutos, solo mostrar el grupo sin conversión
    if (durationInMinutes > 50) {
      if (groupNoMerge.length === 0) {
        return res.status(400).json({
          error: 'No hay formatos disponibles con audio y video para este video.',
        });
      }
      return res.json({
        title: info.title,
        thumbnail: info.thumbnail,
        duration: durationInMinutes,
        formats: groupNoMerge, // Solo formatos que no requieren conversión
        restriction: 'Solo puedes descargar videos mayores a 50 minutos sin conversión.',
      });
    }

    // Para videos menores de 50 minutos, devolver ambos grupos
    const groupRequiresMerge = [];
    const seenRequiresMerge = new Set();

    formats.forEach((format) => {
      if (format.requires_merge && !seenRequiresMerge.has(format.quality)) {
        seenRequiresMerge.add(format.quality);
        groupRequiresMerge.push(format);
      }
    });

    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      duration: durationInMinutes,
      formats: {
        no_merge: groupNoMerge, // Sin conversión, tiene audio y video
        requires_merge: groupRequiresMerge, // Requiere conversión
      },
    });
  } catch (error) {
    console.error('Error al obtener información del video:', error.message);
    progress = 0; // Reiniciar el progreso en caso de error
    res.status(500).json({ error: 'No se pudo obtener la información del video.' });
  }
});

module.exports = router;
