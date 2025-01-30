const infoForm = document.getElementById('infoForm');
const videoUrlInput = document.getElementById('videoUrl');
const videoPreview = document.getElementById('videoPreview');
const videoTitle = document.getElementById('videoTitle');
const videoThumbnail = document.getElementById('videoThumbnail');
const qualitySelect = document.getElementById('qualitySelect');
const downloadButton = document.getElementById('downloadButton');
const statusMessage = document.getElementById('status');

let videoUrl = '';

// Obtener la raíz del idioma desde la URL
const langPath = window.location.pathname.split('/')[1]; // Detectar idioma (es, en, chino, etc.)
const apiBaseUrl = `/${langPath}/api`; // Base URL dinámica para las rutas de la API

const translations = {
  es: {
    fetchingInfo: "Obteniendo información del video...",
    errorFetchingInfo: "Error al obtener información del video.",
    selectQuality: "Selecciona una calidad antes de descargar.",
    startingVideoConversion: "Iniciando conversión de video...",
    startingQuickDownload: "Iniciando descarga rápida...",
    startingAudioExtraction: "Iniciando extracción de audio...",
    downloadCompleted: "¡Descarga completada!",
    errorDuringDownload: "Los servidores están sobrecargados. Por favor, inténtalo nuevamente en 15 minutos.",
    noConversion: "sin conversión",
    requiresConversion: "requiere conversión",
    processing: "Procesando solicitud...",
  },
  en: {
    fetchingInfo: "Fetching video information...",
    errorFetchingInfo: "Error fetching video information.",
    selectQuality: "Select a quality before downloading.",
    startingVideoConversion: "Starting video conversion...",
    startingQuickDownload: "Starting quick download...",
    startingAudioExtraction: "Starting audio extraction...",
    downloadCompleted: "Download completed!",
    errorDuringDownload: "The servers are overloaded. Please try again in 15 minutes.",
    noConversion: "no conversion",
    requiresConversion: "requires conversion",
    processing: "Processing request...",
  },
};

// Función para traducir mensajes
function t(key) {
  return translations[langPath]?.[key] || translations['en'][key] || key;
}

// Función para limpiar el formulario
function resetForm() {
  videoUrl = '';
  videoUrlInput.value = '';
  videoTitle.textContent = '';
  videoThumbnail.src = '';
  videoPreview.classList.add('hidden');
  qualitySelect.innerHTML = '';
  statusMessage.textContent = '';
  statusMessage.classList.remove('processing'); // Eliminar animación
}

// Funciones para animar el estado
function startProcessing(message) {
  statusMessage.textContent = message;
  statusMessage.classList.add('processing');
}

function stopProcessing(message) {
  statusMessage.textContent = message;
  statusMessage.classList.remove('processing');
}

// Manejo del evento para obtener información del video
infoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  videoUrl = videoUrlInput.value;

  if (!videoUrl) {
    stopProcessing(t('errorFetchingInfo'));
    return;
  }

  startProcessing(t('fetchingInfo'));

  try {
    const response = await fetch(`${apiBaseUrl}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: videoUrl }),
    });

    if (!response.ok) throw new Error(t('errorFetchingInfo'));

    const data = await response.json();

    videoTitle.textContent = data.title;
    videoThumbnail.src = data.thumbnail;
    qualitySelect.innerHTML = '';

    if (data.restriction) {
      stopProcessing(data.restriction);
    } else {
      stopProcessing('');
    }

    // Agrupar formatos en categorías (sin conversión y con conversión)
    if (data.formats.no_merge) {
      const noMergeGroup = document.createElement('optgroup');
      noMergeGroup.label = t('noConversion');
      data.formats.no_merge.forEach((format) => {
        const option = document.createElement('option');
        option.value = JSON.stringify(format);
        option.textContent = `${format.quality} - ${format.filesize || 'Desconocido'} (${t('noConversion')})`;
        noMergeGroup.appendChild(option);
      });
      qualitySelect.appendChild(noMergeGroup);
    }

    if (data.formats.requires_merge) {
      const requiresMergeGroup = document.createElement('optgroup');
      requiresMergeGroup.label = t('requiresConversion');
      data.formats.requires_merge.forEach((format) => {
        const option = document.createElement('option');
        option.value = JSON.stringify(format);
        option.textContent = `${format.quality} - ${format.filesize || 'Desconocido'} (${t('requiresConversion')})`;
        requiresMergeGroup.appendChild(option);
      });
      qualitySelect.appendChild(requiresMergeGroup);
    }

    videoPreview.classList.remove('hidden');
  } catch (error) {
    stopProcessing(error.message);
  }
});

// Manejo del evento para descargar el archivo seleccionado
downloadButton.addEventListener('click', () => {
  const selectedOption = qualitySelect.value;

  if (!selectedOption) {
    stopProcessing(t('selectQuality'));
    return;
  }

  const format = JSON.parse(selectedOption);

  startProcessing(t('processing'));

  const eventSource = new EventSource(`${apiBaseUrl}/video?url=${encodeURIComponent(videoUrl)}&format_id=${format.format_id}`);

  eventSource.onmessage = (event) => {
    statusMessage.textContent = event.data; // Actualiza el estado en tiempo real
  };

  eventSource.addEventListener('done', (event) => {
    const fileUrl = `${apiBaseUrl}/downloads/${event.data}`;
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = 'video_con_audio.mp4';
    link.click();

    stopProcessing(t('downloadCompleted'));
    eventSource.close();
    resetForm();
  });

  eventSource.onerror = () => {
    stopProcessing(t('errorDuringDownload'));
    eventSource.close();
  };
});
