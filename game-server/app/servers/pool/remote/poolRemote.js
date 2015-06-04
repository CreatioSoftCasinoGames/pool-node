var poolLogic 			= require('../../../services/poolLogic');
var backendFetcher 	= require('../../../util/backendFetcher');
var dbLogger 				= require('../../../services/dbLogger');
var redisUtil 			= require('../../../util/redisUtil');
var _ 							= require('underscore');
var aiLogic 				= require('../../../services/aiLogic');

module.exports = function(app) {
	return new PoolRemote(app);
};

var PoolRemote = function(app) {
	this.app 						= app;
	this.channelService = app.get('channelService');
	dbLogger.setApp(app);
};

PoolRemote.prototype = {

	findClub:function(clubConfigId, uid, cb) {
		var that 			= this;
        freeClubs = false,
				redis 		= that.app.get("redis");

      redis.hgetall("club_config:"+clubConfigId, function(err, typeData){
      	if(!!typeData) {
      		if (typeData.club_type == "OneToOne") {
	      		redis.zrevrangebyscore("club_config_occupancy:"+clubConfigId, 2, -1, "limit", 0, 1, function(err, data) {
							if(data.length>0) {
								freeClubs = true;
								cb({
									success: true,
									clubId: parseInt(data[0].split(":")[1])
								});
							} else if(data.length == 0 || !freeClubs) {
								backendFetcher.post("/api/v1/clubs.json", {club_config_id: clubConfigId}, that.app, function(data) {
									if(data.valid) {
										redisUtil.createClub(data.club, redis);
										cb({
											success: true,
											clubId: parseInt(data.club.id)
										});
									}
								})
						  }
	          });
			    } else {
  					redis.zrevrangebyscore("club_config_occupancy:"+clubConfigId, 7, -1, "limit", 0,  1, function(err, data){
  						redis.hmget("game_player:"+uid, "room_id", function(err, playerRoom){
  							if(!!playerRoom) {
  								data = _.without(data, parseInt(playerRoom));
  							} else {
  								console.error('Player was not playing in any Tournament room!');
  							}
  							
  							if(data.length>0) {
									freeClubs = true;
									cb({
										success: true,
										clubId: parseInt(data[0].split(":")[1])
									});
								} else if(data.length == 0 || !freeClubs) {
									backendFetcher.post("/api/v1/clubs.json", {club_config_id: clubConfigId}, that.app, function(data) {
										if(data.valid) {
											redisUtil.createClub(data.club, redis);
											cb({
												success: true,
												clubId: parseInt(data.club.id)
											});
										}
									});
							  }
							});
	          });
			    }
      	} else {
      		console.error('No clubs found, Please sync the database!');
      		cb({
      			success: false
      		})
      	}
		  });

	},
  
	add: function(uid, sid, clubConfigId, playerIp, flag, cb) {
		var that = this;
		that.findClub(clubConfigId, uid, function(clubData) {
			if(clubData.success) {
				that.addToClub(uid, sid, clubConfigId, parseInt(clubData.clubId), flag, false, playerIp, cb);
			} else {
				console.error('No clubs found, Create or Sync database!');
				cb({
					success: false,
					message: 'No clubs found, Create or Sync database!'
				})
			}
		});
	},

  addToClub: function(uid, sid, clubConfigId, clubId, flag, forceJoin, playerIp, next) {
		var that 		= this,
				redis 	= that.app.get("redis"),
				channel = that.channelService.getChannel(clubId, flag);

		//Set this club id with user
		redis.hmset("game_player:"+uid, "club_id", clubId, function(err, clubSaved){});

    if(!!channel) {
    	channel.add(uid, sid);
    } else {
    	console.error('Channel not created !!')
    }

		//Calculate online players
		redis.hgetall("club:"+clubId, function(err, clubData) {
			console.log(clubData);
			
			//Update number of online players in this club
			if(!!clubData) {
				redis.get("onlinePlayer:"+clubData.club_config_id, function(err, data1){
					var onlinePlayers = !!data1 ? parseInt(data1) : 0;
			    redis.set("onlinePlayer:"+clubData.club_config_id, onlinePlayers+1, function(err, data){
				  });
				});
			} else {
				console.error('Redis details for this club - ' + clubId + ' not found!');
				next({
					success: false,
					message: 'Please sync and try again!'
				})
				return;
			}

			  redis.hgetall("game_player:"+uid, function(err, playerDetails) {

			  	//Create a board here
			  	if(!channel.board){
			  		console.log("New channel created !");
			  			clubType = clubData.club_type;
			  			channel.board = new poolLogic.Board(clubId, redis, that.app, clubType);
			  		  that.addEventListers(channel);
			  		  channel.board.addPlayer(uid, false);
			  		  channel.board.resetTournament();
			  	}else{
			  		channel.board.addPlayer(uid, false);
			  		that.addEventListers(channel);
			  		channel.board.resetTournament();
			  	}
			  	
			  	//Get opponenet
					redis.zadd("club_id:"+clubId, parseInt(playerDetails.player_level),  uid, function(err, data) {
						that.getOpponent({ channel: channel, clubId: clubId, playerId: uid, sid: sid, playerLevel: parseInt(playerDetails.player_level), playerIp: playerIp}, function(responseData){
							if(!!responseData ){
								if (channel.board.clubType == "Tournament") {
									console.log('Bot added  - ' + channel.board.botAdded);
									if(!channel.board.botAdded) {
										channel.board.botAdded = true;
										setTimeout(function(){
											console.log('Enough of waiting player, bring bots!')
											aiLogic.addBotPlayers(channel.board, function() {});
									  },5000);
									} else {
										console.error('Bot has been already adding in this club!');
									}
								}

								if (responseData.isDummy == true){
									redis.sadd("busy_bots", responseData.opponentId,  function(err, data){
										redis.srem("available_bots", responseData.opponentId, function(err, data){
										});
									});
									
									redis.hgetall("club:"+clubId, function(err, clubData) {
										redis.get("onlinePlayer:"+clubData.club_config_id, function(err, data1){
											var onlinePlayers = !!data1 ? parseInt(data1) : 0;
									    redis.set("onlinePlayer:"+clubData.club_config_id, onlinePlayers+1, function(err, data){
										  });
										});
									});
								}
								
								responseData.clubId = clubId;
								responseData.clubConfigId = clubConfigId;
								next(responseData);

								//Add all waiting players into players
								if(channel.board.playersToAdd.length > 0) {
									_.each(channel.board.playersToAdd, function(player) {
						      	channel.board.players.push(player);
						      });
								}

							} else {
								console.error('Opponent details response not found!')
								next({
									success: false,
									message: 'Opponent details response not found!'
								});
							}
						});
					});
				});
	});
	},

  getOpponent: function(msg, next) {

		var that 					= this,
		  	redis 				= that.app.get("redis"),
		 		opponentFound = false,
		 		channel 			=	_.extend(msg.channel),
		  	clubType 			= channel.board.clubType;

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
										backendFetcher.get("/api/v1/users/"+ playerList[0] +".json", {}, that.app, function(newPlayer) {
	                    that.returnData(msg.playerId, playerList[0], newPlayer.full_name, newPlayer.xp, newPlayer.current_level, newPlayer.image_url, player.player_ip, false, true, parseInt(newPlayer.device_avatar_id), function(data){
	                       next(data);
	                    });
	                  });
									});
								});
							});
						});
					});
				});

			} else {

				setTimeout(function(){
					redis.zrangebyscore("club_id:"+msg.clubId, msg.playerLevel-3, msg.playerLevel+3, function(err, newPlayerList){
						newPlayerList = _.without(newPlayerList, msg.playerId); //Remove the current player from list
						if(playerList.length > 0 && !opponentFound) {
							opponentFound = true;
		
							//Remove players from redis data, Set status playing, send response
							redis.zrem("club_id:"+msg.clubId, parseInt(msg.playerLevel), msg.playerId, function(err, data) {
								redis.hmget("game_player:"+playerList[0], "player_level", function(err, playerLevel) {
									redis.zrem("club_id:"+msg.clubId, parseInt(playerLevel), playerList[0], function(err, data) {
										redis.hmset("game_player:"+msg.playerId, "playing", true, "opponentId", playerList[0], function(err, playerLevel) {
											redis.hmset("game_player:"+playerList[0], "playing", true, "opponentId", msg.playerId, function(err, playerLevel) {
												redis.hgetall("game_player:"+playerList[0], function(err, player) {
													backendFetcher.get("/api/v1/users/"+ playerList[0] +".json", {}, that.app, function(newPlayer) {
				                    that.returnData(msg.playerId, playerList[0], newPlayer.full_name, newPlayer.xp, newPlayer.current_level, newPlayer.image_url, player.player_ip, false, true, parseInt(newPlayer.device_avatar_id), function(data){
				                      next(data)
				                    })
				                  });
												});
											});
										});
									});
								});
							});
						} else {
							if(opponentFound){
							} else if(!opponentFound) {
								opponentFound = true;
								//Remove players from redis data
								redis.zrem("club_id:"+msg.clubId, parseInt(msg.playerLevel), msg.playerId, function(err, data) {
									redis.hgetall("game_player:"+msg.playerId, function(err, playerDetails) {
										if(String(playerDetails.playing) == "false") {
											redis.smembers("available_bots", function(err, data) {
												if(data.length > 0){
													backendFetcher.get("/api/v1/users/"+data[0]+".json", {}, that.app, function(bot_player) {
														redis.sadd("game_players", "game_player:"+bot_player.login_token, function(err, botData){
														  redis.hmset("game_player:"+bot_player.login_token, "player_id", bot_player.login_token, "player_level", bot_player.current_level, "player_name", bot_player.full_name, "player_xp", bot_player.xp, "player_image", bot_player.image_url, "playing", true, "device_avatar_id", parseInt(bot_player.device_avatar_id), function(err, botDetails){
                                channel.board.addPlayer(bot_player.login_token, true);
														    that.returnData(msg.playerId, bot_player.login_token,  bot_player.full_name, bot_player.xp, bot_player.current_level, bot_player.image_url, playerDetails.player_ip, true, true, bot_player.device_avatar_id, function(data){
						                      console.log('3');
						                      next(data)
						                    })
														  });
														});
												  });												  
													
											  } else {
											  	channel.board.getBotPlayerName("first_name", function(firstName){
											  		channel.board.getBotPlayerName("last_name", function(lastName){
												  		backendFetcher.post("/api/v1/sessions.json", {is_dummy: true, first_name: firstName, last_name: lastName}, that.app, function(bot_player) {
												  			redis.sadd("game_players", "game_player:"+bot_player.login_token, function(err, botData){
																  redis.hmset("game_player:"+bot_player.login_token, "player_id", bot_player.login_token, "player_level", bot_player.current_level, "player_name", bot_player.full_name, "player_xp", bot_player.xp, "player_image", bot_player.image_url, "playing", true, "device_avatar_id", parseInt(bot_player.device_avatar_id), function(err, botDetails){
														  			channel.board.addPlayer(bot_player.login_token, true);
															  		redis.sadd("busy_bots", bot_player.login_token)
															  		redis.sadd("game_players", "game_player:"+bot_player.login_token);
															  		redis.hmset("game_player:"+bot_player.login_token, "player_id", bot_player.login_token, "player_level", bot_player.current_level, "player_name", bot_player.full_name, "player_xp", bot_player.xp, "player_image", bot_player.image_url, "playing", true)
															  		that.returnData(msg.playerId, bot_player.login_token, bot_player.full_name, bot_player.xp, bot_player.current_level, bot_player.image_url, playerDetails.player_ip, true, true, bot_player.device_avatar_id, function(data){
								                      next(data)
								                    })
															  	});
		                            });
													  			
															});
												  	});
													});
											  }	
											});
										} else {
											redis.hgetall("game_player:"+msg.playerId, function(err, playerDetails) {
												if(!!playerDetails) {
													redis.hgetall("game_player:"+playerDetails.opponentId, function(err, opponentDetails) {
														if(!!opponentDetails) {
															that.returnData(playerDetails.player_id, opponentDetails.player_id,  opponentDetails.player_name, opponentDetails.player_xp,  opponentDetails.player_level, opponentDetails.player_image,  opponentDetails.player_ip, false, false, parseInt(opponentDetails.device_avatar_id), function(data){
					                      next(data);
							                });
														} else {
															console.error('Opponent '+playerDetails.opponentId+' details not found !');
															next();
														}												
													})
												} else {
													console.error('Player '+msg.playerId+' details not found !');
													next();
												}	
											});
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


  returnData: function(id, opid, opname, opxp, oplevel, opimage, opip, isdummy, isserver, device_avatar_id, next ){
		next({
			message: !isdummy ? "Opponent found!" : "Bot player added !",
			success: true,
			playerId: id,
			opponentId: opid,
			opponentName: opname,
			opponentXp: opxp,
			opponentLevel: oplevel,
			opponentImage: opimage,
			opponentIp: opip,
			isDummy: isdummy,
			isServer: isserver,
			deviceAvatarId: device_avatar_id
		})	
  },


  sendMessageToUser: function(uid, serverId, msg) {
   this.app.rpcInvoke(serverId, {namespace: "user", service: "entryRemote", method: "sendMessageToUser", args: [uid, msg, "addPlayer"]}, function(data) {});
  },


  kick: function(uid, sid, clubId, cb) {

		var channel = this.channelService.getChannel(clubId, false),
				redis 	= this.app.get("redis");

		if(!!channel) {
			channel.leave(uid, sid);
			console.log('Player has been removed from channel!')
		} else {
			console.error("No channel for this player, Not playing game!");
		}	
		cb()
	},

	addEventListers: function(channel) {
		var that = this,
				board = channel.board,
				redis = that.app.get('redis');
				
		board.eventEmitter.on("addPlayer", function() {
			msg = {};
			msg.quarterFinal = board.quarterFinal;
			msg.semiFinal = board.semiFinal;
			if ((msg.semiFinal[0].length <= 0) && (msg.semiFinal[1].length > 0)) {
				msg.semiFinal = [[]];
				msg.semiFinal[0] = msg.semiFinal[1];
			} else if ((msg.semiFinal[1].length <= 0) && (msg.semiFinal[0].length > 0)) {
				msg.semiFinal = [[]];
				msg.semiFinal[0] = msg.semiFinal[0];
			} else if ((msg.semiFinal[1].length <= 0) && (msg.semiFinal[0].length <= 0)) {
				msg.semiFinal = [];
			}
			msg.finalGame = board.finalGame;
			channel.pushMessage("addPlayer", msg);
		});

		board.eventEmitter.on("gameOver", function() {
			msg = {};
			msg.quarterFinal = board.quarterFinal;
			msg.semiFinal = board.semiFinal;
			if ((msg.semiFinal[0].length <= 0) && (msg.semiFinal[1].length > 0)) {
				msg.semiFinal = [[]]
				msg.semiFinal[0] = board.semiFinal[1];
			} else if ((msg.semiFinal[1].length <= 0) && (msg.semiFinal[0].length > 0)) {
				msg.semiFinal = [[]]
				msg.semiFinal[0] = msg.semiFinal[0];
			} else if ((msg.semiFinal[0].length <= 0) && (msg.semiFinal[1].length <= 0)) {
				msg.semiFinal = [];
			}
			msg.finalGame = board.finalGame;
			channel.pushMessage("addPlayer", msg);
		});

		board.eventEmitter.on("tournamentWinner", function(){
			board.finalGameWinner = _.omit(board.finalGameWinner, 'isDummy', 'playerIp', 'isServer');
			channel.pushMessage("tournamentWinner", board.finalGameWinner)
			channel.board.resetTournament();
		});	
	}

}










