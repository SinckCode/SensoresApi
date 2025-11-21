// models/DhtLightReading.js
const mongoose = require('mongoose');

// Subdocumento con los datos de los sensores DHT + Luz
const DhtLightSensorSchema = new mongoose.Schema(
  {
    // === DHT22 ===
    temp_dht_c: {
      type: Number,
      required: true,
      // opcional: rangos típicos
      // min: -40,
      // max: 125,
    },
    humidity_pct: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    // === Luz (BH1750 u otro en lux) ===
    light_lux: {
      type: Number,
      required: true,
      min: 0,
    },

    // Nivel de luz interpretado por la API
    light_level: {
      type: String,
      required: true,
      enum: [
        'muy oscuro',
        'oscuro',
        'poco iluminado',
        'bien iluminado',
        'muy iluminado',
      ],
    },
  },
  { _id: false } // no queremos _id separado para este subdoc
);

// Documento principal: cada lectura
const DhtLightReadingSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    sensors: {
      type: DhtLightSensorSchema,
      required: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: 'dhtLightReadings',
  }
);

module.exports = mongoose.model('DhtLightReading', DhtLightReadingSchema);
