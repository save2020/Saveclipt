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
    // Solicitud al endpoint /api/info
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

    // Mostrar mensaje de restricción si aplica
    if (data.restriction) {
      statusMessage.textContent = data.restriction;
    } else {
      statusMessage.textContent = '';
    }

    // Mostrar opciones de calidades según el grupo
    if (Array.isArray(data.formats)) {
      // Videos mayores a 50 minutos (solo no_merge)
      data.formats.forEach((format) => {
        const option = document.createElement('option');
        option.value = JSON.stringify(format);
        option.textContent = `${format.quality} - ${format.filesize} (sin conversión)`;
        qualitySelect.appendChild(option);
      });
    } else {
      // Videos menores a 50 minutos (dos grupos)
      if (data.formats.no_merge) {
        const noMergeGroup = document.createElement('optgroup');
        noMergeGroup.label = 'Formatos que no requieren conversión';
        data.formats.no_merge.forEach((format) => {
          const option = document.createElement('option');
          option.value = JSON.stringify(format);
          option.textContent = `${format.quality} - ${format.filesize} (sin conversión)`;
          noMergeGroup.appendChild(option);
        });
        qualitySelect.appendChild(noMergeGroup);
      }

      if (data.formats.requires_merge) {
        const requiresMergeGroup = document.createElement('optgroup');
        requiresMergeGroup.label = 'Formatos que requieren conversión';
        data.formats.requires_merge.forEach((format) => {
          const option = document.createElement('option');
          option.value = JSON.stringify(format);
          option.textContent = `${format.quality} - ${format.filesize} (requiere conversión)`;
          requiresMergeGroup.appendChild(option);
        });
        qualitySelect.appendChild(requiresMergeGroup);
      }
    }

    videoPreview.classList.remove('hidden');
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
      // Solicitar conversión y descarga de video
      statusMessage.textContent = 'Iniciando conversión de video...';
      try {
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

        statusMessage.textContent = '¡Descarga completada!';
      } catch (error) {
        statusMessage.textContent = error.message;
      }
    } else {
      // Descarga directa sin conversión
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
    // Solicitar extracción de audio
    statusMessage.textContent = 'Iniciando extracción de audio...';
    try {
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

      statusMessage.textContent = '¡Descarga completada!';
    } catch (error) {
      statusMessage.textContent = error.message;
    }
  }
});
