FROM debian:wheezy
MAINTAINER Jan Guth <jan.guth@gmail.com>

ENV MONGO_MAJOR 3.1
ENV MONGO_VERSION 3.1.6

# set cluster child (shards, config) server ips
# e.g. x.x.x.x:pppp[,...]
#
ENV MONGO_CLUSTER_ENABLED=1

ENV MONGO_CLUSTER_CONFIGSVR=""
ENV MONGO_CLUSTER_SHARDS=""
ENV MONGO_CLUSTER_MONGOS=""

ENV MONGO_CLUSTER_CNAME=""

ENV MONGO_CLUSTER_UDP_PORT=27023

ENV MONGO_CLUSTER_TIMEOUT=5000
ENV MONGO_CLUSTER_RETRIES=3

ENV BUNYAN_STDOUT_LEVEL='info'

# add our user and group first to make sure their IDs get assigned consistently, regardless of whatever dependencies get added
RUN groupadd -r mongodb && useradd -r -g mongodb mongodb

# Remove non-critical packages (don't remove busybox -> don't sure if this ist still a problem on debian 7)
# ~i -> list all installed packages
# !~M -> don't list automatic installed packages
# !~prequired -> don't list packages with priority required
# !~pimportant -> don't list packages with priority important
# !~R~prequired -> don't list dependency packages of required packages
# !~R~pimportant -> don't list dependency packages of important packages
# !~R~R~prequired -> don't list dependency packages of dependency packages of required packages -.- (two levels should be enough. Have not found a recursive option)
# !~R~R~pimportant -> ... required packages
# !busybox -> don't list busybox
# !grub -> don't list grub (we need a boot manager. If LILO or something else is used change this)
# !initramfs-tools -> don't list initramfs-tools (else the kernel is gone)
# --
# apt-get purge $(aptitude search '~i!~M!~prequired!~pimportant!~R~prequired!~R~R~prequired!~R~pimportant!~R~R~pimportant!busybox!grub!initramfs-tools' | awk '{print $2}') && \
# apt-get purge aptitude && \
# apt-get autoremove && \
# apt-get clean && \
RUN \
  apt-get update && \
  apt-get install -y --no-install-recommends \
    ca-certificates curl \
    numactl \
    apt-transport-https \
  && rm -rf /var/lib/apt/lists/*

# grab gosu for easy step-down from root
RUN gpg --keyserver ha.pool.sks-keyservers.net --recv-keys B42F6819007F00F88E364FD4036A9C25BF357DD4
RUN \
  curl -o /usr/local/bin/gosu -SL "https://github.com/tianon/gosu/releases/download/1.2/gosu-$(dpkg --print-architecture)" && \
  curl -o /usr/local/bin/gosu.asc -SL "https://github.com/tianon/gosu/releases/download/1.2/gosu-$(dpkg --print-architecture).asc" && \
  gpg --verify /usr/local/bin/gosu.asc && \
  rm /usr/local/bin/gosu.asc && \
  chmod +x /usr/local/bin/gosu

# grap jq for json parsing
RUN curl -o /usr/local/bin/jq -SL 'https://github.com/stedolan/jq/releases/download/jq-1.5/jq-linux64' && \
  chmod +x /usr/local/bin/jq

# gpg: key 7F0CEB10: public key "Richard Kreuter <richard@10gen.com>" imported
RUN apt-key adv --keyserver ha.pool.sks-keyservers.net --recv-keys 492EAFE8CD016A07919F1D2B9ECBEC467F0CEB10
RUN echo "deb http://repo.mongodb.org/apt/debian wheezy/mongodb-org/$MONGO_MAJOR main" > /etc/apt/sources.list.d/mongodb-org.list
#
RUN curl -s https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add -
RUN echo 'deb https://deb.nodesource.com/node_0.12 wheezy main' > /etc/apt/sources.list.d/nodesource.list

RUN set -x && \
  apt-get update && \
  apt-get install -y --force-yes \
    mongodb-org-unstable=$MONGO_VERSION \
    mongodb-org-unstable-server=$MONGO_VERSION \
    mongodb-org-unstable-shell=$MONGO_VERSION \
    mongodb-org-unstable-mongos=$MONGO_VERSION \
    mongodb-org-unstable-tools=$MONGO_VERSION \
    nodejs \
  && rm -rf /var/lib/apt/lists/* \
  && rm -rf /var/lib/mongodb \
  && mv /etc/mongod.conf /etc/mongod.conf.orig

RUN \
  npm install -g forever && \
  npm install -g bunyan

RUN \
  mkdir -p /var/log/mongo-cluster && chown -R mongodb:mongodb /var/log/mongo-cluster && \
  mkdir -p /data/db && chown -R mongodb:mongodb /data/db && \
  mkdir -p /data/configdb && chown -R mongodb:mongodb /data/configdb
VOLUME /data/db
VOLUME /data/configdb

COPY ./cluster /opt
COPY docker-entrypoint.sh /entrypoint.sh
RUN \
  cd /opt && npm install && \
  touch /run/mongodb.pid && \
  chown mongodb:mongodb /run/mongodb.pid

ENTRYPOINT ["/entrypoint.sh"]

# udp port
EXPOSE $MONGO_CLUSTER_UDP_PORT

# default shard server port
EXPOSE 27017
# default mongod port
EXPOSE 27018
# default mongod --configsvr port
EXPOSE 27019
# http monitoring
EXPOSE 28017
EXPOSE 28018
EXPOSE 28019
CMD ["mongod"]
