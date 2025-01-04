const express = require('express');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Cargar proxies para descargas directas
const proxiesDirectas = JSON.parse(fs.readFileSync(path.join(__dirname, '../proxis_directas.json'), 'utf-8'));

// Ruta del archivo de cookies
const cookiesPath = path.join(__dirname, '../cookies.txt');

// Objeto para rastrear proxies bloqueados temporalmente
const blockedProxies = {};

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
    const now = Date.now();
    const availableProxies = proxies.filter((proxy) => {
        const isBlocked = blockedProxies[proxy.ip] && now < blockedProxies[proxy.ip];
        return !usedProxies.includes(proxy.ip) && !isBlocked;
    });

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

// Función para agregar retrasos
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Ruta para descargas directas
router.post('/direct', async (req, res) => {
    const { direct_url } = req.body;

    if (!direct_url) {
        return res.status(400).json({ error: 'La URL directa es requerida.' });
    }

    const downloadsDir = ensureDownloadsDir();
    const tempFile = path.join(downloadsDir, `${Date.now()}_direct.mp4`);
    const maxRetries = proxiesDirectas.length; // Número máximo de intentos igual al número de proxies
    const retryDelay = 3000; // Retraso de 3 segundos entre intentos
    const timeoutLimit = 60000; // Timeout de 1 minuto
    const blockDuration = 15 * 60 * 1000; // Bloqueo temporal de 15 minutos
    let attempt = 0;
    const usedProxies = [];

    while (attempt < maxRetries) {
        const proxy = getRandomProxy(proxiesDirectas, usedProxies);
        if (!proxy) {
            console.error('No hay más proxies disponibles para descargas directas.');
            break;
        }
        usedProxies.push(proxy);
        console.log(`Usando proxy directo: ${proxy} (Intento ${attempt + 1}/${maxRetries})`);

        try {
            // Descargar con proxy y timeout
            await Promise.race([
                youtubedl(direct_url, {
                    output: tempFile,
                    proxy: `http://${proxy}`,
                    cookies: cookiesPath,
                    userAgent: getRandomUserAgent(),
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout: El proxy tardó más de 1 minuto')), timeoutLimit)
                ),
            ]);

            if (!fs.existsSync(tempFile)) {
                throw new Error('El archivo no se creó correctamente.');
            }

            return res.download(tempFile, 'video_directo.mp4', () => {
                fs.unlinkSync(tempFile);
                console.log('Archivo directo eliminado.');
            });
        } catch (error) {
            console.error(`Error con proxy directo ${proxy}: ${error.message}`);
            if (error.message.includes('Timeout')) {
                blockedProxies[proxy.split('@')[1].split(':')[0]] = Date.now() + blockDuration;
            }
            attempt++;
            console.log(`Esperando ${retryDelay / 1000} segundos antes del próximo intento...`);
            await delay(retryDelay);
        }
    }

    return res.status(500).json({ error: 'Error al descargar el archivo directamente.' });
});

module.exports = router;
