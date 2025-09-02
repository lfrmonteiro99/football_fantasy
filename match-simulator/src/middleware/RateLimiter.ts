import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/Logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private static readonly limits = new Map<string, RateLimitEntry>();
  private static readonly windowMs = parseInt(process.env.RATE_LIMIT_WINDOW || '60000');
  private static readonly maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
  
  static middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = req.ip || 'unknown';
      const now = Date.now();
      
      // Clean up expired entries
      RateLimiter.cleanup();
      
      const entry = RateLimiter.limits.get(key);
      
      if (!entry || now > entry.resetTime) {
        // First request or window expired
        RateLimiter.limits.set(key, {
          count: 1,
          resetTime: now + RateLimiter.windowMs
        });
        next();
      } else if (entry.count < RateLimiter.maxRequests) {
        // Within limit
        entry.count++;
        next();
      } else {
        // Rate limit exceeded
        Logger.warn('Rate limit exceeded', { ip: key, count: entry.count });
        
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: 'Too many requests, please try again later',
          retryAfter: Math.ceil((entry.resetTime - now) / 1000)
        });
      }
    };
  }
  
  private static cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of RateLimiter.limits.entries()) {
      if (now > entry.resetTime) {
        RateLimiter.limits.delete(key);
      }
    }
  }
} 