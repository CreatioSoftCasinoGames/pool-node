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
  var getProfileRoute = "/api/v1/sessions.json"

	if(msg.is_guest) {
		backendFetcher.post(getProfileRoute, {is_guest: true, device_id: msg.device_id}, self.app, function(user) {
		  self.getHostAndPort({user: user, connectors: connectors, redis: redis}, function(data){
		  	next(null,data);
		  })
		})
	} else if(!!msg.fb_id && !!msg.fb_friends_list && !msg.device_id) {
		backendFetcher.post(getProfileRoute, {fb_id: msg.fb_id, fb_friends_list: msg.fb_friends_list, device_id: msg.device_id}, self.app, function(user) {
			self.getHostAndPort({user: user, connectors: connectors, redis: redis}, function(data){
		  	next(null,data);
		  })
		})
	} else if(!!msg.fb_id && !!msg.fb_friends_list && !!msg.device_id) {
		backendFetcher.post(getProfileRoute, {fb_id: msg.fb_id, fb_friends_list: msg.friend_list, device_id: msg.device_id}, self.app, function(user) {
			self.getHostAndPort({user: user, connectors: connectors, redis: redis}, function(data){
		  	next(null,data);
		  })
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

		if(msg.is_guest) {
			
		} else {
			userSession.getUser(msg.email, msg.password, self.app, function(user){
				if(user != null){
					var res = dispatcher.dispatch(user.id, connectors);
					redis.sadd("game_players", "game_player:"+user.login_token);
			  	redis.hmset("game_player:"+user.login_token, "player_id", user.id, "first_name", user.first_name, "player_name", (user.first_name + ' ' + user.last_name), "player_image", user.image_url, "is_bot", false);
					next(null, {
						code: 200,
						host: res.host,
						port: res.clientPort,
						user: user,
						loginSuccess: true
					});
				} else {
					next(null, {
						code: 200,
						host: null,
						port: null,
						user: user,
						loginSuccess: false
					});
				}		
			});
		}
	}	
},

handler.getHostAndPort = function(msg, next) {
  if (msg.user != null) {
    var res = dispatcher.dispatch(msg.user.login_token, msg.connectors);
    msg.redis.sadd("game_players", "game_player:" + msg.user.login_token);
    msg.redis.hmset("game_player:"+msg.user.login_token, "previous_login_token", msg.user.previous_login_token, "player_id", msg.user.id, "first_name", msg.user.first_name, "player_name", (msg.user.first_name + ' ' + msg.user.last_name), "player_image", msg.user.image_url);
    next({
      code: 200,
      host: res.host,
      port: res.clientPort,
      user: msg.user,
      loginSuccess: true
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