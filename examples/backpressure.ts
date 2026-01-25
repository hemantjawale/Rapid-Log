import { Logger, LogLevel, Transport, LogEntry } from '../src';

class SlowTransport implements Transport {
  async send(entries: LogEntry[]): Promise<void> {
    console.log(`[Transport] Starting batch of ${entries.length}...`);
    // Simulate slow network (1 second)
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`[Transport] Finished batch of ${entries.length}`);
  }
}

const logger = new Logger({
  transports: [new SlowTransport()],
  bufferSize: 2, // Flush every 2 logs
  flushIntervalMs: 5000,
  maxInflight: 1, // Only 1 batch at a time
  level: LogLevel.INFO
});

console.log('--- Backpressure Test ---');

// Batch 1 (Logs 1, 2) -> Flush (Inflight 1)
logger.info('Log 1');
logger.info('Log 2'); 

// Batch 2 (Logs 3, 4) -> Buffer Full -> Flush called -> Skipped (Inflight 1) -> Buffer stays full
logger.info('Log 3');
logger.info('Log 4');

// Log 5 -> Buffer Full -> Drop
logger.info('Log 5');

// Log 6 -> Buffer Full -> Drop
logger.info('Log 6');

// After 1s, Batch 1 finishes. Inflight 0.
// Recursion triggers Flush for Batch 2 (Logs 3, 4).

setTimeout(() => {
    console.log('--- Sending Log 7 after delay ---');
    // Should succeed now
    logger.info('Log 7');
}, 2000);

setTimeout(() => {
    console.log('--- Test Complete ---');
}, 3000);
