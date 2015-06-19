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
		backendFetcher.get("/api/v1/club_configs.json", {club_type: msg.club_type}, that.app, function(data) {
			if(!!data) {
				console.log(data)
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

			backendFetcher.put("/api/v1/users/"+session.uid+"/connect_facebook", {fb_id: msg.fb_id, first_name: firstName, last_name: lastName, email: email, fb_friends_list: msg.fb_friends_list}, that.app, function(data) {
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
						message: "User has been connected with facebook!"
					})
				} else {
					next(null, {
						success: true,
						message: "User has been connected with facebook!"
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

	//Send a broadcast to player from rpcInvoke
	sendMessageToUser: function(uid, serverId, route, msg) {
   this.app.rpcInvoke(serverId, {namespace: "user", service: "entryRemote", method: "sendMessageToUser", args: [uid, msg, route]}, function(data) {});
  },

	//Handle online player count request from client
	//Online players stored in redis
	etOnlinePlayers: function(msg, session, next) {
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
    }else {
      redis.smembers("tournament_room_players", function(err, data) {
        that.getPlayerOnline({data: data, redis: redis}, function(onlinePlayer) {
          next(null, {
            success: true,
            onlinePlayer: onlinePlayer
          })
        })
      });
    }
  },

  //Get online players form every instances of all room configs
  getPlayerOnline: function(msg, next) {
    var totalData = 0;
    var onlinePlayer = [];
    _.each(msg.data, function(clubId) {
      msg.redis.get(clubId, function(err, playerCount) {
        totalData++;
        onlinePlayer.push({
          clubId: clubId.split(":")[1],
          player: !!playerCount ? parseInt(playerCount) : 0
        });
        if (totalData == msg.data.length) {
          next(onlinePlayer);
        }
      })
    });
  },


	//Handle request to update profile (from this file)
	updatePlayer: function(msg, next) {
		var details = {};
		layerId = msg.playerId;
		details.xp 						= !!msg.xp ? msg.xp : 0;
		details.win_streak 		= !!msg.winStreak ? msg.winStreak : 0;
		details.award 				= !!msg.award ? msg.award : 0;
		details.win 					= !!msg.win ? msg.win : 0;
		details.game_played 	= !!msg.gamePlayed ? msg.gamePlayed : 0;
		dbLogger.updateGame({playerId: playerId, details: details})
	},

	//This worker is used to update user's profile through Rails (sidekiq)
	updateProfile: function(msg, session, next){
		var that = this,
		details	=	{};

		details.ball_potted 	= !!msg.ball_potted ? msg.ball_potted : 0;
		details.strike_count 	= !!msg.strike_count ? msg.strike_count : 0;
		details.xp 						= !!msg.xp ? msg.xp : 0;
		details.win_streak 		= !!msg.winStreak ? msg.winStreak : 0;
		details.award 				= !!msg.award ? msg.award : 0;
		details.win 					= !!msg.win ? msg.win : 0;
		details.game_played 	= !!msg.gamePlayed ? msg.gamePlayed : 0;

		dbLogger.updateGame({playerId: session.uid, details: details})
		// }else if (msg.total_time_in_game){
		// 	dbLogger.updateGame({playerId: session.uid, total_time_in_game:  msg.total_time_in_game})
		// }
		next();
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
									playerId: msg.winnerId
								})
							}
							if(!!msg.looserId) {
								console.log('---Looser Player----')
								dbLogger.updatePlayer({
									xp: looserXp,
									playerId: msg.looserId
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


