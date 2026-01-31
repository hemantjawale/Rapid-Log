export interface QueryAST {
  type: 'AND' | 'OR' | 'EXPRESSION';
  left?: QueryAST | QueryCondition;
  right?: QueryAST | QueryCondition;
  condition?: QueryCondition;
}

export interface QueryCondition {
  field: string;
  operator: string;
  value: string | number;
}

export class QueryParser {
  parse(query: string): QueryAST {
    const tokens = this.tokenize(query);
    return this.parseExpression(tokens);
  }

  private tokenize(query: string): string[] {
    const regex = /(\w+:"[^"]+")|(\w+:[^\s]+)|(AND|OR)|(\(|\))/g;
    const tokens = query.match(regex);
    return tokens ? tokens.map(t => t.trim()) : [];
  }

  private parseExpression(tokens: string[]): QueryAST {
    if (tokens.length === 0) throw new Error('Empty query');
    
    let left = this.parseTerm(tokens.shift()!);

    while (tokens.length > 0) {
      const operator = tokens.shift();
      if (operator === 'AND' || operator === 'OR') {
        const right = this.parseTerm(tokens.shift()!);
        left = {
          type: operator,
          left: left as any,
          right: right as any
        };
      }
    }

    return left as any;
  }

  private parseTerm(token: string): QueryAST | QueryCondition {
    if (token.includes(':')) {
      const [field, value] = token.split(':');
      return {
        type: 'EXPRESSION',
        condition: {
          field,
          operator: ':',
          value: value.replace(/"/g, '')
        }
      };
    }
    throw new Error(`Invalid token: ${token}`);
  }
}
