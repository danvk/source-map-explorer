// TypeScript generates source map that includes mapping for line ending characters
function calculate(a: number, b: number) {
  return a + b;
}

const a = 3;
const b = 5;

console.log(`${a} ➕ ${b} 💥 `, calculate(a, b));
