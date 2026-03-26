/**
 * IvyLens Social Operator - Main API Entry Point
 * Vercel serverless function handler
 */

import logger from '../src/lib/logger.js';

/**
 * Main API handler
 */
export default async function handler(req, res) {
  const { method, url } = req;
  
  logger.info('API Request', {
    method,
    url,
    headers: req.headers,
  });
  
  // Health check endpoint
  if (url === '/api' || url === '/api/health') {
    return res.status(200).json({
      status: 'healthy',
      service: 'IvyLens Social Operator',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  }
  
  // Route to appropriate handler based on path
  try {
    // Telegram webhook will be at /api/telegram
    if (url.startsWith('/api/telegram')) {
      const telegramHandler = await import('./telegram/index.js');
      return telegramHandler.default(req, res);
    }
    
    // Cron endpoints will be at /api/cron
    if (url.startsWith('/api/cron')) {
      const cronHandler = await import('./cron/index.js');
      return cronHandler.default(req, res);
    }
    
    // System status endpoint
    if (url === '/api/status') {
      const statusHandler = await import('./system/status.js');
      return statusHandler.default(req, res);
    }
    
    // 404 for unmatched routes
    return res.status(404).json({
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
    });
    
  } catch (error) {
    logger.error('API Handler Error', error);
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: config.isDevelopment ? error.message : 'An error occurred processing your request',
    });
  }
}