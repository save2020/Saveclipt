const express = require('express');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');

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

// Endpoint para manejar la extracción de audio
router.post('/audio', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'La URL es requerida.' });
    }

    // Asegurar que el directorio `downloads` exista
    const downloadsDir = ensureDownloadsDir();
    const tempFile = path.join(downloadsDir, `${Date.now()}.mp3`);
    const maxRetries = 10; // Número máximo de reintentos
    let attempt = 0;

    while (attempt < maxRetries) {
        const proxy = getRandomProxy();
        console.log(`Usando proxy: ${proxy} (Intento ${attempt + 1}/${maxRetries})`);

        try {
            console.log(`Iniciando extracción de audio desde: ${url}...`);

            // Descargar audio utilizando el proxy
            await youtubedl(url, {
                format: 'bestaudio', // Descargar solo el audio
                extractAudio: true,  // Extraer únicamente el audio
                audioFormat: 'mp3',  // Convertir directamente a MP3
                output: tempFile,    // Archivo de salida
                proxy: `http://${proxy}` // Usar el proxy
            });

            console.log(`Audio descargado y convertido a MP3: ${tempFile}`);

            // Enviar el archivo al cliente
            return res.download(tempFile, 'audio.mp3', (err) => {
                if (err) {
                    console.error(`Error al enviar el archivo al cliente: ${err.message}`);
                } else {
                    console.log('Archivo MP3 enviado al cliente correctamente.');
                }

                // Eliminar archivo temporal después de enviarlo
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            });
        } catch (error) {
            console.error(`Error al usar el proxy ${proxy}: ${error.message}`);
            attempt++; // Incrementar intentos en caso de fallo
        }
    }

    // Si todos los intentos fallan
    if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile); // Asegurarse de limpiar cualquier archivo temporal
    }
    res.status(500).json({ error: 'No se pudo extraer el audio después de varios intentos.' });
});

module.exports = router;
