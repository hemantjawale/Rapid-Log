import { HttpTransport } from '../src/transports/HttpTransport.js';
import { LogEntry, LogLevel } from '../src/types.js';
import * as http from 'http';
import * as zlib from 'zlib';

describe('HttpTransport Compression', () => {
  let server: http.Server;
  let port: number;
  let receivedBody: Buffer = Buffer.alloc(0);
  let receivedHeaders: http.IncomingHttpHeaders = {};

  beforeAll((done) => {
    server = http.createServer((req, res) => {
      receivedHeaders = req.headers;
      let chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        receivedBody = Buffer.concat(chunks);
        res.writeHead(200);
        res.end();
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

  const createEntry = (): LogEntry => ({
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    message: 'test-compression',
  });

  it('should send gzipped payload when enabled', async () => {
    const transport = new HttpTransport({
      url: `http://localhost:${port}/logs`,
      compression: 'gzip',
    });

    await transport.send([createEntry()]);

    expect(receivedHeaders['content-encoding']).toBe('gzip');
    
    // Decompress and verify
    const decompressed = zlib.gunzipSync(receivedBody).toString();
    const parsed = JSON.parse(decompressed);
    
    expect(parsed).toHaveLength(1);
    expect(parsed[0].message).toBe('test-compression');
  });

  it('should send plain JSON when compression is disabled', async () => {
    const transport = new HttpTransport({
      url: `http://localhost:${port}/logs`,
      compression: 'none',
    });

    await transport.send([createEntry()]);

    expect(receivedHeaders['content-encoding']).toBeUndefined();
    
    const parsed = JSON.parse(receivedBody.toString());
    expect(parsed[0].message).toBe('test-compression');
  });
});
