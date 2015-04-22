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

	updateGame: function(data) {
		// console.log(data);
	  var that = this;
	  that.sidekiq.enqueue("UpdateWorker", JSON.stringify({
	  	id: data.playerId,
	    data: data
	  }), {
	    retry: false
	  });
  }

}

module.exports = new DBLogger();




