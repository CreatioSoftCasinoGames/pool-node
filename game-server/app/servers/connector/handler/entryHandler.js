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

Handler.prototype.joinClub= function(msg, session, next) {
	var that = this;
	var redis = that.app.get("redis");
	redis.hmget("game_player:"+session.uid, "player_level", function(err, playerLevel) {
		redis.zadd("club:"+msg.clubId, parseInt(playerLevel), session.uid, function(err, data) {
			that.app.rpc.pool.poolRemote.add(session, session.uid, that.app.get('serverId'), msg.clubId, true, function(data) {
				session.set("clubId", msg.clubId);
					that.getOpponent({clubId: msg.clubId, playerId: session.uid, playerLevel: parseInt(playerLevel), playerIp: msg.playerIp}, function(responseData){
						if(!!responseData){
							if(responseData.success && responseData.message == "Opponent found!") {
								responseData.playerIp = msg.playerIp;
								responseData.isServer = true;
								next(null, responseData)
							} {
								next(null, responseData)
							}
						}
					});
				});
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
										isDummy: false
									})
								})
							});
						});
					});
				});
			});

		} else {
			setTimeout(function(){
				redis.zrangebyscore("club:"+msg.clubId, msg.playerLevel-3, msg.playerLevel+3, function(err, newPlayerList){
					newPlayerList = _.without(newPlayerList, msg.playerId); //Remove the current player from list
					if(playerList.length > 0 && !opponentFound) {
						opponentFound = true;
						//Remove players from redis data, Set status playing, send response
						redis.zrem("club:"+msg.clubId, parseInt(msg.playerLevel), msg.playerId, function(err, data) {
							redis.hmget("game_player:"+playerList[0], "player_level", function(err, playerLevel) {
								redis.zrem("club:"+msg.clubId, parseInt(playerLevel), playerList[0], function(err, data) {
									redis.hmset("game_player:"+msg.playerId, "playing", true, function(err, playerLevel) {
										redis.hmset("game_player:"+playerList[0], "playing", true, function(err, playerLevel) {
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
													isDummy: false
												})
											})
										});
									});
								});
							});
						});
					} else {
						if(!opponentFound) {
							opponentFound = true;
							//Remove players from redis data
							redis.zrem("club:"+msg.clubId, parseInt(msg.playerLevel), msg.playerId, function(err, data) {
								redis.hmget("game_player:"+msg.playerId, "playing", function(err, playingStatus) {
									if(String(playingStatus) == "false") {
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
													playerIp: msg.playerIp,
													isServer: true,
													isDummy: true
												})
											});
										});
									}
								});
							});
						}
					}
				});
			}, 5000)
		}
	})
};

var onUserLeave = function(app, session) {
	if(!session || !session.uid) {
		return;
	}
	app.get('redis').del("game_players" , "game_player:"+session.uid, function(err, data) {
		backendFetcher.delete("/api/v1/sessions/"+session.uid+".json", {}, app, function(data) {
			console.log(data.message);
		});
	})
	app.rpc.pool.poolRemote.kick(session, session.uid, app.get('serverId'), session.get('tableId'), true, null);
};
