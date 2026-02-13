const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: '*',
  credentials: false
}));

app.use(express.json());

// Pool global persistente
let pool = null;
let lastConnectionString = null;

// Función para obtener o crear pool
function getPool(connectionString) {
  // Si ya existe un pool con el mismo connection string, reutilizarlo
  if (pool && lastConnectionString === connectionString) {
    return pool;
  }
  
  // Si hay un pool viejo, cerrarlo
  if (pool) {
    pool.end();
  }
  
  // Crear nuevo pool
  pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10, // máximo de conexiones
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  
  lastConnectionString = connectionString;
  return pool;
}

// Endpoint de prueba
app.get('/api', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Backend corriendo en Vercel',
    connected: pool !== null 
  });
});

// Conectar a PostgreSQL
app.post('/api/connect', async (req, res) => {
  try {
    const { connectionString } = req.body;
    
    if (!connectionString) {
      return res.status(400).json({ 
        success: false, 
        error: 'Connection string requerido' 
      });
    }

    // Obtener o crear pool
    const currentPool = getPool(connectionString);

    // Probar conexión
    const client = await currentPool.connect();
    await client.query('SELECT NOW()');
    client.release();

    res.json({ 
      success: true, 
      message: 'Conectado a PostgreSQL',
      connectionString: connectionString // Devolver para guardar en frontend
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Ejecutar query
app.post('/api/query', async (req, res) => {
  try {
    const { query, connectionString } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query requerido' 
      });
    }

    // Si viene connectionString, reconectar automáticamente
    let currentPool = pool;
    if (connectionString) {
      currentPool = getPool(connectionString);
    }

    if (!currentPool) {
      return res.status(400).json({ 
        success: false, 
        error: 'No hay conexión activa. Por favor conecta primero.' 
      });
    }

    // Ejecutar query
    const result = await currentPool.query(query);

    res.json({
      success: true,
      data: {
        rows: result.rows || [],
        fields: result.fields ? result.fields.map(f => ({ name: f.name })) : [],
        rowCount: result.rowCount,
        command: result.command
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

module.exports = app;
