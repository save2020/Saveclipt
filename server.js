const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const infoRoutes = require('./routes/info');
const audioRoutes = require('./routes/audio');
const videoRoutes = require('./routes/video');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Registrar las rutas
app.use('/api', infoRoutes); // Manejo de información del video
app.use('/api', audioRoutes); // Manejo de audio
app.use('/api', videoRoutes); // Manejo de videos

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
