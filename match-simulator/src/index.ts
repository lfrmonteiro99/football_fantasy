import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { SimulationController } from './controllers/SimulationController';
import { ErrorHandler } from './middleware/ErrorHandler';
import { RateLimiter } from './middleware/RateLimiter';
import { Logger } from './utils/Logger';
import { RabbitMQConsumerService } from './services/RabbitMQConsumerService';
import { RealTimeMatchSimulationService } from './services/RealTimeMatchSimulationService';
import { WebSocketService } from './services/WebSocketService';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const port = process.env.PORT || 8001;

// Initialize services
const simulationService = new RealTimeMatchSimulationService();
const webSocketService = new WebSocketService(server);
const rabbitMQConsumer = new RabbitMQConsumerService(simulationService, webSocketService);

// Initialize Socket.IO
webSocketService.initialize().catch(error => {
    Logger.error('Failed to initialize WebSocket service', { error: error.message });
});

// Middleware
app.use(cors({
  origin: 'http://127.0.0.1:3000',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(RateLimiter.middleware());

// Request logging
app.use((req, res, next) => {
  Logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Routes
const simulationController = new SimulationController();

app.post('/simulate', simulationController.simulateMatch.bind(simulationController));
app.post('/simulate-realtime', simulationController.simulateRealTimeMatch.bind(simulationController));
app.post('/simulate-streaming', simulationController.simulateStreamingMatch.bind(simulationController));
app.get('/health', simulationController.health.bind(simulationController));

// Error handling
app.use(ErrorHandler.handle);

// Start server
server.listen(port, async () => {
  Logger.info(`🚀 Match Simulator Microservice running on port ${port}`);
  Logger.info(`🔌 WebSocket server running on port ${port}`);
  Logger.info(`📊 Performance Mode: ${process.env.NODE_ENV === 'production' ? 'Optimized' : 'Development'}`);
  Logger.info(`⚡ Tick Rate: ${process.env.SIMULATION_TICK_RATE || 60} Hz`);
  
  // Initialize RabbitMQ consumer
  try {
    await rabbitMQConsumer.connect();
    await rabbitMQConsumer.startConsuming();
    Logger.info(`🐰 RabbitMQ consumer started successfully`);
  } catch (error) {
    Logger.error('Failed to start RabbitMQ consumer', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    Logger.info('⚠️  Continuing without RabbitMQ consumer - HTTP endpoints still available');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  Logger.info('🛑 Received SIGTERM, shutting down gracefully...');
  await rabbitMQConsumer.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  Logger.info('🛑 Received SIGINT, shutting down gracefully...');
  await rabbitMQConsumer.disconnect();
  process.exit(0);
});

// Export services for use in other modules
export { webSocketService };
export default app; 