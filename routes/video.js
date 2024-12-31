const express = require('express');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const router = express.Router();

// Cargar proxies desde un archivo
const proxies = JSON.parse(fs.readFileSync(path.join(__dirname, '../proxies.json'), 'utf-8'));

// Función para seleccionar un proxy aleatorio y excluir los fallidos
function getRandomProxy(usedProxies) {
    const availableProxies = proxies.filter((proxy) => !usedProxies.includes(proxy.ip));
    if (availableProxies.length === 0) return null; // No hay proxies disponibles
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

// Endpoint para manejar la conversión de videos
router.post('/video', async (req, res) => {
    const { url, format_id } = req.body;

    if (!url || !format_id) {
        return res.status(400).json({ error: 'La URL y el formato son requeridos.' });
    }

    const downloadsDir = ensureDownloadsDir();
    const videoFile = path.join(downloadsDir, `${Date.now()}_video.mp4`);
    const audioFile = path.join(downloadsDir, `${Date.now()}_audio.mp4`);
    const outputFile = path.join(downloadsDir, `${Date.now()}_output.mp4`);
    const maxRetries = 10; 
    let attempt = 0;
    const usedProxies = [];

    while (attempt < maxRetries) {
        const proxy = getRandomProxy(usedProxies);
        if (!proxy) {
            console.error('No hay más proxies disponibles para intentar.');
            break;
        }
        usedProxies.push(proxy);
        console.log(`Usando proxy: ${proxy} (Intento ${attempt + 1}/${maxRetries})`);

        try {
            // Descargar el video
            console.log(`Iniciando descarga del video en el formato ${format_id} desde: ${url}...`);
            await youtubedl(url, {
                format: format_id,
                output: videoFile,
                proxy: `http://${proxy}`,
            });
            console.log(`Video descargado correctamente: ${videoFile}`);

            // Descargar el mejor audio disponible
            console.log('Iniciando descarga del audio...');
            await youtubedl(url, {
                format: 'bestaudio',
                output: audioFile,
                proxy: `http://${proxy}`,
            });
            console.log(`Audio descargado correctamente: ${audioFile}`);

            // Validar si los archivos existen antes de combinar
            if (!fs.existsSync(videoFile) || !fs.existsSync(audioFile)) {
                throw new Error('Archivos de video o audio faltantes después de la descarga.');
            }

            // Combinar video y audio usando FFmpeg
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
                        if (fs.existsSync(videoFile)) fs.unlinkSync(videoFile);
                        if (fs.existsSync(audioFile)) fs.unlinkSync(audioFile);
                        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
                    });
                } else {
                    console.error(`FFmpeg cerró con código: ${code}`);
                    res.status(500).send('Error al combinar el video y el audio.');
                }
            });

            return; // Salir del ciclo si todo se completó correctamente
        } catch (error) {
            console.error(`Error al usar el proxy ${proxy}: ${error.message}`);
            attempt++;
        }
    }

    // Si todos los intentos fallan
    if (fs.existsSync(videoFile)) fs.unlinkSync(videoFile);
    if (fs.existsSync(audioFile)) fs.unlinkSync(audioFile);
    res.status(500).json({ error: 'No se pudo procesar el video después de varios intentos.' });
});

module.exports = router;
