var udp = require('../utils/udp'),
    middleware = require('../utils/middleware'),
    instance = require('./instance'),
    local = require('./local'),
    exec = require('../utils/exec'),
    util = require('util'),
    dns = require('dns'),
    bunyan = require('../utils/bunyan')()

util.inherits(common, middleware)
function common() {
  this.configsvr = null
  this.shard = null
  this.mongos = null
  this.count = 0
}

common.prototype.addInstance = function(host, type) {
  var inst = new instance(host, type)
  this[type].push(inst)
  return inst
}

common.prototype.getInstances = function(type) {
  return this[type].filter(function(instance) {
    // remove not reachable instances
    if ( instance.get(status) )
      return true
  })
}

common.prototype.lookupMongoCluster = function(itype) {
  bunyan.debug({MONGO_CLUSTER_INSTANCES: process.env['MONGO_CLUSTER_INSTANCES']}, 'lookup env.');

  [
    process.env['MONGO_CLUSTER_CONFIGSVR'],
    process.env['MONGO_CLUSTER_SHARDS'],
    process.env['MONGO_CLUSTER_MONGOS']
  ]
  .forEach(function(env, z) {
    if ( ! env ) return;

    var type = ['configsvr', 'shard', 'mongos'][z],
        self = this,
        list = env,
        instances = null,

        count = 0,
        pongCount = 0,

        pong = function() {
          bunyan.debug('Instance %s of %s loaded.', pongCount+1, count)
          if ( ++pongCount == count ) {
            bunyan.info('Pong complete.')
            if ( typeof itype == 'function' )
              itype()
            else
              itype.emit('_initialize')
          }
        }

    if ( /^https?/.test(list) ) {
      bunyan.debug({list: list}, 'Recognized MONGO_CLUSTER_INSTANCES as http url.')

      list = exec('curl -s -L "'+list+'"')
      if ( list.code !== 0 ) bunyan.error({shell: list}, 'bash script returned error code.')
      instances = list.output
    }
    else if ( /^#/.test(list) ) {
      bunyan.debug({list: list}, 'Recognized MONGO_CLUSTER_INSTANCES as bash script.')

      list = exec(list.substr(1))
      if ( list.code !== 0 ) bunyan.error({shell: list}, 'bash script returned error code.')
      instances = list.output
    }
    else instances = list

    if ( instances && /^(.+,?)+$/.test(instances) ) { //\d{3}\.\d{3})\.\d{3}\.\d{3}
      bunyan.debug({instances: instances}, 'Got mongo instance list.')

      instances = instances.split(',')
      count = instances.length

      for ( var i = 0 ; i < instances.length ; i++ ) {
        if ( ! instances[i] ) continue

        (function(instance) {
          bunyan.debug({instance: instance}, 'Resolve A records.')

          dns.resolve(instance.split(':')[0], 'A', function(error, addresses) {
            if ( error ) {
              bunyan.debug({error: error}, 'No A records, error occured')

              var inst = new instance(instance, type)
              inst.lookup(function(error) {
                if ( error ) {
                  --count
                  return
                }

                inst.ping(pong)
                self[type].push(inst)

                if ( self[type].length == count ) {
                  bunyan.debug('Everything resolved. Waiting for pong.')
                }
              })
              return
            }

            bunyan.debug('A records found')
            count += addresses.length - 1

            for ( var x = 0 ; x < addresses.length ; x++ ) {
               var inst = new instance(addresses[x] + (':'+instance.split(':')[1] || '').replace(/:$/, ''), type)
               inst.ping(pong)
               self[type].push(inst)
            }

            if ( self[type].length == count ) {
              bunyan.debug('Everything resolved. Waiting for pong.')
            }
          })
        })(instances[i])
      }
    }
    else bunyan.warn({instances: instances}, 'Maleformed mongo instance list.')
  })
}

module.exports = exports = new function() {
  var use = new common(),
      responses = []

  use.on('ping', function(instance, status) {
    bunyan.info({instance: instance.toString()}, 'Got ping.')

    instance.set(status)
    // send local instance status
    instance.emit('pong', local.toJSON())
  })

  use.on('pong', function (instance, status) {
    bunyan.info({instance: instance.toString()}, 'Got status.')

    instance.set(status)
  })


  return use
}
