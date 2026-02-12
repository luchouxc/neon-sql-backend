const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

// CORS abierto para permitir conexiones
app.use(cors({
  origin: '*',
  credentials: false
}));

app.use(express.json());

let pool = null;

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

    pool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    res.json({ 
      success: true, 
      message: 'Conectado a PostgreSQL' 
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
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query requerido' 
      });
    }

    if (!pool) {
      return res.status(400).json({ 
        success: false, 
        error: 'No hay conexión activa' 
      });
    }

    const result = await pool.query(query);

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
