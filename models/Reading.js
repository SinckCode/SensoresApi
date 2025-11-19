// models/Reading.js
const mongoose = require('mongoose');

const SensorSchema = new mongoose.Schema(
  {
    temp_dht_c:   { type: Number, required: true },
    humidity_pct: { type: Number, required: true },
    // temp_lm35_c: { type: Number, required: true }, // <-- ELIMINADO
    light_raw:    { type: Number, required: true },
    light_state:  { type: Number, required: true }, // 0 o 1
    light_level:  { type: String, required: true }
  },
  { _id: false }
);

const ReadingSchema = new mongoose.Schema(
  {
    deviceId:  { type: String, required: true, index: true },
    sensors:   { type: SensorSchema, required: true },
    createdAt: { type: Date, default: Date.now, index: true }
  },
  {
    collection: 'readings'
  }
);

ReadingSchema.index({ deviceId: 1, createdAt: -1 });

module.exports = mongoose.model('Reading', ReadingSchema);
