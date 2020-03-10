import { getFileContent, getSourceMapComment, EOL, saveTestDataFile } from './common';

/**
 * Generate bundle with source map (inlined) that reference column (34) beyond source last column (35)
 */
export function generateInvalidMapColumn(): void {
  const filename = 'invalid-map-column.js';

  const source = getFileContent('src/invalid-map-column.1.js');
  const invalidSource = getFileContent('src/invalid-map-column.2.js');

  const sourceMapComment = getSourceMapComment(source, filename);

  const content = `${invalidSource}${EOL}${sourceMapComment}`;

  saveTestDataFile(filename, content);
}
