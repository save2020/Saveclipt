const express = require('express');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const router = express.Router();

// Cargar proxies desde un archivo
const proxies = JSON.parse(fs.readFileSync(path.join(__dirname, '../proxies.json'), 'utf-8'));

// Función para seleccionar un proxy aleatorio
function getRandomProxy() {
    const randomIndex = Math.floor(Math.random() * proxies.length);
    const proxy = proxies[randomIndex];

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

// Función para manejar la descarga con reintentos
async function downloadWithRetries(url, options, retries = 10) {
    for (let i = 0; i < retries; i++) {
        const proxy = getRandomProxy();
        console.log(`Intento ${i + 1}/${retries} con proxy: ${proxy}`);

        try {
            await youtubedl(url, { ...options, proxy: `http://${proxy}` });
            console.log(`Descarga completada con proxy: ${proxy}`);
            return true;
        } catch (error) {
            console.error(`Error al descargar con proxy ${proxy}: ${error.message}`);
        }
    }
    console.error('Todos los intentos de descarga fallaron.');
    return false;
}

// Endpoint para manejar la conversión de videos
router.post('/video', async (req, res) => {
    const { url, format_id } = req.body;

    if (!url || !format_id) {
        return res.status(400).json({ error: 'La URL y el formato son requeridos.' });
    }

    const downloadsDir = ensureDownloadsDir();
    const timestamp = Date.now();
    const videoFile = path.join(downloadsDir, `${timestamp}_video.mp4`);
    const audioFile = path.join(downloadsDir, `${timestamp}_audio.mp4`);
    const outputFile = path.join(downloadsDir, `${timestamp}_output.mp4`);

    try {
        // Descargar el video
        console.log('Iniciando descarga del video...');
        const videoDownloaded = await downloadWithRetries(url, { format: format_id, output: videoFile });
        if (!videoDownloaded || !fs.existsSync(videoFile)) {
            throw new Error(`No se pudo descargar el video: ${videoFile}`);
        }

        // Descargar el audio
        console.log('Iniciando descarga del audio...');
        const audioDownloaded = await downloadWithRetries(url, { format: 'bestaudio', output: audioFile });
        if (!audioDownloaded || !fs.existsSync(audioFile)) {
            throw new Error(`No se pudo descargar el audio: ${audioFile}`);
        }

        // Combinar video y audio con FFmpeg
        console.log('Iniciando combinación de video y audio...');
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoFile,
            '-i', audioFile,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-strict', 'experimental',
            outputFile,
        ]);

        ffmpeg.stderr.on('data', (data) => {
            console.error(`FFmpeg: ${data.toString()}`);
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                console.log(`Combinación completada: ${outputFile}`);
                res.download(outputFile, 'video_con_audio.mp4', () => {
                    [videoFile, audioFile, outputFile].forEach((file) => {
                        if (fs.existsSync(file)) fs.unlinkSync(file);
                    });
                });
            } else {
                console.error(`FFmpeg cerró con código: ${code}`);
                res.status(500).json({ error: 'Error al combinar el video y el audio.' });
            }
        });
    } catch (error) {
        console.error(`Error crítico: ${error.message}`);
        [videoFile, audioFile, outputFile].forEach((file) => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        });
        res.status(500).json({ error: 'No se pudo procesar el video.' });
    }
});

module.exports = router;
