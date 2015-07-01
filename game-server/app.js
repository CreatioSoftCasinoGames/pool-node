var pomelo = require('pomelo');
var dispatcher = require('./app/util/dispatcher');
var backendFetcher = require('./app/util/backendFetcher');
var redisUtil = require('./app/util/redisUtil');
var _ = require('underscore');

/**
 * Init app for client.
 */

var app = pomelo.createApp();
var poolConstants = require('./config/poolConstants.json')[app.get("env")];
var redis = require('redis').createClient(poolConstants.redisPort, poolConstants.redisHost, {});
var redisPubSubClient   = require('redis').createClient(poolConstants.redisPort, poolConstants.redisHost, {});

//Register pub/sub events with redis
redisPubSubClient.subscribe("friend_online");
redisPubSubClient.subscribe("friend_added");

app.set('redis', redis)
app.set('name', 'pool');
app.set('poolConstants', poolConstants);
app.set('redisPubSubClient', redisPubSubClient);


if(app.get('serverId') == "connector-server-1") {
  // var connector = app.components.__connector__;
  // console.log(connector);
  redisPubSubClient.on("message", function(channel, message) {
    if(!!message) {
      console.log(message);
      message = JSON.parse(message);
      console.log(message);
      if(message.publish_type == "gift_received") {
        console.log('========= New friend online ==========');
        if(!!app.get('sessionService')) {
          if(!!message.send_to_token) {
            var connector = app.components.__connector__;
            console.log('Send giftReceived broadcast to  - '+message.send_to_token+'!');
            if(!!app.get('sessionService').getByUid(message.send_to_token) && app.get('sessionService').getByUid(message.send_to_token).length > 0) {
              connector.send(null, "giftReceived", {message: message}, [app.get('sessionService').getByUid(message.send_to_token)[0].id], {}, function(err) {
                console.log('Braodcast giftReceived to  - '+uid+' has been successfully sent !');
                // cb(null)
              });
            } else {
              console.error('Player session not found on server !');
            }
          } else {
            console.error('Send token not found!');
            console.log(message);
          }
        } else {
          console.error('Session services not found in app!');
        }
      } else if(message.publish_type == "friend_online") {
        console.log('========= New friend online ==========');
        if(!!app.get('sessionService')) {
          if(!!message.friends_token && message.friends_token.length > 0) {
            _.each(message.friends_token, function(uid){
              var connector = app.components.__connector__;
              console.log('Send friendOnline broadcast to  - '+uid+'!');
              if(!!app.get('sessionService').getByUid(uid) && app.get('sessionService').getByUid(uid).length > 0) {
                connector.send(null, "friendOnline", {friendId: message.login_token}, [app.get('sessionService').getByUid(uid)[0].id], {}, function(err) {
                  console.log('Braodcast friendOnline to  - '+uid+' has been successfully sent !');
                  // cb(null)
                });
              } else {
                console.error('Player session not found on server !');
              }
            });
          } else {
            console.error('No friend found for this player!');
            console.log(message.friends_token);
          }
        } else {
          console.error('Session services not found in app!');
        }
      } else if(message.publish_type == "friend_added") {
        console.log('========= A new friend added ==========');
        if(!!app.get('sessionService')) {
          if(!!message.login_token){
            var connector = app.components.__connector__;
            console.log('Send friendAdded broadcast to  - '+message.login_token+'!');
            if(!!app.get('sessionService').getByUid(message.login_token) && app.get('sessionService').getByUid(message.login_token).length > 0) {
              connector.send(null, "friendAdded", {friendId: message.friend_token}, [app.get('sessionService').getByUid(message.login_token)[0].id], {}, function(err) {
                console.log('Braodcast friendAdded to  - '+message.login_token+' has been successfully sent !');
                // cb(null)
              });
            } else {
              console.error('Player session not found on server !');
            }
          } else {
            console.log('Login token not found while frind added!');
            console.log(message);
          }

          if(!!message.friend_token) {
            console.log('Send friendAdded broadcast to  - '+message.friend_token+'!');
            if(!!app.get('sessionService').getByUid(message.friend_token) && app.get('sessionService').getByUid(message.friend_token).length > 0) {
              connector.send(null, "friendAdded", {friendId: message.login_token}, [app.get('sessionService').getByUid(message.friend_token)[0].id], {}, function(err) {
                console.log('Braodcast friendAdded to  - '+message.friend_token+' has been successfully sent !');
                // cb(null)
              });
            } else {
              console.error('Player session not found on server !');
            }
          } else {
            console.log('Friend token not found while frind added!');
            console.log(message); 
          }
        } else {
          console.error('Session services not found in app!');
        }
      }
    } else {
      console.error('No message from Rails pub/sub!');
      console.log(message);
    }
  });
}

// app configuration
app.configure('production|development', 'connector', function(){
  app.set('connectorConfig',
    {
      connector : pomelo.connectors.sioconnector,
      transports : ['websocket'],
      heartbeats : true,
      closeTimeout : 60,
      heartbeatTimeout : 60,
      heartbeatInterval : 25,
      key: fs.readFileSync ('../shared/server.key'),
      cert: fs.readFileSync ('../shared/server.crt')
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

