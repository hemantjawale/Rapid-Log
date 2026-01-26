import { LogLevel, LogEntry } from './types.js';
import { LogBuffer } from './core/LogBuffer.js';
import { Transport } from './transports/Transport.js';
import { ConsoleTransport } from './transports/ConsoleTransport.js';
import { ContextManager } from './context/ContextManager.js';

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
    
    const transports = options.transports && options.transports.length > 0 
      ? options.transports 
      : [new ConsoleTransport()];
      
    const bufferSize = options.bufferSize ?? 100;
    const flushInterval = options.flushIntervalMs ?? 1000;
    const maxInflight = options.maxInflight ?? 5;

    this.buffer = new LogBuffer(bufferSize, flushInterval, transports, maxInflight);
  }

  public enableGracefulShutdown(): void {
    const handler = async (_signal: string) => {
        try {
            await this.flush();
        } catch (err) {
            process.stderr.write(`RapidLog flush failed: ${err}\n`);
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
  
  public async flush(): Promise<void> {
    await this.buffer.flush();
  }

  public runWithContext<T>(context: Record<string, unknown>, callback: () => T): T {
    return ContextManager.runWithContext(context, callback);
  }
}
