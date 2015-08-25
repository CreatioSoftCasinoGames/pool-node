var _ = require('underscore');
var backendFetcher = require('../../../util/backendFetcher');

module.exports = function(app) {
  return new Handler(app);
};

var Handler = function(app) {
  this.app = app;
};

/**
 * New client entry.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next step callback
 * @return {Void}
 */


 /*   */
Handler.prototype.entry = function(msg, session, next) {
  next(null, {code: 200, msg: 'game server is ok.'});
};

/**
 * Publish route for mqtt connector.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next step callback
 * @return {Void}
 */
Handler.prototype.publish = function(msg, session, next) {
	var result = {
		topic: 'publish',
		payload: JSON.stringify({code: 200, msg: 'publish message is ok.'})
	};
  next(null, result);
};

/**
 * Subscribe route for mqtt connector.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next step callback
 * @return {Void}
 */
Handler.prototype.subscribe = function(msg, session, next) {
	var result = {
		topic: 'subscribe',
		payload: JSON.stringify({code: 200, msg: 'subscribe message is ok.'})
	};
  next(null, result);
};

//Bind user with server session
Handler.prototype.enter= function(msg, session, next) {
	console.log(msg);
	var that = this;
	var sessionService = that.app.get('sessionService');
	var redis = that.app.get("redis");

	//Check here if the user's token is already exist
	if( !! sessionService.getByUid(msg.login_token)) {
		next(null, {
			code: 500,
			error: true,
			message: "User is already logged in"
		});
		return;
	}
	
	session.bind(msg.login_token);

	//Save server and session id for this player
	redis.hmset("game_player:"+msg.login_token, "player_server_id", that.app.get('serverId'), "session_id", session.id);
	session.on('closed', onUserLeave.bind(null, that.app));

	next(null, {
		code: 502,
		message: "User is ready to enter"
	});
};


//Handle join club request from client
Handler.prototype.joinClub=function(msg, session, next) {
	console.error(msg);
	console.log("This is join club request");
  var that = this;
  var board = null;
  that.app.rpc.pool.poolRemote.add(session, session.uid, that.app.get('serverId'), msg.clubConfigId, msg.playerIp, true, function(data) {
    //Save club details in order to get channel for this player
    session.set("clubConfigId", msg.clubConfigId);
    session.set("clubId", data.clubId);
    session.push("clubConfigId", function(err) {
      if (err) {
        console.error('set clubId for session service failed! error is : %j', err.stack);
      }
    });
    session.push("clubId", function(err) {
      if (err) {
        console.error('set clubId for session service failed! error is : %j', err.stack);
      }
    });    
    next(null, data)
  });
},

//Handle stand up request from client (Remove from attached channel)
Handler.prototype.standUp= function(msg, session, next) {
	var that = this;
	that.app.rpc.pool.poolRemote.kick(session, session.uid, that.app.get('serverId'), session.get('clubId'), function() {
		next(null, {
			success: true
		})
	});
};

Handler.prototype.dummyDriverlocation = function(msg, session, next) {


var that 			= this,	
redis 				= that.app.get("redis"),
 latitude =    !!msg.latitude ? msg.latitude : null;
 longitude =    !!msg.longitude ? msg.longitude : null;
  poppId   =    !!msg.driIdentity  ? msg.driIdentity : null;
   broadcast = "driverlocation";

   var message = {};
   message.latitude = latitude; 
   message.logitude = longitude;
redis.hgetall("unique_id:"+poppId, function(err, driver) {
	opponentId = driver.login_token;
 if(!!opponentId) {
 that.sendMessageToUser(opponentId,  driver.player_server_id, broadcast, message);
	
	next(null, {
            success: true
            
        })				
    } else {

    	next(null, {
            success: false
            
        })	
    }    		
});






};




//Handle challenge/revenge request from Client
Handler.prototype.revengeChallenge= function(msg, session, next) {
	console.log("************************this is challenge request*********************************");
	console.log(msg);

	var that 					= this,
			gameType 			= !!msg.gameType ? msg.gameType : null,
			oppId 			= !!msg.opponentId ? msg.opponentId : null,
			redis 				= that.app.get("redis"),
			broadcast 			=	null,
			clubConfigId 		= !!msg.clubConfigId ? msg.clubConfigId : null;
			accepted 			= !!msg.accepted ? msg.accepted : false;
			uniqueId			= !!msg.unique_id ? msg.unique_id : null;
			challengerId		= !!msg.challengerId ? msg.challengerId : null;
           





	if(!!gameType && !!oppId && !!clubConfigId) {
          

           //get login token corresponding to unique id
            redis.hgetall("unique_id:"+oppId, function(err, player) {
                console.log("this is login token from redis");
            	console.log(player);
            	if(!!player)  {
                 opponentId = player.login_token;
                 console.log("login_token from redis fetch is ",+opponentId);
		//Handle different cases for revenge and challenge
		redis.hgetall("game_player:"+opponentId, function(err, playerDetails){
			if(!!playerDetails) {
				console.log("++++++++++++++++Player details of opponent in challenge+++++++++++++++++++++++++++++++++++++++++++++++")
				console.log(playerDetails);
				console.log(accepted);
				console.log("+++++++++++++++++++++end of details++++++++++++++++++++++++++++++++++++++++++")
				console.log(!!playerDetails.online)
				broadcast = gameType == "revenge" ? "revenge" : "challenge";
				
               
				if(!!playerDetails.player_server_id) {
					//If player is online
					if(!!playerDetails.online && playerDetails.online == "true") {
						redis.hgetall("game_player:"+challengerId, function(err, challengerDetails){
							message = {};
							message.user_login_token = session.uid;
							message.requested_token = opponentId;
							message.club_config_id = clubConfigId;
							message.full_name = challengerDetails.player_name;
							message.invitation_type = gameType;
							message.accepted = accepted;
							message.online = !!challengerDetails.online;
							message.image_url = challengerDetails.player_image;
							message.device_avatar_id = parseInt(challengerDetails.device_avatar_id);
							message.unique_id = uniqueId;
						})
						backendFetcher.post("/api/v1/game_requests", {login_token: session.uid, requested_token: opponentId, invitation_type: gameType, club_config_id: clubConfigId}, that.app, function(data) {
							message.id = data.id;
							console.log("test broadcast data");
							console.log(message);

							//broadcast to opponent regarding challenger's challenge
							console.log("broadcast being sent to opponent reg challenge");
							that.sendMessageToUser(opponentId,  playerDetails.player_server_id, broadcast, message);
							console.log('Game request detail saved in database!');
						});

						
						//that.sendMessageToUser(opponentId, playerDetails.player_server_id, broadcast, message);
						next(null, {
							success: true
						})
					} else {
						console.log("=======================Revenge Challange===================================")
						//console.log(message);
						console.error('Player '+opponentId+' is offline while '+gameType+' !');
						backendFetcher.post("/api/v1/game_requests", {login_token: session.uid, requested_token: opponentId, invitation_type: gameType, club_config_id: clubConfigId}, that.app, function(data) {
							console.log('Game request detail saved in database!');
						});
						next(null, {
							success: false,
							message: 'Player is offline!'
						});
					}
				} else {
					console.error('Server for player '+opponentId+' not found!');
					next(null, {
						success: false,
						message: 'Server for player '+opponentId+' not found!'
					})
				}
			} else {
				console.log("=======================Revenge Chalange===================================")
				//console.log(message)
				console.error('Player '+opponentId+' details not found in redis / or offline!');
				backendFetcher.post("/api/v1/game_requests", {login_token: session.uid, requested_token: opponentId, invitation_type: gameType, club_config_id: clubConfigId}, that.app, function(data) {
					console.log('Game request detail saved in database!');
				});
				next(null, {
					success: false,
					message: 'Player '+opponentId+' details not found in redis / or offline!'
				})
	}
                       });	
    
    }
});

	} 


	else {
		console.error('Parameter missing while revenge or challenge!')
		console.log(msg);
		next({
			success: false,
			message: 'Parameter missing while revenge or challenge!',
			data: msg
		})
	}
};

//Send a broadcast to player from rpcInvoke
Handler.prototype.sendMessageToUser = function(uid, serverId, route, msg) {
 this.app.rpcInvoke(serverId, {namespace: "user", service: "entryRemote", method: "sendMessageToUser", args: [uid, msg, route]}, function(data) {});
};

//Handle force close requests from client
var onUserLeave = function(app, session) {
	if(!session || !session.uid) {
		return;
	}
	
	//Log out this user from Rails 
	app.get('redis').del("game_players", "game_player:"+session.uid, function(err, data) {
		backendFetcher.delete("/api/v1/sessions/"+session.uid+".json", {}, app, function(data) {
			console.log(data.message);
		});
	});

	//Remove from channel also
	app.rpc.pool.poolRemote.kick(session, session.uid, app.get('serverId'), session.get('clubId'), null);
};


