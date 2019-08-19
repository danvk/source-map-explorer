// This is a comment which will be stripped from the minified JS.
var bar = require('./bar');

var foo = x => bar(x) + bar(x);

module.exports = foo;
