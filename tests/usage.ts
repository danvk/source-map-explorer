import fs from 'fs';

import { explore } from '../dist';

// Full example

explore('js/*.*', {
  file: './sme-results/2019-04-27.html',
  html: true,
  noRoot: true,
  onlyMapped: true,
  replaceMap: {
    dist: '',
  },
})
  .then(result => {
    result.errors.forEach(error => {
      if (error.isWarning) {
        console.log(`Issue during '${error.bundleName}; explore`, error.message);
      } else {
        console.log(`Failed to explore '${error.bundleName}'`, error.message);
      }
    });

    result.bundles.forEach(bundle => {
      console.log(bundle.bundleName);
      console.log(JSON.stringify(bundle.files));
    });
  })
  .catch(error => {
    console.log('Failed to explore');
    if (error.errors) {
      error.errors.forEach(exploreError => {
        console.log(exploreError.bundleName);
        console.log(exploreError.message);
      });
    } else {
      console.log(error);
    }
  });

// Inline or referenced map

explore('with-inline-map.js');

// Separate map

explore(['foo.min.js', 'foo.min.js.map']);

// Glob pattern

explore('js/*.*');

// Multiple globs

explore(['js/foo.1*.js', 'js/foo.mi?.js']);

// Specify bundles explicitly

explore({ code: 'foo.min.js', map: 'foo.min.js.map' });

explore([{ code: 'foo.min.js', map: 'foo.min.js.map' }, { code: 'with-inline-map.js' }]);

// Pass buffer

explore({ code: fs.readFileSync('js/foo.min.js'), map: fs.readFileSync('js/foo.min.js.map') });
