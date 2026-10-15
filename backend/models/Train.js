const mongoose = require('mongoose');

const PassengerManifestSchema = new mongoose.Schema({
  passengerName: { type: String, required: true, trim: true },
  passengerPhone: { type: String, required: true, trim: true },
  passengerEmail: { type: String, trim: true },
  pnr: { type: String, required: true, trim: true },
  coach: { type: String, required: true, trim: true },
  berth: { type: String, required: true, trim: true },
  addedAt: { type: Date, default: Date.now }
});

const TrainSchema = new mongoose.Schema({
  trainNumber: { type: String, required: true, unique: true, trim: true },
  trainName: { type: String, required: true, trim: true },
  origin: { type: String, default: 'NDLS - New Delhi' },
  destination: { type: String, default: 'MMCT - Mumbai Central' },
  currentStation: { type: String, default: 'In Transit' },
  delayMinutes: { type: Number, default: 0 },
  lastTelemetryUpdate: { type: Date, default: Date.now },
  passengers: [PassengerManifestSchema]
});

module.exports = mongoose.model('Train', TrainSchema);
