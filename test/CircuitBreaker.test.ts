import { HttpTransport } from '../src/transports/HttpTransport';
import { LogEntry, LogLevel } from '../src/types';
import * as http from 'http';

describe('HttpTransport Circuit Breaker', () => {
  let server: http.Server;
  let port: number;
  let shouldFail = false;

  beforeAll((done) => {
    server = http.createServer((_req, res) => {
      if (shouldFail) {
        res.writeHead(500);
        res.end();
      } else {
        res.writeHead(200);
        res.end();
      }
    });
    
    server.listen(0, () => {
      port = (server.address() as any).port;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    shouldFail = false;
  });

  const createEntry = (): LogEntry => ({
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    message: 'test',
  });

  it('should open circuit after threshold failures', async () => {
    shouldFail = true;
    const transport = new HttpTransport({
      url: `http://localhost:${port}/logs`,
      retries: 0, // Disable retries to trigger failure fast
      circuitBreakerThreshold: 2,
      circuitBreakerResetMs: 100,
    });

    // 1. First failure
    await expect(transport.send([createEntry()])).rejects.toThrow();
    
    // 2. Second failure -> Open Circuit
    await expect(transport.send([createEntry()])).rejects.toThrow();

    // 3. Third attempt -> Should fail fast with "Circuit Breaker is OPEN"
    await expect(transport.send([createEntry()])).rejects.toThrow('Circuit Breaker is OPEN');
  });

  it('should reset circuit after timeout', async () => {
    shouldFail = true;
    const transport = new HttpTransport({
      url: `http://localhost:${port}/logs`,
      retries: 0,
      circuitBreakerThreshold: 1,
      circuitBreakerResetMs: 200,
    });

    // 1. Fail -> Open
    await expect(transport.send([createEntry()])).rejects.toThrow();
    await expect(transport.send([createEntry()])).rejects.toThrow('Circuit Breaker is OPEN');

    // 2. Wait for reset
    await new Promise(r => setTimeout(r, 250));
    
    // 3. Heal server
    shouldFail = false;

    // 4. Should succeed (Half-Open -> Closed)
    await transport.send([createEntry()]);
    
    // 5. Subsequent calls succeed
    await transport.send([createEntry()]);
  });
});
