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
		if (msg.ball_potted){
			dbLogger.updateGame({playerId: session.uid, ball_potted:  msg.ball_potted})
		}else if (msg.total_coins_won){
			dbLogger.updateGame({playerId: session.uid, total_coins_won:  msg.total_coins_won})
    }else if (msg.accuracy){
			dbLogger.updateGame({playerId: session.uid, accuracy:  msg.accuracy})
		}else if (msg.win_percentage){
			dbLogger.updateGame({playerId: session.uid, win_percentage:  msg.win_percentage})
		}else if (msg.xp){
			dbLogger.updateGame({playerId: session.uid, xp:  msg.xp})
		}else if (msg.total_games_played){
			dbLogger.updateGame({playerId: session.uid, total_games_played:  msg.total_games_played})
		}else if (msg.rank){
			dbLogger.updateGame({playerId: session.uid, rank:  msg.rank})
		}else if (msg.total_time_in_game){
			dbLogger.updateGame({playerId: session.uid, total_time_in_game:  msg.total_time_in_game})
		}else if (msg.win_streak){
			dbLogger.updateGame({playerId: session.uid, win_streak:  msg.win_streak})
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


}

