var backendFetcher = require('../util/backendFetcher');
var _ = require("underscore")

var AILogic = function() {
	this.app = null;
};

AILogic.prototype = {

	addBotPlayers: function(board, cb) {
		var that 	= this,
				redis = board.redis;

		var botTimer = setInterval(function(){
			if(board.quarterFinal.length == 4 && (!!board.quarterFinal[3] && board.quarterFinal[3].length >= 2)) {
				if (board.quarterFinal[3].length >= 2){
					console.log('Tournament fixture is complete!');
					clearInterval(botTimer);
					cb();
				}
			} else {
				redis.smembers("available_bots", function(err, data){
					console.log('Total bot found - ' + data.length);
					if(!!data && data.length > 0) {
						redis.sadd("busy_bots", data[0],  function(err, added){
							redis.srem("available_bots", data[0], function(err, removed){
								backendFetcher.get("/api/v1/users/"+data[0]+".json", {}, board.app, function(botDetails) {
									redis.sadd("game_players", "game_player:"+botDetails.login_token, function(err, botData){
							      redis.hmset("game_player:"+botDetails.login_token, "player_id", botDetails.login_token, "player_level", botDetails.current_level, "player_name", botDetails.full_name, "player_xp", botDetails.xp, "player_image", botDetails.image_url, "playing", true, "device_avatar_id", parseInt(botDetails.device_avatar_id), function(err, botDetails){
									    board.addPlayer(data[0], true);
									  });
							    });
								});
							});
						});
					} else {
						console.log('No bots found, create one !');	
						backendFetcher.post("/api/v1/sessions.json", {is_dummy: true, first_name: "Guest User"}, board.app, function(botDetails) {
					  	redis.sadd("game_players", "game_player:"+botDetails.login_token, function(err, botData){
							  redis.hmset("game_player:"+botDetails.login_token, "player_id", botDetails.login_token, "player_level", botDetails.current_level, "player_name", botDetails.full_name, "player_xp", botDetails.xp, "player_image", botDetails.image_url, "playing", true, "device_avatar_id", parseInt(botDetails.device_avatar_id), function(err, botDetails){
						  	  board.addPlayer(botDetails.login_token, true);
						    });
							});
						});
					}
				});
			}
		},board.addbotInterval);
	},

	getBotPlayerName: function(type, cb) {
		var  firstNames	= ["Alina", "Braden", "Britney", "Brock", "Charles", 
											"Charlie", "Darren", "Edward", "Elisa", "Anne", 
											"Elvin", "Geoffrey", "Harley", "Howard", "James", 
											"Janet", "Joanna", "Jeffery", "Kate", "Kathy"];

		var lastNames = ["Smith", "Evans", "Taylor", "Jones", "Wilson", 
										"Thomas", "Lewis", "Walker", "White", "Watson", 
										"Harris", "Martin", "Phillips", "Adams", "Campbell", 
										"Cook", "Richards", "Russell", "Rogers", "Carry"];

		if(type == "first_name") {
			cb(firstNames[Math.floor(Math.random()*firstNames.length)]);
		} else if(type == "last_name") {
			cb(lastNames[Math.floor(Math.random()*lastNames.length)]);
		} else {
			cb(firstNames[Math.floor(Math.random()*firstNames.length)] + " " + lastNames[Math.floor(Math.random()*lastNames.length)]);
		}
	},

	setApp: function(app) {
		this.app = app;
		this.sidekiq = new Sidekiq(app.get('redis'));
	}

}

module.exports = new AILogic();