import { getFileContent, getSourceMapComment, EOL, saveTestDataFile } from './common';

/**
 * Generate bundle with source map (inlined) that reference line (2) beyond source last line (1)
 */
export function generateInvalidMapLine(): void {
  const filename = 'invalid-map-line.js';

  const source = getFileContent('src/invalid-map-line.1.js');
  const invalidSource = getFileContent('src/invalid-map-line.2.js');

  const sourceMapComment = getSourceMapComment(source, filename);

  const content = `${invalidSource}${EOL}${sourceMapComment}`;

  saveTestDataFile(filename, content);
}
