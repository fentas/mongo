var argv = require('minimist')(process.argv.slice(2)),
    dgram = require("dgram"),
    config = require('../config'),
    dns = require('dns'),
    udp = dgram.createSocket("udp4"),
    bunyan = require('../utils/bunyan')()


function instance(host, type) {
  this.data = {}
  this.set('type', type)

  if ( typeof host !== 'undefined' ) {
    var self = this

    if ( typeof host === 'string' )
      host = host.split(':').map(function(data) { return {address: data[0], port: data[1]} })

    if ( /^(\d{1,3}\.?){4}$/.test(host.address) )
      this.set('address', host.address)
    else
      this.set('cname', host.address)

    this.set('port', host.port)
  }
}

instance.prototype.lookup = function(cb) {
  var cb = cb || function() {},
      self = this

  dns.lookup(this.get('cname') || this.get('address'), 4, function(error, address, family) {
    cb.apply(self, arguments)
    if ( error ) {
      bunyan.error('Could not lookup instance.', self.toString(), error)
      return
    }

    self.set('address', address)
  })
}

instance.prototype.ping = function(cb) {
  bunyan.debug('Ping.', tries)
  this.emit('ping')

  var tries = 0
  var pong = function() {
    if ( typeof self.get('status') !== 'undefined' ) return cb.apply(self, [])


    if ( ++tries > process.env['MONGO_CLUSTER_RETRIES'] ) {
      bunyan.error('Instance did not responed', self.toString())

      self.set('status', null)
    }
    else {
      bunyan.debug('Retry ping.', tries)

      self.emit('ping')
      setTimeout(pong, process.env['MONGO_CLUSTER_TIMEOUT'])
    }
  }
  setTimeout(pong, process.env['MONGO_CLUSTER_TIMEOUT'])
}

instance.prototype.emit = function(event) {
  var msg = {
    event: event,
    type: this.get('type')
    args: arguments.slice(1)
  }
  msg = new Buffer(JSON.stringify(msg))
  bunyan.debug('udp.send', msg, this.address, process.env['MONGO_CLUSTER_UDP_PORT'])

  udp.send(msg, 0, msg.length, this.address, process.env['MONGO_CLUSTER_UDP_PORT'])
}

instance.prototype.toString = function() {
  return this.get('dns') + '/' + this.get('address') + ':' + this.get('port')
}

instance.prototype.set = function(data, value) {
  if ( typeof data == 'object' ) {
    return extend(this.data, data)
  }
  return this.data[data] = key
}
instance.prototype.get = function(key) {
  return this.data[key]
}

instance.prototype.toJSON = function() {
  return JSON.stringify(this.data, function(key, value) {
    // strip privates
    if ( ! /^_/.test(key) ) return value
  })
}

module.exports = exports = instance
