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
  this.shards = null
  this.mongos = null
  this.count = 0
}

common.prototype.addInstance = function(host, type) {
  var inst = new instance(host, type)
  this[type][] = inst
  return inst
}

common.prototype.getInstances = function(type) {
  return this[type]
}

common.prototype.lookupMongoCluster = function(itype) {
  bunyan.debug('lookup env MONGO_CLUSTER_INSTANCES', process.env['MONGO_CLUSTER_INSTANCES'])

  [
    process.env['MONGO_CLUSTER_CONFIGSVR'],
    process.env['MONGO_CLUSTER_SHARDS'],
    process.env['MONGO_CLUSTER_MONGOS']
  ].forEach(function(env, z) {
    var type = ['configsvr', 'shards', 'mongos'][z],
        self = this,
        list = env,
        instances = null,

        count = 0,
        pongCount = 0,

        pong = function() {
          if ( ++pongCount == count ) {
            bunyan.info('Pong complete.')
            itype.emit('initialize', self[type])
          }
        }

    if ( /^#/.test(list) ) {
      bunyan.debug('Recognized MONGO_CLUSTER_INSTANCES as bash script')

      list = exec(list.substr(1))
      if ( list.code === 0 ) bunyan.error('bash script returned error code', list)
      instances = list.output
    }
    else instances = list

    if ( /^(.+,?)*$/.test(instances) { //\d{3}\.\d{3})\.\d{3}\.\d{3}
      bunyan.debug('Got mongo instance list', instances)

      instances = instances.split(',')
      count = instances.length

      for ( var i = 0 ; i < instances.length ; i++ ) {
        bunyan.debug('Resolve A records', instances[i])

        dns.resolve(instances[i], 'A', function(error, addresses) {
          if ( error ) {
            bunyan.debug('No A records, error occured', instances[i], error)
            bunyan.debug('Lookup instance', instances[i].split(':')[0])


            var inst = new instance(address + (':'+instances[i].split(':')[1] || '').replace(/:$/, '') , type)
            inst.lookup(function(error) {
              if ( error ) {
                --count
                return
              }

              inst.ping(pong)
              self[type][] = inst

              if ( self[type].length == count ) {
                bunyan.debug('Everything resolved. Waiting for pong.')
              }
            })
            return
          }

          bunyan.debug('A records found')
          count += addresses.length - 1

          for ( var x = 0 ; x < addresses.length ; x++ ) {
             var inst = new instance(addresses[x], type)
             inst.ping(pong)
             self[type][] = inst
          }

          if ( self[type].length == count ) {
            bunyan.debug('Everything resolved. Waiting for pong.')
          }
        })
      }
    }
    else bunyan.fatal('Maleformed mongo instance list', instances)
  })
}

module.exports = exports = new function() {
  var use = new common(),
      responses = []

  use.on('ping', function(instance) {
    bunyan.info('Got ping.', instance.toString())
    // send instance status
    instance.emit('pong', local.toJSON())
  })

  use.on('pong', function (instance, status) {
    bunyan.info('Got status.', instance.toString())
    instance.set(status)
  })


  return use
}
