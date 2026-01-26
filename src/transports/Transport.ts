import { LogEntry } from '../types.js';

export interface Transport {
  send(entries: LogEntry[]): Promise<void> | void;
}
