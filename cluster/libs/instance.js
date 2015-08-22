var argv = require('minimist')(process.argv.slice(2)),
    dgram = require("dgram"),
    config = require('../config'),
    udp = dgram.createSocket("udp4"),
    bunyan = require('bunyan')


function instance(host, cb) {
  this.data = {}

  if ( typeof host !== 'undefined' ) {
    var self = this

    if ( typeof host === 'string' )
      host = host.split(':').map(function(data) { return {address: data[0], port: data[1]} })

    this.address = host.address
    this.port = host.port || config.udp.port

    bunyan.debug('pong.', self.getFullAddress())
    this.emit('ping')

    var tries = 0
    var pong = function() {
      if ( typeof self.get('status') !== 'undefined' ) return cb.apply(self, [])


      if ( ++tries > process.env['MONGO_CLUSTER_RETRIES'] ) {
        bunyan.error('Instance did not responed', self.getFullAddress())

        self.set('status', null)
      }
      else {
        bunyan.debug('Retry pong.', tries)

        self.emit('ping')
        setTimeout(pong, process.env['MONGO_CLUSTER_TIMEOUT'])
      }
    }
    setTimeout(pong, process.env['MONGO_CLUSTER_TIMEOUT'])

    return this
  }

  this.set('argv', argv)
  switch ( argv._[0] ) {
    case 'mongod':
      if ( argv['configsvr'] ) {
        this.set('type', 'configsvr')
      }
      else {
        this.set('type', 'mongod')
      }

      break;
    case 'mongos':
      this.set('type', 'mongos')
      break;
  }
}

instance.prototype.emit = function(event) {
  var msg = {
    event: event,
    args: arguments.slice(1)
  }
  msg = new Buffer(JSON.stringify(msg))
  bunyan.debug('udp.send', msg, this.address, this.port)
  
  udp.send(msg, 0, msg.length, this.address, this.port)
}

instance.prototype.getFullAddress = function() {
  return this.address + ':' + this.port
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
  return JSON.stringify(this.data)
}

module.exports = exports = instance
