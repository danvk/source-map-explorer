const fs = require('fs');

/**
 * @param {(Buffer|string)} file Path to file or Buffer
 */
function getFileContent(file) {
  const buffer = Buffer.isBuffer(file) ? file : fs.readFileSync(file);

  return buffer.toString();
}

/**
 * Apply a transform to the keys of an object, leaving the values unaffected.
 * @param {Object} obj
 * @param {Function} fn
 */
function mapKeys(obj, fn) {
  return Object.keys(obj).reduce((result, key) => {
    const newKey = fn(key);
    result[newKey] = obj[key];

    return result;
  }, {});
}

// https://stackoverflow.com/a/18650828/388951
function formatBytes(bytes, decimals = 2) {
  if (bytes == 0) return '0 B';

  const k = 1000,
    dm = decimals,
    sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
    i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Find common path prefix
 * @see http://stackoverflow.com/a/1917041/388951
 * @param {string[]} array List of filenames
 */
function commonPathPrefix(array) {
  if (array.length === 0) return '';

  const A = array.concat().sort(),
    a1 = A[0].split(/(\/)/),
    a2 = A[A.length - 1].split(/(\/)/),
    L = a1.length;

  let i = 0;

  while (i < L && a1[i] === a2[i]) i++;

  return a1.slice(0, i).join('');
}

module.exports = {
  getFileContent,
  mapKeys,
  formatBytes,
  commonPathPrefix,
};
