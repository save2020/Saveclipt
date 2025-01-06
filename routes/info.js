const express = require('express');
const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const proxies = JSON.parse(fs.readFileSync(path.join(__dirname, '../proxies_info.json'), 'utf-8'));
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
function getRandomProxy(usedProxies) {
    const availableProxies = proxies.filter((proxy) => !usedProxies.includes(proxy.ip));

    if (availableProxies.length === 0) return null; // No hay más proxies disponibles
    const randomIndex = Math.floor(Math.random() * availableProxies.length);
    const proxy = availableProxies[randomIndex];

    if (proxy.username && proxy.password) {
        return `${proxy.username}:${proxy.password}@${proxy.ip}:${proxy.port}`;
    }
    return `${proxy.ip}:${proxy.port}`;
}

// Función para agregar retrasos
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Objeto para rastrear el progreso por solicitud
const progressTracker = {};

// Endpoint para rastrear el progreso de información
router.get('/progress/:id', (req, res) => {
    const { id } = req.params;
    const progress = progressTracker[id] || 0;
    res.json({ progress });
});

// Endpoint para obtener información del video con rotación de proxies
router.post('/info', async (req, res) => {
    const { url } = req.body;
    const requestId = `${Date.now()}-${Math.random()}`; // Generar un ID único para esta solicitud
    progressTracker[requestId] = 0; // Inicializar progreso

    if (!url) {
        return res.status(400).json({ error: 'La URL es requerida.' });
    }

    const maxRetries = proxies.length; // Número máximo de intentos igual al número de proxies
    const retryDelay = 3000; // Retraso de 3 segundos entre intentos
    let attempt = 0;
    const usedProxies = []; // Lista de proxies ya utilizados

    while (attempt < maxRetries) {
        const proxy = getRandomProxy(usedProxies);
        if (!proxy) {
            console.error('No hay más proxies disponibles para intentar.');
            break;
        }

        // Agregar proxy a la lista de usados
        const proxyIP = proxy.split('@')[1]?.split(':')[0] || proxy.split(':')[0];
        usedProxies.push(proxyIP);

        console.log(`Usando proxy: ${proxy} (Intento ${attempt + 1}/${maxRetries})`);

        try {
            // Simular progreso mientras se procesa la información
            const interval = setInterval(() => {
                if (progressTracker[requestId] < 100) {
                    progressTracker[requestId] += 20; // Incrementar el progreso
                }
            }, 500);

            // Obtener información del video
            const info = await youtubedl(url, {
                dumpSingleJson: true,
                proxy: `http://${proxy}`,
                cookies: cookiesPath,
                userAgent: getRandomUserAgent(), // User-Agent aleatorio
            });

            clearInterval(interval); // Detener el incremento del progreso
            progressTracker[requestId] = 100; // Marcar progreso como completo

            // Filtrar formatos deseados
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

            // Agrupar formatos que no requieren combinación
            const groupNoMerge = [];
            const seenNoMerge = new Set();

            formats.forEach((format) => {
                if (!format.requires_merge && format.has_audio && !seenNoMerge.has(format.quality)) {
                    seenNoMerge.add(format.quality);
                    groupNoMerge.push(format);
                }
            });

            // Duración del video
            const videoDuration = info.duration; // Duración en segundos
            const durationInMinutes = Math.floor(videoDuration / 60);

            if (durationInMinutes > 50) {
                if (groupNoMerge.length === 0) {
                    delete progressTracker[requestId]; // Limpiar progreso
                    return res.status(400).json({
                        error: 'No hay formatos disponibles con audio y video para este video.',
                    });
                }
                delete progressTracker[requestId]; // Limpiar progreso
                return res.json({
                    title: info.title,
                    thumbnail: info.thumbnail,
                    duration: durationInMinutes,
                    formats: groupNoMerge, // Solo formatos que no requieren conversión
                    restriction: 'Solo puedes descargar videos mayores a 50 minutos sin conversión.',
                });
            }

            // Agrupar formatos que requieren combinación
            const groupRequiresMerge = [];
            const seenRequiresMerge = new Set();

            formats.forEach((format) => {
                if (format.requires_merge && !seenRequiresMerge.has(format.quality)) {
                    seenRequiresMerge.add(format.quality);
                    groupRequiresMerge.push(format);
                }
            });

            // Enviar respuesta y detener el ciclo
            delete progressTracker[requestId]; // Limpiar progreso
            return res.json({
                title: info.title,
                thumbnail: info.thumbnail,
                duration: durationInMinutes,
                formats: {
                    no_merge: groupNoMerge, // Sin conversión, tiene audio y video
                    requires_merge: groupRequiresMerge, // Requiere conversión
                },
            });
        } catch (error) {
            console.error(`Error con el proxy ${proxy}:`, error.message);
            attempt++;
            console.log(`Esperando ${retryDelay / 1000} segundos antes del próximo intento...`);
            await delay(retryDelay); // Agregar retraso antes de reintentar
        }
    }

    // Si todos los intentos fallan
    delete progressTracker[requestId]; // Eliminar progreso
    res.status(500).json({ error: 'No se pudo obtener la información del video después de varios intentos.' });
});

module.exports = router;
