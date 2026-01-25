# @hemant_jawale/rapid-log

A high-performance, asynchronous Node.js logger built for scale and reliability. It features built-in circuit breakers, batching, compression, and multiple transports (Console, HTTP).

## Features

- **🚀 High Performance**: Asynchronous logging with batched writes.
- **🛡️ Circuit Breaker**: Protects your application from downstream failures (e.g., slow HTTP endpoints).
- **📦 Compression**: Gzip compression support for HTTP transport to save bandwidth.
- **🔌 Multiple Transports**: Comes with Console and HTTP transports out of the box.
- **🔍 Context Awareness**: AsyncLocalStorage support for request-scoped logging (e.g., Trace IDs).
- **💪 TypeScript**: Fully typed for a great developer experience.

## Installation

```bash
npm install @hemant_jawale/rapid-log
```

## Quick Start

```typescript
import { Logger, LogLevel } from '@hemant_jawale/rapid-log';

// Initialize the logger
const logger = new Logger({
  level: LogLevel.INFO,
  bufferSize: 100,      // Flush after 100 logs
  flushIntervalMs: 5000 // ...or every 5 seconds
});

// Log something
logger.info('Application started', { env: 'production' });
logger.error('Database connection failed', { error: 'ECONNREFUSED' });
```

## Advanced Usage

### HTTP Transport with Circuit Breaker

```typescript
import { Logger, LogLevel, HttpTransport } from '@hemant_jawale/rapid-log';

const httpTransport = new HttpTransport({
  url: 'https://logs.example.com/ingest',
  batchSize: 50,
  circuitBreakerConfig: {
    failureThreshold: 5,
    resetTimeoutMs: 10000
  }
});

const logger = new Logger({
  level: LogLevel.INFO,
  transports: [httpTransport]
});
```

## License

ISC