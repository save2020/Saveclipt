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

// Configuración de traducciones
const translations = {
  es: {
    fetchingInfo: "Obteniendo información del video...",
    errorFetchingInfo: "Error al obtener información del video.",
    selectQuality: "Selecciona una calidad antes de descargar.",
    startingVideoConversion: "Iniciando conversión de video...",
    startingQuickDownload: "Iniciando descarga rápida...",
    startingAudioExtraction: "Iniciando extracción de audio...",
    downloadCompleted: "¡Descarga completada!",
    errorDuringDownload: "Error al iniciar la descarga.",
    noConversion: "sin conversión",
    requiresConversion: "requiere conversión"
  },
  en: {
    fetchingInfo: "Fetching video information...",
    errorFetchingInfo: "Error fetching video information.",
    selectQuality: "Select a quality before downloading.",
    startingVideoConversion: "Starting video conversion...",
    startingQuickDownload: "Starting quick download...",
    startingAudioExtraction: "Starting audio extraction...",
    downloadCompleted: "Download completed!",
    errorDuringDownload: "Error starting the download.",
    noConversion: "no conversion",
    requiresConversion: "requires conversion"
  },
  zh: {
    fetchingInfo: "获取视频信息...",
    errorFetchingInfo: "获取视频信息时出错。",
    selectQuality: "下载前请选择质量。",
    startingVideoConversion: "开始视频转换...",
    startingQuickDownload: "开始快速下载...",
    startingAudioExtraction: "开始提取音频...",
    downloadCompleted: "下载完成！",
    errorDuringDownload: "开始下载时出错。",
    noConversion: "无需转换",
    requiresConversion: "需要转换"
  }
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

    // Separar formatos por si requieren o no conversión
    if (Array.isArray(data.formats)) {
      data.formats.forEach((format) => {
        const option = document.createElement('option');
        option.value = JSON.stringify(format);
        option.textContent = `${format.quality} - ${format.filesize} (${format.requires_merge ? t('requiresConversion') : t('noConversion')})`;
        qualitySelect.appendChild(option);
      });
    }
    videoPreview.classList.remove('hidden');
  } catch (error) {
    stopProcessing(error.message);
  }
});


// Manejo del evento para descargar el archivo seleccionado
downloadButton.addEventListener('click', async () => {
  const selectedOption = qualitySelect.value;
  const type = document.querySelector('input[name="type"]:checked').value;

  if (!selectedOption) {
    stopProcessing(t('selectQuality'));
    return;
  }

  const format = JSON.parse(selectedOption);

  if (type === 'video') {
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
        const response = await fetch(`${apiBaseUrl}/video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: videoUrl, direct_url: format.url }),
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
  } else if (type === 'audio') {
    // Descarga de solo audio
    startProcessing(t('startingAudioExtraction'));
    try {
      const response = await fetch(`${apiBaseUrl}/audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl }),
      });

      if (!response.ok) throw new Error(t('errorDuringDownload'));

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${videoTitle.textContent || 'audio'}.mp3`;
      link.click();

      stopProcessing(t('downloadCompleted'));
      resetForm();
    } catch (error) {
      stopProcessing(error.message);
    }
  }
});
