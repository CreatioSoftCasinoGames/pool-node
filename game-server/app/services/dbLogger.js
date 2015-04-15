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
	  console.log('Game START');
	  var that = this;
	  console.log(data);
    
    // if 
	  // case 1
	  //  data {bp: 67}
	  // 2
	  //  da {require 5}

	  that.sidekiq.enqueue("UpdateWorker", JSON.stringify({
	  	id: data.playerId,
	    data: data
	  }), {
	    retry: false
	  });
  }

}

module.exports = new DBLogger();




