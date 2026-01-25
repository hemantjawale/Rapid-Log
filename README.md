# @hemant_jawale/rapid-log

![NPM Version](https://img.shields.io/npm/v/@hemant_jawale/rapid-log?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=flat-square)
![License](https://img.shields.io/npm/l/@hemant_jawale/rapid-log?style=flat-square)

**rapid-log** is a production-grade, asynchronous logging library for Node.js designed for high-throughput applications. It prioritizes **performance** and **reliability** by offloading log transport to background buffers, ensuring your application's event loop is never blocked by I/O operations.

Built with **Circuit Breakers**, **Batching**, and **Compression** out of the box, it is ready for distributed systems where network reliability is not guaranteed.

---

## 🚀 Features

- **Non-Blocking I/O**: Logs are buffered and flushed asynchronously.
- **🛡️ Circuit Breaker**: Built-in protection against failing downstream log aggregators (e.g., Logstash, Splunk).
- **📦 Smart Batching**: Aggregates logs to reduce network overhead (HTTP).
- **🗜️ Compression**: Native Gzip support for HTTP transport to save bandwidth.
- **🔍 Context Awareness**: `AsyncLocalStorage` integration for effortless Request ID / Transaction tracing.
- **🔌 Pluggable Transports**: Modular design with built-in Console and HTTP transports.
- **🚦 Graceful Shutdown**: Ensures all pending logs are flushed before the process exits.

---

## 📦 Installation

```bash
npm install @hemant_jawale/rapid-log
```

---

## ⚡ Quick Start

```typescript
import { Logger, LogLevel } from '@hemant_jawale/rapid-log';

// 1. Initialize the Logger
const logger = new Logger({
  level: LogLevel.INFO,
  bufferSize: 100,      // Flush when 100 logs accumulate
  flushIntervalMs: 2000 // ...or every 2 seconds
});

// 2. Log messages
logger.info('Server started', { port: 3000, env: 'production' });

// 3. Log errors with stack traces
try {
  throw new Error('Database disconnected');
} catch (err) {
  logger.error('Critical failure', { error: err });
}
```

---

## 📖 Advanced Usage

### 1. HTTP Transport with Circuit Breaker

Send logs to a remote endpoint (e.g., Elasticsearch, Logstash) without risking your app's stability.

```typescript
import { Logger, HttpTransport } from '@hemant_jawale/rapid-log';

const httpTransport = new HttpTransport({
  url: 'https://logs.example.com/ingest',
  timeout: 5000,
  retries: 3,
  compression: 'gzip',          // Compress payloads
  circuitBreakerThreshold: 5,   // Open circuit after 5 consecutive failures
  circuitBreakerResetMs: 30000  // Retry after 30 seconds
});

const logger = new Logger({
  transports: [httpTransport]
});
```

### 2. Request Tracing (Context Management)

Use `ContextManager` to attach metadata (like `requestId` or `userId`) to every log line within a specific execution scope, automatically.

```typescript
import { Logger, ContextManager } from '@hemant_jawale/rapid-log';

const logger = new Logger();

// Simulate an incoming HTTP request
const requestId = 'req-12345';
const userId = 'user-987';

ContextManager.runWithContext({ requestId, userId }, () => {
  // All logs inside this block will automatically have requestId & userId
  logger.info('Processing payment'); 
  
  someInternalFunction(); 
});

function someInternalFunction() {
  // This log ALSO has the context, even though we didn't pass it explicitly!
  logger.debug('Validating currency');
}
```

### 3. Express Middleware

Automatically log incoming HTTP requests with timing data.

```typescript
import express from 'express';
import { Logger, createExpressMiddleware } from '@hemant_jawale/rapid-log';

const app = express();
const logger = new Logger();

app.use(createExpressMiddleware(logger));

app.get('/', (req, res) => {
  res.send('Hello World');
});
// Logs: INFO "HTTP Request" { method: "GET", url: "/", status: 200, duration: 12ms, ... }
```

### 4. Graceful Shutdown

Ensure no logs are lost when your application restarts or crashes.

```typescript
const logger = new Logger();

// Automatically hooks into SIGTERM and SIGINT
logger.enableGracefulShutdown();
```

---

## ⚙️ Configuration Reference

### LoggerOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | `LogLevel` | `INFO` | Minimum log level (DEBUG, INFO, WARN, ERROR, FATAL) |
| `transports` | `Transport[]` | `[ConsoleTransport]` | Destinations for your logs |
| `bufferSize` | `number` | `100` | Max logs to hold in memory before flushing |
| `flushIntervalMs` | `number` | `1000` | Max time to wait before flushing buffer |
| `maxInflight` | `number` | `5` | Max concurrent flush operations |
| `defaultContext` | `Object` | `{}` | Global metadata added to every log |

### HttpTransportOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | **Required** | The endpoint URL |
| `method` | `string` | `POST` | HTTP Method |
| `headers` | `Object` | `Content-Type: application/json` | Custom headers |
| `compression` | `'gzip' \| 'none'` | `'none'` | Compress payload before sending |
| `circuitBreakerThreshold` | `number` | `5` | Failures before stopping requests |
| `circuitBreakerResetMs` | `number` | `30000` | Cooldown period for circuit breaker |

---

## 🛠️ Architecture

`rapid-log` uses a **Producer-Consumer** model:

1.  **Application** calls `logger.info()`.
2.  **Logger** pushes entry to an in-memory `LogBuffer`.
3.  **LogBuffer** waits until `bufferSize` is reached OR `flushIntervalMs` elapses.
4.  **Flusher** takes a batch of logs and sends them to all configured **Transports** in parallel.
5.  **Circuit Breakers** in transports monitor success/failure rates and cut off connections to failing backends to prevent resource exhaustion.

---

## License

ISC © [Hemant Jawale](https://github.com/hemantjawale)