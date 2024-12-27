# Usa una imagen base de Node.js con soporte de Debian
FROM node:18-bullseye

# Instala FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Instala yt-dlp (si es necesario)
RUN apt-get install -y python3-pip && pip3 install --upgrade yt-dlp

# Crea un directorio de trabajo
WORKDIR /app

# Copia solo los archivos esenciales para instalar dependencias primero (para aprovechar la cache)
COPY package*.json ./

# Instala las dependencias del proyecto
RUN npm install

# Copia todos los archivos del proyecto al contenedor
COPY . .

# Asegúrate de que los directorios de idiomas están en la carpeta `public`
# Ejemplo: public/en, public/es, public/chino
# Si ya están organizados en el proyecto local, no es necesario copiarlos manualmente

# Expone el puerto (Render usará esta configuración)
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "server.js"]
