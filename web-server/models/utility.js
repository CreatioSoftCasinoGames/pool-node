var http = require('http');

module.exports = function() {
	return(new Utility());
};

var Utility = function() {
};

Utility.prototype = {

	getTableConfigs: function(app, cb) {
		var params = {token: app.get("config").token}
		var queryString = JSON.stringify(params)
		var options = {
		  hostname: app.get("config").backendHost,
		  port: app.get("config").backendPort,
		  path: '/api/v1/table_configs.json',
		  method: 'GET',
	    headers: {
	      'Content-Type': 'application/json',
	      'Content-Length': queryString.length,
	    }
		};
		var req = http.request(options, function(res) {
		  res.setEncoding('utf8');
		  res.on('data', function (chunk) {
		    cb(JSON.parse(chunk));
		  });
		});
		req.write(queryString);
	  req.end();
	}

};
