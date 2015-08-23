#!/bin/bash
set -e

if [ "${1:0:1}" = '-' ]; then
	set -- mongod "$@"
fi

if [ "$1" = 'mongod' ] || [ "$1" = 'mongos' ]; then
	chown -R mongodb /data/db /data/configdb

	if [ ! -z $MONGO_CLUSTER_SERVER ]; then
		function watchCluster() {
			sleep 10
			forever start /opt/cluster/index.js "$@"
		}
		watchCluster "$@" &
	fi

	numa='numactl --interleave=all'
	if $numa true &> /dev/null; then
		set -- $numa "$@"
	fi

	exec gosu mongodb "$@" --pidfilepath /run/mongodb.pid
fi

exec "$@"
