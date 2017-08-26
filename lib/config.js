var fs = require('fs');

var exports = {
};

var FILENAME = 'notstu-config.json';
var AUTHFILENAME = 'notstu-auth.json';

var reload = function() {
  try {
    exports = {
      auth: {}
    };

    var parsed = JSON.parse(fs.readFileSync(FILENAME, 'utf8'));

    for (var key in parsed) {
      exports[key] = parsed[key];
    }

    exports.reload = reload;

    var parsed = JSON.parse(fs.readFileSync(AUTHFILENAME, 'utf8'));

    exports.auth = {};

    for (var key in parsed) {
      exports.auth[key] = parsed[key];
    }

    exports.reload = reload;
  } catch (e) {
    if (e.code == 'ENOENT') {
      // File doesn't exist
      console.log(`Error: The file ${e.path} doesn't exist!`);
    } else {
      console.log(e);
    }
  }
};

reload();

module.exports = exports;
o
