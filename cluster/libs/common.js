var argv = require('minimist')(process.argv.slice(2)),
    mongo = require('mongodb-core'),
    udp = require('../utils/udp'),
    middleware = require('../utils/middleware'),
    instance = require('../utils/instance'),
    exec = require('../utils/exec'),
    util = require('util'),
    dns = require('dns')



util.inherits(common, middleware)
function common() {
  this.instances = {}
  this.count = 0
}

common.prototype.addInstance = function(host) {
  var inst = new instance(host)
  return this.instances[inst.getFullAddress()] = inst;
}
common.prototype.getInstances = function(cb) {
  if ( typeof cb !== 'function' ) return this.instances

  var env = process.env['MONGO_CLUSTER_INSTANCES'],
      instances = '',
      self = this
  self.instances = {}

  if ( env.text(/^https?:/) ) {

  }
  else if ( env.test(/^#/) ) {
    env = exec(env.substr(1))
    if ( env.code === 0 )
      instances = env.output
  }
  else instances = env

  if ( instances.test(/^(.+,?)*$/) { //\d{3}\.\d{3})\.\d{3}\.\d{3}
    instances = instances.split(',')
    self.count = instances.length

    for ( var i = 0 ; i < instances.length ; i++ ) {
      dns.resolve(instances[i], 'A', function(error, addresses) {
        if ( error ) {
          dns.lookup(instances[i].split(':')[0], 4, function(error, address, family) {
            if ( err ) {
              //TODO: what to do? ignore it?
              console.warn('Could not resolve ['+instances[i]+']')
              --self.count
              return
            }

            var faddress = address + (':'+instances[i].split(':')[1] || '').replace(/:$/, '')
            self.instances[faddress] = new instance(faddress)

            if ( Object.keys(self.instances).length == self.count )
              cb(self.instances)
          })
        }
        continue
      }
      self.count += addresses.length - 1

      for ( var x = 0 ; x < addresses.length ; x++ )
        self.instances[addresses[x]] = new instance(addresses[x])
      
      if ( Object.keys(self.instances).length == self.count )
        cb(self.instances)
    }


  }
  else throw new TypeError('Maleformed MONGO_CLUSTER_INSTANCES')
}

common.prototype.brodcast = function(cb) {
  var self = this

  self.getInstances(function(instances) {
    for ( address in self.instances )
      self.instances[address].emit('ping')

    var tries = 0
    function allResponded() {
      var count = 0,
          again = {}

      for ( address in self.instances ) {
        if ( typeof self.instances[address].get('status') !== 'undefined' )
          ++count
        else
          again[] = self.instances[address]
      }

      if ( self.count == count ) {
        cb()
        return
      }
      else if ( ++tries > process.env['MONGO_CLUSTER_RETRIES'] ) {
        //TODO: what to do? ~ ignore or exit?
        throw new Error('Given server not responding..')
      }
      else for ( var i = 0 ; i < again.length ; i++ )
        again[i].emit('ping')

      setTimeout(allResponded, process.env['MONGO_CLUSTER_TIMEOUT'])
    }
    setTimeout(allResponded, process.env['MONGO_CLUSTER_TIMEOUT'])
  })
}


module.exports = exports = new function() {
  var use = new common(),
      responses = [],
      local = new instance()

  use.on('ping', function(instance) {
    // get status
    instance.emit('status', local.toJSON())
  })

  use.on('status', function (instance, status) {
    instance.set('status', status)
  })


  return use
}
