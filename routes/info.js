const express = require('express');
const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Cargar proxies desde un archivo
const proxies = JSON.parse(fs.readFileSync(path.join(__dirname, '../proxies_download.json'), 'utf-8'));

// Función para seleccionar un proxy aleatorio y excluir los fallidos
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

    const maxRetries = 3; // Número máximo de reintentos
    let attempt = 0;
    const usedProxies = []; // Lista de proxies ya utilizados

    while (attempt < maxRetries) {
        const proxy = getRandomProxy(usedProxies);
        if (!proxy) {
            console.error('No hay más proxies disponibles para intentar.');
            break;
        }
        usedProxies.push(proxy);
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
                proxy: `http://${proxy}`, // Usar el proxy seleccionado
            });

            clearInterval(interval); // Detener el incremento del progreso
            progressTracker[requestId] = 100; // Marcar progreso como completo

            // Filtrar formatos deseados
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
                    clearInterval(interval); // Detener el intervalo
                    delete progressTracker[requestId]; // Limpiar progreso
                    return res.status(400).json({
                        error: 'No hay formatos disponibles con audio y video para este video.',
                    });
                }
                clearInterval(interval); // Detener el intervalo si hay éxito
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
            clearInterval(interval); // Detener el intervalo si hay éxito
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
            console.error(`Error al usar el proxy ${proxy}:`, error.message);
            attempt++;
        }
    }

    // Si todos los intentos fallan
    progressTracker[requestId] = 0; // Reiniciar progreso en caso de error
    delete progressTracker[requestId]; // Eliminar progreso
    res.status(500).json({ error: 'No se pudo obtener la información del video después de varios intentos.' });
});

module.exports = router;
