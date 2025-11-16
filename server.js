// server.js
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const readingsRouter = require('./routes/readings');

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/esp32_sensors_db';

// Middlewares
app.use(cors());
app.use(express.json()); // para leer JSON del ESP32

// Healthcheck básico
app.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'ESP32 Sensors API funcionando'
  });
});

// Rutas
app.use('/api/readings', readingsRouter);

// Conexión a Mongo y arranque del server
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('Conectado a MongoDB:', MONGODB_URI);
    app.listen(PORT, () => {
      console.log(`Servidor escuchando en http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error al conectar a MongoDB:', err);
    process.exit(1);
  });
