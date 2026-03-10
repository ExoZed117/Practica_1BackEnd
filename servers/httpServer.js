const express = require('express');
const cors = require('cors');
const Reporte = require('../models/Reporte');
const tcpServer = require('./tcpServer');

const app = express();
app.use(cors());
app.use(express.json());

// REQUERIMIENTO 3.1: Último reporte de cada nodo (Dashboard)
app.get('/api/nodos', async (req, res) => {
    try {
        const ultimosReportes = await Reporte.aggregate([
            { $sort: { timestamp: -1 } },
            { $group: { _id: "$id_regional", ultimo: { $first: "$$ROOT" } }}
        ]);
        res.json(ultimosReportes.map(r => r.ultimo));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// REQUERIMIENTO 3.2: Totales, Utilización Global y Disponibilidad
app.get('/api/cluster/totales', async (req, res) => {
    try {
        const ultimosReportes = await Reporte.aggregate([
            { $sort: { timestamp: -1 } },
            { $group: { _id: "$id_regional", ultimo: { $first: "$$ROOT" } }}
        ]);

        let totalCapacidad = 0, totalUsado = 0, totalLibre = 0, nodosActivosCount = 0;

        ultimosReportes.forEach(nodo => {
            totalCapacidad += nodo.ultimo.capacidad_total;
            totalUsado += nodo.ultimo.espacio_usado;
            totalLibre += nodo.ultimo.espacio_libre;
            if (nodo.ultimo.estado === 'Activo') nodosActivosCount++;
        });

        const utilizacionGlobal = totalCapacidad > 0 ? (totalUsado / totalCapacidad) * 100 : 0;
        const disponibilidad = (nodosActivosCount / 9) * 100;

        res.json({
            capacidad_total: totalCapacidad,
            espacio_usado: totalUsado,
            espacio_libre: totalLibre,
            utilizacion_global: parseFloat(utilizacionGlobal.toFixed(2)),
            disponibilidad_pct: parseFloat(disponibilidad.toFixed(2)),
            nodos_activos: nodosActivosCount,
            total_nodos: 9
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// REQUERIMIENTO 4.2.7: Tasa de Crecimiento (Growth Rate)
app.get('/api/nodos/:id/crecimiento', async (req, res) => {
    try {
        const { id } = req.params;
        const actual = await Reporte.findOne({ id_regional: id }).sort({ timestamp: -1 });
        
        // Compara con datos de hace 1 hora (ajustable)
        const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000);
        const pasado = await Reporte.findOne({ id_regional: id, timestamp: { $lte: haceUnaHora } }).sort({ timestamp: -1 });

        if (!actual || !pasado) {
            return res.json({ msg: "Faltan datos históricos para calcular", crecimiento_gb: 0 });
        }

        const crecimientoGB = actual.espacio_usado - pasado.espacio_usado;
        res.json({ id_regional: id, crecimiento_gb_por_hora: crecimientoGB });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// REQUERIMIENTO 7.1: Puente Bidireccional para mandar comandos al nodo
app.post('/api/comando', (req, res) => {
    const { id_regional, comando } = req.body;
    const socket = tcpServer.nodosActivos[id_regional]; 

    if (socket && socket.writable) {
        socket.write(JSON.stringify({ action: comando, remote: true }));
        return res.json({ status: "Enviado", msg: `Orden enviada a ${id_regional}` });
    }
    res.status(404).json({ error: 'Nodo no conectado o socket cerrado' });
});

module.exports = app;