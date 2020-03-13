import fs from 'fs';
import path from 'path';
import browserify from 'browserify';
import babelify from 'babelify';

import { root, dist, BUNDLE_FILE_NAME } from './common';

/**
 * Generate bundle with two source using Browserify
 */
export function createBundle(): Promise<void> {
  const bundleFile = fs.createWriteStream(path.join(dist, BUNDLE_FILE_NAME));

  const b = browserify('src/foo.js', {
    debug: true,
    basedir: root,
  })
    .transform(babelify, {
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              browsers: 'IE 11',
            },
          },
        ],
      ],
    })
    .bundle()
    .pipe(bundleFile);

  return new Promise((resolve, reject) => {
    b.on('error', reject);
    bundleFile.on('finish', resolve).on('error', reject);
  });
}
