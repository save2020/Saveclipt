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
    return `${proxies[randomIndex].ip}:${proxies[randomIndex].port}`;
}

router.post('/audio', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'La URL es requerida.' });
    }

    const tempFile = path.join(__dirname, '../downloads', `${Date.now()}.mp3`);

    try {
        console.log(`Iniciando extracción de audio desde: ${url}...`);

        // Seleccionar un proxy aleatorio
        const proxy = getRandomProxy();
        console.log(`Usando proxy: ${proxy}`);

        await youtubedl(url, {
            format: 'bestaudio',   // Descargar solo el audio
            extractAudio: true,    // Extraer únicamente el audio
            audioFormat: 'mp3',    // Convertir directamente a MP3
            output: tempFile,      // Archivo de salida
            proxy: `http://${proxy}` // Usar el proxy
        });

        console.log(`Audio descargado y convertido a MP3: ${tempFile}`);

        res.download(tempFile, 'audio.mp3', (err) => {
            if (err) {
                console.error(`Error al enviar el archivo al cliente: ${err.message}`);
            } else {
                console.log('Archivo MP3 enviado al cliente correctamente.');
            }

            // Eliminar archivo temporal después de enviarlo
            fs.unlinkSync(tempFile);
        });
    } catch (error) {
        console.error('Error al extraer el audio:', error.message);
        res.status(500).json({ error: 'Error al extraer el audio.' });
    }
});

module.exports = router;
