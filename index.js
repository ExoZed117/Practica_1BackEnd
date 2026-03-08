// index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const net = require('net');
const Reporte = require('./models/Reporte');

// --- CONFIGURACIÓN BÁSICA ---
const app = express();
app.use(cors());
app.use(express.json());

const PORT_API = 3000; // Puerto para React (HTTP)
const PORT_TCP = 5000; // Puerto para las regionales (TCP)

// --- CONEXIÓN A MONGODB ---
// Asegúrate de tener MongoDB corriendo localmente
mongoose.connect('mongodb://127.0.0.1:27017/cluster_db')
    .then(() => console.log('✅ Conectado a MongoDB'))
    .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// --- 2. EL ESCUCHA (SERVIDOR TCP) ---
const tcpServer = net.createServer((socket) => {
    console.log('🔗 Nueva regional conectada');

    socket.on('data', async (data) => {
        try {
            // Convertir Buffer a JSON
            const mensaje = JSON.parse(data.toString());
            console.log('📥 Datos recibidos de:', mensaje.id_regional);

            // Guardar en la base de datos
            const nuevoReporte = await Reporte.create({
                id_regional: mensaje.id_regional,
                capacidad_total: mensaje.capacidad_total,
                espacio_libre: mensaje.espacio_libre,
                estado: 'Activo'
            });

            // "Guiño": Responder al cliente para confirmar
            socket.write(JSON.stringify({ status: 'ok', msg: 'Datos guardados' }));
            
        } catch (error) {
            console.error('❌ Error procesando datos TCP:', error.message);
        }
    });

    socket.on('end', () => {
        console.log('🔴 Regional desconectada');
    });

    socket.on('error', (err) => {
        console.error('⚠️ Error en socket:', err.message);
    });
});

tcpServer.listen(PORT_TCP, () => {
    console.log(`🚀 Servidor TCP (Escucha) corriendo en el puerto ${PORT_TCP}`);
});

// --- 4. EL PUENTE (API PARA REACT) ---

// Ruta para ver la lista de nodos y sus últimos datos
app.get('/api/nodos', async (req, res) => {
    try {
        // Agrupamos por id_regional y sacamos el último reporte de cada una
        const nodos = await Reporte.aggregate([
            { $sort: { timestamp: -1 } },
            { $group: {
                _id: "$id_regional",
                ultimo_reporte: { $first: "$$ROOT" }
            }}
        ]);
        res.json(nodos.map(n => n.ultimo_reporte));
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo nodos' });
    }
});

// Ruta para ver el total global del clúster
app.get('/api/cluster/totales', async (req, res) => {
    try {
        const nodos = await Reporte.aggregate([
            { $sort: { timestamp: -1 } },
            { $group: { _id: "$id_regional", ultimo_reporte: { $first: "$$ROOT" } }}
        ]);

        let capacidad_global = 0;
        let espacio_libre_global = 0;

        nodos.forEach(nodo => {
            // Solo sumar si están reportando ("Activo")
            if(nodo.ultimo_reporte.estado === 'Activo') {
                capacidad_global += nodo.ultimo_reporte.capacidad_total;
                espacio_libre_global += nodo.ultimo_reporte.espacio_libre;
            }
        });

        res.json({
            nodos_activos: nodos.filter(n => n.ultimo_reporte.estado === 'Activo').length,
            capacidad_global,
            espacio_libre_global
        });
    } catch (error) {
        res.status(500).json({ error: 'Error calculando totales' });
    }
});

app.listen(PORT_API, () => {
    console.log(`🌐 API HTTP (Puente) corriendo en http://localhost:${PORT_API}`);
});

// --- LÓGICA "NO REPORTA" ---
// Se ejecuta cada 60 segundos (60000 ms)
setInterval(async () => {
    try {
        const hace30Segundos = new Date(Date.now() - 30000);
        
        // Buscar todos los reportes Activos que sean más viejos de 30 segundos
        // y cambiar su estado a "No Reporta"
        const resultado = await Reporte.updateMany(
            { estado: 'Activo', timestamp: { $lt: hace30Segundos } },
            { $set: { estado: 'No Reporta' } }
        );
        
        if (resultado.modifiedCount > 0) {
            console.log(`⚠️ Se actualizaron ${resultado.modifiedCount} registros a "No Reporta"`);
        }
    } catch (error) {
        console.error('Error en tarea de actualización de estado:', error);
    }
}, 60000);