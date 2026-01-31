import { LogLevel, LogEntry } from './types.js';
import { LogBuffer } from './core/LogBuffer.js';
import { Transport } from './transports/Transport.js';
import { ConsoleTransport } from './transports/ConsoleTransport.js';
import { ContextManager } from './context/ContextManager.js';
import { BreadcrumbManager } from './breadcrumbs/BreadcrumbManager.js';
import { DynamicLogLevelManager, LevelOverride } from './levels/DynamicLogLevelManager.js';
import { LogSearchEngine } from './search/SearchEngine.js';

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
  private breadcrumbManager: BreadcrumbManager;
  private levelManager: DynamicLogLevelManager;
  private searchEngine: LogSearchEngine;

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
    this.breadcrumbManager = new BreadcrumbManager();
    this.levelManager = new DynamicLogLevelManager(this.level);
    this.searchEngine = new LogSearchEngine();
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

    const asyncContext = ContextManager.getContext();
    const mergedContext = { 
        ...this.context, 
        ...asyncContext,
        ...context 
    };

    if (!this.levelManager.shouldLog(level, mergedContext)) {
      return;
    }
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: mergedContext,
    };

    const enrichedEntry = this.breadcrumbManager.attachToLog(entry);
    this.breadcrumbManager.add(entry);
    this.searchEngine.indexLog(enrichedEntry);

    this.buffer.add(enrichedEntry);
  }
  
  public async flush(): Promise<void> {
    await this.buffer.flush();
  }

  public runWithContext<T>(context: Record<string, unknown>, callback: () => T): T {
    return ContextManager.runWithContext(context, callback);
  }

  public setLevel(level: LogLevel, options?: { userId?: string; feature?: string; path?: string; duration?: string }): string | void {
    return this.levelManager.setLevel(level, options);
  }

  public getOverrides(): (LevelOverride & { id: string; remaining: number | null })[] {
    return this.levelManager.listOverrides();
  }

  public removeOverride(ruleId: string): boolean {
    return this.levelManager.removeOverride(ruleId);
  }

  public async search(query: string): Promise<{ logs: LogEntry[]; total: number; took: number }> {
    return this.searchEngine.search(query);
  }
}
