// routes/readings.js
const express = require('express');
const router = express.Router();
const Reading = require('../models/Reading');

// POST /api/readings
// Guarda una nueva lectura enviada por el ESP32
router.post('/', async (req, res) => {
  try {
    const { deviceId, sensors } = req.body;

    // Validación básica
    if (!deviceId || !sensors) {
      return res.status(400).json({
        ok: false,
        message: 'Faltan campos: deviceId o sensors'
      });
    }

    const requiredFields = [
      'temp_dht_c',
      'humidity_pct',
      'temp_lm35_c',
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
      // createdAt se autogenera
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

// GET /api/readings
// Opcional: listar las últimas N lecturas (default 50)
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);

    const readings = await Reading.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({
      ok: true,
      count: readings.length,
      data: readings
    });
  } catch (error) {
    console.error('Error en GET /api/readings:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/readings/:deviceId
// Obtiene lecturas de un dispositivo específico
router.get('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const limit = parseInt(req.query.limit || '50', 10);

    const readings = await Reading.find({ deviceId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({
      ok: true,
      deviceId,
      count: readings.length,
      data: readings
    });
  } catch (error) {
    console.error('Error en GET /api/readings/:deviceId:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;
