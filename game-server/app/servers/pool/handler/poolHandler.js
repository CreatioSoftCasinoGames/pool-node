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
    that.getPlayerAndChannel(session, function(player, channel) {
      if (!!channel) {
        if (msg.gameType == "OneToOne") {
          channel.board.redis.smembers("onetoone_room_players", function(err, data) {
            that.getPlayerOnline({data: data, redis: channel.board.redis}, function(onlinePlayer) {
              next(null, {
                success: true,
                onlinePlayer: onlinePlayer
              })
            });
          })
        }else {
          channel.board.redis.smembers("tournament_room_players", function(err, data) {
            that.getPlayerOnline({data: data, redis: channel.board.redis}, function(onlinePlayer) {
              next(null, {
                success: true,
                onlinePlayer: onlinePlayer
              })
            })
          });
        }
      } else {
        next(null, {
          success: false
        })
      }
    });
  },

  getPlayerOnline: function(msg, next) {
    var totalData = 0;
    var onlinePlayer = [];
    _.each(msg.data, function(clubId) {
      msg.redis.get(clubId, function(err, playerCount) {
        totalData++;
        onlinePlayer.push({
          clubId: clubId.split(":")[1],
          player: !!playerCount ? playerCount : 0
        });
        if (totalData == msg.data.length) {
          next(onlinePlayer);
        }
      })
    });
  },


	updateProfile: function(msg, session, next){
		var that = this

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
		}else if(msg.device_avtar_id){
			dbLogger.updateGame({playerId: session.uid, device_avtar_id:  msg.device_avtar_id})
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
		var that = this;
		that.getPlayerAndChannel(session, function(player, channel) {
	    
			// console.log(channel.board.clubType);
			console.log(channel.board.quarter_final);
			// console.log(channel.board.semi_final);					

			if(channel.board.clubType == "OneToOne"){
				// console.log(channel.board.players);
				channel.board.players = [];
				// console.log(channel.board.players);
			}else{
				// console.log(channel.board.quarter_final);
				// console.log(msg);
				// console.log(channel.board.quarter_final.playerId);

				// var filteredPlayerId = _.where(goal, {id: "1"});
				// console.log(msg.winner);
				// console.log(channel.board.quarter_final[0][1].playerId);
				if (channel.board.semi_final[0].length == 0){
					msg.winner = channel.board.quarter_final[0][0].playerId
				}else if(channel.board.semi_final[0].length == 1){
					msg.winner = channel.board.quarter_final[1][0].playerId
				}else if(channel.board.semi_final[1].length == 0){
					msg.winner = channel.board.quarter_final[2][0].playerId
				}else{
					msg.winner = channel.board.quarter_final[2][1].playerId
				}
				// msg.winner = channel.board.quarter_final[0][1].playerId
				// console.log(msg.winner);

        	// console.log(channel.board.quarter_final);
					// console.log(channel.board.quarter_final[1]);
				_.each(channel.board.quarter_final, function(filteredPlayer) {
					// console.log(filteredPlayer);
					// filteredPlayer++;
					// console.log(channel.board.quarter_final[0][0]);
					// console.log(msg.winner + ' and ' + channel.board.quarter_final[1][0].playerId + ' and ' + channel.board.quarter_final[1][1].playerId)

					if((msg.winner == channel.board.quarter_final[0][0].playerId) || (msg.winner == channel.board.quarter_final[0][1].playerId)) {
						// console.log(_.where(channel.board.semi_final[0], {playerId: msg.winner}));
						if (_.where(channel.board.semi_final[0], {playerId: msg.winner}).length < 1) {
							channel.board.semi_final[0].push({playerId: msg.winner});
							console.log("1 one");
						} 
						console.log(channel.board.semi_final[0]);
					}else if ((msg.winner == channel.board.quarter_final[1][0].playerId) || (msg.winner == channel.board.quarter_final[1][1].playerId)) {
						// console.log(_.where(channel.board.semi_final[0], {playerId: msg.winner}));
						if (_.where(channel.board.semi_final[0], {playerId: msg.winner}).length < 1) {
							channel.board.semi_final[0].push({playerId: msg.winner});
							console.log("1 two");
						} 
						console.log(channel.board.semi_final[0]);
					}else if ((msg.winner == channel.board.quarter_final[2][0].playerId) || (msg.winner == channel.board.quarter_final[2][1].playerId)) {
						// console.log(_.where(channel.board.semi_final[1], {playerId: msg.winner}));
						if (_.where(channel.board.semi_final[1], {playerId: msg.winner}).length < 1) {
							channel.board.semi_final[1].push({playerId: msg.winner});
							console.log("1 three");
						} 
        		console.log(channel.board.semi_final[1]);
					}else if ((msg.winner == channel.board.quarter_final[3][0].playerId) || (msg.winner == channel.board.quarter_final[3][1].playerId)) {
						// console.log(_.where(channel.board.semi_final[1], {playerId: msg.winner}));
						if (_.where(channel.board.semi_final[1], {playerId: msg.winner}).length < 1) {
							channel.board.semi_final[1].push({playerId: msg.winner});
							console.log("1 four");
						} 
						console.log(channel.board.semi_final[1]);
					}
					console.log(channel.board.semi_final);
					
        });

			}
			next()	

		
		});		
	},




}

