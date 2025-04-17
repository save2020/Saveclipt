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

// Manejo del evento para descargar el video seleccionado
downloadButton.addEventListener('click', async () => {
  const selectedOption = qualitySelect.value;

  if (!selectedOption) {
    stopProcessing(t('selectQuality'));
    return;
  }

  const format = JSON.parse(selectedOption);

  if (format.requires_merge) {
    // Descarga con conversión
    startProcessing(t('startingVideoConversion'));
    try {
      const response = await fetch(`${apiBaseUrl}/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl, format_id: format.format_id }),
      });

      if (!response.ok) throw new Error(t('errorDuringDownload'));

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${videoTitle.textContent}.mp4`;
      link.click();

      stopProcessing(t('downloadCompleted'));
      resetForm();
    } catch (error) {
      stopProcessing(error.message);
    }
  } else {
    // Descarga directa (sin conversión)
    startProcessing(t('startingQuickDownload'));
    try {
      const response = await fetch(`${apiBaseUrl}/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direct_url: format.url }),
      });

      if (!response.ok) throw new Error(t('errorDuringDownload'));

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${videoTitle.textContent}.mp4`;
      link.click();

      stopProcessing(t('downloadCompleted'));
      resetForm();
    } catch (error) {
      stopProcessing(error.message);
    }
  }
});
