import { LogLevel, LogEntry } from './types';
import { LogBuffer } from './core/LogBuffer';
import { Transport } from './transports/Transport';
import { ConsoleTransport } from './transports/ConsoleTransport';
import { ContextManager } from './context/ContextManager';

export interface LoggerOptions {
  level?: LogLevel;
  transports?: Transport[];
  bufferSize?: number;
  flushIntervalMs?: number;
  maxInflight?: number;
  defaultContext?: Record<string, unknown>;
  enabled?: boolean;
}

export class Logger {
  private level: LogLevel;
  private buffer: LogBuffer;
  private context: Record<string, unknown>;
  private enabled: boolean;

  // Level priority map for O(1) comparison
  private static readonly LEVEL_PRIORITY: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
    [LogLevel.FATAL]: 4,
  };

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.context = options.defaultContext ?? {};
    this.enabled = options.enabled ?? true;
    
    // Default to ConsoleTransport if none provided
    const transports = options.transports && options.transports.length > 0 
      ? options.transports 
      : [new ConsoleTransport()];
      
    const bufferSize = options.bufferSize ?? 100; // Default batch size
    const flushInterval = options.flushIntervalMs ?? 1000; // Default 1 second
    const maxInflight = options.maxInflight ?? 5; // Default 5 concurrent batches

    this.buffer = new LogBuffer(bufferSize, flushInterval, transports, maxInflight);
  }

  /**
   * Registers SIGTERM and SIGINT handlers to flush logs before exit.
   * Call this in your application entry point.
   */
  public enableGracefulShutdown(): void {
    const handler = async (signal: string) => {
        // Use console.error to ensure it bypasses our own logger buffer if possible, or just as feedback
        // Actually, we want to be silent unless error.
        try {
            await this.flush();
        } catch (err) {
            process.stderr.write(`OpenLogger flush failed: ${err}\n`);
        }
        process.exit(0);
    };

    process.on('SIGTERM', () => handler('SIGTERM'));
    process.on('SIGINT', () => handler('SIGINT'));
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }
  
  public error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }
  
  public warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }
  
  public debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }
  
  public fatal(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.FATAL, message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.enabled) return;
    if (Logger.LEVEL_PRIORITY[level] < Logger.LEVEL_PRIORITY[this.level]) return;

    // Merge contexts: Default < AsyncLocal < Explicit
    const asyncContext = ContextManager.getContext();
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { 
        ...this.context, 
        ...asyncContext,
        ...context 
      },
    };

    this.buffer.add(entry);
  }
  
  /**
   * Force flush the buffer.
   * Useful for graceful shutdowns.
   */
  public async flush(): Promise<void> {
    await this.buffer.flush();
  }

  /**
   * Run a callback with a specific context.
   * Helper to expose ContextManager functionality.
   */
  public runWithContext<T>(context: Record<string, unknown>, callback: () => T): T {
    return ContextManager.runWithContext(context, callback);
  }
}
