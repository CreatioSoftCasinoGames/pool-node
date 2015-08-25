var backendFetcher = require('../util/backendFetcher');
var Sidekiq = require("sidekiq");
var _ = require("underscore")

var DBLogger = function() {
	this.app = null;
	this.sidekiq = null;
};

DBLogger.prototype = {

	
	setApp: function(app) {
		this.app = app;
		this.sidekiq = new Sidekiq(app.get('redis'));
	},

	//This worker is used to update user's profile through Rails (sidekiq)
	updateGame: function(data) {
	  var that = this;
	  that.sidekiq.enqueue("UpdateWorker", JSON.stringify({
	  	id: data.playerId,
	    data: data.details
	  }), {
	    retry: false
	  });
  },

  updatePlayerData: function(data) {
	  var that = this;
	  that.sidekiq.enqueue("UpdateWorker", JSON.stringify({
	  	id: data.playerId,
	    data: data
	  }), {
	    retry: false
	  });
  },

  //Handle profile update requests from different servers
  updatePlayer: function(msg, next) {
  	var details = {};
		playerId = msg.playerId;
		details.xp 						= !!msg.xp ? parseInt(msg.xp ): 0;
		details.win_streak 		= !!msg.winStreak ? parseInt(msg.winStreak) : 0;
		details.award 				= !!msg.award ? parseInt(msg.award) : 0;
		details.win 					= !!msg.win ? parseInt(msg.win) : 0;
		details.game_played 	= !!msg.gamePlayed ? parseInt(msg.gamePlayed) : 0;
		details.deduce_amount = !!msg.deduce_amount ? parseInt(msg.deduce_amount) : 0;
		console.log(details);
		this.updateGame({playerId: playerId, details: details})
	},

}

module.exports = new DBLogger();




