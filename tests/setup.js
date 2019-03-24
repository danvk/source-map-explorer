const chai = require('chai');
const chaiJestSnapshot = require('chai-jest-snapshot');

// Set current directory to ./tests so that all paths can be set as relative to test folder
process.chdir(__dirname);

chai.use(chaiJestSnapshot);

before(function() {
  chaiJestSnapshot.resetSnapshotRegistry();
});

beforeEach(function() {
  chaiJestSnapshot.configureUsingMochaContext(this);
});
