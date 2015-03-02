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