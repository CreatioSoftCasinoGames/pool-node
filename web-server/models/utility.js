var http = require('http');
var backendFetcher = require('./backendFetcher');

module.exports = function() {
	return(new Utility());
};

var Utility = function() {
};

Utility.prototype = {

	getClubs: function(app, cb) {
		backendFetcher.get("/api/v1/clubs.json", {}, app, function(data) {
			cb(data);
		});
	}

};
