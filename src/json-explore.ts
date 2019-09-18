import * as fs from 'fs';
import { FileSizeMap } from 'src';
const moo = require('moo');

const symbols = {
  '{': '{',
  '}': '}',
  '[': '[',
  ']': ']',
  ',': ',',
  ':': ':',
  space: {match: /\s+/, lineBreaks: true},
  NUMBER: /-?(?:[0-9]|[1-9][0-9]+)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?\b/,
  STRING: /"(?:\\["bfnrt\/\\]|\\u[a-fA-F0-9]{4}|[^"\\])*"/,
  TRUE: /true\b/,
  FALSE: /false\b/,
  NULL: /null\b/,
} as const;

const lexer = moo.compile(symbols) as Lexer;

interface Token {
  type: keyof typeof symbols;
  value: string;
  /** Start of this token */
  offset: number;
  text: string;
}

interface Lexer {
  [Symbol.iterator]: Token;
  next(): Token;
  index: number;
  reset(text: string): void;
}

interface Segment {
  key: string;
  start: number;
  end?: number;
}

let path: Segment[] = [];
let sizes: FileSizeMap = {};

function pushPath(key: string, pos?: number) {
  pos = pos === undefined ? lexer.index : pos;
  path.push({key, start: pos});
}

function popPath(pos?: number) {
  const fullPath = path.map(s => s.key).join('/');
  const {start} = path.pop()!;
  pos = pos === undefined ? lexer.index : pos;
  sizes[fullPath] = (sizes[fullPath] || 0) + (pos - start + 1);
}

function addToken(key: string, length: number) {
  pushPath(key, 1);
  popPath(length);
}

function nextSkipWhitepace(lex: Lexer): Token {
  let tok = lex.next();
  while (tok.type === 'space') {
    tok = lex.next();
  }
  return tok;
}

function parseValue(tok: Token, lex: Lexer) {
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

function parseArray(lex: Lexer) {
  let tok = nextSkipWhitepace(lex);
  let i = 0;
  while (true) {
    pushPath('*', tok.offset);
    parseValue(tok, lex);
    popPath();
    tok = nextSkipWhitepace(lex);
    if (tok.type === ']') {
      break;
    } else if (tok.type === ',') {
      tok = nextSkipWhitepace(lex);
      i++;
      continue;
    } else {
      throw new Error(`b Unexpected token ${tok.type}`);
    }
  }
}

function parseObject(lex: Lexer) {
  let tok = nextSkipWhitepace(lex);
  while (true) {
    if (tok.type !== 'STRING') {
      throw new Error(`c Unexpected token ${tok.type}`);
    }
    const key = tok.value.slice(1, -1);  // strip quotes
    addToken('<keys>', tok.text.length);
    tok = nextSkipWhitepace(lex);
    if (tok.type !== ':') {
      throw new Error(`d Unexpected token ${tok.type}`);
    }
    tok = nextSkipWhitepace(lex);
    pushPath(key, tok.offset);
    parseValue(tok, lex);
    popPath();
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

// lexer.reset(fs.readFileSync('/tmp/test.json', 'utf8'));
// lexer.reset(fs.readFileSync('examples/test.json', 'utf8'));
// lexer.reset(fs.readFileSync('/tmp/daylight_views.geojson', 'utf8'));
lexer.reset(fs.readFileSync(process.argv[2], 'utf8'));

parseValue(nextSkipWhitepace(lexer), lexer);
console.log(sizes);
