var http = require('http');

// select an item from list based on key
module.exports = {
	exec: function(url, data, app, method, cb) {
		data['token'] = app.get("poolConstants").token
		var queryString = JSON.stringify(data);
		var options = {
		  hostname: app.get("poolConstants").backendHost,
		  port: app.get("poolConstants").backendPort,
		  path: url,
		  method: method,
	    headers: {
	      'Content-Type': 'application/json',
	      'Content-Length': queryString.length
	    }
		};
		var req = http.request(options, function(response) {
			var data = ""
			response.setEncoding('utf8');
			response.on('data', function (chunk) {
		    data += chunk;
		  });
		  response.on('end', function () {
		  	cb(JSON.parse(data));
		  })
		});
		req.write(queryString);
	  req.end();
	},

	get: function(url ,data, app, cb) {
		this.exec(url ,data, app, 'GET', cb)
	},

	post: function(url ,data, app, cb) {
		this.exec(url ,data, app, 'POST', cb)
	},

	delete: function(url ,data, app, cb) {
		this.exec(url ,data, app, 'DELETE', cb)
	},

	put: function(url ,data, app, cb) {
		this.exec(url ,data, app, 'PUT', cb)
	},
}