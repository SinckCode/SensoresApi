// models/Reading.js
const mongoose = require('mongoose');

const SensorSchema = new mongoose.Schema(
  {
    // === DHT22 ===
    temp_dht_c: {
      type: Number,
      required: true
    },
    humidity_pct: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },

    // === BME680 ===
    temp_bme_c: {
      type: Number,
      required: true
    },
    pressure_hpa: {
      type: Number,
      required: true,
      min: 300,   // rango típico sensato
      max: 1100
    },
    gas_resistance_ohms: {
      type: Number,
      required: true,
      min: 0
    },

    // === BH1750 (lux) ===
    light_raw: {
      type: Number,
      required: true,
      min: 0
    },
    // 0 = oscuro, 1 = iluminado (según lux)
    light_state: {
      type: Number,
      required: true,
      enum: [0, 1]
    },
    light_level: {
      type: String,
      required: true,
      enum: [
        'muy oscuro',
        'oscuro',
        'poco iluminado',
        'bien iluminado',
        'muy iluminado'
      ]
    }
  },
  { _id: false }
);

const ReadingSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    sensors: { type: SensorSchema, required: true },
    createdAt: { type: Date, default: Date.now, index: true }
  },
  {
    collection: 'readings',
    toJSON: {
      transform: (_, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Índice compuesto: consultas por deviceId ordenadas por fecha
ReadingSchema.index({ deviceId: 1, createdAt: -1 });

module.exports = mongoose.model('Reading', ReadingSchema);
