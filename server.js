const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Endpoint para obtener información del video
app.post('/info', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'La URL es requerida.' });
  }

  try {
    const info = await youtubedl(url, { dumpSingleJson: true });

    const desiredQualities = [360, 720, 1080];
    const formats = info.formats
      .filter((f) => f.ext === 'mp4' && desiredQualities.includes(f.height))
      .map((f) => ({
        quality: `${f.height}p`,
        format_id: f.format_id,
        url: f.url || null, // Enlace directo si está disponible
        has_audio: f.acodec !== 'none',
        requires_merge: f.acodec === 'none', // Indica si requiere combinar audio
        filesize: f.filesize ? `${(f.filesize / (1024 * 1024)).toFixed(2)} MB` : 'Desconocido',
      }));

    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      formats,
    });
  } catch (error) {
    console.error('Error al obtener información del video:', error);
    res.status(500).json({ error: 'No se pudo obtener la información del video.' });
  }
});

// Endpoint para convertir y combinar video/audio
app.post('/convert', async (req, res) => {
  const { url, format_id } = req.body;

  if (!url || !format_id) {
    return res.status(400).json({ error: 'La URL y el formato son requeridos.' });
  }

  const tempFile = path.join(__dirname, 'downloads', `${Date.now()}.mp4`);

  try {
    console.log(`Iniciando conversión: formato=${format_id}...`);

    // Obtener URLs de video y audio
    const videoUrl = await youtubedl(url, { format: format_id, getUrl: true });
    const audioUrl = await youtubedl(url, { format: 'bestaudio', getUrl: true });

    if (!videoUrl || !audioUrl) {
      throw new Error('No se pudieron obtener los enlaces de video y audio.');
    }

    // Ejecutar FFmpeg para combinar
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoUrl,      // Entrada de video
      '-i', audioUrl,      // Entrada de audio
      '-c:v', 'copy',      // Copiar el video sin recodificar
      '-c:a', 'aac',       // Convertir audio a AAC
      '-strict', 'experimental',
      '-shortest',         // Finalizar cuando el más corto (audio/video) termine
      tempFile,
    ]);

    ffmpeg.stderr.on('data', (data) => {
      console.error(`Error en FFmpeg (convertir): ${data}`);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        res.download(tempFile, () => fs.unlinkSync(tempFile));
      } else {
        console.error(`FFmpeg cerró con código: ${code}`);
        res.status(500).send('Error al procesar la conversión.');
      }
    });
  } catch (error) {
    console.error('Error al convertir el archivo:', error);
    res.status(500).json({ error: 'Error al convertir el archivo.' });
  }
});


app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
