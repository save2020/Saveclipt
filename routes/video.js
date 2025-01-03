const express = require('express');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const router = express.Router();

// Cargar proxies desde los archivos correspondientes
const proxiesDirectas = JSON.parse(fs.readFileSync(path.join(__dirname, '../proxis_directas.json'), 'utf-8'));
const proxiesConversion = JSON.parse(fs.readFileSync(path.join(__dirname, '../proxies_download.json'), 'utf-8'));

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

// Función para limpiar archivos temporales
function cleanUpFiles(...files) {
    files.forEach((file) => {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            console.log(`Archivo temporal eliminado: ${file}`);
        }
    });
}

// Endpoint para manejar la descarga de videos
router.post('/video', async (req, res) => {
    const { url, format_id, direct_url } = req.body; // Incluye la URL directa para descargas sin conversión

    if (!url || (!format_id && !direct_url)) {
        return res.status(400).json({ error: 'La URL y el formato son requeridos.' });
    }

    const downloadsDir = ensureDownloadsDir();
    const usedProxies = [];
    const maxRetries = 3;
    let attempt = 0;

    if (direct_url) {
        // Caso: descarga directa (sin conversión)
        while (attempt < maxRetries) {
            const proxy = getRandomProxy(proxiesDirectas, usedProxies);
            if (!proxy) {
                console.error('No hay más proxies disponibles para descargas directas.');
                break;
            }
            usedProxies.push(proxy);
            console.log(`Usando proxy directo: ${proxy} (Intento ${attempt + 1}/${maxRetries})`);

            try {
                console.log(`Descargando directamente desde: ${direct_url}`);
                const tempFile = path.join(downloadsDir, `${Date.now()}_direct.mp4`);

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
        usedProxies.push(proxy);
        console.log(`Usando proxy para conversión: ${proxy} (Intento ${attempt + 1}/${maxRetries})`);

        try {
            // Descargar el video
            console.log(`Iniciando descarga del video en el formato ${format_id} desde: ${url}`);
            await youtubedl(url, {
                format: format_id,
                output: videoFile,
                proxy: `http://${proxy}`,
            });

            // Descargar el mejor audio disponible
            console.log('Iniciando descarga del audio...');
            await youtubedl(url, {
                format: 'bestaudio',
                output: audioFile,
                proxy: `http://${proxy}`,
            });

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
                        cleanUpFiles(videoFile, audioFile, outputFile);
                    });
                } else {
                    console.error(`FFmpeg cerró con código: ${code}`);
                    cleanUpFiles(videoFile, audioFile, outputFile);
                    res.status(500).send('Error al combinar el video y el audio.');
                }
            });

            return; // Salir del ciclo si todo se completó correctamente
        } catch (error) {
            console.error(`Error con proxy de conversión ${proxy}: ${error.message}`);
            attempt++;
            cleanUpFiles(videoFile, audioFile, outputFile);
        }
    }

    // Si falla la conversión
    cleanUpFiles(videoFile, audioFile, outputFile);
    res.status(500).json({ error: 'No se pudo procesar el video después de varios intentos.' });
});

module.exports = router;
