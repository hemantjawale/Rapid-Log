import { Transport } from './Transport.js';
import { LogEntry } from '../types.js';
import * as http from 'http';
import * as https from 'https';
import * as zlib from 'zlib';
import { URL } from 'url';

export interface HttpTransportOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  compression?: 'gzip' | 'none';
  circuitBreakerThreshold?: number;
  circuitBreakerResetMs?: number;
}

enum CircuitState {
  CLOSED,
  OPEN,
  HALF_OPEN
}

export class HttpTransport implements Transport {
  private readonly url: URL;
  private readonly options: Required<Omit<HttpTransportOptions, 'url' | 'headers'>> & { headers: Record<string, string> };
  
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;

  constructor(options: HttpTransportOptions) {
    this.url = new URL(options.url);
    this.options = {
      method: options.method ?? 'POST',
      headers: options.headers ?? { 'Content-Type': 'application/json' },
      timeout: options.timeout ?? 5000,
      retries: options.retries ?? 3,
      compression: options.compression ?? 'none',
      circuitBreakerThreshold: options.circuitBreakerThreshold ?? 5,
      circuitBreakerResetMs: options.circuitBreakerResetMs ?? 30000,
    };
  }

  async send(entries: LogEntry[]): Promise<void> {
    if (this.circuitState === CircuitState.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime > this.options.circuitBreakerResetMs) {
        this.circuitState = CircuitState.HALF_OPEN;
      } else {
        return Promise.reject(new Error('Circuit Breaker is OPEN'));
      }
    }

    try {
      await this.sendWithRetry(entries, this.options.retries);
      this.onSuccess();
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.circuitState = CircuitState.CLOSED;
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.options.circuitBreakerThreshold) {
      this.circuitState = CircuitState.OPEN;
    }
  }

  private async sendWithRetry(entries: LogEntry[], retriesLeft: number): Promise<void> {
    try {
      await this.post(entries);
    } catch (err) {
      if (retriesLeft > 0) {
        const delay = 100 * Math.pow(2, this.options.retries - retriesLeft);
        await new Promise(res => setTimeout(res, delay));
        return this.sendWithRetry(entries, retriesLeft - 1);
      }
      throw err;
    }
  }

  private async post(entries: LogEntry[]): Promise<void> {
    return new Promise((resolve, reject) => {
      let body: Buffer | string = JSON.stringify(entries);
      const headers = { ...this.options.headers };

      if (this.options.compression === 'gzip') {
        zlib.gzip(body, (err, result) => {
          if (err) return reject(err);
          this.sendRequest(result, headers, resolve, reject);
        });
      } else {
        this.sendRequest(body, headers, resolve, reject);
      }
    });
  }

  private sendRequest(
    body: Buffer | string, 
    headers: Record<string, string>, 
    resolve: () => void, 
    reject: (err: Error) => void
  ) {
      if (this.options.compression === 'gzip') {
        headers['Content-Encoding'] = 'gzip';
      }
      
      headers['Content-Length'] = Buffer.byteLength(body).toString();

      const requestOptions = {
        hostname: this.url.hostname,
        port: this.url.port || (this.url.protocol === 'https:' ? 443 : 80),
        path: this.url.pathname,
        method: this.options.method,
        headers,
        timeout: this.options.timeout,
      };

      const lib = this.url.protocol === 'https:' ? https : http;
      
      const req = lib.request(requestOptions, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          res.resume();
          resolve();
        } else {
          res.resume();
          reject(new Error(`HTTP Error: ${res.statusCode}`));
        }
      });

      req.on('error', (err) => reject(err));
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('HTTP Timeout'));
      });

      req.write(body);
      req.end();
  }
}
