import { HttpTransport } from '../src/transports/HttpTransport.js';
import { LogEntry, LogLevel } from '../src/types.js';
import * as http from 'http';

describe('HttpTransport', () => {
  let server: http.Server;
  let port: number;
  let requestBody: string = '';
  let requestCount = 0;
  let shouldFailCount = 0;

  beforeAll((done) => {
    server = http.createServer((req, res) => {
      requestCount++;
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        requestBody = body;
        
        if (shouldFailCount > 0) {
          shouldFailCount--;
          res.writeHead(500);
          res.end();
        } else {
          res.writeHead(200);
          res.end();
        }
      });
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
    requestBody = '';
    requestCount = 0;
    shouldFailCount = 0;
  });

  const createEntry = (): LogEntry => ({
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    message: 'test',
  });

  it('should send logs via HTTP POST', async () => {
    const transport = new HttpTransport({
      url: `http://localhost:${port}/logs`,
    });

    const entries = [createEntry(), createEntry()];
    await transport.send(entries);

    expect(requestCount).toBe(1);
    const body = JSON.parse(requestBody);
    expect(body).toHaveLength(2);
    expect(body[0].message).toBe('test');
  });

  it('should retry on failure', async () => {
    shouldFailCount = 2; // Fail twice, succeed on third

    const transport = new HttpTransport({
      url: `http://localhost:${port}/logs`,
      retries: 3,
    });

    await transport.send([createEntry()]);

    expect(requestCount).toBe(3); // Initial + 2 Retries
  });

  it('should throw after max retries', async () => {
    shouldFailCount = 5; // Always fail

    const transport = new HttpTransport({
      url: `http://localhost:${port}/logs`,
      retries: 2,
    });

    await expect(transport.send([createEntry()])).rejects.toThrow();
    expect(requestCount).toBe(3); // Initial + 2 Retries
  });
});
