const infoForm = document.getElementById('infoForm');
const videoUrlInput = document.getElementById('videoUrl');
const videoPreview = document.getElementById('videoPreview');
const videoTitle = document.getElementById('videoTitle');
const videoThumbnail = document.getElementById('videoThumbnail');
const qualitySelect = document.getElementById('qualitySelect');
const downloadButton = document.getElementById('downloadButton');
const statusMessage = document.getElementById('status');

let videoUrl = '';

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
  },
  pt: {
    fetchingInfo: "Obtendo informações do vídeo...",
    errorFetchingInfo: "Erro ao obter informações do vídeo.",
    selectQuality: "Selecione uma qualidade antes de baixar.",
    startingVideoConversion: "Iniciando conversão de vídeo...",
    startingQuickDownload: "Iniciando download rápido...",
    startingAudioExtraction: "Iniciando extração de áudio...",
    downloadCompleted: "Download concluído!",
    errorDuringDownload: "Erro ao iniciar o download.",
    noConversion: "sem conversão",
    requiresConversion: "requer conversão"
  },
  fr: {
    fetchingInfo: "Récupération des informations de la vidéo...",
    errorFetchingInfo: "Erreur lors de la récupération des informations de la vidéo.",
    selectQuality: "Sélectionnez une qualité avant de télécharger.",
    startingVideoConversion: "Début de la conversion vidéo...",
    startingQuickDownload: "Début du téléchargement rapide...",
    startingAudioExtraction: "Début de l'extraction audio...",
    downloadCompleted: "Téléchargement terminé !",
    errorDuringDownload: "Erreur lors du démarrage du téléchargement.",
    noConversion: "pas de conversion",
    requiresConversion: "nécessite une conversion"
  },
  de: {
    fetchingInfo: "Video-Informationen werden abgerufen...",
    errorFetchingInfo: "Fehler beim Abrufen der Video-Informationen.",
    selectQuality: "Wählen Sie eine Qualität vor dem Herunterladen.",
    startingVideoConversion: "Video-Konvertierung starten...",
    startingQuickDownload: "Schnell-Download starten...",
    startingAudioExtraction: "Audio-Extraktion starten...",
    downloadCompleted: "Download abgeschlossen!",
    errorDuringDownload: "Fehler beim Starten des Downloads.",
    noConversion: "keine Konvertierung",
    requiresConversion: "erfordert Konvertierung"
  },
  ar: {
    fetchingInfo: "جارٍ الحصول على معلومات الفيديو...",
    errorFetchingInfo: "حدث خطأ أثناء الحصول على معلومات الفيديو.",
    selectQuality: "اختر الجودة قبل التنزيل.",
    startingVideoConversion: "بدء تحويل الفيديو...",
    startingQuickDownload: "بدء التنزيل السريع...",
    startingAudioExtraction: "بدء استخراج الصوت...",
    downloadCompleted: "اكتمل التنزيل!",
    errorDuringDownload: "حدث خطأ أثناء بدء التنزيل.",
    noConversion: "بدون تحويل",
    requiresConversion: "يتطلب تحويل"
  },
  hi: {
    fetchingInfo: "वीडियो जानकारी प्राप्त की जा रही है...",
    errorFetchingInfo: "वीडियो जानकारी प्राप्त करने में त्रुटि।",
    selectQuality: "डाउनलोड करने से पहले गुणवत्ता चुनें।",
    startingVideoConversion: "वीडियो रूपांतरण शुरू हो रहा है...",
    startingQuickDownload: "त्वरित डाउनलोड शुरू हो रहा है...",
    startingAudioExtraction: "ऑडियो निकालना शुरू हो रहा है...",
    downloadCompleted: "डाउनलोड पूरा हुआ!",
    errorDuringDownload: "डाउनलोड शुरू करने में त्रुटि।",
    noConversion: "कोई रूपांतरण नहीं",
    requiresConversion: "रूपांतरण की आवश्यकता है"
  }
};

// Determinar el idioma actual
const userLang = navigator.language.slice(0, 2); // Extraer los primeros 2 caracteres del idioma

// Función para obtener el mensaje traducido
function t(key) {
  return translations[userLang]?.[key] || translations['en'][key] || key;
}

// Función para limpiar la vista previa y reiniciar el formulario
function resetForm() {
  videoUrl = '';
  videoUrlInput.value = '';
  videoTitle.textContent = '';
  videoThumbnail.src = '';
  videoPreview.classList.add('hidden');
  qualitySelect.innerHTML = '';
  statusMessage.textContent = '';
  statusMessage.classList.remove('processing'); // Asegura que se elimine la animación
}

// Función para iniciar la animación del estado
function startProcessing(message) {
  statusMessage.textContent = message;
  statusMessage.classList.add('processing');
}

// Función para detener la animación del estado
function stopProcessing(message) {
  statusMessage.textContent = message;
  statusMessage.classList.remove('processing');
}

// Manejo del evento para obtener información del video
infoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  videoUrl = videoUrlInput.value;

  startProcessing(t('fetchingInfo'));

  try {
    const response = await fetch('/api/info', {
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

    if (Array.isArray(data.formats)) {
      data.formats.forEach((format) => {
        const option = document.createElement('option');
        option.value = JSON.stringify(format);
        option.textContent = `${format.quality} - ${format.filesize} (${t('noConversion')})`;
        qualitySelect.appendChild(option);
      });
    } else {
      if (data.formats.no_merge) {
        const noMergeGroup = document.createElement('optgroup');
        noMergeGroup.label = t('noConversion');
        data.formats.no_merge.forEach((format) => {
          const option = document.createElement('option');
          option.value = JSON.stringify(format);
          option.textContent = `${format.quality} - ${format.filesize} (${t('noConversion')})`;
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
          option.textContent = `${format.quality} - ${format.filesize} (${t('requiresConversion')})`;
          requiresMergeGroup.appendChild(option);
        });
        qualitySelect.appendChild(requiresMergeGroup);
      }
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
      startProcessing(t('startingVideoConversion'));
      try {
        const response = await fetch('/api/video', {
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
      startProcessing(t('startingQuickDownload'));
      try {
        const link = document.createElement('a');
        link.href = format.url;
        link.download = `${videoTitle.textContent}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        stopProcessing(t('downloadCompleted'));
        resetForm();
      } catch (error) {
        stopProcessing(t('errorDuringDownload'));
      }
    }
  } else if (type === 'audio') {
    startProcessing(t('startingAudioExtraction'));
    try {
      const response = await fetch('/api/audio', {
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
