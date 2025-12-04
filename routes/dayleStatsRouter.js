// routes/dayleStatsRouter.js
// Router para resúmenes DIARIOS de los sensores (BME680 y DHT+Luz)

const express = require('express');
const BmeReading = require('../models/BmeReading');
const DhtLightReading = require('../models/DhtLightReading');

const router = express.Router();

// ===================== RANGOS RECOMENDADOS =====================
// Si tu profe da otros valores, cámbialos aquí y listo.
const RANGES = {
  temperature: { min: 23, max: 27 }, // °C  (ASHRAE para aulas)
  humidity: { min: 40, max: 60 },    // %   (ASHRAE)
  light: { min: 300, max: 500 }      // lux (ISO 8995 para aulas)
};

// Clasificación simple usando los rangos anteriores
function classifyRange(value, { min, max }) {
  if (value == null || Number.isNaN(value)) return 'sin_datos';
  if (value < min) return 'bajo';
  if (value > max) return 'alto';
  return 'en_rango';
}

/**
 * Utilidad para construir el filtro de fechas a partir de query params.
 * Espera start y end en formato YYYY-MM-DD (o cualquier fecha válida para new Date()).
 */
function buildDateMatch(start, end) {
  const match = {};
  if (start || end) {
    match.createdAt = {};
    if (start) match.createdAt.$gte = new Date(start);
    if (end) match.createdAt.$lte = new Date(end);
  }
  return match;
}

// ======================================================================
//  GET /api/dayle-stats/daily-bme
//  Resumen diario BME680: temperatura, humedad y presión
//  Query opcional: ?start=2025-11-01&end=2025-11-30
// ======================================================================
router.get('/daily-bme', async (req, res) => {
  try {
    const { start, end } = req.query;
    const match = buildDateMatch(start, end);

    const pipeline = [
      { $match: match },
      {
        $addFields: {
          day: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: 'America/Mexico_City'
            }
          }
        }
      },
      {
        $group: {
          _id: '$day',
          count: { $sum: 1 },

          tempMin: { $min: '$sensors.temp_bme_c' },
          tempMax: { $max: '$sensors.temp_bme_c' },
          tempAvg: { $avg: '$sensors.temp_bme_c' },

          humMin: { $min: '$sensors.humidity_bme_pct' },
          humMax: { $max: '$sensors.humidity_bme_pct' },
          humAvg: { $avg: '$sensors.humidity_bme_pct' },

          pressMin: { $min: '$sensors.pressure_hpa' },
          pressMax: { $max: '$sensors.pressure_hpa' },
          pressAvg: { $avg: '$sensors.pressure_hpa' }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const raw = await BmeReading.aggregate(pipeline);

    const data = raw.map((d) => {
      const tempStatus = classifyRange(d.tempAvg, RANGES.temperature);
      const humStatus = classifyRange(d.humAvg, RANGES.humidity);

      return {
        date: d._id,
        count: d.count,

        temperature: {
          min: d.tempMin,
          max: d.tempMax,
          avg: d.tempAvg,
          status: tempStatus
        },
        humidity: {
          min: d.humMin,
          max: d.humMax,
          avg: d.humAvg,
          status: humStatus
        },
        pressure: {
          min: d.pressMin,
          max: d.pressMax,
          avg: d.pressAvg
        }
      };
    });

    res.json({ ok: true, data });
  } catch (error) {
    console.error('Error en GET /api/dayle-stats/daily-bme:', error);
    res
      .status(500)
      .json({ ok: false, message: 'Error generando resumen diario BME680' });
  }
});

// ======================================================================
//  GET /api/dayle-stats/daily-dht-light
//  Resumen diario DHT22 + BH1750: temperatura, humedad e iluminación
//  Query opcional: ?start=2025-11-01&end=2025-11-30
// ======================================================================
router.get('/daily-dht-light', async (req, res) => {
  try {
    const { start, end } = req.query;
    const match = buildDateMatch(start, end);

    const pipeline = [
      { $match: match },
      {
        $addFields: {
          day: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: 'America/Mexico_City'
            }
          }
        }
      },
      {
        $group: {
          _id: '$day',
          count: { $sum: 1 },

          tempMin: { $min: '$sensors.temp_dht_c' },
          tempMax: { $max: '$sensors.temp_dht_c' },
          tempAvg: { $avg: '$sensors.temp_dht_c' },

          humMin: { $min: '$sensors.humidity_pct' },
          humMax: { $max: '$sensors.humidity_pct' },
          humAvg: { $avg: '$sensors.humidity_pct' },

          lightMin: { $min: '$sensors.light_lux' },
          lightMax: { $max: '$sensors.light_lux' },
          lightAvg: { $avg: '$sensors.light_lux' }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const raw = await DhtLightReading.aggregate(pipeline);

    const data = raw.map((d) => {
      const tempStatus = classifyRange(d.tempAvg, RANGES.temperature);
      const humStatus = classifyRange(d.humAvg, RANGES.humidity);
      const lightStatus = classifyRange(d.lightAvg, RANGES.light);

      return {
        date: d._id,
        count: d.count,

        temperature: {
          min: d.tempMin,
          max: d.tempMax,
          avg: d.tempAvg,
          status: tempStatus
        },
        humidity: {
          min: d.humMin,
          max: d.humMax,
          avg: d.humAvg,
          status: humStatus
        },
        light: {
          min: d.lightMin,
          max: d.lightMax,
          avg: d.lightAvg,
          status: lightStatus
        }
      };
    });

    res.json({ ok: true, data });
  } catch (error) {
    console.error('Error en GET /api/dayle-stats/daily-dht-light:', error);
    res.status(500).json({
      ok: false,
      message: 'Error generando resumen diario DHT + Luz'
    });
  }
});

module.exports = router;
