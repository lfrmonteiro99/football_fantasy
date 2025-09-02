import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/Logger';

export class ErrorHandler {
  static handle(error: Error, req: Request, res: Response, next: NextFunction): void {
    Logger.error('Unhandled error', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      timestamp: new Date().toISOString()
    });
  }
} 