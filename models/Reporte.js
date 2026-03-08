// models/Reporte.js
const mongoose = require('mongoose');

const reporteSchema = new mongoose.Schema({
    id_regional: { type: String, required: true },
    capacidad_total: { type: Number, required: true },
    espacio_libre: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
    estado: { type: String, default: 'Activo' }
});

module.exports = mongoose.model('Reporte', reporteSchema);