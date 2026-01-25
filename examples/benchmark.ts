import { Logger, LogLevel } from '../src';
import { Transport } from '../src/transports/Transport';
import { LogEntry } from '../src/types';

// No-op transport that resolves immediately (very fast)
class FastTransport implements Transport {
  send(_entries: LogEntry[]): Promise<void> {
    return Promise.resolve();
  }
}

const logger = new Logger({
  level: LogLevel.INFO,
  transports: [new FastTransport()],
  bufferSize: 10000, // Large buffer to reduce flush overhead
  flushIntervalMs: 1000,
  maxInflight: 1000, // Allow many inflight batches since they resolve instantly
});

const ITERATIONS = 1_000_000;

console.log(`Benchmarking ${ITERATIONS} log operations...`);

// We need to be careful: add() is sync, but it triggers async flush.
// If we loop 1M times in sync, the microtask queue will fill up with flush promises.
// The Node.js event loop won't run until the synchronous loop finishes.
// This is exactly what we want to measure: the cost of calling .info()
// However, if we fill the buffer 1000 times (1M / 1000), we trigger 1000 flushes.
// Since we are blocking the event loop, those flushes WON'T run until the loop ends.
// Wait, if `add` calls `flush`, and `flush` is `async`, it returns a Promise.
// We ignore the promise.
// BUT, `flush` clears the buffer synchronously.
// So we CAN continue adding.
// The only limit is memory usage for the promises.

const start = process.hrtime.bigint();

for (let i = 0; i < ITERATIONS; i++) {
  logger.info('Benchmark message', { iteration: i });
}

const end = process.hrtime.bigint();
const durationNs = end - start;
const durationMs = Number(durationNs) / 1_000_000;
const opsPerSec = (ITERATIONS / durationMs) * 1000;

console.log(`Duration: ${durationMs.toFixed(2)}ms`);
console.log(`Ops/Sec: ${opsPerSec.toFixed(2)}`);
console.log(`Ns/Op: ${(Number(durationNs) / ITERATIONS).toFixed(2)}`);

// Force exit to avoid waiting for all promises (which are just null ops)
process.exit(0);
