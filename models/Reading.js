// models/Reading.js
const mongoose = require('mongoose');

const SensorSchema = new mongoose.Schema(
  {
    temp_dht_c: { type: Number, required: true },
    humidity_pct: { type: Number, required: true },
    temp_lm35_c: { type: Number, required: true },
    light_raw: { type: Number, required: true },
    light_state: { type: Number, required: true } // 0 o 1
  },
  { _id: false } // no necesitamos _id dentro de sensors
);

const ReadingSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },
    sensors: { type: SensorSchema, required: true },
    createdAt: { type: Date, default: Date.now, index: true }
  },
  {
    collection: 'readings'
  }
);

// Índice compuesto útil: deviceId + createdAt
ReadingSchema.index({ deviceId: 1, createdAt: -1 });

module.exports = mongoose.model('Reading', ReadingSchema);
