declare module 'moo' {
  interface Token<K extends string | number | symbol> {
    type: K;
    value: string;
    /** Start of this token */
    offset: number;
    text: string;
  }

  interface Lexer<K extends string | number | symbol> {
    [Symbol.iterator]: Token<K>;
    next(): Token<K>;
    index: number;
    reset(text: string): void;
  }

  export function compile<T extends object>(symbols: T): Lexer<keyof T>;
}
