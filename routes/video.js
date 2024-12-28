const express = require('express');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const router = express.Router();

// Cargar proxies desde un archivo
const proxies = JSON.parse(fs.readFileSync(path.join(__dirname, '../proxies.json'), 'utf-8'));

// Función para seleccionar un proxy aleatorio
function getRandomProxy() {
    const randomIndex = Math.floor(Math.random() * proxies.length);
    const proxy = proxies[randomIndex];

    if (proxy.username && proxy.password) {
        // Proxy con autenticación
        return `${proxy.username}:${proxy.password}@${proxy.ip}:${proxy.port}`;
    }

    // Proxy sin autenticación
    return `${proxy.ip}:${proxy.port}`;
}

// Endpoint para manejar la conversión de videos
router.post('/video', async (req, res) => {
    const { url, format_id } = req.body;

    if (!url || !format_id) {
        return res.status(400).json({ error: 'La URL y el formato son requeridos.' });
    }

    // Asegurar que el directorio `downloads` exista
    const downloadsDir = path.join(__dirname, '../downloads');
    if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
        console.log(`Directorio creado: ${downloadsDir}`);
    }

    const videoFile = path.join(downloadsDir, `${Date.now()}_video.mp4`);
    const audioFile = path.join(downloadsDir, `${Date.now()}_audio.mp4`);
    const outputFile = path.join(downloadsDir, `${Date.now()}_output.mp4`);
    const maxRetries = 10; // Número máximo de reintentos
    let attempt = 0;

    while (attempt < maxRetries) {
        const proxy = getRandomProxy();
        console.log(`Usando proxy: ${proxy} (Intento ${attempt + 1}/${maxRetries})`);

        try {
            console.log(`Iniciando descarga del video en el formato ${format_id} desde: ${url}...`);

            // Descargar el video
            await youtubedl(url, {
                format: format_id,
                output: videoFile,
                proxy: `http://${proxy}`, // Usar el proxy seleccionado
            });

            console.log(`Video descargado correctamente: ${videoFile}`);

            // Descargar el mejor audio disponible
            await youtubedl(url, {
                format: 'bestaudio',
                output: audioFile,
                proxy: `http://${proxy}`, // Usar el proxy seleccionado
            });

            console.log(`Audio descargado correctamente: ${audioFile}`);

            // Combinar video y audio usando FFmpeg
            console.log('Iniciando combinación de video y audio...');
            const ffmpeg = spawn('ffmpeg', [
                '-i', videoFile,      // Archivo de video
                '-i', audioFile,      // Archivo de audio
                '-c:v', 'copy',       // Copiar el video sin recodificar
                '-c:a', 'aac',        // Convertir el audio a AAC
                '-strict', 'experimental',
                outputFile,           // Archivo de salida
            ]);

            ffmpeg.stderr.on('data', (data) => {
                console.error(`FFmpeg: ${data.toString()}`);
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    console.log(`Combinación completada: ${outputFile}`);
                    res.download(outputFile, 'video_con_audio.mp4', () => {
                        // Eliminar archivos temporales
                        if (fs.existsSync(videoFile)) fs.unlinkSync(videoFile);
                        if (fs.existsSync(audioFile)) fs.unlinkSync(audioFile);
                        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
                    });
                } else {
                    console.error(`FFmpeg cerró con código: ${code}`);
                    res.status(500).send('Error al combinar el video y el audio.');
                }
            });

            return; // Salir del ciclo después de un éxito
        } catch (error) {
            console.error(`Error al usar el proxy ${proxy}: ${error.message}`);
            attempt++; // Incrementar el intento si ocurre un error
        }
    }

    // Si todos los intentos fallan
    if (fs.existsSync(videoFile)) fs.unlinkSync(videoFile);
    if (fs.existsSync(audioFile)) fs.unlinkSync(audioFile);

    res.status(500).json({ error: 'No se pudo procesar el video después de varios intentos.' });
});

module.exports = router;
