// routes/bmeReadingsRouter.js
const express = require('express');
const BmeReading = require('../models/BmeReading');

const router = express.Router();

// ====================== POST / ======================
// Crea una nueva lectura del BME680
// Body esperado:
// {
//   "deviceId": "esp32-bme-01",
//   "sensors": {
//     "temp_bme_c": 26.8,
//     "humidity_bme_pct": 45.1,
//     "pressure_hpa": 1012.3,
//     "gas_resistance_ohms": 123456.7
//   }
// }
router.post('/', async (req, res) => {
  try {
    const { deviceId, sensors } = req.body || {};
    const {
      temp_bme_c,
      humidity_bme_pct,
      pressure_hpa,
      gas_resistance_ohms,
    } = sensors || {};

    if (
      typeof deviceId !== 'string' ||
      typeof temp_bme_c !== 'number' ||
      typeof humidity_bme_pct !== 'number' ||
      typeof pressure_hpa !== 'number' ||
      typeof gas_resistance_ohms !== 'number'
    ) {
      return res.status(400).json({
        error: 'Datos inválidos en la lectura BME680',
      });
    }

    const reading = await BmeReading.create({
      deviceId,
      sensors: {
        temp_bme_c,
        humidity_bme_pct,
        pressure_hpa,
        gas_resistance_ohms,
      },
    });

    res.status(201).json(reading);
  } catch (err) {
    console.error('[BmeReadings POST] Error:', err);
    res.status(500).json({ error: 'Error al guardar lectura BME680' });
  }
});

// ====================== GET / =======================
// Lista lecturas (por defecto las últimas 100, ordenadas por fecha desc)
// /api/bme-readings?limit=50
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(
      parseInt(req.query.limit || '100', 10),
      500
    ); // máximo 500

    const readings = await BmeReading.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    res.json(readings);
  } catch (err) {
    console.error('[BmeReadings GET] Error:', err);
    res.status(500).json({ error: 'Error al obtener lecturas BME680' });
  }
});

// =================== GET /latest ====================
// Última lectura registrada
router.get('/latest', async (req, res) => {
  try {
    const latest = await BmeReading.findOne()
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!latest) {
      return res.status(404).json({ error: 'No hay lecturas BME680 aún' });
    }

    res.json(latest);
  } catch (err) {
    console.error('[BmeReadings GET /latest] Error:', err);
    res.status(500).json({ error: 'Error al obtener la última lectura BME680' });
  }
});

module.exports = router;
