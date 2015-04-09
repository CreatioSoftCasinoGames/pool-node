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

Handler.prototype.enter= function(msg, session, next) {
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
	redis.hmset("game_player:"+msg.login_token, "player_server_id", that.app.get('serverId'), "session_id", session.id);
	session.on('closed', onUserLeave.bind(null, that.app));
	next(null, {
		code: 502,
		uid: msg.login_token,
		message: "User is ready to enter"
	})
};


Handler.prototype.joinClub=function(msg, session, next) {
  var that = this;
  that.app.rpc.pool.poolRemote.add(session, session.uid, that.app.get('serverId'), msg.clubConfigId, true, function(data) {
    session.set("clubConfigId", msg.clubConfigId);
    // session.set("roomId", data.roomId);
    session.push("clubConfigId", function(err) {
      if (err) {
        console.error('set roomId for session service failed! error is : %j', err.stack);
      }
    });
    session.push("roomId", function(err) {
      if (err) {
        console.error('set roomId for session service failed! error is : %j', err.stack);
      }
    });
    next(null, data)
  });
},

Handler.prototype.getOpponentPlayer= function(msg, session, next) {
	console.log(msg)
	console.log('Player id - ' + session.uid);
	var that = this;
	var redis = that.app.get("redis");
	redis.hmset("game_player:"+session.uid, "player_ip", msg.playerIp, function(err, playerIp) {
		redis.hgetall("game_player:"+session.uid, function(err, playerDetails) {		
			// console.log(playerDetails)
			redis.zadd("club:"+msg.clubId, parseInt(playerDetails.player_level), session.uid, function(err, data) {
				session.set("clubId", msg.clubId);
				that.getOpponent({clubId: msg.clubId, playerId: session.uid, playerLevel: parseInt(playerDetails.player_level), playerIp: msg.playerIp}, function(responseData){
					console.log('Success opponent - ' + responseData.success );
					console.log(responseData)
					if(!!responseData){
						if(responseData.success && responseData.message == "Opponent found!") {
							redis.hmget("game_player:"+responseData.opponentId, "player_ip", function(err, opponentIp) {
								// responseData.opponentIp = opponentIp[0];
								// responseData.isServer = true;
								console.log('IP and Server added')
								next(null, responseData)
							});
						} else {
							console.log('This should not be sent!')
							next(null, responseData)
						}
					}
				});
			});
		})
	});
};

Handler.prototype.sendMessage= function(msg, session, next) {
	var that = this;
	var redis = that.app.get("redis");
	redis.hgetall("game_player:"+session.uid, function(err, data) {
		opponentId = data.opponentId;
		serverId = data.player_server_id;
		console.log(session.uid + ' and opponent - ' + opponentId + ' and server id - ' + serverId)
		that.app.rpcInvoke(serverId, {namespace: "user", service: "entryRemote", method: "sendMessageToUser", args: [opponentId, msg, "generalProgress"]}, function(data) {
			console.log('Message sent to ' + opponentId);
    });
	})
};

Handler.prototype.getOpponent= function(msg, next) {
	var that = this;
	var redis = that.app.get("redis");
	var opponentFound = false;
	redis.zrangebyscore("club:"+msg.clubId, msg.playerLevel-3, msg.playerLevel+3, function(err, playerList){
		playerList = _.without(playerList, msg.playerId); //Remove the current player from list
		if(playerList.length > 0 && !opponentFound) {
			opponentFound = true;

			//Remove players from redis data, Set status playing, send response
			redis.zrem("club:"+msg.clubId, parseInt(msg.playerLevel), msg.playerId, function(err, data) {
				redis.hmget("game_player:"+playerList[0], "player_level", function(err, playerLevel) {
					redis.zrem("club:"+msg.clubId, parseInt(playerLevel), playerList[0], function(err, data) {
						redis.hmset("game_player:"+msg.playerId, "playing", true, function(err, playerLevel) {
							redis.hmset("game_player:"+playerList[0], "playing", true, function(err, playerLevel) {
								redis.hmset("game_player:"+msg.playerId, "opponentId", playerList[0], function(err, playerLevel) {
									redis.hmset("game_player:"+playerList[0], "opponentId", msg.playerId, function(err, playerLevel) {
										redis.hgetall("game_player:"+playerList[0], function(err, player) {
											next({
												message: "Opponent found!",
												success: true,
												playerId: msg.playerId,
												opponentId: playerList[0],
												opponentName: player.player_name,
												opponentXp: player.player_xp,
												opponentLevel: player.player_level,
												opponentImage: player.player_image,
												opponentIp: player.player_ip,
												isDummy: false,
												isServer: true
											})
										});
									});
								});
							});
						});
					});
				});
			});

		} else {
			console.log('3. Now check here !')
			setTimeout(function(){
				redis.zrangebyscore("club:"+msg.clubId, msg.playerLevel-3, msg.playerLevel+3, function(err, newPlayerList){
					newPlayerList = _.without(newPlayerList, msg.playerId); //Remove the current player from list
					// console.log('Updated player list !')
					// console.log(newPlayerList)
					if(playerList.length > 0 && !opponentFound) {
						console.log('2. Now check here !')
						opponentFound = true;
						//Remove players from redis data, Set status playing, send response
						redis.zrem("club:"+msg.clubId, parseInt(msg.playerLevel), msg.playerId, function(err, data) {
							redis.hmget("game_player:"+playerList[0], "player_level", function(err, playerLevel) {
								redis.zrem("club:"+msg.clubId, parseInt(playerLevel), playerList[0], function(err, data) {
									redis.hmset("game_player:"+msg.playerId, "playing", true, function(err, playerLevel) {
										redis.hmset("game_player:"+playerList[0], "playing", true, function(err, playerLevel) {
											redis.hmset("game_player:"+msg.playerId, "opponentId", playerList[0], function(err, playerLevel) {
												redis.hmset("game_player:"+playerList[0], "opponentId", msg.playerId, function(err, playerLevel) {
													redis.hgetall("game_player:"+playerList[0], function(err, player) {
														next({
															message: "Opponent found!",
															success: true,
															playerId: msg.playerId,
															opponentId: playerList[0],
															opponentName: player.player_name,
															opponentXp: player.player_xp,
															opponentLevel: player.player_level,
															opponentImage: player.player_image,
															opponentIp: player.player_ip,
															isDummy: false,
															isServer: true
														})
													});
												});
											});
										});
									});
								});
							});
						});
					} else {
						console.log('1. Now check here !')
						console.log('opponentFound - ' + opponentFound);
						if(opponentFound){
							console.log('Now check here !')
						} else if(!opponentFound) {
							opponentFound = true;
							//Remove players from redis data
							redis.zrem("club:"+msg.clubId, parseInt(msg.playerLevel), msg.playerId, function(err, data) {
								redis.hgetall("game_player:"+msg.playerId, function(err, playerDetails) {
									if(String(playerDetails.playing) == "false") {
										redis.get("bot_token", function(err, data) {
											backendFetcher.get("/api/v1/users/"+data+".json", {}, that.app, function(bot_player) {
												next({
													message: "Bot player added !",
													success: true,
													playerId: msg.playerId,
													opponentId: bot_player.login_token,
													opponentName: bot_player.full_name,
													opponentXp: bot_player.xp,
													opponentLevel: bot_player.current_level,
													opponentImage: bot_player.image_url,
													opponentIp: playerDetails.player_ip,
													isServer: true,
													isDummy: true
												})
											});
										});
									} else {
										console.log(msg.playerId)
										redis.hgetall("game_player:"+msg.playerId, function(err, playerDetails) {
											console.log(playerDetails);
											redis.hgetall("game_player:"+playerDetails.opponentId, function(err, opponentDetails) {
												console.log(opponentDetails);
												next({
													message: "Opponent found!",
													success: true,
													playerId: playerDetails.player_id,
													opponentId: opponentDetails.player_id,
													opponentName: opponentDetails.player_name,
													opponentXp: opponentDetails.player_xp,
													opponentLevel: opponentDetails.player_level,
													opponentImage: opponentDetails.player_image,
													opponentIp: opponentDetails.player_ip,
													isDummy: false,
													isServer: false
												})	
											})	
										})
									}
								});
							});
						} else {
						}
					}
				});
			}, 5000)
		}
	})
};

var onUserLeave = function(app, session) {
	console.log(session.uid + ' is going to log out!')
	if(!session || !session.uid) {
		return;
	}
	app.get('redis').del("game_players" , "game_player:"+session.uid, function(err, data) {
		backendFetcher.delete("/api/v1/sessions/"+session.uid+".json", {}, app, function(data) {
			console.log(data.message);
		});
	})
	// app.rpc.pool.poolRemote.kick(session, session.uid, app.get('serverId'), session.get('tableId'), true, null);
};
