import { LogEntry } from '../types';

export interface Transport {
  /**
   * Send a batch of log entries to the destination.
   * This should ideally be non-blocking.
   */
  send(entries: LogEntry[]): Promise<void> | void;
}
