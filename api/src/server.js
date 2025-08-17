const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const log4js = require('log4js');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const { setupDatabase } = require('./utils/database');
const { setupKafka } = require('./utils/kafka');
const { setupLogging } = require('./utils/logging');

const app = express();
const PORT = process.env.PORT || 3001;

// Setup logging
setupLogging();
const logger = log4js.getLogger('server');

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
app.set('trust proxy', 1); 

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',                           
  keyGenerator: (req) => req.headers['x-real-ip'] || req.ip,       
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 10,             
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers['x-real-ip'] || req.ip,
});

app.use(globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info({
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent'),
      ip: req.ip || req.connection.remoteAddress
    });
  });
  
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error({
    timestamp: new Date().toISOString(),
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Initialize services and start server
async function startServer() {
  try {
    // Setup database
    await setupDatabase();
    logger.info('Database connection established');

    // Setup Kafka
    await setupKafka();
    logger.info('Kafka connection established');

    // Start server
    app.listen(PORT, () => {
      logger.info({
        timestamp: new Date().toISOString(),
        message: `Server running on port ${PORT}`,
        environment: process.env.NODE_ENV || 'development'
      });
    });
  } catch (error) {
    logger.error({
      timestamp: new Date().toISOString(),
      error: 'Failed to start server',
      details: error.message
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();