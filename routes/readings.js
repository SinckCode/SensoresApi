// routes/readings.js
const express = require('express');
const router = express.Router();
const Reading = require('../models/Reading');

// ====== Umbrales de luz para BH1750 (lux) ======
//
// <   5  → muy oscuro         (noche casi total, solo luna)
// <  50  → oscuro             (calle poco iluminada, pasillo)
// < 200  → poco iluminado     (sala, ambiente relajado)
// < 700  → bien iluminado     (aula, oficina típica)
// >=700  → muy iluminado      (cerca de ventana, exterior nublado, sol indirecto)
const LIGHT_THRESHOLDS = {
  VERY_DARK: 5,   // < 5   → muy oscuro
  DARK: 50,       // < 50  → oscuro
  DIM: 200,       // < 200 → poco iluminado
  BRIGHT: 700     // < 700 → bien iluminado
  // >= 700        → muy iluminado
};

function getLightLevel(lightLux) {
  if (lightLux < LIGHT_THRESHOLDS.VERY_DARK) {
    return 'muy oscuro';
  } else if (lightLux < LIGHT_THRESHOLDS.DARK) {
    return 'oscuro';
  } else if (lightLux < LIGHT_THRESHOLDS.DIM) {
    return 'poco iluminado';
  } else if (lightLux < LIGHT_THRESHOLDS.BRIGHT) {
    return 'bien iluminado';
  } else {
    return 'muy iluminado';
  }
}

// 0 = oscuro, 1 = iluminado
function getLightState(lightLux) {
  // A partir de "poco iluminado" lo consideramos iluminado
  return lightLux >= LIGHT_THRESHOLDS.DIM ? 1 : 0;
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

    // Campos que DEBE mandar el ESP32 ahora:
    const requiredFields = [
      'temp_dht_c',
      'humidity_pct',
      'temp_bme_c',
      'humidity_bme_pct',
      'pressure_hpa',
      'gas_resistance_ohms',
      'light_lux' // BH1750 en lux
    ];

    for (const field of requiredFields) {
      if (typeof sensors[field] === 'undefined') {
        return res.status(400).json({
          ok: false,
          message: `Falta el campo sensors.${field}`
        });
      }
    }

    // Validación rápida de tipos numéricos
    const numericFields = [
      'temp_dht_c',
      'humidity_pct',
      'temp_bme_c',
      'humidity_bme_pct',
      'pressure_hpa',
      'gas_resistance_ohms',
      'light_lux'
    ];

    for (const field of numericFields) {
      if (typeof sensors[field] !== 'number') {
        return res.status(400).json({
          ok: false,
          message: `sensors.${field} debe ser numérico`
        });
      }
    }

    const lightLux = sensors.light_lux;
    const lightLevel = getLightLevel(lightLux);
    const lightState = getLightState(lightLux);

    const reading = new Reading({
      deviceId,
      sensors: {
        temp_dht_c: sensors.temp_dht_c,
        humidity_pct: sensors.humidity_pct,
        temp_bme_c: sensors.temp_bme_c,
        humidity_bme_pct: sensors.humidity_bme_pct,
        pressure_hpa: sensors.pressure_hpa,
        gas_resistance_ohms: sensors.gas_resistance_ohms,
        light_lux: lightLux,
        light_state: lightState,
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
