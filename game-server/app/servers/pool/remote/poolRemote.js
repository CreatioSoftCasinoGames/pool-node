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

	//Find the relavent club for a player
	//It must offer a new club if previous clubs have occupancies 2
	findClub:function(clubConfigId, uid, cb) {
		var that 			= this;
		freeClubs = false,
				redis 		= that.app.get("redis"),
				playerId 	= uid,
				clubDetails = {};

	  redis.hgetall("club_config:"+clubConfigId, function(err, typeData){
		if(!!typeData) {

			//Select a club (not with occupancy > 2)
			if (typeData.club_type == "OneToOne") {
				redis.zrevrangebyscore("club_config_occupancy:"+clubConfigId, 2, -1, "limit", 0, 1, function(err, data) {
					console.log(data);
							if(data.length>0) {
								freeClubs = true;
								cb({
									success: true,
									clubId: parseInt(data[0].split(":")[1])
								});
							} else if(data.length == 0 || !freeClubs) {
								backendFetcher.post("/api/v1/clubs.json", {club_config_id: clubConfigId}, that.app, function(data) {
									if(data.valid) {
										clubDetails.club = data.club;
										clubDetails.clubType = data.club_type;
										redisUtil.createClub(clubDetails, redis);
										cb({
											success: true,
											clubId: parseInt(data.club.id)
										});
									}
								})
						  }
			  });
				} else {
					//Select a club (not with occupancy > 8)
					redis.zrevrangebyscore("club_config_occupancy:"+clubConfigId, 7, -1, "limit", 0,  1, function(err, data){
						redis.hmget("game_player:"+uid, "club_id", function(err, playerRoom){
							if(!!playerRoom) {
								data = _.without(data, "club:"+playerRoom);
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
                      console.log("This is Club data after redisUtil Creation");
											console.log(data.club);
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
  
	//Handle join club request from entryhadler 
	//Serch for a relevant club then add this player in a channel
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

  //Handle request from above add message 
  //Serch for a opponent with level +5 and -5 of requested player level
  //Wait for 5 second or add bot as an opponent
  //Bots and players are saved in redis with their login token
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
			console.log("addToClub<<<<<<<<<<<<This is poolRemote clubdata from redis>>>>>>>>>>>>>>");
			console.log(clubData);
			//Update number of online players in this club
			if(!!clubData) {
				redis.get("onlinePlayer:"+clubData.club_config_id, function(err, data1){
					var onlinePlayers = !!data1 ? parseInt(data1) : 0;
				redis.set("onlinePlayer:"+clubData.club_config_id, onlinePlayers+1, function(err, data){
				  });
				});
			} else {
				console.error('addToClub-Redis details for this club - ' + clubId + ' not found!');
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
					channel.board = new poolLogic.Board(clubId, redis, that.app, clubData.club_type);
           




				  redis.sadd("club_config_players:"+clubConfigId, uid, function(err, data){});
				that.addEventListers(channel);
				channel.board.addPlayer(uid, false);
				channel.board.resetTournament();
				}else{
					redis.sadd("club_config_players:"+clubConfigId, uid, function(err, data){});
				that.addEventListers(channel);
				channel.board.addPlayer(uid, false);
				channel.board.resetTournament();
				}
				
				//Get opponenet (either a player or bot)
					redis.zadd("club_id:"+clubId, parseInt(playerDetails.player_level),  uid, function(err, data) {
						that.getOpponent({ channel: channel, clubConfigId: clubConfigId, clubId: clubId, playerId: uid, sid: sid, playerLevel: parseInt(playerDetails.player_level), playerIp: String(playerIp)}, function(responseData){
							if(!!responseData ){

								//Remove these players from room_config_players array
								redis.srem("club_config_players:"+clubConfigId, responseData.playerId);
								redis.srem("club_config_players:"+clubConfigId, responseData.opponentId);
								
								console.log("<<<<<<<<<<The Tournament is starting:>>>>>>>>>>>");
								console.log(channel.board.clubType);
								//If the game type is tournament then ready to add more bot players
								if (channel.board.clubType == "Tournament") {


									if(!channel.board.botAdded) {
										console.log("<<<<<<<<The bot is added to board botadded : true>>>>>>>>");
										channel.board.botAdded = true;
										setTimeout(function(){
											console.log('Enough of waiting player, bring bots!')
											aiLogic.addBotPlayers(channel.board, function() {});
									  },5000);
									} else {
										console.error('Bot has been already adding in this club!');
									}
								}

								//Adjust available and busy bots
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
								
								//Callback of this function
								responseData.clubId = clubId;
								responseData.clubConfigId = clubConfigId;
								next(responseData);

								//Update players profile from here
								redis.hgetall("club:"+clubId, function(err, data) {
									if(!!data) {
										console.log('Entry fees - ' + data.entry_fees);
										dbLogger.updatePlayerData({playerId: uid, gamePlayed: 1, deduce_amount: parseInt(data.entry_fees)});
									} else {
										dbLogger.updatePlayerData({playerId: uid, gamePlayed: 1});
									}
								})

								//Add all waiting players into players list
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

  //Get relevant opponent for a requested players
  //Opponent with level +5 and -5 with requested player
  //If there are no players then add a bot player
  //At the same time get players/bot profile details form Rails and 
  //ready to send back to requested player in Join Club response
  getOpponent: function(msg, next) {

		var that 					= this,
			redis 				= that.app.get("redis"),
				opponentFound = false,
				channel 			=	_.extend(msg.channel),
			clubType 			= channel.board.clubType,
			clubConfigId 	=	msg.clubConfigId;

		redis.zrangebyscore("club_id:"+msg.clubId, msg.playerLevel-3, msg.playerLevel+3, function(err, allPlayers){
			console.log('========= ALL PLAYERS =========');
			console.log(allPlayers)
			that.filterOpponent(clubConfigId, allPlayers, function(playerList){
				console.log('========= FINAL PLAYERS IN MATCH =========');
				console.log(playerList)
				playerList = _.without(playerList, msg.playerId); //Remove the current player from list
				console.log('========= FINAL OPPONENT PLAYERS =========');
				console.log(playerList);
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
							that.returnData(msg.playerId, playerList[0], newPlayer.full_name, newPlayer.xp, newPlayer.current_level, newPlayer.image_url, String(player.player_ip), false, true, parseInt(newPlayer.device_avatar_id), function(data){
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
							if(newPlayerList.length > 0 && !opponentFound) {
								opponentFound = true;
			
								//Remove players from redis data, Set status playing, send response
								redis.zrem("club_id:"+msg.clubId, parseInt(msg.playerLevel), msg.playerId, function(err, data) {
									redis.hmget("game_player:"+playerList[0], "player_level", function(err, playerLevel) {
										redis.zrem("club_id:"+msg.clubId, parseInt(playerLevel), playerList[0], function(err, data) {
											redis.hmset("game_player:"+msg.playerId, "playing", true, "opponentId", playerList[0], function(err, playerLevel) {
												redis.hmset("game_player:"+playerList[0], "playing", true, "opponentId", msg.playerId, function(err, playerLevel) {
													redis.hgetall("game_player:"+playerList[0], function(err, player) {
														backendFetcher.get("/api/v1/users/"+ playerList[0] +".json", {}, that.app, function(newPlayer) {
															that.returnData(msg.playerId, playerList[0], newPlayer.full_name, newPlayer.xp, newPlayer.current_level, newPlayer.image_url, String(player.player_ip), false, true, parseInt(newPlayer.device_avatar_id), function(data){
																console.log("The real player data is:", +data);
															  next(data)
															});
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
											if(!!playerDetails && !!playerDetails.playing && String(playerDetails.playing) == "false") {
												redis.smembers("available_bots", function(err, data) {
													if(data.length > 0){
														backendFetcher.get("/api/v1/users/"+data[0]+".json", {}, that.app, function(bot_player) {
															redis.sadd("game_players", "game_player:"+bot_player.login_token, function(err, botData){
															  redis.hmset("game_player:"+bot_player.login_token, "player_id", bot_player.login_token, "player_level", bot_player.current_level, "player_name", bot_player.full_name, "player_xp", bot_player.xp, "player_image", bot_player.image_url, "playing", true, "device_avatar_id", parseInt(bot_player.device_avatar_id), function(err, botDetails){
															  		console.log("getopponent1>>The bot details are:");
																		console.log(bot_player);
																		channel.board.addPlayer(bot_player.login_token, true);
																	that.returnData(msg.playerId, bot_player.login_token,  bot_player.full_name, bot_player.xp, bot_player.current_level, bot_player.image_url, String(playerDetails.player_ip), true, true, bot_player.device_avatar_id, function(data){
																	  next(data)
																	});
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
																			console.log("getopponent111>>The bot details are:" +bot_player[0]);
																			console.log(bot_player);
																			that.returnData(msg.playerId, bot_player.login_token, bot_player.full_name, bot_player.xp, bot_player.current_level, bot_player.image_url, String(playerDetails.player_ip), true, true, bot_player.device_avatar_id, function(data){
																			  next(data)
																			});
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
																that.returnData(playerDetails.player_id, opponentDetails.player_id,  opponentDetails.player_name, opponentDetails.player_xp,  opponentDetails.player_level, opponentDetails.player_image,  String(opponentDetails.player_ip), false, false, parseInt(opponentDetails.device_avatar_id), function(data){
																  next(data);
																	});
															} else {
																console.error('Opponent '+playerDetails.opponentId+' details not found !');
																that.addBotasOpponent(channel, msg.playerId, function(data){
																	console.log("getopponent2>>Bot added as Opponent");
																	next(data);
																});
															}												
														})
													} else {
														console.error('Player '+msg.playerId+' details not found !');
														that.addBotasOpponent(channel, msg.playerId, function(data){
																console.log("getopponent3>>Bot added as Opponent");
															next(data);
														});
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
			});
		});
  },

  addBotasOpponent: function(channel, playerId, cb){
  	var that 	= this,
  			redis = that.app.get("redis");
        
  	channel.board.getBotPlayerName("first_name", function(firstName){
			channel.board.getBotPlayerName("last_name", function(lastName){
				backendFetcher.post("/api/v1/sessions.json", {is_dummy: true, first_name: firstName, last_name: lastName}, that.app, function(bot_player) {
					redis.sadd("game_players", "game_player:"+bot_player.login_token, function(err, botData){
						  redis.hmset("game_player:"+bot_player.login_token, "player_id", bot_player.login_token, "player_level", bot_player.current_level, "player_name", bot_player.full_name, "player_xp", bot_player.xp, "player_image", bot_player.image_url, "playing", true, "device_avatar_id", parseInt(bot_player.device_avatar_id), function(err, botDetails){
								channel.board.addPlayer(bot_player.login_token, true);
								redis.sadd("busy_bots", bot_player.login_token)
								redis.sadd("game_players", "game_player:"+bot_player.login_token);
								redis.hmset("game_player:"+bot_player.login_token, "player_id", bot_player.login_token, "player_level", bot_player.current_level, "player_name", bot_player.full_name, "player_xp", bot_player.xp, "player_image", bot_player.image_url, "playing", true)
								console.log("addbotasopponent1>>The bot details are:" +bot_player[0]);
								console.log(bot_player);
								that.returnData(playerId, bot_player.login_token, bot_player.full_name, bot_player.xp, bot_player.current_level, bot_player.image_url, String(playerDetails.player_ip), true, true, bot_player.device_avatar_id, function(data){			  
  								cb(data);
								});
							});
						});
					});
				});
			});
  },

  filterOpponent: function(clubConfigId, allPlayers, cb) {
	var that 	= this,
			redis = that.app.get("redis"),
			sortedList 	=	[];
	console.log('========= 2 ALL PLAYERS =========');
	console.log(allPlayers)
	redis.smembers("club_config_players:"+clubConfigId, function(err, playerList){
		console.log('========= CLUB PLAYERS =========');
		console.log(playerList)
		if(!!playerList && playerList.length > 0) {
			sortedList = _.intersection(allPlayers, playerList)
			console.log('========= SORTED PLAYERS =========');
			console.log(sortedList)
			console.log('========= CALLBACK SENT =========');
			cb(sortedList);
		} else {
			console.error('There are no waiting players in this club!')
			console.log('========= CALLBACK SENT =========');
			cb(sortedList);
		}
	});
  },

  //Create a opponent response for Join Club request (send call back to getOpponent function)
  returnData: function(id, opid, opname, opxp, oplevel, opimage, opip, isdummy, isserver, device_avatar_id, next ){
  //	console.log(isServer)
	/*	if(isServer) {*/
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
			});
		}, /*else {
			setTimeout(function(){
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
				});
			}, 2000)
		}*/
		/*if(isServer) */
		// next({
			
  // 			message: !isdummy ? "Opponent found!" : "Bot player added !",
		// 	success: true,
		// 	playerId: id,
		// 	opponentId: opid,
		// 	opponentName: opname,
		// 	opponentXp: opxp,
		// 	opponentLevel: oplevel,
		// 	opponentImage: opimage,
		// 	opponentIp: opip,
		// 	isDummy: isdummy,
		// 	isServer: isserver,
		// 	deviceAvatarId: device_avatar_id
	 //        });
			
			/*else { setTimeout(function(){ next({ 
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
		   });
			},2000); 
			}*/
  //},


  //Used to send broadcast to any player through session / connected server
  sendMessageToUser: function(uid, serverId, msg) {
   this.app.rpcInvoke(serverId, {namespace: "user", service: "entryRemote", method: "sendMessageToUser", args: [uid, msg, "addPlayer"]}, function(data) {});
  },


  //Handle request to remove a player from any channel
  kick: function(uid, sid, clubId, cb) {

		var channel = this.channelService.getChannel(clubId, false),
				redis 	= this.app.get("redis");

		if(!!channel) {
			channel.leave(uid, sid);
			console.log('Kick has been called, Player has been removed from channel!')
		} else {
			console.error("No channel for this player, Not playing game!");
		}	
		cb()
	},

	//Add all the event listeners from different server
	addEventListers: function(channel) {
		var that = this,
				board = channel.board,
				redis = that.app.get('redis');
				
		//Add player broadcast to send complete tournament fixture when players are adding
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

		//Game over broadcastto send updated tournament fixture
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










