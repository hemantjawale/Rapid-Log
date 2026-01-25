export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export interface LogEntry {
  timestamp: string; // ISO 8601
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>; // Structured metadata
  [key: string]: unknown; // Allow extensions
}

