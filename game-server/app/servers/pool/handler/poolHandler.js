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

	getClubConfigs: function(msg, session, next) {
		var that = this;
		backendFetcher.get("/api/v1/club_configs.json", {club_type: msg.club_type}, that.app, function(data) {
			next(null, {
				club_configs: data
			})
		})
	},

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

	general: function(msg, session, next) {
		var that = this;
		that.getPlayerAndChannel(session, function(player, channel) {
			that.generalProgress(channel, session.uid, msg);
			next(null, {
				success: true
			})	
		});
	},


	generalProgress: function(channel, playerId, data) {
		data = _.omit(data, 'timestamp', '__route__');
		channel.pushMessage("generalProgress", {
			message: "General Progress",
			data: data
		});
	},

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


	updateProfile: function(msg, session, next){
		var that = this;

		if((msg.win_streak || msg.win_streak == 0) && (msg.total_coins_won || msg.total_coins_won == 0) && (msg.win_percentage || msg.win_percentage == 0) && (msg.won_count || msg.won_count == 0) && (msg.xp || msg.xp == 0) && (msg.current_coins_balance || msg.current_coins_balance == 0) ){
			dbLogger.updateGame({playerId: session.uid,
			                     win_streak:  msg.win_streak,
                           total_coins_won:  msg.total_coins_won,
                           win_percentage:  msg.win_percentage,
                           won_count:  msg.won_count,
                           xp:  msg.xp,
                           current_coins_balance: msg.current_coins_balance 
			                   })
		}else if((msg.ball_potted || msg.ball_potted == 0) && (msg.strike_count || msg.strike_count == 0) && (msg.accuracy || msg.accuracy == 0)) {
			dbLogger.updateGame({playerId: session.uid,
				                   ball_potted:  msg.ball_potted,
				                   strike_count: msg.strike_count,
				                   accuracy: msg.accuracy
			                   })

		}else if ((msg.total_coins_won || msg.total_coins_won == 0) && (msg.current_coins_balance || msg.current_coins_balance == 0)){
		  dbLogger.updateGame({playerId: session.uid,
			                     total_coins_won:  msg.total_coins_won,
		                       current_coins_balance:  msg.current_coins_balance
		                     })	

		}else if(msg.total_coins_won || msg.total_coins_won == 0){
			dbLogger.updateGame({playerId: session.uid,
			                     total_coins_won:  msg.total_coins_won
			                   })

		
    }else if(msg.device_avatar_id){
			dbLogger.updateGame({playerId: session.uid, device_avatar_id:  msg.device_avatar_id})

		}else if (msg.total_coins_won){
			dbLogger.updateGame({playerId: session.uid, total_coins_won:  msg.total_coins_won})

		}else if (msg.current_coins_balance){
			dbLogger.updateGame({playerId: session.uid, current_coins_balance:  msg.current_coins_balance})	

		}else if (msg.total_games_played){
			dbLogger.updateGame({playerId: session.uid, total_games_played:  msg.total_games_played})

		}else if (msg.rank){
			dbLogger.updateGame({playerId: session.uid, rank:  msg.rank})

		}else if (msg.total_time_in_game){
			dbLogger.updateGame({playerId: session.uid, total_time_in_game:  msg.total_time_in_game})

		}else if (msg.current_level){
			dbLogger.updateGame({playerId: session.uid, current_level:  msg.current_level})

		}else if (msg.flag){
			dbLogger.updateGame({playerId: session.uid, flag:  msg.flag})
			
		}else if (msg.country){
			dbLogger.updateGame({playerId: session.uid, country:  msg.country})
		
		}

		next();

	},

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


