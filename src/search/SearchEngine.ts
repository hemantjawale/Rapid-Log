import { LogEntry } from '../types.js';
import { QueryParser } from './QueryParser.js';
import { InMemoryIndex } from './InMemoryIndex.js';

export class LogSearchEngine {
  private index: InMemoryIndex;
  private parser: QueryParser;

  constructor(limit: number = 10000) {
    this.index = new InMemoryIndex(limit);
    this.parser = new QueryParser();
  }

  indexLog(entry: LogEntry): void {
    this.index.add(entry);
  }

  async search(queryString: string): Promise<{ logs: LogEntry[]; total: number; took: number }> {
    const start = Date.now();
    const ast = this.parser.parse(queryString);
    const results = this.index.search(ast);
    const took = Date.now() - start;

    return {
      logs: results,
      total: results.length,
      took
    };
  }
}
