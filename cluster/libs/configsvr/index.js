var udp = require('../utils/udp'),
    middleware = require('../../utils/middleware'),
    shell = require('../../utils/shell'),
    common = require('../common'),
    local = require('../local'),
    bunyan = require('../../utils/bunyan')()

shell.defaultOptions = {
  scriptPath: __dirname,
  mode: 'json'
}

util.inherits(mongos, middleware)
function mongos() {

}

module.exports = exports = new function() {
  var use = new mongos()

  // first run
  common.on('_initialize', function(instances) {

  })

  return use
}
