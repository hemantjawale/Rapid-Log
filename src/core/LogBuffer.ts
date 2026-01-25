import { LogEntry } from '../types';
import { Transport } from '../transports/Transport';

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
    // Backpressure check: Buffer is full (and couldn't be flushed due to downstream latency)
    if (this.buffer.length >= this.limit) {
      process.stderr.write('OpenLogger Warning: Buffer full, dropping log.\n');
      return;
    }

    this.buffer.push(entry);

    // If buffer is full, flush immediately (async)
    if (this.buffer.length >= this.limit) {
      this.flush();
    } 
    // If this is the first item, start the timer
    else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushInterval);
      this.flushTimer.unref(); // Don't prevent process exit
    }
  }

  public async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    // If too many batches are already in flight, skip flush (buffer remains full)
    if (this.inflightBatches >= this.maxInflight) {
      return;
    }

    // Swap buffer to ensure atomicity and allow new logs while flushing
    const batch = this.buffer;
    this.buffer = [];
    
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.inflightBatches++;
    try {
      // Send to all transports in parallel
      await Promise.all(this.transports.map(t => t.send(batch)));
    } catch (err) {
      // Fallback: write to stderr if transports fail
      process.stderr.write(`RapidLog Error: Failed to flush logs: ${err}\n`);
    } finally {
      this.inflightBatches--;
      // Self-healing: If buffer has items (accumulated during backpressure), try to flush again
      if (this.buffer.length > 0) {
        this.flush().catch(err => {
            // Should not happen as flush catches internally, but good hygiene
            process.stderr.write(`RapidLog Error: Recursive flush failed: ${err}\n`);
        });
      }
    }
  }
}
