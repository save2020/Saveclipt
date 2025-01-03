const express = require('express');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Cargar proxies desde un archivo
const proxies = JSON.parse(fs.readFileSync(path.join(__dirname, '../proxies_download.json'), 'utf-8'));

// Función para seleccionar un proxy aleatorio y excluir los fallidos
function getRandomProxy(usedProxies) {
    const availableProxies = proxies.filter(proxy => !usedProxies.includes(proxy.ip));
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

// Endpoint para manejar la extracción de audio
router.post('/audio', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'La URL es requerida.' });
    }

    // Asegurar que el directorio `downloads` exista
    const downloadsDir = ensureDownloadsDir();
    const tempFile = path.join(downloadsDir, `${Date.now()}.mp3`);
    const maxRetries = 5; // Número máximo de reintentos
    let attempt = 0;
    const usedProxies = []; // Proxies que ya fallaron

    while (attempt < maxRetries) {
        const proxy = getRandomProxy(usedProxies);
        if (!proxy) {
            console.error('No hay más proxies disponibles para intentar.');
            break;
        }
        usedProxies.push(proxy);
        console.log(`Usando proxy: ${proxy} (Intento ${attempt + 1}/${maxRetries})`);

        try {
            console.log(`Iniciando extracción de audio desde: ${url}...`);

            // Descargar audio utilizando el proxy
            await youtubedl(url, {
                format: 'bestaudio',   // Descargar solo el audio
                extractAudio: true,    // Extraer únicamente el audio
                audioFormat: 'mp3',    // Convertir directamente a MP3
                output: tempFile,      // Archivo de salida
                proxy: `http://${proxy}` // Usar el proxy
            });

            console.log(`Audio descargado y convertido a MP3: ${tempFile}`);

            // Verificar si el archivo fue creado correctamente
            if (!fs.existsSync(tempFile)) {
                throw new Error('El archivo de audio no se creó correctamente.');
            }

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
        }
    }

    // Si todos los intentos fallan
    cleanUpFile(tempFile);
    res.status(500).json({ error: 'No se pudo extraer el audio después de varios intentos.' });
});

module.exports = router;
