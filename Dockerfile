# Usa Node.js 20 con soporte Debian
FROM node:20-bullseye

# Establecer una variable de entorno para evitar avisos interactivos en Debian
ENV DEBIAN_FRONTEND=noninteractive

# Actualiza el sistema y instala FFmpeg y curl
RUN apt-get update && apt-get install -y ffmpeg curl && rm -rf /var/lib/apt/lists/*

# Crea un usuario sin privilegios para mayor seguridad
RUN useradd -m appuser
USER appuser

# Crea un directorio de trabajo
WORKDIR /app

# Copia solo los archivos esenciales para aprovechar la caché
COPY --chown=appuser:appuser package*.json ./

# Instala las dependencias del proyecto, ignorando scripts para evitar errores en `postinstall.js`
RUN npm ci --only=production --ignore-scripts

# Copia todos los archivos del proyecto al contenedor
COPY --chown=appuser:appuser . .

# Ejecuta manualmente el script `postinstall.js` si es necesario
RUN node node_modules/youtube-dl-exec/scripts/postinstall.js || true

# Crea el directorio de descargas con los permisos correctos
RUN mkdir -p /app/downloads

# Establece la variable de entorno para producción
ENV NODE_ENV=production

# Expone el puerto de la aplicación
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "server.js"]
