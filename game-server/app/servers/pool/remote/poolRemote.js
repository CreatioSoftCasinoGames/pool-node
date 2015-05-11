var poolLogic = require('../../../services/poolLogic');
var backendFetcher = require('../../../util/backendFetcher');
var dbLogger = require('../../../services/dbLogger');
var redisUtil = require('../../../util/redisUtil');
var _ = require('underscore');

module.exports = function(app) {
	return new PoolRemote(app);
};

var PoolRemote = function(app) {
	this.app = app;
	this.channelService = app.get('channelService');
	dbLogger.setApp(app);
};

PoolRemote.prototype = {

	findClub:function(clubConfigId, cb) {
		var that = this;
        freeClubs = false,
				redis = that.app.get("redis");

      redis.hgetall("club_config:"+clubConfigId, function(err, typeData){
      	if (typeData.club_type == "OneToOne") {
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
    	
		    } else if (typeData.club_type ==  "Tournament") {
		    	redis.zrevrangebyscore("club_config_occupancy:"+clubConfigId, 2, -1, "limit", 0, 1, function(err, data) {
      			redis.zrange("club_config_occupancy:"+clubConfigId, 0, -1, function(err, clubId){
      				redis.zincrby("club_config_occupancy:"+clubConfigId, 1, "club", clubId, function(err, incData){
      					redis.zrevrangebyscore("club_config_occupancy:"+clubConfigId, 7, -1, "limit", 0,  1, function(err, incValue){
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
      				});
	          });
      		});

		    }
		  });

	},
  
	add: function(uid, sid, clubConfigId, playerIp, flag, cb) {
		var that = this;
		that.findClub(clubConfigId, function(clubId) {
			that.addToClub(uid, sid, clubConfigId, clubId, flag, false, playerIp, cb);

		});
	},

  addToClub: function(uid, sid, clubConfigId, clubId, flag, forceJoin, playerIp, next) {
		var that = this;
		var redis = that.app.get("redis");
		var channel = that.channelService.getChannel(clubId, flag);

		//Calculate online players
		redis.hgetall("club:"+clubId, function(err, clubData) {
			redis.get("onlinePlayer:"+clubData.club_config_id, function(err, data1){
				var onlinePlayers = !!data1 ? parseInt(data1) : 0;
		    redis.set("onlinePlayer:"+clubData.club_config_id, onlinePlayers+1, function(err, data){
			  });
			});
		


			redis.hmset("game_player:"+uid, "player_ip", playerIp, function(err, playerIp) {
			  redis.hgetall("game_player:"+uid, function(err, playerDetails) {
			  	// that.addEventListers(channel);

			  	//Create a board here
			  	if(!channel.board){
			  			clubType = clubData.club_type;
			  			channel.board = new poolLogic.Board(clubId, redis, clubType);
			  		  that.addEventListers(channel);
			  		  channel.board.addPlayer(uid, false);
			  		  channel.board.quarterFinal = [];
				  		channel.board.semiFinal = [[], []];
				  		channel.board.finalGame = [];
			  	}else{
			  		channel.board.addPlayer(uid, false);
			  		// that.addEventListers(channel);
			  		channel.board.quarterFinal = [];
			  		channel.board.semiFinal = [[], []];
			  		channel.board.finalGame = [];
			  	}
			  	
			  	//Get opponenet
			  	// console.log(playerDetails);
					redis.zadd("club_id:"+clubId, parseInt(playerDetails.player_level),  uid, function(err, data) {
						that.getOpponent({ channel: channel, clubId: clubId, playerId: uid, sid: sid, playerLevel: parseInt(playerDetails.player_level), playerIp: playerIp}, function(responseData){
							if(!!responseData ){
								if (channel.board.clubType == "Tournament") {
									setTimeout(function(){
										var botTimer = setInterval(function(){
											redis.smembers("available_bots", function(err, data){
												if(!!data && data.length > 0) {
													// console.log(data);
													if(channel.board.quarterFinal.length == 4 ) {
														if (channel.board.quarterFinal[3].length >= 2){
															console.log('List is full now !');
															clearInterval(botTimer)
														}
														
													} else {
														redis.sadd("busy_bots", data[0],  function(err, added){
															redis.srem("available_bots", data[0], function(err, removed){
																backendFetcher.get("/api/v1/users/"+data[0]+".json", {}, that.app, function(bot_player) {
																	redis.sadd("game_players", "game_player:"+bot_player.login_token, function(err, botData){
															      redis.hmset("game_player:"+bot_player.login_token, "player_id", bot_player.login_token, "player_level", bot_player.current_level, "player_name", bot_player.full_name, "player_xp", bot_player.xp, "player_image", bot_player.image_url, "playing", true, "device_avatar_id", parseInt(bot_player.device_avatar_id), function(err, botDetails){
																	    channel.board.addPlayer(data[0], true);
																	  });
															    });
																});
															});
														});
														
													}
												} else {
													console.log('No bots found, create one !')
													if(channel.board.quarterFinal.length == 4 ) {
														if (channel.board.quarterFinal[3].length >= 2){
															console.log('List is full now !');
															clearInterval(botTimer)
														}
														
													} else {
														backendFetcher.post("/api/v1/sessions.json", {is_dummy: true, first_name: "Guest User"}, that.app, function(bot_player) {
															// console.log(bot_player);
													  	// msg.channel.board.addPlayer(bot_player.login_token);
													  	redis.sadd("game_players", "game_player:"+bot_player.login_token, function(err, botData){
															  redis.hmset("game_player:"+bot_player.login_token, "player_id", bot_player.login_token, "player_level", bot_player.current_level, "player_name", bot_player.full_name, "player_xp", bot_player.xp, "player_image", bot_player.image_url, "playing", true, "device_avatar_id", parseInt(bot_player.device_avatar_id), function(err, botDetails){
														  	  channel.board.addPlayer(bot_player.login_token, true);
														    });
															});
														});
													}
												}
												
											});
										},500);
								  },500) 
								}


								if (responseData.isDummy == true){
									redis.sadd("busy_bots", responseData.opponentId,  function(err, data){
										redis.srem("available_bots", responseData.opponentId, function(err, data){
										});
									});
									
									redis.hgetall("club:"+clubId, function(err, clubData) {
										// console.log(clubData);
										redis.get("onlinePlayer:"+clubData.club_config_id, function(err, data1){
											// console.log(data1);
											var onlinePlayers = !!data1 ? parseInt(data1) : 0;
											// console.log("online player kumar");
									    // console.log(onlinePlayers);
									    redis.set("onlinePlayer:"+clubData.club_config_id, onlinePlayers+1, function(err, data){
									    	// console.log(onlinePlayers);
									      // console.log(data);
										  });
										});
									});
								}
								

								if(responseData.success && responseData.message == "Opponent found!") {
									responseData.clubId = clubId;
									responseData.clubConfigId = clubConfigId;
									next(responseData);
								} else {
									responseData.clubId = clubId;
									responseData.clubConfigId = clubConfigId;
									next(responseData);
								}
								//Add all waiting players into players
								_.each(channel.board.playersToAdd, function(player) {
					      	channel.board.players.push(player);
					      });	
							}
						});
					});
				});
		  });
	});
	},


	addEventListers: function(channel) {
		var that = this,
				board = channel.board,
				redis = that.app.get('redis');
		board.eventEmitter.on("addPlayer", function() {
    	_.each(board.players, function(player) {
    		redis.hgetall("game_player:"+player.playerId, function(err, data) {
    			if(!!data && !!data.player_server_id) {
    				sid = data.player_server_id;
    				msg = {};
    				msg.quarterFinal = board.quarterFinal;
						msg.semiFinal = board.semiFinal;

						
    				if ((msg.semiFinal[0].length <= 0) && (msg.semiFinal[1].length > 0)) {
    					msg.semiFinal = [[]]
							msg.semiFinal[0] = msg.semiFinal[1];
						} else if ((msg.semiFinal[1].length <= 0) && (msg.semiFinal[0].length > 0)) {
							msg.semiFinal = [[]]
							msg.semiFinal[1] = msg.semiFinal[0];
						} else if ((msg.semiFinal[1].length <= 0) && (msg.semiFinal[0].length <= 0)) {
    					msg.semiFinal = [];
    				}

						msg.finalGame = board.finalGame;
    				that.sendMessageToUser(player.playerId, sid, msg);
    			}
    		})
    	});
		});

		board.eventEmitter.on("gameOver", function() {
    	_.each(board.players, function(player) {
    		redis.hgetall("game_player:"+player.playerId, function(err, data) {
    			if(!!data && !!data.player_server_id) {
    				sid = data.player_server_id;
    				msg = {};
    				msg.quarterFinal = board.quarterFinal;
    				msg.semiFinal = board.semiFinal;
    				// console.log(msg.semiFinal);
    				
    				if ((msg.semiFinal[0].length <= 0) && (msg.semiFinal[1].length > 0)) {
    					msg.semiFinal = [[]]
							msg.semiFinal[0] = board.semiFinal[1];
						} else if ((msg.semiFinal[1].length <= 0) && (msg.semiFinal[0].length > 0)) {
							// console.log(msg.semiFinal);
							msg.semiFinal = [[]]
							msg.semiFinal[0] = board.semiFinal[0];
						} else if ((msg.semiFinal[1].length <= 0) && (msg.semiFinal[0].length <= 0)) {
    					msg.semiFinal = [];
    				}
						
						msg.finalGame = board.finalGame;
    				that.sendMessageToUser(player.playerId, sid, msg);
    			}
    		})
    	});
		});
		
	},



	


  getOpponent: function(msg, next) {

  	msg.channel.add(msg.playerId, msg.sid);

		var that = this,
		  redis = that.app.get("redis"),
		  opponentFound = false,
		  quarterFinal = msg.channel.board.quarterFinal,
		  clubType = msg.channel.board.clubType;

		// console.log(quarterFinal.length);

		redis.zrangebyscore("club_id:"+msg.clubId, msg.playerLevel-3, msg.playerLevel+3, function(err, playerList){
			// console.log(err);
			// console.log(playerList);
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
                    that.returnData(msg.playerId, playerList[0], player.player_name, player.player_xp, player.player_level, player.player_image, player.player_ip, false, true, parseInt(player.device_avatar_id), function(data){
                       // console.log(data);
                       // console.log('1');
                       next(data)
                    })
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
													that.returnData(msg.playerId, playerList[0],  player.player_name, player.player_xp, player.player_level, player.player_image, player.player_ip, false, true, parseInt(player.device_avatar_id), function(data){
		                        // console.log(data);
		                        // console.log('2');
		                        next(data)
		                      })
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
                                msg.channel.board.addPlayer(bot_player.login_token, true);
														    that.returnData(msg.playerId, bot_player.login_token,  bot_player.full_name, bot_player.xp, bot_player.current_level, bot_player.image_url, playerDetails.player_ip, true, true, bot_player.device_avatar_id, function(data){
						                      // console.log(data);
						                      // console.log('3');
						                      next(data)
						                    })
														  });
														});
												  });												  
													
											  } else {
											  	msg.channel.board.getBotPlayerName("first_name", function(name){
											  		backendFetcher.post("/api/v1/sessions.json", {is_dummy: true, first_name: name}, that.app, function(bot_player) {
											  			redis.sadd("game_players", "game_player:"+bot_player.login_token, function(err, botData){
															  redis.hmset("game_player:"+bot_player.login_token, "player_id", bot_player.login_token, "player_level", bot_player.current_level, "player_name", bot_player.full_name, "player_xp", bot_player.xp, "player_image", bot_player.image_url, "playing", true, "device_avatar_id", parseInt(bot_player.device_avatar_id), function(err, botDetails){
													  			msg.channel.board.addPlayer(bot_player.login_token, true);
														  		redis.sadd("available_bots", bot_player.login_token)
														  		redis.sadd("game_players", "game_player:"+bot_player.login_token);
														  		redis.hmset("game_player:"+bot_player.login_token, "player_id", bot_player.login_token, "player_level", bot_player.current_level, "player_name", bot_player.full_name, "player_xp", bot_player.xp, "player_image", bot_player.image_url, "playing", true)
														  		that.returnData(msg.playerId, bot_player.login_token, bot_player.full_name, bot_player.xp, bot_player.current_level, bot_player.image_url, playerDetails.player_ip, true, true, bot_player.device_avatar_id, function(data){
							                      // console.log(data);
							                      // console.log('4');
							                      next(data)
							                    })
														  	});
                              });
														});
											  	})
											  	
											  }	
											});
										} else {
											redis.hgetall("game_player:"+msg.playerId, function(err, playerDetails) {
												redis.hgetall("game_player:"+playerDetails.opponentId, function(err, opponentDetails) {
													that.returnData(playerDetails.player_id, opponentDetails.player_id,  opponentDetails.player_name, opponentDetails.player_xp,  opponentDetails.player_level, opponentDetails.player_image,  opponentDetails.player_ip, false, false, parseInt(opponentDetails.device_avatar_id), function(data){
			                      // console.log(data);
			                      // console.log('5');
			                      next(data)
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
   this.app.rpcInvoke(serverId, {namespace: "user", service: "entryRemote", method: "sendMessageToUser", args: [uid, msg, "addPlayer"]}, function(data) {
   });
  },


  kick: function(uid, sid, clubId, cb) {
		var channel = this.channelService.getChannel(clubId, false);
		var redis = this.app.get("redis");
		if( !! channel) {
			channel.leave(uid, sid);
		}
			
		cb()
	},

}










