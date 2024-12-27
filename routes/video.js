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
    return `${proxies[randomIndex].ip}:${proxies[randomIndex].port}`;
}

// Endpoint para manejar la conversión de videos
router.post('/video', async (req, res) => {
    const { url, format_id } = req.body;

    if (!url || !format_id) {
        return res.status(400).json({ error: 'La URL y el formato son requeridos.' });
    }

    const videoFile = path.join(__dirname, '../downloads', `${Date.now()}_video.mp4`);
    const audioFile = path.join(__dirname, '../downloads', `${Date.now()}_audio.mp4`);
    const outputFile = path.join(__dirname, '../downloads', `${Date.now()}_output.mp4`);

    try {
        console.log(`Iniciando descarga del video en el formato ${format_id} desde: ${url}...`);

        // Seleccionar un proxy aleatorio
        const proxy = getRandomProxy();
        console.log(`Usando proxy: ${proxy}`);

        // Descargar el video
        await youtubedl(url, {
            format: format_id,
            output: videoFile,
            proxy: `http://${proxy}`, // Usar el proxy
        });

        console.log(`Video descargado correctamente: ${videoFile}`);

        // Descargar el mejor audio disponible
        await youtubedl(url, {
            format: 'bestaudio',
            output: audioFile,
            proxy: `http://${proxy}`, // Usar el proxy
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
                    fs.unlinkSync(videoFile);
                    fs.unlinkSync(audioFile);
                    fs.unlinkSync(outputFile);
                });
            } else {
                console.error(`FFmpeg cerró con código: ${code}`);
                res.status(500).send('Error al combinar el video y el audio.');
            }
        });
    } catch (error) {
        console.error('Error durante la conversión:', error);

        // Eliminar archivos temporales si ocurre un error
        if (fs.existsSync(videoFile)) fs.unlinkSync(videoFile);
        if (fs.existsSync(audioFile)) fs.unlinkSync(audioFile);

        res.status(500).json({ error: 'Error al procesar la combinación de video y audio.' });
    }
});

module.exports = router;
