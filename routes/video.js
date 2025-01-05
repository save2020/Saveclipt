const express = require('express');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const router = express.Router();

// Cargar proxies desde los archivos correspondientes
const proxiesDirectas = JSON.parse(fs.readFileSync(path.join(__dirname, '../proxis_directas.json'), 'utf-8'));
const proxiesConversion = JSON.parse(fs.readFileSync(path.join(__dirname, '../proxies_download.json'), 'utf-8'));

// Ruta del archivo de cookies
const cookiesPath = path.join(__dirname, '../cookies.txt');

// Lista de User-Agents
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
];

// Función para obtener un User-Agent aleatorio
function getRandomUserAgent() {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Función para seleccionar un proxy disponible
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

// Función para limpiar archivos temporales
function cleanUpFiles(...files) {
    files.forEach((file) => {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            console.log(`Archivo temporal eliminado: ${file}`);
        }
    });
}

// Función para agregar retrasos
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Función genérica para descargar con proxy
async function downloadWithProxy(proxy, downloadUrl, outputPath) {
    return youtubedl(downloadUrl, {
        output: outputPath,
        proxy: `http://${proxy}`,
        cookies: cookiesPath,
        userAgent: getRandomUserAgent(),
    });
}

// Endpoint para manejar la descarga de videos
router.post('/video', async (req, res) => {
    const { url, format_id, direct_url } = req.body; // Incluye la URL directa para descargas sin conversión

    if (!url || (!format_id && !direct_url)) {
        return res.status(400).json({ error: 'La URL y el formato son requeridos.' });
    }

    const downloadsDir = ensureDownloadsDir();
    const maxRetries = proxiesDirectas.length; // Número máximo de intentos basado en el número de proxies disponibles
    const retryDelay = 3000; // Retraso entre intentos
    let attempt = 0;
    const usedProxies = [];

    // Caso: descarga directa (sin conversión)
    if (direct_url) {
        while (attempt < maxRetries) {
            const proxy = getRandomProxy(proxiesDirectas, usedProxies);
            if (!proxy) {
                console.error('No hay más proxies disponibles para descargas directas.');
                break;
            }

            // Agregar proxy a la lista de usados
            const proxyIP = proxy.split('@')[1]?.split(':')[0] || proxy.split(':')[0];
            usedProxies.push(proxyIP);

            console.log(`Usando proxy directo: ${proxy} (Intento ${attempt + 1}/${maxRetries})`);

            try {
                const tempFile = path.join(downloadsDir, `${Date.now()}_direct.mp4`);
                await downloadWithProxy(proxy, direct_url, tempFile);

                return res.download(tempFile, 'video_directo.mp4', () => {
                    cleanUpFiles(tempFile);
                    console.log('Archivo directo eliminado.');
                });
            } catch (error) {
                console.error(`Error con proxy directo ${proxy}: ${error.message}`);
                attempt++;
                console.log(`Esperando ${retryDelay / 1000} segundos antes del próximo intento...`);
                await delay(retryDelay);
            }
        }

        return res.status(500).json({ error: 'Error al descargar el archivo directamente.' });
    }

    // Caso: requiere conversión
    const videoFile = path.join(downloadsDir, `${Date.now()}_video.mp4`);
    const audioFile = path.join(downloadsDir, `${Date.now()}_audio.mp4`);
    const outputFile = path.join(downloadsDir, `${Date.now()}_output.mp4`);

    while (attempt < maxRetries) {
        const proxy = getRandomProxy(proxiesConversion, usedProxies);
        if (!proxy) {
            console.error('No hay más proxies disponibles para la conversión.');
            break;
        }

        // Agregar proxy a la lista de usados
        const proxyIP = proxy.split('@')[1]?.split(':')[0] || proxy.split(':')[0];
        usedProxies.push(proxyIP);

        console.log(`Usando proxy para conversión: ${proxy} (Intento ${attempt + 1}/${maxRetries})`);

        try {
            await downloadWithProxy(proxy, url, videoFile);
            await downloadWithProxy(proxy, url, audioFile);

            if (!fs.existsSync(videoFile) || !fs.existsSync(audioFile)) {
                throw new Error('Archivos de video o audio faltantes después de la descarga.');
            }

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
                        cleanUpFiles(videoFile, audioFile, outputFile);
                    });
                } else {
                    console.error(`FFmpeg cerró con código: ${code}`);
                    cleanUpFiles(videoFile, audioFile, outputFile);
                    res.status(500).send('Error al combinar el video y el audio.');
                }
            });

            return;
        } catch (error) {
            console.error(`Error con proxy de conversión ${proxy}: ${error.message}`);
            attempt++;
            console.log(`Esperando ${retryDelay / 1000} segundos antes del próximo intento...`);
            await delay(retryDelay);
            cleanUpFiles(videoFile, audioFile, outputFile);
        }
    }

    cleanUpFiles(videoFile, audioFile, outputFile);
    res.status(500).json({ error: 'No se pudo procesar el video después de varios intentos.' });
});

module.exports = router;
