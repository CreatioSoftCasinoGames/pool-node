var poolLogic = require('../../../services/poolLogic');
var backendFetcher = require('../../../util/backendFetcher');
var redisUtil = require('../../../util/redisUtil');
var _ = require('underscore');

module.exports = function(app) {
	return new PoolRemote(app);
};

var PoolRemote = function(app) {
	this.app = app;
	this.channelService = app.get('channelService');
};

PoolRemote.prototype = {

	findClub:function(clubConfigId, cb) {
		var that = this;
        freeClubs = false,
				redis = that.app.get("redis");

		redis.zrevrangebyscore("club_config_occupancy:"+clubConfigId, 2, -1, "limit", 0, 1, function(err, data) {
			if(data.length!=0) {
				freeClubs = true;
				cb(parseInt(data[0].split(":")[1]));
			} else if(data.length == 0 || !freeClubs) {
				backendFetcher.post("/api/v1/clubs.json", {club_config_id: clubConfigId}, that.app, function(data) {
					if(data.valid) {
						redisUtil.createClub(data.club, redis);
						cb(parseInt(data.club.id));
					}
				})
			}
		});
	},
  
	add: function(uid, sid, clubConfigId, playerIp, flag, cb) {
		var that = this;
		that.findClub(clubConfigId, function(clubId) {
			that.addToClub(uid, sid, clubId, flag, false, playerIp, cb);

		});
	},

  addToClub: function(uid, sid, clubId, flag, forceJoin, playerIp, next) {
		var that = this;
		var redis = that.app.get("redis");
		redis.hmset("game_player:"+uid, "player_ip", playerIp, function(err, playerIp) {
		  redis.hgetall("game_player:"+uid, function(err, playerDetails) {
				redis.zadd("club_id:"+clubId, parseInt(playerDetails.player_level),  uid, function(err, data) {
					that.getOpponent({clubId: clubId, playerId: uid, playerLevel: parseInt(playerDetails.player_level), playerIp: playerIp}, function(responseData){
						console.log('Success opponent - ' + responseData.success );
						if(!!responseData){
							if(responseData.success && responseData.message == "Opponent found!") {
								redis.hmget("game_player:"+responseData.opponentId, "player_ip", playerIp, function(err, opponentIp) {
									// responseData.opponentIp = opponentIp[0];
									// responseData.isServer = true;
									console.log('IP and Server added')
									next(responseData)
								});
							} else {
								console.log('This should not be sent!')
								next(responseData)
							}
						}
					});
				});
			});
	  });
	}, 


  getOpponent: function(msg, next) {
		var that = this;
		var redis = that.app.get("redis");
		var opponentFound = false;
		redis.zrangebyscore("club_id:"+msg.clubId, msg.playerLevel-3, msg.playerLevel+3, function(err, playerList){

			playerList = _.without(playerList, msg.playerId); //Remove the current player from list
			if(playerList.length > 0 && !opponentFound) {
				opponentFound = true;

				//Remove players from redis data, Set status playing, send response
				redis.zrem("club_id:"+msg.clubId, parseInt(msg.playerLevel), msg.playerId, function(err, data) {
					redis.hmget("game_player:"+playerList[0], "player_level", function(err, playerLevel) {
						redis.zrem("club_id:"+msg.clubId, parseInt(playerLevel), playerList[0], function(err, data) {
							redis.hmset("game_player:"+msg.playerId, "playing", true, "opponentId", playerList[0], function(err, playerLevel) {
								redis.hmset("game_player:"+playerList[0], "playing", true, "opponentId", msg.playerId, function(err, playerLevel) {
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

			} else {
				console.log('3. Now check here !')
				setTimeout(function(){
					redis.zrangebyscore("club_id:"+msg.clubId, msg.playerLevel-3, msg.playerLevel+3, function(err, newPlayerList){
						newPlayerList = _.without(newPlayerList, msg.playerId); //Remove the current player from list
						console.log('Updated player list !')
						console.log(newPlayerList)
						if(playerList.length > 0 && !opponentFound) {
							console.log('2. Now check here !')
							opponentFound = true;
							//Remove players from redis data, Set status playing, send response
							redis.zrem("club_id:"+msg.clubId, parseInt(msg.playerLevel), msg.playerId, function(err, data) {
								redis.hmget("game_player:"+playerList[0], "player_level", function(err, playerLevel) {
									redis.zrem("club_id:"+msg.clubId, parseInt(playerLevel), playerList[0], function(err, data) {
										redis.hmset("game_player:"+msg.playerId, "playing", true, "opponentId", playerList[0], function(err, playerLevel) {
											redis.hmset("game_player:"+playerList[0], "playing", true, "opponentId", msg.playerId, function(err, playerLevel) {
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
						} else {
							console.log('1. Now check here !')
							console.log('opponentFound - ' + opponentFound);
							if(opponentFound){
								console.log('Now check here !')
							} else if(!opponentFound) {
								opponentFound = true;
								//Remove players from redis data
								redis.zrem("club_id:"+msg.clubId, parseInt(msg.playerLevel), msg.playerId, function(err, data) {
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
											redis.hgetall("game_player:"+msg.playerId, function(err, playerDetails) {
												redis.hgetall("game_player:"+playerDetails.opponentId, function(err, opponentDetails) {
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
  },




	returnAddData: function(channel, clubId, sid, uid, cb) {
		cb({
			success: true,
			clubId: clubId
		})
	},

	addEventListers: function(channel) {
		var that = this;
		var board = channel.board;
		var redis = that.app.get('redis');
	}

}