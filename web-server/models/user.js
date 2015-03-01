var http = require('http');

module.exports = function() {
	return(new User());
};

var User = function() {
};

User.prototype = {

	create: function(params, app, cb) {
		params["token"] = app.get("config").token
		var userString = JSON.stringify(params)
		var options = {
		  hostname: app.get("config").backendHost,
		  port: app.get("config").backendPort,
		  path: '/api/v1/users.json',
		  method: 'POST',
	    headers: {
	      'Content-Type': 'application/json',
	      'Content-Length': userString.length,
	    }
		};
		var req = http.request(options, function(res) {
		  res.setEncoding('utf8');
		  res.on('data', function (chunk) {
		    cb(JSON.parse(chunk));
		  });
		});
		req.write(userString);
	  req.end();
	}

};
