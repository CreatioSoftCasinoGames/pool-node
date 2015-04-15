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
			console.log(data);
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

	// sendMessageToUser: function(uid, serverId, msg, route) {
	// 		this.app.rpcInvoke(serverId, {namespace: "user", service: "entryRemote", method: "sendMessageToUser", args: [uid, msg, route]}, function(data) {
 //      });
	// 	},

	generalProgress: function(channel, playerId, data) {
		data = _.omit(data, 'timestamp', '__route__');
		channel.pushMessage("generalProgress", {
			message: "General Progress",
			data: data
		});
	},

	// getOnlinePlayers: function(msg, session, next) {
	// 	var that = this;
	// 	if(msg.gameType == "Tournament"){
	// 		next(null, {
	// 		onlinePlayer: [ {clubId: 1,
	// 											player: 10}, 
	// 										{clubId: 2,
	// 										  player: 20},  
	// 										{clubId: 3,
	// 										  player: 30}, 
	// 										{clubId: 4,
	// 										  player: 40}, 
	// 										{clubId: 5,
	// 										  player: 50}
	// 										]
	// 	  })
	// 	}else {
	// 		next(null, {
	// 		onlinePlayer: [ {clubId: 6,
	// 											player: 10}, 
	// 										{clubId: 7,
	// 										  player: 20},  
	// 										{clubId: 8,
	// 										  player: 30}, 
	// 										{clubId: 9,
	// 										  player: 40}, 
	// 										{clubId: 10,
	// 										  player: 50}
	// 										]
	// 	  })
	// 	};
	// }



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


	updateOnlinePlayers: function(msg, session, next){
		var that = this
		if (msg.ball_potted){
			console.log("ball_potted");
			dbLogger.updateGame({playerId: session.uid, ball_potted:  msg.ball_potted})
		}
		else if (msg.total_coins_won){
			console.log("total_coins_won");
			dbLogger.updateGame({playerId: session.uid, total_coins_won:  msg.total_coins_won})
    }
  //   else if (msg.accuracy){
		// 	console.log("accuracy");
		// 	dbLogger.updateGame({playerId: session.uid, accuracy:  msg.accuracy})
		// }
		// else if (msg.win_percentage){
		// 	console.log("win_percentage");
		// 	dbLogger.updateGame({playerId: session.uid, win_percentage:  msg.win_percentage})
		// }else if (msg.xp){
		// 	console.log("xp");
		// 	dbLogger.updateGame({playerId: session.uid, xp:  msg.xp})
		// }else if (msg.total_games_played){
		// 	console.log("total_games_played");
		// 	dbLogger.updateGame({playerId: session.uid, total_games_played:  msg.total_games_played})
		// }else if (msg.rank){
		// 	console.log("rank");
		// 	dbLogger.updateGame({playerId: session.uid, rank:  msg.rank})
		// }else if (msg.total_time_in_game){
		// 	console.log("total_time_in_game");
		// 	dbLogger.updateGame({playerId: session.uid, total_time_in_game:  msg.total_time_in_game})
		// }else if (msg.win_streak){
		// 	console.log("win_streak");
		// 	dbLogger.updateGame({playerId: session.uid, win_streak:  msg.win_streak})
		// }else if (msg.current_level){
		// 	console.log("current_level");
		// 	dbLogger.updateGame({playerId: session.uid, current_level:  msg.current_level})
		// }else if (msg.flag){
		// 	console.log("flag");
		// 	dbLogger.updateGame({playerId: session.uid, flag:  msg.flag})
		// }else if (msg.country){
		// 	console.log("country");
		// 	dbLogger.updateGame({playerId: session.uid, country:  msg.country})
		// }else if(msg.device_avtar_id){
		// 	console.log("device_avtar_id");
		// 	dbLogger.updateGame({playerId: session.uid, device_avtar_id:  msg.device_avtar_id})
		// }

		next();

	}


}


