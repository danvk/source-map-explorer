const generate = require('generate-source-map');
const convert = require('convert-source-map');
const fs = require('fs');
const path = require('path');

const EOL = `\n`;

const destinationDirectory = path.resolve(__dirname, '../data');

function getSourceMapComment(source, sourceFile) {
  const map = generate({ source, sourceFile });

  return convert.fromJSON(map.toString()).toComment();
}

function getFileContent(file) {
  return fs.readFileSync(file).toString();
}

function generateInvalidSourceMapLine() {
  const filename = 'invalid-map-line.js';

  const source = getFileContent('./src/invalid-map-line.1.js');
  const invalidSource = getFileContent('./src/invalid-map-line.2.js');

  const sourceMapComment = getSourceMapComment(source, filename);

  const content = `${invalidSource}${EOL}${sourceMapComment}`;

  fs.writeFileSync(path.join(destinationDirectory, filename), content);
}

function generateInvalidMapColumn() {
  const filename = 'invalid-map-column.js';

  const source = getFileContent('./src/invalid-map-column.1.js');
  const invalidSource = getFileContent('./src/invalid-map-column.2.js');

  const sourceMapComment = getSourceMapComment(source, filename);

  const content = `${invalidSource}${EOL}${sourceMapComment}`;

  fs.writeFileSync(path.join(destinationDirectory, filename), content);
}

generateInvalidSourceMapLine();
generateInvalidMapColumn();
