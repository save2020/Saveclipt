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

    const data = await response.json();

    videoTitle.textContent = data.title;
    videoThumbnail.src = data.thumbnail;
    qualitySelect.innerHTML = '';

    data.formats.forEach((format) => {
      const option = document.createElement('option');
      option.value = format.format_id;
      option.textContent = `${format.quality} - ${format.filesize}`;
      qualitySelect.appendChild(option);
    });

    videoPreview.classList.remove('hidden');
    statusMessage.textContent = '';
  } catch (error) {
    statusMessage.textContent = 'Error al obtener información del video.';
  }
});

downloadButton.addEventListener('click', async () => {
  const selectedFormat = qualitySelect.value;
  const type = document.querySelector('input[name="type"]:checked').value; // Video o audio

  statusMessage.textContent = `Descargando ${type}...`;

  try {
    const response = await fetch('/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: videoUrl, format_id: selectedFormat, type }),
    });

    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = type === 'audio' ? 'audio.mp3' : 'video.mp4';
    link.click();

    statusMessage.textContent = '¡Descarga completada!';
  } catch (error) {
    statusMessage.textContent = 'Error al descargar el archivo.';
  }
});
