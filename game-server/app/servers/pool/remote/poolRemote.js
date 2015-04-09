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

		redis.zrevrangebyscore("club_config_occupancy:"+clubConfigId, 1, -1, "limit", 0, 1, function(err, data) {
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
  
	add: function(uid, sid, clubConfigId, flag, cb) {
		var that = this;
		that.findClub(clubConfigId, function(clubId) {
			that.addToClub(uid, sid, clubId, flag, false, cb);

		});
	},

  addToClub: function(uid, sid, clubId, flag, forceJoin, cb) {
		var that 	= this;
				// channel = that.channelService.getChannel(clubId, flag),
				// redis 	= that.app.get("redis");
		cb({
			success: true,
			clubConfigId: clubId
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