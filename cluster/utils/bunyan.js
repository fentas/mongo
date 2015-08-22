var bunyan = require('bunyan'),
    extend = require('extend'),
    logger

module.exports = exports = function(options) {
  if ( logger ) {
    return logger
  }

  return logger = bunyan.createLogger(
    extend({
      name: 'syslog',
      streams: [
        {
          type: 'rotating-file',
          path: '/etc/mongo-cluster/messages.log',
          period: '1d',
          count: 3
        }
      ]
    }, options)
  )
}
