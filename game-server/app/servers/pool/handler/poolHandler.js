var redisUtil = require('../../../util/redisUtil');
var _ = require('underscore');
var PokerRemote = require("../remote/poolRemote");
var backendFetcher = require('../../../util/backendFetcher');
var dbLogger = require('../../../services/dbLogger');


module.exports = function(app) {
	return new Handler(app);
};

var PoolRemote = function(app) {
	this.app = app;
	this.channelService = app.get('channelService');
};

var Handler = function(app) {
	this.app = app;
	this.poolRemote = PokerRemote(app)
	this.channelService = app.get('channelService');
};

Handler.prototype = {

	//Handle get club config details from client (Data will be fetched form Rails)
	getClubConfigs: function(msg, session, next) {
		var that = this;
		backendFetcher.get("/api/v1/club_configs.json", {}, that.app, function(data) {
			if(!!data) {
				next(null, {
					club_configs: data
				})
			} else {
				console.error('No room found from rails!');
				next(null, {
					success: false
				})
			}
		})
	},

	//Get a player's channel using clubId 
	getPlayerAndChannel: function(session, cb) {
		var that = this;
		var channel = that.channelService.getChannel(session.get('clubId'), false);
		var player = null;
		if(!!channel) {
			player = _.findWhere(channel.board.players, {playerId: session.uid});
		}
		cb(player, channel);
	},

	sit: function(msg, session, next) {
		var that = this;
		var success = false;
		var channel = that.channelService.getChannel(session.get('clubId'), false);
		if(!!channel) {
			channel.board.addPlayer(session.uid)
			channel.pushMessage("playerUpdate", {
				playersToAdd: channel.board.playersToAdd.length,
				players: channel.board.players.length
			})
			success = true
		} 
		next(null, {
			success: success
		})	
	},

	//Handle general progress request from client
	general: function(msg, session, next) {
		var that = this;
		that.getPlayerAndChannel(session, function(player, channel) {
			that.generalProgress(channel, session.uid, msg);
			next(null, {
				success: true
			})	
		});
	},


	//Simply send back what client send (remove some unuseful keys from object)
	generalProgress: function(channel, playerId, data) {
		data = _.omit(data, 'timestamp', '__route__');
		channel.pushMessage("generalProgress", {
			message: "General Progress",
			data: data
		});
	},

	//Handle facebook connect request from client
	connectFacebook: function(msg, session, next){
		var that 			= this,
				redis 		= that.app.get("redis"),
				firstName = "";
				lastName 	= "";
				email 		= ""

		if(!!msg.fb_id && !!msg.fb_friends_list) {

			firstName = !!msg.first_name && msg.first_name != "" ? msg.first_name : "Guest User";
			lastName 	= !!msg.last_name && msg.last_name != "" ? msg.last_name : "";
			email 		= !!msg.email && msg.email != "" ? msg.email : null;
			device_id = !!msg.device_id? msg.device_id : null;
			console.log(msg.device_id);
			console.log(device_id);

			backendFetcher.put("/api/v1/users/"+session.uid+"/connect_facebook", {fb_id: msg.fb_id, first_name: firstName, last_name: lastName, email: email, fb_friends_list: msg.fb_friends_list, device_id: msg.device_id}, that.app, function(data) {

				 console.log("Data from rails for facebook login");
				 console.log(data);

				if(!!data.login_token) {
					//Send broadcast to this previous fb user
					redis.hmget("game_player:"+session.uid, "player_server_id", function(err, serverId){
						if(!!serverId) {
							that.sendMessageToUser(session.uid, serverId, "multipleLogin", "Logged in with other device!");
						} else {
							console.error('Server id not found for player - '+session.uid);
						}
					});
					next(null, {
						success: true,
						message: "User has been connected with facebook!",
						new_user: data.fb_new_user
					})
				} else {
					next(null, {
						success: true,
						message: "User has been connected with facebook!",
						new_user: data.fb_new_user
					})
				}
			});
		} else {
			console.error('Parameter mismatch!');
			console.log(msg);
			next(null, {
				success: false,
				message: 'Parameter mismatch! (Require fb_id and fb_friends_list)',
				params: msg
			})
		}
	},

	//Handle request for power-up used
	//Send broadcast to opponent player
	powerupUsed: function(msg, session, next) {

		var    that 				= this,
		      redis 			=	that.app.get("redis"),
				  opponentId 	= !!msg.opponentId ? msg.opponentId : null;
				powertype = !!msg.power_type ? msg.power_type : null;
				

        console.log("This is req message before  opoonent idcheck:");
        console.log(opponentId);
		if(!!opponentId) {
			console.log("This is req message for power up", +msg);
			msg = _.omit(msg, 'opponentId');
			console.log("This is message after omit", +msg);
			console.log(session.uid);
			redis.hgetall("game_player:"+opponentId, function(err, serverId) {
				console.log("The opponent player details for Powerup is");
        console.log(serverId);

				if(!!serverId) {
					console.log(msg)
					that.sendMessageToUser(opponentId, serverId.player_server_id, "powerupUsed", msg);
					next(null, {
						success: true
					});
				} else {
					console.error('No server found for player - '+session.uid+' while powerup used!');
					next(null, {
						success: false,
						message: 'No server found for player - '+session.uid+' while powerup used!'
					});
				}
			});
		} else {
			console.error('Opponent Id not found while powerup used!')
			next(null, {
				success: false,
				message: 'Opponent Id not found while powerup used!'
			});
		}
	},


//Handle Revenge Challenge request acceptance (start the game)
	requestAccepted: function(msg, session, next) {
		console.log(msg)
		var that = this,
		requestId = !!msg.requestId ? msg.requestId : null;
		opponentId = !!msg.opponentId ? msg.opponentId : null;
		challengerId = !!msg.challengerId ? msg.challengerId : null;
		challengertoken = !!msg.opponentoken  ? msg.opponentoken  : null;
        redis 		= that.app.get("redis");
        clubConfigId =  !!msg.clubConfigId ? msg.clubConfigId : null;
        broadcast = "friend_challenge_acceptance";

            
      redis.hgetall("unique_id:"+challengerId, function(err, player) {
           if(!!player)  {
                      chtoken = player.login_token;
                      redis.hgetall("game_player:"+chtoken, function(err, oppelayer) {
                      console.log("this is challenger detail");
                      console.log(oppelayer);
                      console.log(" This is clubconfigid for finding clubid", +clubConfigId);
      redis.hgetall("club_config:"+clubConfigId, function(err, typeData){
                    console.log("This is data for club_config from redis to extract clubid");
                   if(!!typeData) {
                         
      redis.zrevrangebyscore("club_config_occupancy:"+clubConfigId, 2, -1, "limit", 0, 1, function(err, data) {
                           console.log(data);
							if(data.length>0) {
								freeClubs = true;
								
									
							var sendclubId = parseInt(data[0].split(":")[1])
							console.log("The value for final clubid from redis before sending is: ", +sendclubId);
								
							} else if(data.length == 0 || !freeClubs) {
								backendFetcher.post("/api/v1/clubs.json", {club_config_id: clubConfigId}, that.app, function(data) {
									if(data.valid) {
										redisUtil.createClub(data.club, redis);
										
											
											var sendclubId = parseInt(data.club.id)
										console.log("The value for final clubid from database before sending is: ", +sendclubId);
									}
								})
						  }


                if(!!oppelayer) {
               

      redis.hgetall("game_player:"+challengertoken, function(err, opplayer) {

 	               console.log("this is opponent detail");
                   console.log(opplayer);
             backendFetcher.get("/api/v1/users/"+ chtoken +".json", {}, that.app, function(newoPlayer) {
                
                   finalmsg = {};
                   finalmsg.full_name = newoPlayer.full_name, 
                   finalmsg.xp = newoPlayer.xp,
                   finalmsg.current_level = newoPlayer.current_level, 
                   finalmsg.image_url = newoPlayer.image_url, 
                   finalmsg.player_ip = oppelayer.player_ip, 
                   finalmsg.opplogintoken = chtoken,
                   finalmsg.isServer = false, 
                   finalmsg.isDummy = false, 
                   finalmsg.clubConfigId = clubConfigId,
                   finalmsg.FriendClubId = sendclubId,
                   finalmsg.device_avatar_id = parseInt(oppelayer.device_avatar_id)

                   that.sendMessageToUser(challengertoken, opplayer.player_server_id, broadcast, finalmsg);

                  });


                if(!!opplayer) {
					backendFetcher.get("/api/v1/users/"+ challengertoken +".json", {}, that.app, function(newPlayer) {
                
            mesg = {};					                    
            mesg.full_name = newPlayer.full_name, 
            mesg.xp = newPlayer.xp,
            mesg.current_level = newPlayer.current_level, 
            mesg.image_url = newPlayer.image_url, 
            mesg.player_ip = opplayer.player_ip, 
            mesg.opplogintoken = challengertoken,
            mesg.isServer = true, 
            mesg.isDummy = false,
            mesg.clubConfigId = clubConfigId,
            mesg.FriendClubId = sendclubId,
            mesg.device_avatar_id = parseInt(newPlayer.device_avatar_id)

            //send confirmation to challenger
			that.sendMessageToUser(chtoken, oppelayer.player_server_id, broadcast, mesg);

                next(null, {
				success: true
			});
            


					                  });
                              }
                               });
                       } 
                       }); 
                        } else {
			console.error('No clubs found, Please sync the database!');
			next(null, {
				success: false,
				message: "No clubs found, Please sync the database!"
			});
		}
                           });

                     });

                       } 
                   });

  //that.sendMessageToUser(challengertoken, newPlayer.player_server_id, broadcast, mesg);


       },






/*
//Handle Revenge Challenge request acceptance (start the game)
	requestAccepted: function(msg, session, next) {
		console.log(msg)
		var that = this,
		requestId = !!msg.requestId ? msg.requestId : null;
		opponentId = !!msg.opponentId ? msg.opponentId : null;
		challengerId = !!msg.challengerId ? msg.challengerId : null;
		challengertoken = !!msg.opponentoken  ? msg.opponentoken  : null;
        redis 		= that.app.get("redis");
        broadcast = "friend_challenge_acceptance";
         
        //get status of challenger  --- whether online or not whether playing game or not

//redis.hgetall("game_player:"+challengertoken, function(err, redisplayer) {
	     console.log("this is the broadcast response sent for challenger");
        console.log(redisplayer);
       //send opponent profile to challenger       
       // if(!!redisplayer) {
            //    if (!!redisplayer.online && redisplayer.online = "true")   {

                // if (redisplayer.playing == "false") {

                 //fetch opponent profile from redis
                 redis.hgetall("game_player:"+challengertoken, function(err, opplayer) {

                if(!!opplayer) {
					backendFetcher.get("/api/v1/users/"+ challengertoken +".json", {}, that.app, function(newPlayer) {
                
            mesg = {};					                    
            mesg.full_name = newPlayer.full_name, 
            mesg.xp = newPlayer.xp,
            mesg.current_level = newPlayer.current_level, 
            mesg.image_url = newPlayer.image_url, 
            mesg.player_ip = oppplayer.player_ip, 
            mesg.isServer = false, 
            mesg.isDummy = true, 
            mesg.device_avatar_id = parseInt(newPlayer.device_avatar_id)

            //send confirmation to challenger

              redis.hgetall("unique_id:"+challengerId, function(err, player) {
            	if(!!player)  {
                 chtoken = player.login_token;
			that.sendMessageToUser(chtoken, newPlayer.player_server_id, broadcast, mesg);	
                               }
                           });


					                  });
                              }
                               });
            next(null, {
				success: true,
				message: 'Player is available for gameplay!'
			});



                 //}
            //    else {


              // next(null, {
			//	success: false,
			//	message: 'Player is busy in gameplay!'
			//});
              

         //       }



              //  }

       // }
       
             //  });



       },
/*



	//Handle Revenge / Challenge for requested user (offline players)
	acceptGameInvitation: function(msg, session, next) {

		var that			 	= this,
				oppId 	= !!msg.opponentId ? msg.opponentId : null,
				requestId 	= !!msg.requestId ? msg.requestId : null,
				invitationType = !!msg.invitationType ? msg.invitationType : null,
				redis 			= that.app.get("redis"),
				broadcast 	= "gameInvitation",
				message 		= {};


		if(!!oppId && !!requestId) {

                redis.hgetall("unique_id:"+oppId, function(err, player) {
            	if(!!player)  {
                 opponentId = player.login_token;

			redis.hgetall("game_player:"+opponentId, function(err, playerDetails){
				if(!!playerDetails) {
					if(!!playerDetails.player_server_id) {
						//If player is online
						if(!!playerDetails.online && playerDetails.online = "true") {
							message.playerId = session.uid;
							message.invitationType = invitationType;
							message.requestId = requestId;
							that.sendMessageToUser(opponentId, playerDetails.player_server_id, broadcast, message);
							next({
								success: true
							})
						} else {
							console.error('Player '+opponentId+' is offline while '+invitationType+' !')
							backendFetcher.put("/api/v1/game_requests/"+requestId, {accepted: true}, that.app, function(data){
								console.log('Challenge has been accepted !')
							});
							next({
								success: false,
								message: 'Player is offline!'
							});
						}
					} else {
						console.error('Server for player '+opponentId+' not found!');
						next({
							success: false,
							message: 'Server for player '+opponentId+' not found!'
						})
					}
				} else {
					console.error('Player '+opponentId+' details not found in redis / or offline!');
					backendFetcher.put("/api/v1/game_requests/"+requestId, {accepted: true}, that.app, function(data){
						console.log('Challenge has been accepted !')
					});
					next({
						success: false,
						message: 'Player '+opponentId+' details not found in redis / or offline!'
					});
				}
			});
                }
          }); 

		} else {
			console.error('opponentId or requestId not found while accepting game invitation!')
			console.log(msg)
			next(null, {
				success: false,
				message: 'opponentId or requestId not found while accepting game invitation!'
			})
		}
	},
*/
	//Send a broadcast to player from rpcInvoke
	sendMessageToUser: function(uid, serverId, route, msg) {
   this.app.rpcInvoke(serverId, {namespace: "user", service: "entryRemote", method: "sendMessageToUser", args: [uid, msg, route]}, function(data) {});
  },

//saket -- this is message from server opponent stating broadcast be sent to client opponent to
//connect for rpc calls
clientconnectmaster:  function(msg, session, next) {
        console.log("*********************ClientConnect to master*********************************");
	    console.log(msg);
        var that 					= this,
        redis = that.app.get("redis");
        message = {};
        broadcast         =    "mastertoclient",
        message.info = "Connect to Master Now";
        redis.hmget("game_player:"+msg.opponentId, "player_server_id", function(err, serverID){
        that.sendMessageToUser(msg.opponentId,  serverID, broadcast, message);
       
       });

next(null, {
				success: true
				//message: 'opponentId or requestId not found while accepting game invitation!'
			})

   },//that is the message sent





  

	//Handle online player count request from client
	//Online players stored in redis
	getOnlinePlayers: function(msg, session, next) {
    var that = this;
    var redis = that.app.get("redis");
    if (msg.gameType == "OneToOne") {
      redis.smembers("onetoone_room_players", function(err, data) {
        that.getPlayerOnline({data: data, redis: redis}, function(onlinePlayer) {
          next(null, {
            success: true,
            onlinePlayer: onlinePlayer
          })
        });
      })
    }else if (msg.gameType == "Tournament") {
      redis.smembers("tournament_room_players", function(err, data) {
        that.getPlayerOnline({data: data, redis: redis}, function(onlinePlayer) {
          next(null, {
            success: true,
            onlinePlayer: onlinePlayer
          })
        })
      });
    } else {
    	next(null, {
      success: true,
      onlinePlayer: []
    })
    }
  },

  //Get online players form every instances of all room configs
  getPlayerOnline: function(msg, next) {
    var totalData 		= 0,
    		onlinePlayer 	= [],
    		redis 				=	!!msg.redis ? msg.redis : null,
    		roomConfigs 	=	!!msg.data ? msg.data : null,
    		callbackSent 	=	false;

    if(!redis  || !roomConfigs) {
    	callbackSent = true;
    	cb(onlinePlayer);
    }

    _.each(roomConfigs, function(clubId) {
      redis.get(clubId, function(err, playerCount) {
        totalData++;
        onlinePlayer.push({
          clubId: clubId.split(":")[1],
          player: !!playerCount ? parseInt(playerCount) : 0
        });
        if (totalData >= msg.data.length) {
        	callbackSent = true;
          next(onlinePlayer);
        }
      })
    });

    //Extra check if callback not sent in any case
    setTimeout(function(){
    	if(!callbackSent) {
    		cb(onlinePlayer);
    	}
    }, 1000)
  },


	//Handle request to update profile (from this file)
	updatePlayer: function(msg, next) {
		var details = {},
				playerId = msg.playerId;
				
		details.xp 						= !!msg.xp ? msg.xp : 0;
		details.win_streak 		= msg.winner ? 1 : 0;
		details.award 				= !!msg.award ? msg.award : 0;
		details.win 					= !!msg.win ? msg.win : 0;
		details.game_played 	= !!msg.gamePlayed ? msg.gamePlayed : 0;
		dbLogger.updateGame({playerId: playerId, details: details})
	},

	//This worker is used to update user's profile through Rails (sidekiq)
	updateProfile: function(msg, session, next){
		var that 		= this,
				details	=	{};

		details.ball_potted 	= !!msg.ball_potted ? msg.ball_potted : 0;
		details.strike_count 	= !!msg.strike_count ? msg.strike_count : 0;

		dbLogger.updateGame({playerId: session.uid, details: details})
		next(null, {
					success: true
				});
	},

	//Handle chat messages request from client
	chat: function(msg, session, next) {
		var that = this;
		that.getPlayerAndChannel(session, function(player, channel) {
			if(!!channel) {
				channel.board.redis.hmget("game_player:"+session.uid, "player_name", function(err, playerName) {
					channel.pushMessage("chatProgress", {
						playerName: !!playerName[0] ? playerName[0] : "Guest",
						message: msg.message
					})
					next(null, {
						success: true
					})	
				});
			} else {
				next(null, {
					success: false
				})	
			}
		});		
	},

	//Handle game over request from client
	//OneToOne - Simple update winners and loosers profile update
	//Tournament - Update fixture by sending players from Quarter to Semi and Semi to final if winner
	gameOver: function(msg, session, next) {
		if(!msg.winnerId || msg.winnerId == "null" || msg.winnerId == ""){
			console.error('Parameters mismatch!');
			next(null, {
				msg: "Key mismatch !"
			});
			return;
		}

		var that 			= this,
				redis 		= that.app.get("redis"),
				winnerId 	= msg.winnerId,
				stage 		= msg.stage,
				clubId 		=	null;

		that.getPlayerAndChannel(session, function(player, channel) {
			if(!!player && !!channel) {
				clubId = channel.board.clubId;
				//Remove these players from online count
	      redis.hgetall("club:"+clubId, function(err, clubData) {
					redis.get("onlinePlayer:"+clubData.club_config_id, function(err, data1){
						var onlinePlayers = !!data1 ? parseInt(data1) : 0;
				    redis.set("onlinePlayer:"+clubData.club_config_id, onlinePlayers-2, function(err, data){
					  });
					});
				});

				if(channel.board.clubType == "OneToOne"){
					channel.board.players = [];
					redis.hgetall("club:"+clubId, function(err, clubData) {
						var clubConfigId = clubData.club_config_id;

						//Update winner and loosers profile 
						redis.hgetall("club_config:"+clubConfigId, function(err, clubConfigData) {
							console.log(clubConfigData);
							var winAmount = clubConfigData.winner_amount;
							var winnerXp = clubConfigData.winner_xp;
							var looserXp = clubConfigData.looser_xp;
							if(!!msg.winnerId) {
								console.log('---Winner Player----')
								dbLogger.updatePlayer({
									xp: winnerXp,
									award: winAmount,
									winStreak: 1,
									win: 1,
									playerId: msg.winnerId,
									winner: true
								})
							}
							if(!!msg.looserId) {
								console.log('---Looser Player----')
								dbLogger.updatePlayer({
									xp: looserXp,
									playerId: msg.looserId,
									winner: false
								})
							}
						})
					});
					next();
				} else {
					if(!msg.stage || msg.stage == "null" || msg.stage == ""){
						console.error('Parameters mismatch!');
						next(null, {
							msg: "stage not found !"
						});
						return;
					}
					channel.board.gameOver(winnerId, stage, function(data) {
						if (stage != "final"){
							next(null,{
								success: true,
								message: 'Tournament fixture sent!'
							}); 
							channel.board.eventEmitter.emit("gameOver");
							msg = {};
							msg.quarterFinal = channel.board.quarterFinal;
							msg.semiFinal = channel.board.semiFinal;
							if ((msg.semiFinal[0].length <= 0) && (msg.semiFinal[1].length > 0)) {
								msg.semiFinal = [[]]
								msg.semiFinal[0] = msg.semiFinal[1];
							} else if ((msg.semiFinal[1].length <= 0) && (msg.semiFinal[0].length > 0)) {
								msg.semiFinal = [[]]
								msg.semiFinal[1] = msg.semiFinal[0];
							} else if ((msg.semiFinal[1].length <= 0) && (msg.semiFinal[0].length <= 0)) {
								msg.semiFinal = [];
							}
							msg.finalGame = channel.board.finalGame;
							channel.pushMessage("addPlayer", msg);
						} else {
							channel.board.eventEmitter.emit("gameOver");
							msg = {};
							msg.quarterFinal = channel.board.quarterFinal;
							msg.semiFinal = channel.board.semiFinal;
							if ((msg.semiFinal[0].length <= 0) && (msg.semiFinal[1].length > 0)) {
								msg.semiFinal = [[]]
								msg.semiFinal[0] = msg.semiFinal[1];
							} else if ((msg.semiFinal[1].length <= 0) && (msg.semiFinal[0].length > 0)) {
								msg.semiFinal = [[]]
								msg.semiFinal[1] = msg.semiFinal[0];
							} else if ((msg.semiFinal[1].length <= 0) && (msg.semiFinal[0].length <= 0)) {
								msg.semiFinal = [];
							}
							msg.finalGame = channel.board.finalGame;
							channel.pushMessage("addPlayer", msg);
						}
						
					});
				}
			} else {
				console.error('Player or channel not found!');
				next(null, {
					success: false,
					message: 'Player or channel not found!'
				})
			}
		});	
	},

	//Handle tournament in game messages from client
	getMessage: function(msg, session, next) {
		if((!!msg.messageId && msg.messageId != "") &&  !!msg.playerId && (!!msg.stage && msg.stage != "")) {
			this.getPlayerAndChannel(session, function(player, channel) {
				console.log(channel);
				console.log(channel.board);
				channel.board.getMessage(parseInt(msg.messageId), function(message){
					if(message.success && message.message != "") {
						channel.pushMessage("tournamentMessage", {
							playerId 	: msg.playerId,
							messageId : msg.messageId+" balls left",
							// message 	: message.message,
							stage 		: msg.stage
						})
						next(null, {
							success: true,
							messageId : msg.messageId+" balls left",
						});
					} else {
						console.error('Message for this message id does not exists!');
						next(null,{
							success: false,
							message: 'Message for this message id does not exists!'
						});
					}
				});	
			});
		} else {
			console.error('Key is missing or mismatched!');
			next(null,{
				success: false,
				message: 'Key is missing or mismatched!'
			});
		}
	},

}


