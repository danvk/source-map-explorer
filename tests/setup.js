import chai from 'chai';
import chaiJestSnapshot from 'chai-jest-snapshot';
import chaiAsPromised from 'chai-as-promised';

// Set current directory to ./tests so that all paths can be set as relative to test folder
process.chdir(__dirname);

chai.use(chaiJestSnapshot);
chai.use(chaiAsPromised);

before(function() {
  chaiJestSnapshot.resetSnapshotRegistry();
});

beforeEach(function() {
  chaiJestSnapshot.configureUsingMochaContext(this);
});
