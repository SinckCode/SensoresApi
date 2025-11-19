// routes/readings.js
const express = require('express');
const router = express.Router();
const Reading = require('../models/Reading');

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
      // 'temp_lm35_c',     // <-- ELIMINADO
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

    const reading = new Reading({
      deviceId,
      sensors
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

module.exports = router;
