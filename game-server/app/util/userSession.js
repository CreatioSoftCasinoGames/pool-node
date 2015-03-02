var http = require('http');

// select an item from list based on key
module.exports.getUser = function(email, password, app, cb) {
	var loginString = JSON.stringify({email: email, password: password, token: app.get("poolConstants").token});
	var redis = app.get("redis");
	var options = {
	  hostname: app.get("poolConstants").backendHost,
	  port: app.get("poolConstants").backendPort,
	  path: '/api/v1/sessions.json',
	  method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginString.length,
    }
	};
	var req = http.request(options, function(res) {
	  res.setEncoding('utf8');
	  res.on('data', function (user) {
	    cb(JSON.parse(user));
	  });
	});
	req.write(loginString);
  req.end();
};