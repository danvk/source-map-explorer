import { existsSync } from 'fs';
import spawn from 'cross-spawn';
import concat from 'concat-stream';
import os from 'os';
import { ChildProcess } from 'child_process';

const PATH = process.env.PATH;

/**
 * Set current directory to ./tests so that all paths can be set as relative to test folder
 */
export function setTestFolder(): void {
  const originalCwd = process.cwd();

  before(() => {
    process.chdir(__dirname);
  });

  after(() => {
    process.chdir(originalCwd);
  });
}

export function mockEOL(): void {
  const originalEOL = os.EOL;

  before(() => {
    // Unify EOL for snapshots
    Object.defineProperty(os, 'EOL', {
      value: '\r\n',
    });
  });

  after(() => {
    Object.defineProperty(os, 'EOL', {
      value: originalEOL,
    });
  });
}

/*
  `createProcess` and `execute` are from
  https://gist.github.com/zorrodg/c349cf54a3f6d0a9ba62e0f4066f31cb
  https://medium.com/@zorrodg/integration-tests-on-node-js-cli-part-1-why-and-how-fa5b1ba552fe
*/

/**
 * Creates a child process with script path
 * @param processPath Path of the process to execute
 * @param args Arguments to the command
 */
function createProcess(processPath: string, args: string[] = []): ChildProcess {
  // Ensure that path exists
  if (!processPath || !existsSync(processPath)) {
    throw new Error('Invalid process path');
  }

  return spawn('node', [processPath, ...args], {
    env: {
      NODE_ENV: 'test',
      preventAutoStart: 'false',
      PATH, // This is needed in order to get all the binaries in your current terminal
    },
    stdio: [null, null, null, 'ipc'], // This enables interprocess communication (IPC)
  });
}

/**
 * Creates a command and executes inputs (user responses) to the stdin.
 * Returns a promise that resolves when all inputs are sent.
 * Rejects the promise if any error.
 * @param processPath Path of the process to execute
 * @param args Arguments to the command
 */
export function execute(processPath: string, args: string[] = []): Promise<string> {
  const childProcess = createProcess(processPath, args);

  if (childProcess.stdin === null) {
    throw new Error('stdin is null');
  }

  return new Promise((resolve, reject) => {
    if (childProcess.stderr) {
      childProcess.stderr.once('data', error => {
        reject(error.toString());
      });
    }

    childProcess.on('error', reject);

    // Collect output
    if (childProcess.stdout) {
      childProcess.stdout.pipe(
        concat(result => {
          resolve(result.toString());
        })
      );
    }
  });
}
