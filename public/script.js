const infoForm = document.getElementById('infoForm');
const videoUrlInput = document.getElementById('videoUrl');
const videoPreview = document.getElementById('videoPreview');
const videoTitle = document.getElementById('videoTitle');
const videoThumbnail = document.getElementById('videoThumbnail');
const qualitySelect = document.getElementById('qualitySelect');
const downloadButton = document.getElementById('downloadButton');
const statusMessage = document.getElementById('status');

let videoUrl = '';

// Manejo del evento para obtener información del video
infoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  videoUrl = videoUrlInput.value;

  statusMessage.textContent = 'Obteniendo información del video...';

  try {
    // Realiza una solicitud al endpoint /api/info
    const response = await fetch('/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: videoUrl }),
    });

    if (!response.ok) throw new Error('Error al obtener información del video.');

    const data = await response.json();

    videoTitle.textContent = data.title;
    videoThumbnail.src = data.thumbnail;
    qualitySelect.innerHTML = '';

    const uniqueFormats = [];
    const seenQualities = new Set();
    data.formats.forEach((format) => {
      const uniqueKey = `${format.quality}-${format.requires_merge}`;
      if (!seenQualities.has(uniqueKey)) {
        seenQualities.add(uniqueKey);
        uniqueFormats.push(format);
      }
    });

    uniqueFormats.forEach((format) => {
      const option = document.createElement('option');
      option.value = JSON.stringify(format);
      option.textContent = `${format.quality} - ${format.filesize} ${
        format.requires_merge ? '(requiere conversión)' : '(no requiere conversión)'
      }`;
      qualitySelect.appendChild(option);
    });

    videoPreview.classList.remove('hidden');
    statusMessage.textContent = '';
  } catch (error) {
    statusMessage.textContent = error.message;
  }
});

// Manejo del evento para descargar el archivo seleccionado
downloadButton.addEventListener('click', async () => {
  const selectedOption = qualitySelect.value;
  const type = document.querySelector('input[name="type"]:checked').value;

  if (!selectedOption) {
    statusMessage.textContent = 'Selecciona una calidad antes de descargar.';
    return;
  }

  const format = JSON.parse(selectedOption);

  if (type === 'video') {
    if (format.requires_merge) {
      if (!confirm('Este formato requiere conversión y puede demorar más tiempo. ¿Deseas continuar?')) {
        return;
      }

      statusMessage.textContent = 'Iniciando conversión...';

      try {
        // Realiza una solicitud al endpoint /api/convert
        const response = await fetch('/api/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: videoUrl, format_id: format.format_id }),
        });

        if (!response.ok) throw new Error('Error durante la conversión.');

        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${videoTitle.textContent}.mp4`;
        link.click();

        statusMessage.textContent = '¡Conversión y descarga completadas!';
      } catch (error) {
        statusMessage.textContent = error.message;
      }
    } else {
      statusMessage.textContent = 'Iniciando descarga rápida...';

      try {
        const link = document.createElement('a');
        link.href = format.url;
        link.download = `${videoTitle.textContent}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        statusMessage.textContent = '¡Descarga completada!';
      } catch (error) {
        statusMessage.textContent = 'Error al iniciar la descarga.';
      }
    }
  } else if (type === 'audio') {
    statusMessage.textContent = 'Iniciando extracción de audio...';

    try {
      // Realiza una solicitud al endpoint /api/audio
      const response = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl }),
      });

      if (!response.ok) throw new Error('Error durante la extracción de audio.');

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${videoTitle.textContent || 'audio'}.mp3`;
      link.click();

      statusMessage.textContent = '¡Extracción y descarga de audio completadas!';
    } catch (error) {
      statusMessage.textContent = error.message;
    }
  }
});
