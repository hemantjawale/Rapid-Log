import { LogEntry } from '../types.js';
import { Transport } from '../transports/Transport.js';

export class LogBuffer {
  private buffer: LogEntry[] = [];
  private readonly limit: number;
  private readonly flushInterval: number;
  private readonly transports: Transport[];
  private flushTimer: NodeJS.Timeout | null = null;
  private inflightBatches = 0;
  private readonly maxInflight: number;

  constructor(limit: number, flushInterval: number, transports: Transport[], maxInflight = 5) {
    this.limit = limit;
    this.flushInterval = flushInterval;
    this.transports = transports;
    this.maxInflight = maxInflight;
  }

  public add(entry: LogEntry): void {
    if (this.buffer.length >= this.limit) {
      process.stderr.write('OpenLogger Warning: Buffer full, dropping log.\n');
      return;
    }

    this.buffer.push(entry);

    if (this.buffer.length >= this.limit) {
      this.flush();
    } 
    else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushInterval);
      this.flushTimer.unref();
    }
  }

  public async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    if (this.inflightBatches >= this.maxInflight) {
      return;
    }

    const batch = this.buffer;
    this.buffer = [];
    
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.inflightBatches++;
    try {
      await Promise.all(this.transports.map(t => t.send(batch)));
    } catch (err) {
      process.stderr.write(`RapidLog Error: Failed to flush logs: ${err}\n`);
    } finally {
      this.inflightBatches--;
      if (this.buffer.length > 0) {
        this.flush().catch(err => {
            process.stderr.write(`RapidLog Error: Recursive flush failed: ${err}\n`);
        });
      }
    }
  }
}
