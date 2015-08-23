#!/bin/bash
set -e

if [ "${1:0:1}" = '-' ]; then
	set -- mongod "$@"
fi

if [ "$1" = 'mongod' ] || [ "$1" = 'mongos' ]; then
	chown -R mongodb /data/db /data/configdb

	numa='numactl --interleave=all'
	if $numa true &> /dev/null; then
		set -- $numa "$@"
	fi

	if [ ! -z $MONGO_CLUSTER_SERVER ]; then
		forever start /opt/cluster/index.js "$@"
	fi
	exec gosu mongodb "$@" --pidfilepath /run/mongodb.pid
fi

exec "$@"
