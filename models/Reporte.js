const mongoose = require('mongoose');

const reporteSchema = new mongoose.Schema({
    id_regional: { type: String, required: true },
    nombre_disco: { type: String, default: 'Desconocido' },
    tipo_disco: { type: String, default: 'HDD' },
    capacidad_total: { type: Number, required: true }, // en GB
    espacio_usado: { type: Number, required: true },    // en GB
    espacio_libre: { type: Number, required: true },    // en GB
    iops: { type: Number, default: 0 },
    utilizacion: { type: Number },
    timestamp: { type: Date, default: Date.now },
    estado: { type: String, default: 'Activo' }
});

module.exports = mongoose.model('Reporte', reporteSchema);