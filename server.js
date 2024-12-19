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

    // Filtrar calidades deseadas (360p, 720p, 1080p) y formatos MP4
    const desiredQualities = [360, 720, 1080];
    const formats = info.formats
      .filter((f) => f.ext === 'mp4' && desiredQualities.includes(f.height))
      .map((f) => ({
        quality: `${f.height}p`,
        format_id: f.format_id,
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

// Endpoint para descargar video o audio
app.post('/download', async (req, res) => {
  const { url, format_id, type } = req.body;

  if (!url || !format_id || !type) {
    return res.status(400).json({ error: 'La URL, el formato y el tipo son requeridos.' });
  }

  try {
    console.log(`Iniciando descarga: tipo=${type}, formato=${format_id}...`);

    if (type === 'audio') {
      // Descargar solo audio
      const audioUrl = await youtubedl(url, {
        format: 'bestaudio',
        getUrl: true,
      });

      const tempFile = path.join(__dirname, 'downloads', `${Date.now()}_audio.mp3`);
      const ffmpeg = spawn('ffmpeg', ['-i', audioUrl, '-q:a', '0', '-map', 'a', tempFile]);

      ffmpeg.stderr.on('data', (data) => {
        console.error(`Error en FFmpeg (audio): ${data.toString()}`);
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          res.download(tempFile, () => {
            fs.unlinkSync(tempFile); // Eliminar archivo temporal después de enviarlo
          });
        } else {
          console.error(`FFmpeg cerró con código (audio): ${code}`);
          res.status(500).send('Error al procesar la descarga del audio.');
        }
      });
    } else {
      // Obtener URLs separadas de video y audio
      const videoUrl = await youtubedl(url, {
        format: format_id,
        getUrl: true,
      });
      const audioUrl = await youtubedl(url, {
        format: 'bestaudio',
        getUrl: true,
      });

      const tempFile = path.join(__dirname, 'downloads', `${Date.now()}_video.mp4`);
      const ffmpeg = spawn(
        'ffmpeg',
        [
          '-i',
          videoUrl,
          '-i',
          audioUrl,
          '-c:v',
          'copy',
          '-c:a',
          'aac',
          '-strict',
          'experimental',
          tempFile,
        ]
      );

      ffmpeg.stderr.on('data', (data) => {
        console.error(`Error en FFmpeg (video): ${data.toString()}`);
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          res.download(tempFile, () => {
            fs.unlinkSync(tempFile); // Eliminar archivo temporal después de enviarlo
          });
        } else {
          console.error(`FFmpeg cerró con código (video): ${code}`);
          res.status(500).send('Error al procesar la descarga del video.');
        }
      });
    }
  } catch (error) {
    console.error('Error al procesar la descarga:', error);
    res.status(500).json({ error: 'Error al descargar el archivo.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
