var argv = require('minimist')(process.argv.slice(2)),
    mongo = require('mongodb-core'),
    dgram = require("dgram"),
    instances = require('libs/cluster-instances'),
    jsonb = require('json-buffer'),
    common = require('../libs/common')

module.exports = exports = new function() {
  var middlewares = [],
      udp = dgram.createSocket("udp4")

  udp.on("error", function (err) {
    console.log("server error:\n" + err.stack);
    udp.close();
    process.exit(1)
  })

  udp.on("message", function (msg, rinfo) {
    var msg = JSON.parse(msg.toString('utf8')),
        instance = common.getInstances(msg.type)

    if ( ! instance ) {
      console.log('New instance recognized', rinfo)
      instance = common.addInstance(rinfo)
    }

    msg.args.unshift([msg.event, instance])
    for ( var i = 0 ; i < middleware.length ; i++ ) {
      middleware[i].emit.apply(middleware[i], msg.args)
    }
  })

  udp.use = function(use) {
    middlewares[] = use
  }

  return udp
}
