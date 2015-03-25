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

	add: function(uid, sid, clubId, flag, cb) {
		var that = this;
		var channel = that.channelService.getChannel(clubId, flag);
		var redis = that.app.get("redis");
		if(!channel.board) {
			channel.board = new poolLogic.Board(clubId, redis);
			channel.board.addPlayer(uid)
			that.addEventListers(channel);
			that.returnAddData(channel, clubId, sid, uid, cb);
		} else {
			channel.board.addPlayer(uid)
			that.returnAddData(channel, clubId, sid, uid, cb);
		}
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