# @hemant_jawale/rapid-log

A high-performance, asynchronous, and production-ready logging library for Node.js applications. Designed for scale, it features built-in circuit breakers, batching, backpressure management, and request context propagation.

## Features

- **Native ESM Support**: Built specifically for modern Node.js environments using `"type": "module"`.
- **Asynchronous Batching**: Logs are buffered and flushed in batches to minimize I/O overhead and improve application throughput.
- **Circuit Breaker Pattern**: `HttpTransport` includes a stateful circuit breaker to prevent cascading failures during network outages.
- **Backpressure Handling**: Intelligent buffer management drops logs when the system is under extreme load to preserve application stability.
- **Context Propagation**: Leverages `AsyncLocalStorage` to automatically propagate request context (e.g., `traceId`, `userId`) across asynchronous call chains.
- **Multiple Transports**: Includes `ConsoleTransport` for development and `HttpTransport` for shipping logs to aggregation services (e.g., Elasticsearch, Splunk).
- **Compression**: Supports Gzip compression for HTTP payloads to reduce network bandwidth.
- **Graceful Shutdown**: Automatically flushes pending logs on system signals (`SIGTERM`, `SIGINT`).

## Installation

```bash
npm install @hemant_jawale/rapid-log
```

## Quick Start

Initialize the logger with default settings (Console Transport):

```typescript
import { Logger, LogLevel } from '@hemant_jawale/rapid-log';

const logger = new Logger({
  level: LogLevel.INFO,
  bufferSize: 100, // Flush after 100 logs
  flushIntervalMs: 1000 // Or flush every 1 second
});

logger.info('Application started', { env: 'production' });
```

## Advanced Usage

### HTTP Transport with Circuit Breaker

Configure the `HttpTransport` to reliably ship logs to a remote endpoint. The circuit breaker ensures your application doesn't hang if the logging server is unresponsive.

```typescript
import { Logger, HttpTransport } from '@hemant_jawale/rapid-log';

const httpTransport = new HttpTransport({
  url: 'https://logs.example.com/ingest',
  method: 'POST',
  headers: { 'Authorization': 'Bearer token' },
  circuitBreakerThreshold: 5, // Open circuit after 5 consecutive failures
  circuitBreakerResetMs: 30000, // Retry after 30 seconds
  compression: 'gzip', // Compress payloads
  retries: 3 // Retry network errors up to 3 times
});

const logger = new Logger({
  transports: [httpTransport],
  bufferSize: 500
});

logger.enableGracefulShutdown(); // Ensure logs are flushed on exit
```

### Context Propagation (Request Tracing)

Use `ContextManager` to inject context (like Request IDs) that automatically attaches to all logs generated within that execution scope.

```typescript
import { Logger, ContextManager } from '@hemant_jawale/rapid-log';

const logger = new Logger();

// Middleware example
function requestMiddleware(req, res, next) {
  const traceId = req.headers['x-request-id'] || crypto.randomUUID();
  
  // All logs inside this callback will have { traceId } attached automatically
  ContextManager.runWithContext({ traceId }, () => {
    logger.info('Request received'); // Log contains traceId
    next();
  });
}
```

### Breadcrumb Trail
Automatically captures the last 50 log entries for a trace and attaches them to any Error/Fatal log. This provides immediate context for debugging failures without querying a central database.

```typescript
// No configuration needed.
// Simply ensure you are using ContextManager with a `traceId`.
ContextManager.runWithContext({ traceId: 'req-123' }, () => {
    logger.info('User authenticated');
    logger.info('Querying database');
    logger.error('Connection failed'); // Will include 'breadcrumbs' with previous 2 logs
});
```

### Dynamic Log Levels
Change log levels at runtime for specific users, features, or paths, with automatic expiration. Perfect for debugging specific issues in production without spamming global logs.

```typescript
// Enable DEBUG logs only for user '123' for 5 minutes
logger.setLevel(LogLevel.DEBUG, { 
    userId: '123', 
    duration: '5m' 
});

// Enable DEBUG logs for 'checkout' feature
logger.setLevel(LogLevel.DEBUG, { 
    feature: 'checkout' 
});
```

### In-Memory Smart Search
Query recent logs directly from memory using a SQL-like syntax. Useful for health checks, admin dashboards, or local debugging.

```typescript
// Find all error logs for a specific user
const result = await logger.search('level:error AND userId:123');

// Find logs containing specific text
const result = await logger.search('message:"Database connection timeout"');

console.log(`Found ${result.total} logs`);
```

## Configuration

### LoggerOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | `LogLevel` | `INFO` | Minimum log level to capture. |
| `transports` | `Transport[]` | `[ConsoleTransport]` | Array of transport instances. |
| `bufferSize` | `number` | `100` | Number of logs to buffer before flushing. |
| `flushIntervalMs` | `number` | `1000` | Maximum time (ms) to wait before flushing. |
| `maxInflight` | `number` | `5` | Max concurrent flush requests allowed. |
| `enabled` | `boolean` | `true` | Master switch to enable/disable logging. |

### HttpTransportOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | Required | Endpoint URL. |
| `method` | `string` | `POST` | HTTP method. |
| `circuitBreakerThreshold` | `number` | `5` | Failures before opening circuit. |
| `circuitBreakerResetMs` | `number` | `30000` | Cooldown period for circuit breaker. |
| `compression` | `'gzip' \| 'none'` | `'none'` | Payload compression. |
| `retries` | `number` | `3` | Number of retry attempts for failed requests. |

## Architecture

1.  **Ingestion**: `Logger.log()` accepts an entry and checks the log level.
2.  **Context Enrichment**: `ContextManager` merges global context and async-local storage context.
3.  **Buffering**: `LogBuffer` pushes the entry to an in-memory array.
4.  **Flush Strategy**:
    *   **Size-based**: Flushes immediately when `bufferSize` is reached.
    *   **Time-based**: Flushes periodically based on `flushIntervalMs`.
5.  **Transport Execution**: The batch is sent to all configured transports in parallel.
    *   `HttpTransport` applies compression and checks Circuit Breaker state before sending.
    *   If the circuit is open, the request is rejected immediately to save resources.

## License

ISC
