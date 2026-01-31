import { LogEntry, LogLevel } from '../types.js';
import { CircularBuffer } from './CircularBuffer.js';
import { ContextManager } from '../context/ContextManager.js';

export class BreadcrumbManager {
  private breadcrumbs: Map<string, CircularBuffer<LogEntry>>;
  private readonly maxBreadcrumbs: number;

  constructor(maxBreadcrumbs: number = 50) {
    this.breadcrumbs = new Map();
    this.maxBreadcrumbs = maxBreadcrumbs;
  }

  add(entry: LogEntry): void {
    const context = ContextManager.getContext();
    const traceId = context?.traceId as string;

    if (!traceId) return;

    if (!this.breadcrumbs.has(traceId)) {
      this.breadcrumbs.set(traceId, new CircularBuffer<LogEntry>(this.maxBreadcrumbs));
    }

    this.breadcrumbs.get(traceId)!.push(entry);
  }

  getBreadcrumbs(traceId: string): LogEntry[] {
    return this.breadcrumbs.get(traceId)?.toArray() || [];
  }

  attachToLog(entry: LogEntry): LogEntry {
    if (entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL) {
      const context = ContextManager.getContext();
      const traceId = context?.traceId as string;
      
      if (traceId) {
        const crumbs = this.getBreadcrumbs(traceId);
        if (crumbs.length > 0) {
          return {
            ...entry,
            breadcrumbs: crumbs
          };
        }
      }
    }
    return entry;
  }

  cleanup(traceId: string): void {
    this.breadcrumbs.delete(traceId);
  }
}
