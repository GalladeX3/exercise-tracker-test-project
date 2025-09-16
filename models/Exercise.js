const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: true, trim: true },
    duration: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Exercise', exerciseSchema);

