import { Transport } from './Transport.js';
import { LogEntry } from '../types.js';

export class ConsoleTransport implements Transport {
  send(entries: LogEntry[]): void {
    for (const entry of entries) {
      process.stdout.write(JSON.stringify(entry) + '\n');
    }
  }
}
