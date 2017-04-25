// Vendored from https://github.com/sindresorhus/pretty-bytes/blob/0d177953b0092fce5749be7cba065b1e70cac272/index.js

;(function() {
	
'use strict';
var UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

window.prettyBytes = function(num) {
	if (!Number.isFinite(num)) {
		throw new TypeError(`Expected a finite number, got ${typeof num}: ${num}`);
	}

	var neg = num < 0;

	if (neg) {
		num = -num;
	}

	if (num < 1) {
		return (neg ? '-' : '') + num + ' B';
	}

	var exponent = Math.min(Math.floor(Math.log(num) / Math.log(1000)), UNITS.length - 1);
	var numStr = Number((num / Math.pow(1000, exponent)).toPrecision(3));
	var unit = UNITS[exponent];

	return (neg ? '-' : '') + numStr + ' ' + unit;
};

})(window);
