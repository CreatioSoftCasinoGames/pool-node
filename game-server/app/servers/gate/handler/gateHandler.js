var dispatcher = require('../../../util/dispatcher');
var userSession = require('../../../util/userSession');
var backendFetcher = require('../../../util/backendFetcher');

module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
	this.app = app;
};

var handler = Handler.prototype;

handler.getConnector = function(msg, session, next) {
	var self = this;
	var redis = self.app.get("redis");
	var connectors = this.app.getServersByType('connector');
	if(msg.deviceID) {
		backendFetcher.post("/api/v1/sessions.json", {is_guest: true, device_id: msg.deviceID, first_name: msg.playerName, last_name: ""}, self.app, function(user) {
			if(user != null) {
				var res = dispatcher.dispatch(user.login_token, connectors);
				next(null, {
					code: 200,
					registeredPlayer: user,
					connector: {host: res.host, port: res.clientPort},
					loginSuccess: true
				});
			}
		})
	} else if(!!msg.fb_id && !!msg.email && !!msg.first_name && !!msg.my_friends) {
		backendFetcher.post("/api/v1/sessions.json", {fb_id: msg.fb_id, email: msg.email, first_name: msg.first_name, last_name: msg.last_name, fb_friend_list: msg.my_friends}, self.app, function(user) {
			if(user != null) {
				var res = dispatcher.dispatch(user.login_token, connectors);
				next(null, {
					code: 200,
					host: res.host,
					port: res.clientPort,
					user: user,
					loginSuccess: true
				});
			}
		})
	} else if(!!msg.fb_id && !!msg.email && !!msg.first_name && !!msg.my_friends && !!device_id) {
		backendFetcher.post("/api/v1/sessions.json", {fb_id: msg.fb_id, email: msg.email, first_name: msg.first_name, last_name: msg.last_name, fb_friend_list: msg.my_friends, device_id: msg.device_id}, self.app, function(user) {
			if(user != null) {
				var res = dispatcher.dispatch(user.login_token, connectors);
				next(null, {
					code: 200,
					host: res.host,
					port: res.clientPort,
					user: user,
					loginSuccess: true
				});
			}
		})
	} else if(!!msg.email.trim() && !!msg.password.trim()) {

		if(!connectors || connectors.length === 0) {
			next(null, {
				code: 500
			});
			return;
		}

		var assignedTable = null;
		var allTables = self.app.get("tables");
		var user = null;

		if(!msg.is_guest) {
			userSession.getUser(msg.email, msg.password, self.app, function(user){
				if(user != null){
					var res = dispatcher.dispatch(user.login_token, connectors);
					next(null, {
						code: 200,
						host: res.host,
						port: res.clientPort,
						user: user,
						loginSuccess: true
					});
				} else {
					next(null, {
						code: 201,
						host: null,
						port: null,
						user: user,
						loginSuccess: false
					});
				}		
			});	
		}
	} else {
		next(null, {
			code: 201,
			loginSuccess: false
		});
	}
},

//SignUp
handler.signUp = function(msg, session, next)	{
	backendFetcher.post("/api/v1/users.json", {first_name: msg.first_name, last_name: msg.last_name, email: msg.email, password: msg.password}, this.app, function(data) {
	 	if(data.valid) {
	 		next(null, {
	 			userCreated: true,
	 			err: null
	 		});
	 	} else {
	 		next(null, {
		 		userCreated: false,
		 		err: data.errors
	 		});
	 	}
	})
};
;