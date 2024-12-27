# Usa una imagen base de Node.js con soporte de Debian
FROM node:16-bullseye

# Instala FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Crea un directorio de trabajo
WORKDIR /app

# Copia los archivos del proyecto al contenedor
COPY . .

# Instala las dependencias del proyecto
RUN npm install

# Expone el puerto (Render usará esta configuración)
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "server.js"]

