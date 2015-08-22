var udp = require('../utils/udp'),
    middleware = require('../../utils/middleware'),
    bash = require('../../utils/bash'),
    common = require('../common'),
    local = require('../local'),
    bunyan = require('../../utils/bunyan')()

bash.defaultOptions = {
  scriptPath: __dirname
}

util.inherits(mongod, middleware)
function mongod() {

}

module.exports = exports = new function() {
  var use = new mongod()

  function choose(inst1, inst2) {
    return (
      parseInt(inst1.get('address').replace(/\./g, '')) < parseInt(inst2.get('address').replace(/\./g, '')) ? inst1 : inst2
    )
  }

  common.on('initialize', function(instances) {
    // on reboot nothing to do
    if ( local.status == 'configured' ) return;

    if ( local.get('replSet') ) {
      var rs = instances.filter(function(instance, i) {
        if ( instance.get('replSet') == local.get('replSet') )
          return true
      })

      var state = null,
          setup = true
      for ( var i = 0 ; i < rs.length ; i++ ) {
        if ( setup ) setup = local.get('started') < rs[i].get('started')

        if ( rs[i].get('mongo.state') != '' ) {
          bunyan.debug('ReplSet instance', rs[i].toString, rs[i].get('mongo.state'))
          state = 'unknown'
        }

        if ( rs[i].get('mongo.state') == '1' ) {
          bunyan.info('ReplSet found primary', rs[i].toString())
          primary = rs[i]
        }
      }

      if ( setup ) {
        if ( rs.length != 2 ) bunyan.warn('There should be 3 instances in %s. Given: %s', local.get('replSet'), rs.length)

        // set prime. me!!
        bash.run('setPrime', {
          args: rs.map(function(instance) {
            return (instance.get('cname') || instance.get('address')) + ':' + instance.get('port')
          })
        })
      }
    }
  })

  return use
}
