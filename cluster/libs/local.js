var argv = require('minimist')(process.argv.slice(2)),
    util = require('util'),
    instance = require('./instance'),
    bunyan = require('../utils/bunyan')()

util.inherits(local, instance)
function local() {
  //TODO: check persistent

  this.set('started', +new Date)
  this.set('status', 'unconfigured')


  this.set('cname', process.env['MONGO_CLUSTER_CNAME'])
  this.lookup(function(error) {
    if ( error )
      bunyan.fatal('Can not lookup local instance.', process.env['MONGO_CLUSTER_CNAME'], error)
  })

  this.set('_argv', argv)
  switch ( argv._[0] ) {
    case 'mongod':
      if ( argv['configsvr'] ) {
        this.set('type', 'configsvr')
      }
      else {
        this.set('type', 'mongod')
        this.set('replSet', argv['replSet'])
      }

      break;
    case 'mongos':
      this.set('type', 'mongos')
      break;
  }

}

module.exports = exports = new local
