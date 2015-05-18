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

Handler.prototype.enter= function(msg, session, next) {
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
	
	redis.hmset("game_player:"+msg.login_token, "player_server_id", that.app.get('serverId'), "session_id", session.id);
	session.on('closed', onUserLeave.bind(null, that.app));
	next(null, {
		code: 502,
		message: "User is ready to enter"
	});
};


Handler.prototype.joinClub=function(msg, session, next) {
  var that = this;
  var board = null;
  that.app.rpc.pool.poolRemote.add(session, session.uid, that.app.get('serverId'), msg.clubConfigId, msg.playerIp, true, function(data) {
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

Handler.prototype.sendMessage= function(msg, session, next) {
	var that = this;
	var redis = that.app.get("redis");
	next(null, {});
	// redis.hgetall("game_player:"+session.uid, function(err, data) {
	// 	opponentId = data.opponentId;
	// 	serverId = data.player_server_id;
	// 	that.app.rpcInvoke(serverId, {namespace: "user", service: "entryRemote", method: "sendMessageToUser", args: [opponentId, msg, "generalProgress"]}, function(data) {
 //    });
	// })
};

var onUserLeave = function(app, session) {
	if(!session || !session.uid) {
		return;
	}
	app.get('redis').del("game_players" , "game_player:"+session.uid, function(err, data) {
		backendFetcher.delete("/api/v1/sessions/"+session.uid+".json", {}, app, function(data) {
		});
	})
	// app.rpc.pool.poolRemote.kick(session, session.uid, app.get('serverId'), session.get('tableId'), true, null);
};


