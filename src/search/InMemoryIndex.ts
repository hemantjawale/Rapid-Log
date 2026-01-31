import { LogEntry } from '../types.js';
import { QueryAST } from './QueryParser.js';

export class InMemoryIndex {
  private logs: LogEntry[] = [];
  private readonly limit: number;

  constructor(limit: number = 10000) {
    this.limit = limit;
  }

  add(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.limit) {
      this.logs.shift();
    }
  }

  search(ast: QueryAST): LogEntry[] {
    return this.logs.filter(log => this.evaluate(ast, log));
  }

  private evaluate(ast: QueryAST, log: LogEntry): boolean {
    if (ast.type === 'AND') {
      return this.evaluate(ast.left as any, log) && this.evaluate(ast.right as any, log);
    }
    if (ast.type === 'OR') {
      return this.evaluate(ast.left as any, log) || this.evaluate(ast.right as any, log);
    }
    if (ast.type === 'EXPRESSION' && ast.condition) {
      const { field, value } = ast.condition;
      const logValue = (log as any)[field] || (log.context && log.context[field]);
      return String(logValue) === String(value);
    }
    return false;
  }
}
