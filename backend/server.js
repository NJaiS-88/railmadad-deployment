const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const officerRoutes = require('./routes/officerRoutes');
const trainRoutes = require('./routes/trainRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/railmadad';

// Middleware
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) 
  : true;
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection
global.useLocalMockDB = false;
console.log('Connecting to database...');
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000
})
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    console.log('--- FALLING BACK TO LOCAL FILE DATABASE (db.json) ---');
    global.useLocalMockDB = true;
  });

// Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/officer', officerRoutes);
app.use('/api/trains', trainRoutes);

// Health check endpoints
const healthHandler = (req, res) => {
  res.json({
    status: 'ok',
    service: 'railmadad-backend',
    database: global.useLocalMockDB ? 'mock_json' : 'mongodb',
    timestamp: new Date().toISOString()
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Public config: helpline number served from env (fallback to 139)
app.get('/api/config/helpline', (req, res) => {
  res.json({
    helplineNumber: process.env.TWILIO_PHONE_NUMBER || '139',
  });
});

// Start Server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`RailMadad Backend server running on port ${PORT} (http://0.0.0.0:${PORT})`);
});

// Graceful shutdown
const handleShutdown = (signal) => {
  console.log(`Received ${signal}. Gracefully shutting down RailMadad Backend...`);
  server.close(async () => {
    try {
      await mongoose.connection.close(false);
      console.log('MongoDB connection closed.');
    } catch (e) {
      console.error('Error closing MongoDB connection:', e.message);
    }
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
