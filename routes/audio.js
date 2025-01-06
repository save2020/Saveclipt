const express = require('express');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Cargar proxies desde un archivo
const proxies = JSON.parse(fs.readFileSync(path.join(__dirname, '../proxies_download.json'), 'utf-8'));

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
function getRandomProxy(usedProxies) {
    const availableProxies = proxies.filter((proxy) => !usedProxies.includes(proxy.ip));

    if (availableProxies.length === 0) return null; // No hay más proxies disponibles
    const randomIndex = Math.floor(Math.random() * availableProxies.length);
    const proxy = availableProxies[randomIndex];

    if (proxy.username && proxy.password) {
        // Proxy con autenticación
        return `${proxy.username}:${proxy.password}@${proxy.ip}:${proxy.port}`;
    }

    // Proxy sin autenticación
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
function cleanUpFile(filePath) {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Archivo temporal eliminado: ${filePath}`);
    }
}

// Función para agregar retrasos
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Endpoint para manejar la extracción de audio
router.post('/audio', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'La URL es requerida.' });
    }

    // Asegurar que el directorio `downloads` exista
    const downloadsDir = ensureDownloadsDir();
    const tempFile = path.join(downloadsDir, `${Date.now()}.mp3`);
    const maxRetries = proxies.length; // Número máximo de intentos basado en el número de proxies
    const retryDelay = 3000; // Retraso entre intentos en milisegundos (3 segundos)
    let attempt = 0;
    const usedProxies = []; // Proxies que ya fallaron

    while (attempt < maxRetries) {
        const proxy = getRandomProxy(usedProxies);
        if (!proxy) {
            console.error('No hay más proxies disponibles para intentar.');
            break;
        }

        // Registrar proxy como usado
        const proxyIP = proxy.split('@')[1]?.split(':')[0] || proxy.split(':')[0];
        usedProxies.push(proxyIP);

        console.log(`Usando proxy: ${proxy} (Intento ${attempt + 1}/${maxRetries})`);

        try {
            console.log(`Iniciando extracción de audio desde: ${url}...`);

            // Descargar audio utilizando proxy
            await youtubedl(url, {
                format: 'bestaudio',   // Descargar solo el audio
                extractAudio: true,    // Extraer únicamente el audio
                audioFormat: 'mp3',    // Convertir directamente a MP3
                output: tempFile,      // Archivo de salida
                proxy: `http://${proxy}`, // Usar el proxy
                cookies: cookiesPath,  // Usar cookies
                userAgent: getRandomUserAgent(),
            });

            // Verificar si el archivo fue creado correctamente
            if (!fs.existsSync(tempFile)) {
                throw new Error('El archivo de audio no se creó correctamente.');
            }

            console.log(`Audio descargado y convertido a MP3: ${tempFile}`);

            // Enviar el archivo al cliente
            return res.download(tempFile, 'audio.mp3', (err) => {
                if (err) {
                    console.error(`Error al enviar el archivo al cliente: ${err.message}`);
                } else {
                    console.log('Archivo MP3 enviado al cliente correctamente.');
                }

                // Eliminar archivo temporal después de enviarlo
                cleanUpFile(tempFile);
            });
        } catch (error) {
            console.error(`Error al usar el proxy ${proxy}: ${error.message}`);
            attempt++; // Incrementar intentos en caso de fallo
            console.log(`Esperando ${retryDelay / 1000} segundos antes del próximo intento...`);
            await delay(retryDelay); // Agregar retraso antes de reintentar
        }
    }

    // Si todos los intentos fallan
    cleanUpFile(tempFile);
    res.status(500).json({ error: 'No se pudo extraer el audio después de varios intentos.' });
});

module.exports = router;
