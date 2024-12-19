const infoForm = document.getElementById('infoForm');
const videoUrlInput = document.getElementById('videoUrl');
const videoPreview = document.getElementById('videoPreview');
const videoTitle = document.getElementById('videoTitle');
const videoThumbnail = document.getElementById('videoThumbnail');
const qualitySelect = document.getElementById('qualitySelect');
const downloadButton = document.getElementById('downloadButton');
const statusMessage = document.getElementById('status');

let videoUrl = '';

infoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  videoUrl = videoUrlInput.value;

  statusMessage.textContent = 'Obteniendo información del video...';

  try {
    const response = await fetch('/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: videoUrl }),
    });

    if (!response.ok) throw new Error('Error al obtener información del video.');

    const data = await response.json();

    videoTitle.textContent = data.title;
    videoThumbnail.src = data.thumbnail;
    qualitySelect.innerHTML = '';

    data.formats.forEach((format) => {
      const option = document.createElement('option');
      option.value = JSON.stringify(format); // Guardar toda la información del formato
      option.textContent = `${format.quality} - ${format.filesize} ${format.requires_merge ? '(requiere conversión)' : ''}`;
      qualitySelect.appendChild(option);
    });

    videoPreview.classList.remove('hidden');
    statusMessage.textContent = '';
  } catch (error) {
    statusMessage.textContent = error.message;
  }
});

downloadButton.addEventListener('click', async () => {
  const selectedOption = qualitySelect.value;

  if (!selectedOption) {
    statusMessage.textContent = 'Selecciona una calidad antes de descargar.';
    return;
  }

  const format = JSON.parse(selectedOption);

  if (format.requires_merge) {
    if (!confirm('Este formato requiere conversión y puede demorar más tiempo. ¿Deseas continuar?')) {
      return;
    }

    statusMessage.textContent = 'Iniciando conversión...';

    try {
      const response = await fetch('/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl, format_id: format.format_id }),
      });

      if (!response.ok) throw new Error('Error durante la conversión.');

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'video.mp4';
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
      link.download = 'video.mp4';
      link.click();

      statusMessage.textContent = '¡Descarga completada!';
    } catch (error) {
      statusMessage.textContent = 'Error al iniciar la descarga.';
    }
  }
});
