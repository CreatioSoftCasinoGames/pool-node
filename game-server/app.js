var pomelo = require('pomelo');
var dispatcher = require('./app/util/dispatcher');
var backendFetcher = require('./app/util/backendFetcher');
var redisUtil = require('./app/util/redisUtil');

/**
 * Init app for client.
 */

var app = pomelo.createApp();
var poolConstants = require('./config/poolConstants.json')[app.get("env")];
var redis = require('redis').createClient(poolConstants.redisPort, poolConstants.redisHost, {});

app.set('redis', redis)
app.set('name', 'pool');
app.set('poolConstants', poolConstants);

// app configuration
app.configure('production|development', 'connector', function(){
  app.set('connectorConfig',
    {
      connector : pomelo.connectors.sioconnector,
      transports : ['websocket'],
      heartbeats : true,
      closeTimeout : 60,
      heartbeatTimeout : 60,
      heartbeatInterval : 25
    });
});

// var poolRoute = function (session, msg, app, cb) {
//   var poolServers = app.getServersByType('pool');

//   if (!poolServers || poolServers.length === 0) {
//     cb (new Error ('can not find pool servers.'));
//     return;
//   }
//   var index = parseInt(session.get("tableConfigId")) % poolServers.length;
//   var res = poolServers[index];
//   cb(null, res.id);
// };

// app.configure('production|development', function() {
//   app.route('pool', poolRoute);
// });

// start app
app.start();

process.on('uncaughtException', function (err) {
  console.error(' Caught exception: ' + err.stack);
});

