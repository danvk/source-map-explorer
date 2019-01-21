module.exports = {
    root: true,
    "env": {
        "commonjs": true,
        "mocha": true,
        "node": true,
        "es6": true
    },
    "parserOptions": {
        "ecmaVersion": 2018,
    },
    "extends": "eslint:recommended",
    "rules": {
        "indent": [
            "error",
            2
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ],
        "no-console": 0
    }
};
