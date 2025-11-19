// routes/readings.js
const express = require('express');
const router = express.Router();
const Reading = require('../models/Reading');

// Función helper para traducir el valor de light_raw a texto
function getLightLevel(lightRaw) {
  // Ajusta estos rangos como tú quieras según tus pruebas.
  if (lightRaw < 500) {
    return 'muy oscuro';
  } else if (lightRaw < 1200) {
    return 'oscuro';
  } else if (lightRaw < 2200) {
    return 'poco iluminado';
  } else if (lightRaw < 3200) {
    return 'bien iluminado';
  } else {
    return 'muy iluminado';
  }
}

// POST /api/readings
router.post('/', async (req, res) => {
  try {
    const { deviceId, sensors } = req.body;

    if (!deviceId || !sensors) {
      return res.status(400).json({
        ok: false,
        message: 'Faltan campos: deviceId o sensors'
      });
    }

    const requiredFields = [
      'temp_dht_c',
      'humidity_pct',
      'light_raw',
      'light_state'
    ];

    for (const field of requiredFields) {
      if (typeof sensors[field] === 'undefined') {
        return res.status(400).json({
          ok: false,
          message: `Falta el campo sensors.${field}`
        });
      }
    }

    // Calculamos el nivel de luz en texto
    const lightLevel = getLightLevel(sensors.light_raw);

    const reading = new Reading({
      deviceId,
      sensors: {
        ...sensors,
        light_level: lightLevel   // 👈 aquí agregamos el texto
      }
    });

    const saved = await reading.save();

    return res.status(201).json({
      ok: true,
      message: 'Lectura guardada correctamente',
      data: saved
    });
  } catch (error) {
    console.error('Error en POST /api/readings:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error interno del servidor'
    });
  }
});

// NO OLVIDAR exportar
module.exports = router;
