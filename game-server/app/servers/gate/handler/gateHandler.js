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

handler.connectFacebook = function(msg, session, next) {
	var self 						= this,
			redis 					= self.app.get("redis"),
			connectors 			= this.app.getServersByType('connector'),
			getProfileRoute = "/api/v1/sessions.json";

	if(!!msg.fb_id && !!msg.fb_friends_list && !!device_id) {
		backendFetcher.post(getProfileRoute, {is_guest: true, device_id: createNewUser, first_name: msg.playerName }, self.app, function(user) {
			next(null, {
				newUser: !!data.new_user ? data.new_user : false,
				device_id: !!data.device_id ? data.device_id : ""
			});
	  });
	} else {
		var errorMessage = 'Parameter mismatch! (Require fb_id, fb_friends_list and device_id)';
		console.error(errorMessage);
		console.log(msg);
		next(null, {
			success: false,
			message: errorMessage,
			params: msg
		});
	}

},

//Connect user with gate server and login form rails 
//Different cases are used for Guest login and facebook login
handler.getConnector = function(msg, session, next) {

	var self 						= this,
			redis 					= self.app.get("redis"),
			connectors 			= this.app.getServersByType('connector'),
			getProfileRoute = "/api/v1/sessions.json";

			if(!!msg.getProfile) {
		if((!!msg.device_id && msg.device_id != " ") || (!!msg.fb_id && msg.fb_id != " ")) {
			profileId = !!msg.device_id ? msg.device_id : msg.fb_id;
			backendFetcher.get(getProfileRoute+"/"+profileId+"/proceed_session.json", {}, self.app, function(user) {
			  self.getHostAndPort({user: user, connectors: connectors, redis: redis}, function(data){
			  	next(null,data);
			  }); 
			});
		} else {
			errorMessage = 'Wrong parameter while getting profile!';
			errorMessage = errorMessage + "\n\n" + JSON.stringify(msg);
			backendFetcher.postBug({bug_type: "Client - Login",test_mode: testMode, exception: errorMessage}, self.app)
		}
		return;
	}

	if (!!msg.is_guest && msg.is_guest != "false" && !!msg.loginType) {
	  if (msg.loginType == "registration") {
	    var createNewUser = Math.random().toString(36).slice(2) + Math.random().toString(16).slice(2);
	    backendFetcher.post(getProfileRoute, {is_guest: true, device_id: createNewUser, first_name: msg.playerName }, self.app, function(user) {
	      self.getHostAndPort({user: user, connectors: connectors, redis: redis, ip: msg.playerIp}, function(data) {
	        next(null, data);
	      })
	    })
    } else {
	    backendFetcher.post(getProfileRoute, {is_guest: true, device_id: msg.device_id, first_name: msg.playerName }, self.app, function(user) {
	      self.getHostAndPort({user: user, connectors: connectors, redis: redis, ip: msg.playerIp}, function(data) {
	        next(null, data);
	      })
	    })
	  }
  } else if(!!msg.fb_id && !!msg.fb_friends_list && !msg.device_id) {

  	//Set first name and last name cases in case we get null values
    if (!!msg.first_name && !!msg.last_name) {
      firstName = msg.first_name;
      lastName = msg.last_name;
    } else if (!!msg.first_name && !msg.last_name) {
      firstName = msg.first_name;
      lastName = null;
    } else if (!msg.first_name && !!msg.last_name) {
      firstName = null;
      lastName = msg.last_name;
    } else if (!msg.first_name && !msg.last_name) {
    	firstName = 'Guest';
    	lastName = 'User';
    }
		emailId = !!msg.email ? msg.email : null;

		//Rails hit to get user's profile
		backendFetcher.post(getProfileRoute, {fb_id: msg.fb_id, email: emailId, first_name: firstName, last_name: lastName, fb_friends_list: msg.fb_friends_list, device_id: msg.device_id}, self.app, function(user){
			self.getHostAndPort({user: user, connectors: connectors, redis: redis, ip: msg.playerIp}, function(data){
		  	next(null,data);
		  })
		})
	} else if(!!msg.fb_id && !!msg.device_id) {

		//Set first name and last name cases in case we get null values
		 if (!!msg.first_name && !!msg.last_name) {
      firstName = msg.first_name;
      lastName = msg.last_name;
    } else if (!!msg.first_name && !msg.last_name) {
      firstName = msg.first_name;
      lastName = null;
    } else if (!msg.first_name && !!msg.last_name) {
      firstName = null;
      lastName = msg.last_name;
    } else if (!msg.first_name && !msg.last_name) {
    	firstName = 'Guest';
    	lastName = 'User';
    }

		emailId = !!msg.email ? msg.email : null;

		//Rails hit to get user's profile
		backendFetcher.post(getProfileRoute, {fb_id: msg.fb_id, email: emailId, first_name: firstName, last_name: lastName, fb_friends_list: msg.fb_friends_list, device_id: msg.device_id}, self.app, function(user) {
			self.getHostAndPort({user: user, connectors: connectors, redis: redis, ip: msg.playerIp}, function(data){
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
					//redis.hmset("unique_id"+user.unique_id, "game_player:"+user.login_token);
			  	redis.hmset("game_player:"+user.login_token, "player_id", user.login_token, "player_ip", msg.ip, "player_level", user.current_level, "player_name", user.full_name, "player_xp", user.xp, "player_image", user.image_url, "playing", false, "device_avatar_id", parseInt(user.device_avatar_id));
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

//Create response for client with Server host, port and User data
handler.getHostAndPort = function(msg, next) {
	var hostAndPort = this.app.sessionService.service.sessions
	console.log("This is host port and User");
	console.log(msg.user);
  if (msg.user != null  && !msg.progress_existed) {
    var res = dispatcher.dispatch(msg.user.login_token, msg.connectors);

    //--saket login_token corresponding to given unique_id
    msg.redis.sadd("unique_ids", "unique_id:" + msg.user.unique_id);
    
    msg.redis.hmset("unique_id:"+msg.user.unique_id, "login_token", msg.user.login_token);
     //end

    //Save this player data in redis as well
    msg.redis.sadd("game_players", "game_player:" + msg.user.login_token);
    
     

    msg.redis.hmset("game_player:"+msg.user.login_token, "player_id", msg.user.login_token, "player_level", msg.user.current_level, "player_name", msg.user.full_name, "player_xp", msg.user.xp, "player_image", msg.user.image_url, "playing", false, "player_ip", msg.ip, "device_avatar_id", parseInt(msg.user.device_avatar_id), "online", true);
    next({
      code: 200,
      host: res.host,
      port: res.clientPort,
      user: msg.user,
      new_user: msg.new_user,
      loginSuccess: true,
      yoursIp: msg.ip
    });
  } 
else if(msg.progress_existed) {
  	next(null,{
			loginSuccess	: false,
			progressExists: true
		});
  }
},

//SignUp (from webclient)
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