import { Logger } from '../Logger';

/**
 * Creates an Express-compatible middleware for logging HTTP requests.
 * Uses duck-typing to avoid hard dependency on Express.
 */
export function createExpressMiddleware(logger: Logger) {
  return (req: any, res: any, next: () => void) => {
    const start = Date.now();
    
    // Hook into response finish event
    res.on('finish', () => {
      const duration = Date.now() - start;
      
      // Extract useful metadata
      const context = {
        method: req.method,
        url: req.originalUrl || req.url,
        status: res.statusCode,
        duration,
        userAgent: req.headers ? req.headers['user-agent'] : undefined,
        ip: req.ip || (req.socket ? req.socket.remoteAddress : undefined),
      };

      // Log based on status code
      if (res.statusCode >= 500) {
        logger.error('HTTP Request Failed', context);
      } else if (res.statusCode >= 400) {
        logger.warn('HTTP Client Error', context);
      } else {
        logger.info('HTTP Request', context);
      }
    });

    next();
  };
}
