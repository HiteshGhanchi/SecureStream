import express from 'express';
import { logger } from './utils/logger';
import { getConfig } from './config';
import { authMiddleware } from './middleware/auth';
import uploadRoutes from './routes/upload.routes';
import configRoutes from './routes/config.routes';
import { Request, Response } from 'express';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

const config = getConfig(); // Fetch the current config

app.get('/health', (req: Request, res: Response) => {
  // Use config values dynamically
  logger.info('Health check endpoint hit', { poolSize: getConfig().dbPoolSize });
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    features: {
      newUploadUi: getConfig().enableNewUploadUi
    }
  });
});

import videoRoutes from './routes/video.routes';

// Add this below app.use('/api/upload', ...)
app.use('/api/videos', authMiddleware, videoRoutes);

// Public routes - no auth required
app.use('/api/config', configRoutes);

// everything below this line is protected

app.get('/api/test', authMiddleware, (req: Request, res: Response) => {
  res.json({
    userId: req.headers['x-user-id'],
    roles: req.headers['x-user-roles']
  })
})
app.use('/api/upload', authMiddleware, uploadRoutes);

// Use the port from the config
app.listen(config.port, () => {
  logger.info(`Server is running on port ${config.port}`);
});