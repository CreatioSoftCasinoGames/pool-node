var pomelo = require('pomelo');
var dispatcher = require('./app/util/dispatcher');
var backendFetcher = require('./app/util/backendFetcher');
var redisUtil = require('./app/util/redisUtil');
var _ = require('underscore');
var fs = require('fs');
/**
 * Init app for client.
 */

var app = pomelo.createApp();
var poolConstants = require('./config/poolConstants.json')[app.get("env")];
var redis = require('redis').createClient(poolConstants.redisPort, poolConstants.redisHost, {});
var redisPubSubClient   = require('redis').createClient(poolConstants.redisPort, poolConstants.redisHost, {});

//Register pub/sub events with redis
redisPubSubClient.subscribe("online");
redisPubSubClient.subscribe("friend_added");
redisPubSubClient.subscribe("gift_received");

app.set('redis', redis);
app.set('name', 'pool');
app.set('poolConstants', poolConstants);
app.set('redisPubSubClient', redisPubSubClient);
//if this is redis pubsub 
// 


if(app.get('serverId') == "connector-server-1") {
  // var connector = app.components.__connector__;
  // console.log(connector);
  redisPubSubClient.on("message", function(channel, message) {
    if(!!message) {
      console.log(message);
      message = JSON.parse(message);
      console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$        Broadcast    $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");
      console.log(message);
      console.log("$$$$$$$$$$$$$$");


  //for gift sent and received
if(message.request_type == "gift_received") {
console.log('========= Gift Received Broadcast ==========');

    //console.log(app.get('sessionService'));
    if(!!app.get('sessionService')) {
        //this is gift received to send_to_token        
        if(!message.confirmed) {
           console.log("===========Broadcast to Sender==============");
            redis.hgetall("unique_id:"+message.receiver_unique_id, function(err, player) {
                console.log("extracting login token from unique id ");
                message.send_to_token = player.login_token;
                if (!!message.send_to_token) {
                    var connector = app.components.__connector__;
                    console.log('Send giftReceived broadcast to  - ' + message.send_to_token + '!');
                    if (!!app.get('sessionService').getByUid(message.send_to_token) && app.get('sessionService').getByUid(message.send_to_token).length > 0) {
                        connector.send(null, "giftSent", {
                                id: message.id,
                                request_type: message.request_type,
                                user_login_token: message.login_token,
                                send_to_token: message.send_to_token,
                                sender_name: message.sender_name,
                                receiver_name: message.receiver_name,
                                full_name: message.full_name,
                                gift_type: message.gift_type,
                                gift_value: message.gift_value,
                                confirmed: message.confirmed,
                                image_url: message.image_url,
                                device_avatar_id: message.device_avatar_id,
                                sender_unique_id: message.sender_unique_id,
                                receiver_unique_id: message.receiver_unique_id
                            },
                            [app.get('sessionService').getByUid(message.send_to_token)[0].id], {}, function (err) {
                                console.log('Braodcast giftReceived to  - ' + message.send_to_token + ' has been successfully sent !');
                                // cb(null)                           
                                 });
                    } else {
                        console.error('Player session not found on server !');
                    }

                } else {
                    console.error('Send token not found!');
                    console.log(message);
                }
            
               
        });
         } else {
                console.log("===========Broadcast to Receiver==============");
                var connector = app.components.__connector__;
                redis.hgetall("unique_id:"+message.sender_unique_id, function(err, player) {
                    message.login_token = player.login_token;
                    console.log('Send giftSent broadcast to  - '+message.login_token+'!');
                    if(!!app.get('sessionService').getByUid(message.login_token) && app.get('sessionService').getByUid(message.login_token).length > 0) {
                        connector.send(null, "giftReceived", {id:message.id, request_type: message.request_type, user_login_token: message.login_token,
                            send_to_token: message.send_to_token, sender_name: message.sender_name, receiver_name: message.receiver_name, full_name: message.full_name, gift_type: message.gift_type,
                            gift_value: message.gift_value, confirmed: message.confirmed, image_url: message.image_url, device_avatar_id: message.device_avatar_id, sender_unique_id: message.sender_unique_id, receiver_unique_id: message.receiver_unique_id}, [app.get('sessionService').getByUid(message.login_token)[0].id], {}, function(err) {
                            console.log('Braodcast giftReceived to  - '+message.login_token+' has been successfully sent !');
                            // cb(null)                     
                               });
                    }
                else {
                    console.error('Player session not found on server !');
                }


            });
        }
     } else {
        console.error('Session services not found in app!');
    }
}





//online-offline


      else if(message.publish_type == "online") {
        console.log('========= New friend online ==========');
        
        if(!!app.get('sessionService')) {
          if(!!message.friends_token && message.friends_token.length > 0) {
            _.each(message.friends_token, function(uid){
              var connector = app.components.__connector__;
              console.log('Send friendOnline broadcast to  - '+uid+'!');
              if(!!app.get('sessionService').getByUid(uid) && app.get('sessionService').getByUid(uid).length > 0) {
                connector.send(null, "friendOnline", {unique_id: message.unique_id, online: message.online}, [app.get('sessionService').getByUid(uid)[0].id], {}, function(err) {
                  console.log('Braodcast friendOnline to  - '+uid+' has been successfully sent !');
                });
              } else {
                console.error('Player session not found on server !');
              }
            });
          } else {
            console.error('No friend found for this player!');
            console.log(message.friends_token);
          }
          if(!!message.challengers_token && message.challengers_token.length > 0) {
            console.log("************************************1212*********************************************")
            console.log(message.challengers_token)
            _.each(message.challengers_token, function(uid){
              var connector = app.components.__connector__;
              console.log('Send friendOnline broadcast to  - '+uid+'!');
              if(!!app.get('sessionService').getByUid(uid) && app.get('sessionService').getByUid(uid).length > 0) {
                connector.send(null, "challengerOnline", {unique_id: message.unique_id, online: message.online}, [app.get('sessionService').getByUid(uid)[0].id], {}, function(err) {
                  console.log('Braodcast challengerOnline to  - '+uid+' has been successfully sent !');
                });
              } else {
                console.error('Player session not found on server !');
              }
            });
          } else {
            console.error('No challenger found for this player!');
            console.log(message.challengers_token);
          }
        } else {
          console.error('Session services not found in app!');
        }
      }



       else if(message.publish_type == "friend_added") {
        console.log('========= A new friend added ==========');
          console.log(message);
          if(!!message.login_token){
            var connector = app.components.__connector__;
            console.log('Send friendAdded broadcast to  - '+message.login_token+'!');
            if(!!app.get('sessionService').getByUid(message.login_token) && app.get('sessionService').getByUid(message.login_token).length > 0) {
              connector.send(null, "friendAdded", {login_token: message.friend_token, full_name: message.full_name, image_url: message.image_url, online: message.is_online, device_avatar_id: message.device_avatar_id, unique_id: message.unique_id, can_send_gift: message.can_send_gift, can_challenge: message.can_challenge}, [app.get('sessionService').getByUid(message.login_token)[0].id], {}, function(err) {
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
        } else {
          console.error('Session services not found in app!');
        }
      } 
     //saket code challenger online  

/*
    else if(message.publish_type == "challengers_online") {
        
     console.log('========= Challenger Online ==========');
        if(!!app.get('sessionService')) {
          if(!!message.friends_token && message.friends_token.length > 0) {
            _.each(message.friends_token, function(uid){
              var connector = app.components.__connector__;
              console.log('Send friendOnline broadcast to  - '+uid+'!');
              if(!!app.get('sessionService').getByUid(uid) && app.get('sessionService').getByUid(uid).length > 0) {
                connector.send(null, "friendOnline", {unique_id: message.unique_id, online: message.online}, [app.get('sessionService').getByUid(uid)[0].id], {}, function(err) {
                  console.log('Braodcast friendOnline to  - '+uid+' has been successfully sent !');
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

       }

     */

        





      

         //saket   challenger online 
     // else if(message.publish_type == "challenger_online") {
  //console.log('========= Challenger online ==========');
  //if(!!app.get('sessionService')) {
    //if(!!message.login_token && message.login_token.length > 0) {
      //_.each(message.login_token, function(uid){
        //var connector = app.components.__connector__;
        //console.log('Send challengerOnline broadcast to  - '+uid+'!');
        //if(!!app.get('sessionService').getByUid(uid) && app.get('sessionService').getByUid(uid).length > 0) {
          //connector.send(null, "challengerOnline", {unique_id: message.unique_id, online: message.online}, [app.get('sessionService').getByUid(uid)[0].id], {}, function(err) {
           // console.log('Braodcast challengerOnline to  - '+uid+' has been successfully sent !');
          //});
        //} else {
          //console.error('Player session not found on server !');
        //}
      //});
    //} else {
      //console.error('No challenger found for this player!');
      //console.log(message.login_token);
    //}
  //} else {
   // console.error('Session services not found in app!');
  //}
//} // ---end saket code for challenger onlline


      else if(message.publish_type = "challenge") {
        if(!!message.requested_token) {
          var connector = app.components.__connector__;
          console.log('Send saveChallenge broadcast to  - '+message.requested_token+'!');
          if(!!app.get('sessionService').getByUid(message.requested_token) && app.get('sessionService').getByUid(message.requested_token).length > 0) {
            connector.send(null, "saveChallenge", 
              { 
                id: message.id,
                invitation_type: message.invitation_type,
                club_config_id: message.club_config_id, 
                user_login_token: message.user_login_token,
                requested_token: message.requested_token,
                full_name: message.full_name,
                image_url: message.image_url,
                online: message.online,
                device_avatar_id: message.device_avatar_id,
                unique_id: message.unique_id
              }, [app.get('sessionService').getByUid(message.requested_token)[0].id], {}, function(err) {
              console.log('Braodcast saveChallenge to  - '+message.requested_token+' has been successfully sent !');
              // cb(null)
            });
          } else {
            console.error('Player session not found on server !');
          }
        }
      }




     else {
      console.error('No message from Rails pub/sub!');
      console.log(message);
    }




  });
}

// app configuration (Configuration is for WS connection) 
app.configure('production|development', 'connector', function(){
  app.set('connectorConfig',
    {
      connector : pomelo.connectors.sioconnector,
      //websocket, htmlfile, xhr-polling, jsonp-polling, flashsocket
      transports : ['websocket'],
      heartbeats : true,
      closeTimeout : 60,
      heartbeatTimeout : 60,
      heartbeatInterval : 25
    });
});




// start app
app.start();

process.on('uncaughtException', function (err) {
  console.error(' Caught exception: ' + err.stack);
});

