// routes/statsRouter.js
const express = require('express');
const BmeReading = require('../models/BmeReading');
const DhtLightReading = require('../models/DhtLightReading');

const router = express.Router();

// ====================== RANGOS RECOMENDADOS ======================
// Estos rangos vienen de recomendaciones generales (ASHRAE / OMS / ISO).
// Si el profe te da otros, solo modificas aquí.

const RANGES = {
  temperature: { min: 23, max: 27 },   // °C
  humidity: { min: 40, max: 60 },      // %
  light: { min: 300, max: 500 }        // lux
};

function classifyRange(value, { min, max }) {
  if (value == null || Number.isNaN(value)) return { status: 'sin_dato', ok: false };

  if (value < min) return { status: 'bajo', ok: false };
  if (value > max) return { status: 'alto', ok: false };
  return { status: 'dentro', ok: true };
}

function parseDateOrDefault(value, fallback) {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
}

// =================================================================
// GET /api/stats/current
// Devuelve la última lectura de ambos sensores + evaluación de rangos
// =================================================================
router.get('/current', async (req, res) => {
  try {
    const [bmeLatest, dhtLatest] = await Promise.all([
      BmeReading.findOne().sort({ createdAt: -1 }).lean().exec(),
      DhtLightReading.findOne().sort({ createdAt: -1 }).lean().exec()
    ]);

    if (!bmeLatest && !dhtLatest) {
      return res.status(404).json({ error: 'No hay lecturas aún' });
    }

    // Tomamos BME como referencia "oficial" de temp/humedad
    const tempBme = bmeLatest?.sensors?.temp_bme_c ?? null;
    const humBme = bmeLatest?.sensors?.humidity_bme_pct ?? null;
    const lux = dhtLatest?.sensors?.light_lux ?? null;
    const pressure = bmeLatest?.sensors?.pressure_hpa ?? null;

    const tempEval = classifyRange(tempBme, RANGES.temperature);
    const humEval = classifyRange(humBme, RANGES.humidity);
    const lightEval = classifyRange(lux, RANGES.light);

    res.json({
      sources: {
        bmeLatest,
        dhtLatest
      },
      derived: {
        temperature: {
          value: tempBme,
          unit: '°C',
          ...tempEval
        },
        humidity: {
          value: humBme,
          unit: '%',
          ...humEval
        },
        light: {
          value: lux,
          unit: 'lux',
          ...lightEval
        },
        pressure: {
          value: pressure,
          unit: 'hPa'
        }
      }
    });
  } catch (err) {
    console.error('[Stats GET /current] Error:', err);
    res.status(500).json({ error: 'Error al obtener stats actuales' });
  }
});

// =================================================================
// GET /api/stats/daily
// Estadísticas diarias (promedios, mínimos, máximos) BME + DHT+Luz
// Parámetros opcionales: ?from=YYYY-MM-DD&to=YYYY-MM-DD
// =================================================================
router.get('/daily', async (req, res) => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // últimos 7 días

    const from = parseDateOrDefault(req.query.from, defaultFrom);
    const to = parseDateOrDefault(req.query.to, now);

    // Ajustamos "to" al final del día
    to.setHours(23, 59, 59, 999);

    const dateAddFields = {
      date: {
        $dateToString: {
          format: '%Y-%m-%d',
          date: '$createdAt'
        }
      }
    };

    const bmePipeline = [
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $addFields: dateAddFields },
      {
        $group: {
          _id: '$date',
          avgTemp: { $avg: '$sensors.temp_bme_c' },
          minTemp: { $min: '$sensors.temp_bme_c' },
          maxTemp: { $max: '$sensors.temp_bme_c' },
          avgHum: { $avg: '$sensors.humidity_bme_pct' },
          minHum: { $min: '$sensors.humidity_bme_pct' },
          maxHum: { $max: '$sensors.humidity_bme_pct' },
          avgPress: { $avg: '$sensors.pressure_hpa' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const dhtPipeline = [
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $addFields: dateAddFields },
      {
        $group: {
          _id: '$date',
          avgTemp: { $avg: '$sensors.temp_dht_c' },
          minTemp: { $min: '$sensors.temp_dht_c' },
          maxTemp: { $max: '$sensors.temp_dht_c' },
          avgHum: { $avg: '$sensors.humidity_pct' },
          minHum: { $min: '$sensors.humidity_pct' },
          maxHum: { $max: '$sensors.humidity_pct' },
          avgLux: { $avg: '$sensors.light_lux' },
          minLux: { $min: '$sensors.light_lux' },
          maxLux: { $max: '$sensors.light_lux' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const [bmeDaily, dhtDaily] = await Promise.all([
      BmeReading.aggregate(bmePipeline).exec(),
      DhtLightReading.aggregate(dhtPipeline).exec()
    ]);

    res.json({
      range: {
        from,
        to
      },
      bme: bmeDaily,
      dhtLight: dhtDaily
    });
  } catch (err) {
    console.error('[Stats GET /daily] Error:', err);
    res.status(500).json({ error: 'Error al obtener stats diarias' });
  }
});

// =================================================================
// GET /api/stats/compliance
// Porcentaje de lecturas que cumplen con rangos recomendados
// Parámetros opcionales: ?from=YYYY-MM-DD&to=YYYY-MM-DD
// =================================================================
router.get('/compliance', async (req, res) => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const from = parseDateOrDefault(req.query.from, defaultFrom);
    const to = parseDateOrDefault(req.query.to, now);
    to.setHours(23, 59, 59, 999);

    // ----------- Temp/Humedad (BME) -----------
    const bmePipeline = [
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $project: {
          temp: '$sensors.temp_bme_c',
          hum: '$sensors.humidity_bme_pct'
        }
      },
      {
        $project: {
          temp: 1,
          hum: 1,
          isTempOk: {
            $and: [
              { $gte: ['$temp', RANGES.temperature.min] },
              { $lte: ['$temp', RANGES.temperature.max] }
            ]
          },
          isHumOk: {
            $and: [
              { $gte: ['$hum', RANGES.humidity.min] },
              { $lte: ['$hum', RANGES.humidity.max] }
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          tempOkCount: { $sum: { $cond: ['$isTempOk', 1, 0] } },
          humOkCount: { $sum: { $cond: ['$isHumOk', 1, 0] } },
          bothOkCount: {
            $sum: {
              $cond: [
                { $and: ['$isTempOk', '$isHumOk'] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          tempOkPct: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $multiply: [{ $divide: ['$tempOkCount', '$total'] }, 100] }
            ]
          },
          humOkPct: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $multiply: [{ $divide: ['$humOkCount', '$total'] }, 100] }
            ]
          },
          bothOkPct: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $multiply: [{ $divide: ['$bothOkCount', '$total'] }, 100] }
            ]
          }
        }
      }
    ];

    // ----------- Iluminación (DHT+Luz) -----------
    const lightPipeline = [
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $project: {
          lux: '$sensors.light_lux',
          isLightOk: {
            $and: [
              { $gte: ['$sensors.light_lux', RANGES.light.min] },
              { $lte: ['$sensors.light_lux', RANGES.light.max] }
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          lightOkCount: { $sum: { $cond: ['$isLightOk', 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          lightOkPct: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $multiply: [{ $divide: ['$lightOkCount', '$total'] }, 100] }
            ]
          }
        }
      }
    ];

    const [bmeComplianceArr, lightComplianceArr] = await Promise.all([
      BmeReading.aggregate(bmePipeline).exec(),
      DhtLightReading.aggregate(lightPipeline).exec()
    ]);

    const bmeCompliance = bmeComplianceArr[0] || null;
    const lightCompliance = lightComplianceArr[0] || null;

    res.json({
      range: { from, to },
      temperatureHumidity: bmeCompliance,
      light: lightCompliance
    });
  } catch (err) {
    console.error('[Stats GET /compliance] Error:', err);
    res.status(500).json({ error: 'Error al obtener cumplimiento de rangos' });
  }
});

module.exports = router;
