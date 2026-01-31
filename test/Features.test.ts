import { Logger } from '../src/Logger.js';
import { LogLevel } from '../src/types.js';
import { ContextManager } from '../src/context/ContextManager.js';
import { jest } from '@jest/globals';

describe('Advanced Features', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({
      level: LogLevel.INFO,
      transports: [],
      bufferSize: 100
    });
  });

  describe('Breadcrumbs', () => {
    test('should attach breadcrumbs to error logs within trace', async () => {
      await ContextManager.runWithContext({ traceId: 'trace-123' }, async () => {
        logger.info('Step 1');
        logger.info('Step 2');
        
        logger.error('Final Error');
        
        const result = await logger.search('level:error');
        expect(result.logs.length).toBe(1);
        
        const errorLog = result.logs[0];
        expect(errorLog.message).toBe('Final Error');
        expect(errorLog.breadcrumbs).toBeDefined();
        
        const crumbs = errorLog.breadcrumbs as any[];
        expect(crumbs.length).toBe(2);
        expect(crumbs[0].message).toBe('Step 1');
        expect(crumbs[1].message).toBe('Step 2');
      });
    });

    test('should not attach breadcrumbs without traceId', async () => {
      logger.info('Step 1');
      logger.error('Error without trace');
      
      const result = await logger.search('level:error');
      expect(result.logs.length).toBe(1);
      expect(result.logs[0].breadcrumbs).toBeUndefined();
    });
  });

  describe('Dynamic Log Levels', () => {
    test('should allow user-specific overrides', async () => {
      // Default level is ERROR, so INFO shouldn't be logged
      logger = new Logger({ level: LogLevel.ERROR });
      
      logger.info('Ignored global');
      
      // Override for user-123 to allow INFO
      logger.setLevel(LogLevel.INFO, { userId: 'user-123' });
      
      // Should log for user-123
      await ContextManager.runWithContext({ userId: 'user-123' }, async () => {
        logger.info('Captured user log');
      });
      
      // Should still ignore for others
      await ContextManager.runWithContext({ userId: 'user-456' }, async () => {
        logger.info('Ignored other user');
      });

      const result = await logger.search('message:"Captured user log"');
      expect(result.logs.length).toBe(1);
      
      const emptyResult = await logger.search('message:"Ignored global"');
      expect(emptyResult.logs.length).toBe(0);
    });

    test('should expire overrides', async () => {
      jest.useFakeTimers();
      
      logger = new Logger({ level: LogLevel.ERROR });
      logger.setLevel(LogLevel.INFO, { userId: 'temp-user', duration: '1s' });
      
      // Active
      await ContextManager.runWithContext({ userId: 'temp-user' }, async () => {
        logger.info('Active');
      });
      
      // Advance time
      jest.advanceTimersByTime(2000);
      
      // Expired
      await ContextManager.runWithContext({ userId: 'temp-user' }, async () => {
        logger.info('Expired');
      });
      
      const active = await logger.search('message:Active');
      expect(active.logs.length).toBe(1);
      
      const expired = await logger.search('message:Expired');
      expect(expired.logs.length).toBe(0);
      
      jest.useRealTimers();
    });
  });

  describe('Smart Search', () => {
    test('should support complex queries', async () => {
      logger.info('Login successful', { userId: 'u1', module: 'auth' });
      logger.warn('Login failed', { userId: 'u2', module: 'auth' });
      logger.error('Database connection lost', { module: 'db' });
      
      // AND query
      const r1 = await logger.search('module:auth AND level:info');
      expect(r1.logs.length).toBe(1);
      expect(r1.logs[0].message).toBe('Login successful');
      
      // OR query
      const r2 = await logger.search('userId:u2 OR module:db');
      expect(r2.logs.length).toBe(2);
    });
  });
});
