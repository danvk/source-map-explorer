import * as fs from 'fs';
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

const lexer = moo.compile(symbols);

lexer.reset(fs.readFileSync('/tmp/test.json', 'utf8'));
// lexer.reset(fs.readFileSync('/tmp/daylight_views.geojson', 'utf8'));

interface Token {
  type: keyof typeof symbols;
  value: string;
  offset: number;
}

interface Lexer {
  [Symbol.iterator]: Token;
  next(): Token;
}

function nextSkipWhitepace(lex: Lexer): Token {
  let tok = lex.next();
  while (tok.type === 'space') {
    tok = lex.next();
  }
  console.log('tok', tok.type);
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
    parseValue(tok, lex);
    console.log('array', i);
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

function parseObject(lex: Lexer) {
  let tok = nextSkipWhitepace(lex);
  while (true) {
    if (tok.type !== 'STRING') {
      throw new Error(`c Unexpected token ${tok.type}`);
    }
    const key = tok.value;
    console.log('key', key);
    tok = nextSkipWhitepace(lex);
    if (tok.type !== ':') {
      throw new Error(`d Unexpected token ${tok.type}`);
    }
    tok = nextSkipWhitepace(lex);
    parseValue(tok, lex);
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

parseValue(nextSkipWhitepace(lexer), lexer);
