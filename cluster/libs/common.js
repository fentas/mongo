var argv = require('minimist')(process.argv.slice(2)),
    mongo = require('mongodb-core'),
    udp = require('../utils/udp'),
    middleware = require('../utils/middleware'),
    instance = require('./instance'),
    exec = require('../utils/exec'),
    util = require('util'),
    dns = require('dns'),
    bunyan = require('bunyan')



util.inherits(common, middleware)
function common() {
  this.instances = {}
  this.count = 0
}

common.prototype.addInstance = function(host) {
  var inst = new instance(host)
  return this.instances[inst.getFullAddress()] = inst;
}

common.prototype.getInstances = function() {
  return this.instances
}

common.prototype.lookupMongoCluster = function() {
  bunyan.debug('lookup env MONGO_CLUSTER_INSTANCES', process.env['MONGO_CLUSTER_INSTANCES'])

  var env = process.env['MONGO_CLUSTER_INSTANCES'],
      instances = '',
      self = this

  self.instances = {}

  var pongCount = 0,
      pong = function() {
        if ( ++pongCount == self.count ) {
          bunyan.info('Pong complete.')
          self.emit('lookup', self.instances)
        }
      }

  if ( env.text(/^https?:/) ) {
    bunyan.debug('Recognized MONGO_CLUSTER_INSTANCES as URL')
  }
  else if ( env.test(/^#/) ) {
    bunyan.debug('Recognized MONGO_CLUSTER_INSTANCES as bash script')

    env = exec(env.substr(1))
    if ( env.code === 0 ) bunyan.error('bash script returned error code', env)
    instances = env.output
  }
  else instances = env

  if ( instances.test(/^(.+,?)*$/) { //\d{3}\.\d{3})\.\d{3}\.\d{3}
    bunyan.debug('Got mongo instance list', instances)

    instances = instances.split(',')
    self.count = instances.length

    for ( var i = 0 ; i < instances.length ; i++ ) {
      bunyan.debug('Resolve A records', instances[i])

      dns.resolve(instances[i], 'A', function(error, addresses) {
        if ( error ) {
          bunyan.debug('No A records, error occured', instances[i], error)
          bunyan.debug('Lookup instance', instances[i].split(':')[0])
          dns.lookup(instances[i].split(':')[0], 4, function(error, address, family) {
            if ( err ) {
              bunyan.error('Could not lookup instance. Instance will be ignored.', instances[i], error)
              --self.count
              return
            }

            var faddress = address + (':'+instances[i].split(':')[1] || '').replace(/:$/, '')
            self.instances[faddress] = new instance(faddress, pong)

            if ( Object.keys(self.instances).length == self.count ) {
              bunyan.debug('Everything resolved. Waiting for pong.')
            }
          })
        }
        continue
      }
      bunyan.debug('A records found')
      self.count += addresses.length - 1

      for ( var x = 0 ; x < addresses.length ; x++ ) {
        self.instances[addresses[x]] = new instance(addresses[x], pong)
      }

      if ( Object.keys(self.instances).length == self.count ) {
        bunyan.debug('Everything resolved. Waiting for pong.')
      }
    }
  }
  else bunyan.fatal('Maleformed mongo instance list', instances)
}

module.exports = exports = new function() {
  var use = new common(),
      responses = [],
      local = new instance()

  use.on('ping', function(instance) {
    bunyan.info('Got ping.', instance.getFullAddress())
    // send instance status
    instance.emit('status', local.toJSON())
  })

  use.on('status', function (instance, status) {
    bunyan.info('Got status.', instance.getFullAddress())
    instance.set('status', status)
  })


  return use
}
