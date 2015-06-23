var _ = require('underscore');
var backendFetcher = require('../../../util/backendFetcher');

module.exports = function(app) {
  return new Handler(app);
};

var Handler = function(app) {
  this.app = app;
};

/**
 * New client entry.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next step callback
 * @return {Void}
 */
Handler.prototype.entry = function(msg, session, next) {
  next(null, {code: 200, msg: 'game server is ok.'});
};

/**
 * Publish route for mqtt connector.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next step callback
 * @return {Void}
 */
Handler.prototype.publish = function(msg, session, next) {
	var result = {
		topic: 'publish',
		payload: JSON.stringify({code: 200, msg: 'publish message is ok.'})
	};
  next(null, result);
};

/**
 * Subscribe route for mqtt connector.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next step callback
 * @return {Void}
 */
Handler.prototype.subscribe = function(msg, session, next) {
	var result = {
		topic: 'subscribe',
		payload: JSON.stringify({code: 200, msg: 'subscribe message is ok.'})
	};
  next(null, result);
};

//Bind user with server session
Handler.prototype.enter= function(msg, session, next) {
	console.log(msg);
	var that = this;
	var sessionService = that.app.get('sessionService');
	var redis = that.app.get("redis");

	//Check here if the user's token is already exist
	if( !! sessionService.getByUid(msg.login_token)) {
		next(null, {
			code: 500,
			error: true,
			message: "User is already logged in"
		});
		return;
	}
	
	session.bind(msg.login_token);

	//Save server and session id for this player
	redis.hmset("game_player:"+msg.login_token, "player_server_id", that.app.get('serverId'), "session_id", session.id);
	session.on('closed', onUserLeave.bind(null, that.app));

	next(null, {
		code: 502,
		message: "User is ready to enter"
	});
};


//Handle join club request from client
Handler.prototype.joinClub=function(msg, session, next) {
  var that = this;
  var board = null;
  that.app.rpc.pool.poolRemote.add(session, session.uid, that.app.get('serverId'), msg.clubConfigId, msg.playerIp, true, function(data) {
    //Save club details in order to get channel for this player
    session.set("clubConfigId", msg.clubConfigId);
    session.set("clubId", data.clubId);
    session.push("clubConfigId", function(err) {
      if (err) {
        console.error('set clubId for session service failed! error is : %j', err.stack);
      }
    });
    session.push("clubId", function(err) {
      if (err) {
        console.error('set clubId for session service failed! error is : %j', err.stack);
      }
    });    
    next(null, data)
  });
},

//Handle stand up request from client (Remove from attached channel)
Handler.prototype.standUp= function(msg, session, next) {
	var that = this;
	that.app.rpc.pool.poolRemote.kick(session, session.uid, that.app.get('serverId'), session.get('clubId'), function() {
		next(null, {
			success: true
		})
	});
};

//Handle challenge/revenge request from Client
Handler.prototype.revengeChallenge= function(msg, session, next) {

	var that 					= this,
			gameType 			= !!msg.gameType ? msg.gameType : null,
			opponentId 		= !!msg.opponentId ? msg.opponentId : null,
			redis 				= that.app.get("redis"),
			broadcast 		=	null,
			clubConfigId 	= !!msg.clubConfigId ? msg.clubConfigId : null;

	if(!!gameType && !!opponentId && !!clubConfigId) {

		//Handle different cases for revenge and challenge
		redis.hgetall("game_player:"+opponentId, function(err, playerDetails){
			if(!!playerDetails) {
				broadcast = gameType == "revenge" ? "revenge" : "challenge";
				message = {};
				message.playerId = session.uid;
				message.opponentId = opponentId;
				message.clubConfigId = clubConfigId;
				if(!!playerDetails.player_server_id) {
					that.sendMessageToUser(opponentId, playerDetails.player_server_id, broadcast, message);
					next({
						success: true
					})
				} else {
					console.error('Server for player '+opponentId+' not found!');
					next({
						success: false,
						message: 'Server for player '+opponentId+' not found!'
					})
				}
			} else {
				console.error('Player '+opponentId+' details not found in redis!');
				next({
					success: false,
					message: 'Player '+opponentId+' details not found in redis!'
				})
			}
		});

	} else {
		console.error('Parameter missing while revenge or challenge!')
		console.log(msg);
		next({
			success: false,
			message: 'Parameter missing while revenge or challenge!',
			data: msg
		})
	}
};

//Send a broadcast to player from rpcInvoke
Handler.prototype.sendMessageToUser = function(uid, serverId, route, msg) {
 this.app.rpcInvoke(serverId, {namespace: "user", service: "entryRemote", method: "sendMessageToUser", args: [uid, msg, route]}, function(data) {});
};

//Handle force close requests from client
var onUserLeave = function(app, session) {
	if(!session || !session.uid) {
		return;
	}
	//Log out this user from Rails 
	app.get('redis').del("game_players" , "game_player:"+session.uid, function(err, data) {
		backendFetcher.delete("/api/v1/sessions/"+session.uid+".json", {}, app, function(data) {
			console.log(data.message);
		});
	})
	//Remove from channel also
	app.rpc.pool.poolRemote.kick(session, session.uid, app.get('serverId'), session.get('clubId'), null);
};


