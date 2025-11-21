// models/BmeReading.js
const mongoose = require('mongoose');

// Subdocumento con los datos del BME680
const BmeSensorSchema = new mongoose.Schema(
  {
    temp_bme_c: {
      type: Number,
      required: true,
      // min/max opcionales
      // min: -40,
      // max: 85,
    },
    humidity_bme_pct: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    pressure_hpa: {
      type: Number,
      required: true,
      min: 300,   // rango atmosférico razonable
      max: 1100,
    },
    gas_resistance_ohms: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

// Documento principal: cada lectura del BME680
const BmeReadingSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    sensors: {
      type: BmeSensorSchema,
      required: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    collection: 'bmeReadings',
  }
);

module.exports = mongoose.model('BmeReading', BmeReadingSchema);
