const { existsSync } = require('fs');
const spawn = require('cross-spawn');
const concat = require('concat-stream');
const PATH = process.env.PATH;

/*
  `createProcess` and `execute` are from
  https://gist.github.com/zorrodg/c349cf54a3f6d0a9ba62e0f4066f31cb
  https://medium.com/@zorrodg/integration-tests-on-node-js-cli-part-1-why-and-how-fa5b1ba552fe
*/

/**
 * Creates a child process with script path
 * @param {string} processPath Path of the process to execute
 * @param {Array} args Arguments to the command
 */
function createProcess(processPath, args = []) {
  // Ensure that path exists
  if (!processPath || !existsSync(processPath)) {
    throw new Error('Invalid process path');
  }

  args = [processPath].concat(args);

  return spawn('node', args, {
    env: {
      NODE_ENV: 'test',
      preventAutoStart: false,
      PATH // This is needed in order to get all the binaries in your current terminal
    },
    stdio: [null, null, null, 'ipc'] // This enables interprocess communication (IPC)
  });
}

/**
 * Creates a command and executes inputs (user responses) to the stdin.
 * Returns a promise that resolves when all inputs are sent.
 * Rejects the promise if any error.
 * @param {string} processPath Path of the process to execute
 * @param {Array} args Arguments to the command
 */
function execute(processPath, args = []) {
  const childProcess = createProcess(processPath, args);
  childProcess.stdin.setEncoding('utf-8');
  const promise = new Promise((resolve, reject) => {
    childProcess.stderr.once('data', err => {
      reject(err.toString());
    });
    childProcess.on('error', reject);
    childProcess.stdout.pipe(
      concat(result => {
        resolve(result.toString());
      })
    );
  });
  return promise;
}

module.exports = {
  execute
};
