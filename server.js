const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Importar las rutas de la API
const infoRoutes = require('./routes/info');
const audioRoutes = require('./routes/audio');
const videoRoutes = require('./routes/video');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Rutas estáticas para los idiomas
app.use('/en', express.static(path.join(__dirname, 'public/en')));
app.use('/es', express.static(path.join(__dirname, 'public/es')));
app.use('/es', express.static(path.join(__dirname, 'public/chino')));

// Rutas amigables para las páginas principales
app.get('/es', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/es/esindex.html'));
});

app.get('/en', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/en/enindex.html'));
});

app.get('/chino', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/chino/chinoindex.html'));
});

// Rutas amigables para políticas y términos
app.get('/es/politicas-de-privacidad', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/es/espoliticas-de-privacidad.html'));
});

app.get('/es/terminos-y-condiciones', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/es/esterminos-y-condiciones.html'));
});

app.get('/en/privacy-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/en/enprivacy-policy.html'));
});

app.get('/en/terms-and-conditions', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/en/enterms-and-conditions.html'));
});

app.get('/chino/chinopriva', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/chino/chinopriva.html'));
});

app.get('/chino/chinoter', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/chino/chinoter.html'));
});

// Rutas de la API
app.use('/api', infoRoutes); // Manejo de información del video
app.use('/api', audioRoutes); // Manejo de audio
app.use('/api', videoRoutes); // Manejo de videos

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
