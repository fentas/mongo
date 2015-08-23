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

util.inherits(shard, middleware)
function shard() {

}

module.exports = exports = new function() {
  var use = new shard()

  function isMaster(cb) {
    var cb = cb || function() {}
    // keep it up to date
    shell.run('_.db.isMaster', function(err, result) {
      if ( err ) bunyan.error('_.db.isMaster failed', err)
      local.set('_.db.isMaster', result[0])

      cb()
    })
  }

  use.on('rs.add', function(instance) {
    isMaster(function() {
      if ( local.get('_.db.isMaster').ismaster ) {
        shell.run('_.rs.add.sh', {
          "args": {
            "members": [instance.getFullAddress()]
          }
        }, function(err, result) {
          if ( err ) instance.emit('error', {'errmsg': 'rs.add error', 'data': err})
        })
      }
      else instance.emit('error', {'errmsg': 'i am not prime.'})
    })
  })

  use.on('rs.remove', function(instance) {
    isMaster(function() {
      if ( local.get('_.db.isMaster').ismaster ) {
        shell.run('_.rs.remove.sh', {
          "args": {
            "members": [instance.getFullAddress()]
          }
        }, function(err, result) {
          if ( err ) instance.emit('error', {'errmsg': 'rs.remove error', 'data': err})
        })
      }
      else instance.emit('error', {'errmsg': 'i am not prime.'})
    })
  })

  //TODO: add shard?

  use.on('_setup', function() {
    // replSet is in startup.
    if ( local.get('_.rs.status').startupStatus ) {
      var rs = common.getInstances('shard').filter(function(instance, i) {
        //TODO: what if config file is used.
        if ( instance.get('_.argv').replSet == local.get('_.argv').replSet )
          return true
      })

      switch ( local.get('_.rs.status').startupStatus ) {
        // errmsg:  loading local.system.replset config (LOADINGCONFIG)
        // url[]:   http://ufasoli.blogspot.de/2013/05/reconfiguring-mongodb-replicaset-after.html
        case 1:
          if ( local.get('_.rs.conf') ) {
            bunyan.error('Stuck on rs startup.')
          }
          //TODO: death loop?
          else setTimeout(function() { use.emit('_setup') }, 1000)
          break;
        // errmsg:  can't get local.system.replset config from self or any seed (EMPTYCONFIG)
        // info:    run rs.initiate(...) if not yet done for the set
        case 3:
          var primary = null,
              setup = true

          for ( var i = 0 ; i < rs.length ; i++ ) {
            if ( setup ) setup = local.get('started') < rs[i].get('started')

            if ( rs[i].get('_.rs.isMaster').ismaster ) {
              primary = rs[i]
              break
            }
          }

          if ( primary ) {
            primary.emit('rs.add')
          }
          else if ( setup ) {
            if ( rs.length != 2 ) bunyan.warn('There should be 3 instances in %s. Given: %s', local.get('replSet'), rs.length)
            var members = []
            members[] = local.getFullAddress()
            for ( var i = 0 ; i < rs.length ; i++ )
              members[] = rs[i].getFullAddress()

            shell.run('_.rs.add.sh', {
              "args": {
                "initiate": true,
                "members": members
              }
            }, function(err, result) {
              if ( err ) bunyan.fatal('_.rs.add.sh failed', err)

              local.set('_.rs.status', result[0])
            })
          }

          break;
        // errmsg:  all members and seeds must be reachable to initiate set
        // url[]:   http://www.devthought.com/2012/09/18/fixing-mongodb-all-members-and-seeds-must-be-reachable-to-initiate-set/
        case 4:
          //TODO: reconfig members of prime

          break;
        default:
          bunyan.error('Unknown startupStatus.', local.get('_.rs.status'))
      }
    }
  })

  // first run
  common.on('_initialize', function(instances) {
    // on reboot nothing to do
    if ( local.status == 'configured' ) return;

    // gather instance information
    var done = [],
    [
      '_.rs.status.sh',
      '_.rs.conf.sh',
      '_.rs.db.isMaster.sh'
    ].forEach(function(cmd, i, todo) {
      shell.run(cmd, function(err, result) {
        if ( err ) bunyan.error(cmd + ' failed', err)
        local.set(cmd.replace(/\.sh$/, ''), result[0])

        done[] = true
        if ( done.length == todo.length)
          use.emit('_setup')
      })
    })
  })

  return use
}
