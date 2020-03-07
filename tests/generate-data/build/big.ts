import path from 'path';
import { exec } from 'child_process';

import { createBundleWithWebpack } from './common';

export function generateBig(): void {
  const currentCwd = process.cwd();

  process.chdir(path.resolve(__dirname, '../src/big'));

  exec('npm install', (error, stdout, stderr) => {
    if (stderr) {
      console.log('stderr:', stderr);
    }

    if (error !== null) {
      console.log('exec error:', error);
    }

    createBundleWithWebpack('big/index.js', 'big.js');
  });

  process.chdir(currentCwd);
}
