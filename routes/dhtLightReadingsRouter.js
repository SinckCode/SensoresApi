// routes/dhtLightReadingsRouter.js
const express = require('express');
const DhtLightReading = require('../models/DhtLightReading');

const router = express.Router();

// ================= UMBRALES DE LUZ =================
// Ajusta estos valores si en tu salón/ambiente ves que no cuadran
const LIGHT_THRESHOLDS = {
  VERY_DARK: 10,    // < 10 lux
  DARK: 50,         // 10–50 lux
  DIM: 200,         // 50–200 lux
  BRIGHT: 1000      // 200–1000 lux, >1000 muy iluminado
};

function classifyLightLevel(lux) {
  if (lux < LIGHT_THRESHOLDS.VERY_DARK) {
    return 'muy oscuro';
  } else if (lux < LIGHT_THRESHOLDS.DARK) {
    return 'oscuro';
  } else if (lux < LIGHT_THRESHOLDS.DIM) {
    return 'poco iluminado';
  } else if (lux < LIGHT_THRESHOLDS.BRIGHT) {
    return 'bien iluminado';
  } else {
    return 'muy iluminado';
  }
}

// ====================== POST / ======================
// Crea una nueva lectura de DHT + Luz
// Body esperado:
// {
//   "deviceId": "esp32-dht-light-01",
//   "sensors": {
//     "temp_dht_c": 27.2,
//     "humidity_pct": 47.3,
//     "light_lux": 120.5
//   }
// }
router.post('/', async (req, res) => {
  try {
    const { deviceId, sensors } = req.body || {};
    const { temp_dht_c, humidity_pct, light_lux } = sensors || {};

    // Validación básica
    if (
      typeof deviceId !== 'string' ||
      typeof temp_dht_c !== 'number' ||
      typeof humidity_pct !== 'number' ||
      typeof light_lux !== 'number' ||
      light_lux < 0
    ) {
      return res.status(400).json({
        error: 'Datos inválidos en la lectura DHT+Luz',
      });
    }

    const light_level = classifyLightLevel(light_lux);

    const reading = await DhtLightReading.create({
      deviceId,
      sensors: {
        temp_dht_c,
        humidity_pct,
        light_lux,
        light_level,
      },
    });

    res.status(201).json(reading);
  } catch (err) {
    console.error('[DhtLightReadings POST] Error:', err);
    res.status(500).json({ error: 'Error al guardar lectura DHT+Luz' });
  }
});

// ====================== GET / =======================
// Lista lecturas (por defecto las últimas 100, ordenadas por fecha desc)
// /api/dht-light-readings?limit=50
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(
      parseInt(req.query.limit || '100', 10),
      500
    ); // máximo 500

    const readings = await DhtLightReading.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    res.json(readings);
  } catch (err) {
    console.error('[DhtLightReadings GET] Error:', err);
    res.status(500).json({ error: 'Error al obtener lecturas DHT+Luz' });
  }
});

// =================== GET /latest ====================
// Última lectura registrada
router.get('/latest', async (req, res) => {
  try {
    const latest = await DhtLightReading.findOne()
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!latest) {
      return res.status(404).json({ error: 'No hay lecturas DHT+Luz aún' });
    }

    res.json(latest);
  } catch (err) {
    console.error('[DhtLightReadings GET /latest] Error:', err);
    res.status(500).json({ error: 'Error al obtener la última lectura DHT+Luz' });
  }
});

module.exports = router;
