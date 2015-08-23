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
      bunyan.fatal({cname: process.env['MONGO_CLUSTER_CNAME'], error: error}, 'Can not lookup local instance.')
  })

  this.set('_.argv', argv)
  switch ( argv._[0] ) {
    case 'mongod':
      if ( argv['configsvr'] ) {
        this.set('type', 'configsvr')
        this.set('port', (argv['port'] ? argv['port'] : 27019))
      }
      else {
        this.set('type', 'shard')
        this.set('port', (
          argv['port'] ? argv['port'] : ( argv['shardsvr'] ? 27018 : 27017 ))
        )
      }

      break;
    case 'mongos':
      this.set('type', 'mongos')
      this.set('port', (argv['port'] ? argv['port'] : 27017))
      break;
  }

}

module.exports = exports = new local
