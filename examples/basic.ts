import { Logger, LogLevel } from '../src';

const logger = new Logger({
  level: LogLevel.DEBUG,
  bufferSize: 5, // Small buffer to test flushing
  flushIntervalMs: 2000,
});

console.log('--- Starting Logger Test ---');

logger.info('Log 1: Hello World', { userId: '123' });
logger.debug('Log 2: Debugging something');
logger.warn('Log 3: Watch out!');
logger.error('Log 4: Oops', { error: 'Something went wrong' });
logger.info('Log 5: Another one'); // Should trigger flush

setTimeout(async () => {
  logger.info('Log 6: Delayed log');
  // Wait for flush interval
}, 500);

// Keep process alive long enough to see delayed flush
setTimeout(() => {
  console.log('--- Test Complete ---');
}, 3000);
