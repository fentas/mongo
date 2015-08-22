var argv = require('minimist')(process.argv.slice(2)),
    udp = require('utils/udp'),
    common = require('libs/common')

udp
  .use(common)

  .bind(29017)

common.lookupMongoCluster()
