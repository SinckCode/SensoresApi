// routes/readings.js
const express = require('express');
const router = express.Router();
const Reading = require('../models/Reading');

// ====== Helper: nivel de luz a partir de light_raw ======
function getLightLevel(lightRaw) {
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

// ====== POST /api/readings  (Registrar lectura) ======
router.post('/', async (req, res) => {
  try {
    let { deviceId, sensors } = req.body;

    if (!deviceId || !sensors) {
      return res.status(400).json({
        ok: false,
        message: 'Faltan campos: deviceId o sensors'
      });
    }

    // Normalizamos el deviceId
    deviceId = String(deviceId).trim().toLowerCase();

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

    // Validación rápida de tipos
    if (typeof sensors.light_raw !== 'number') {
      return res.status(400).json({
        ok: false,
        message: 'sensors.light_raw debe ser numérico'
      });
    }

    // Calculamos el nivel de luz en texto
    const lightLevel = getLightLevel(sensors.light_raw);

    const reading = new Reading({
      deviceId,
      sensors: {
        ...sensors,
        light_level: lightLevel
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

// ====== GET /api/readings/last?deviceId=esp32-node-01 ======
router.get('/last', async (req, res) => {
  try {
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({
        ok: false,
        message: 'Parámetro deviceId es requerido'
      });
    }

    const normalizedId = String(deviceId).trim().toLowerCase();

    const lastReading = await Reading
      .findOne({ deviceId: normalizedId })
      .sort({ createdAt: -1 });

    if (!lastReading) {
      return res.status(404).json({
        ok: false,
        message: `No hay lecturas para el dispositivo ${normalizedId}`
      });
    }

    return res.json({
      ok: true,
      data: lastReading
    });
  } catch (error) {
    console.error('Error en GET /api/readings/last:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error interno del servidor'
    });
  }
});

// ====== GET /api/readings  (Histórico con filtros) ======
// Ejemplos:
//   /api/readings?deviceId=esp32-node-01&limit=50
//   /api/readings?deviceId=esp32-node-01&from=2025-11-18&to=2025-11-19
router.get('/', async (req, res) => {
  try {
    const {
      deviceId,
      from,       // fecha inicio (ISO, ej: 2025-11-18)
      to,         // fecha fin
      page = 1,
      limit = 50
    } = req.query;

    const query = {};
    if (deviceId) {
      query.deviceId = String(deviceId).trim().toLowerCase();
    }

    if (from || to) {
      query.createdAt = {};
      if (from) {
        query.createdAt.$gte = new Date(from);
      }
      if (to) {
        // Sumamos 1 día para incluir "todo el día"
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1);
        query.createdAt.$lt = toDate;
      }
    }

    const numericLimit = Math.min(parseInt(limit, 10) || 50, 200);
    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (numericPage - 1) * numericLimit;

    const [total, readings] = await Promise.all([
      Reading.countDocuments(query),
      Reading
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numericLimit)
    ]);

    return res.json({
      ok: true,
      data: readings,
      meta: {
        total,
        page: numericPage,
        limit: numericLimit,
        totalPages: Math.ceil(total / numericLimit)
      }
    });
  } catch (error) {
    console.error('Error en GET /api/readings:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;
