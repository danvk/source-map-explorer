import * as fs from 'fs';
import moo from 'moo';

import { FileSizeMap, ExploreBundleResult } from 'src';

const symbols = {
  '{': '{',
  '}': '}',
  '[': '[',
  ']': ']',
  ',': ',',
  ':': ':',
  space: { match: /\s+/, lineBreaks: true },
  NUMBER: /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?\b/,
  STRING: /"(?:\\["bfnrt/\\]|\\u[a-fA-F0-9]{4}|[^"\\])*"/,
  TRUE: /true\b/,
  FALSE: /false\b/,
  NULL: /null\b/,
} as const;

const lexer = moo.compile(symbols);
type Lexer = typeof lexer;
type Token = ReturnType<Lexer['next']>;

interface Segment {
  key: string;
  start: number;
  end?: number;
}

const path: Segment[] = [];
const sizes: FileSizeMap = {};

function pushPath(key: string, pos?: number): void {
  pos = pos === undefined ? lexer.index : pos;
  path.push({ key, start: pos });
}

function popPath(pos?: number): void {
  const fullPath = path.map(s => s.key).join('/');
  const x = path.pop();
  if (!x) {
    throw new Error('Impossible');
  }
  const { start } = x;
  pos = pos === undefined ? lexer.index : pos;
  // console.log(`${fullPath}: ${start + 1}-${pos + 1} = ${pos - start + 1}`);
  sizes[fullPath] = (sizes[fullPath] || 0) + (pos - start + 1);
}

function addToken(key: string, pos: number, length: number): void {
  pushPath(key, pos);
  popPath(pos + length - 1);
}

function nextSkipWhitepace(lex: Lexer): Token {
  let tok = lex.next();
  while (tok.type === 'space') {
    tok = lex.next();
  }

  return tok;
}

function parseValue(tok: Token, lex: Lexer): void {
  if (tok.type === '{') {
    // start object
    parseObject(lex);
  } else if (tok.type === '[') {
    // start array
    parseArray(lex);
  } else if (
    tok.type === 'NUMBER' ||
    tok.type === 'STRING' ||
    tok.type === 'TRUE' ||
    tok.type === 'NULL' ||
    tok.type === 'FALSE'
  ) {
    // no-op
  } else {
    throw new Error(`a Unexpected token ${tok.type}`);
  }
}

function parseArray(lex: Lexer): void {
  let tok = nextSkipWhitepace(lex);
  for (;;) {
    pushPath('*', tok.offset);
    parseValue(tok, lex);
    popPath(lex.index - 1);
    tok = nextSkipWhitepace(lex);
    if (tok.type === ']') {
      break;
    } else if (tok.type === ',') {
      tok = nextSkipWhitepace(lex);
      continue;
    } else {
      throw new Error(`b Unexpected token ${tok.type}`);
    }
  }
}

function parseObject(lex: Lexer): void {
  let tok = nextSkipWhitepace(lex);
  for (;;) {
    if (tok.type !== 'STRING') {
      throw new Error(`c Unexpected token ${tok.type}`);
    }
    const key = tok.value.slice(1, -1); // strip quotes
    addToken('<keys>', tok.offset, tok.text.length);
    tok = nextSkipWhitepace(lex);
    if (tok.type !== ':') {
      throw new Error(`d Unexpected token ${tok.type}`);
    }
    tok = nextSkipWhitepace(lex);
    pushPath(key, tok.offset);
    parseValue(tok, lex);
    popPath(lex.index - 1);
    tok = nextSkipWhitepace(lex);
    if (tok.type === '}') {
      break;
    } else if (tok.type === ',') {
      tok = nextSkipWhitepace(lex);
      continue;
    } else {
      throw new Error(`e Unexpected token ${tok.type}`);
    }
  }
}

export function leafify(counts: Record<string, number>): Record<string, number> {
  const childSizes: Record<string, number> = {};
  for (const [path, count] of Object.entries(counts)) {
    const parts = path.split('/');
    if (parts.length > 1) {
      const parent = parts.slice(0, -1).join('/');
      childSizes[parent] = (childSizes[parent] || 0) + count;
    }
  }

  for (const [path] of Object.entries(counts)) {
    if (path in childSizes) {
      const v = childSizes[path];
      counts[path] -= v;
    }
  }

  return counts;
}

export function exploreJson(path: string): ExploreBundleResult {
  const json = fs.readFileSync(path, 'utf8');
  lexer.reset(json);
  parseValue(nextSkipWhitepace(lexer), lexer);
  leafify(sizes);

  return {
    files: sizes,
    unmappedBytes: 0,
    totalBytes: json.length,
    bundleName: path,
  };
}
