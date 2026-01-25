import { Transport } from './Transport';
import { LogEntry } from '../types';

export class ConsoleTransport implements Transport {
  send(entries: LogEntry[]): void {
    for (const entry of entries) {
      // Direct write to stdout is faster than console.log
      // In high-throughput scenarios, we might need to handle backpressure (return value of write)
      // but for standard console transport, this is usually sufficient.
      process.stdout.write(JSON.stringify(entry) + '\n');
    }
  }
}
