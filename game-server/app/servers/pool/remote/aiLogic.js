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
								backendFetcher.get("/api/v1/users/"+data[0]+".json", {}, that.app, function(bot_player) {
									redis.sadd("game_players", "game_player:"+bot_player.login_token, function(err, botData){
							      redis.hmset("game_player:"+bot_player.login_token, "player_id", bot_player.login_token, "player_level", bot_player.current_level, "player_name", bot_player.full_name, "player_xp", bot_player.xp, "player_image", bot_player.image_url, "playing", true, "device_avatar_id", parseInt(bot_player.device_avatar_id), function(err, botDetails){
									    board.addPlayer(data[0], true);
									  });
							    });
								});
							});
						});
					} else {
						console.log('No bots found, create one !')
						backendFetcher.post("/api/v1/sessions.json", {is_dummy: true, first_name: "Guest User"}, that.app, function(bot_player) {
					  	redis.sadd("game_players", "game_player:"+bot_player.login_token, function(err, botData){
							  redis.hmset("game_player:"+bot_player.login_token, "player_id", bot_player.login_token, "player_level", bot_player.current_level, "player_name", bot_player.full_name, "player_xp", bot_player.xp, "player_image", bot_player.image_url, "playing", true, "device_avatar_id", parseInt(bot_player.device_avatar_id), function(err, botDetails){
						  	  board.addPlayer(bot_player.login_token, true);
						    });
							});
						});
					}
				});
			}
		},board.addbotInterval);
	},

	getTotalBot: function(board, cb){
  	var activePlayers = board.allPlayers().length,
  			redis = board.redis;

	  console.log('Total active players - ' + activePlayers)
	  if(activePlayers > 0) {
	  	redis.zrevrangebyscore("bots_probabilities_sorted_set", parseInt(activePlayers), -1, "limit", 0, 1, function(err, data) {
		  	redis.get(data[0], function(err, probabilities){
		  		probabilities = JSON.parse(probabilities);

		  		var randomNumber = Math.floor(Math.random()*101),
		  				totalBotsToBeAdded = 0,
		  				probabilitySum = 0;

					for (i=0; i<probabilities.length; i++) {
						probabilitySum += (probabilities[i] * 100);
						if (probabilitySum < randomNumber){
							totalBotsToBeAdded = i;
						}
					}
					cb(totalBotsToBeAdded+2);
		  	});
		  });
	  } else {
	  	board.botAdded = false;
	  }
	},

	addBot: function(board, token, cb) {
		var that 		= this,
				roomId 	= board.roomId,
				redis 	= board.redis,
				game 		=	board.game;
				
		redis.sadd("bot_busy", token, function(err, data) {
			redis.srem("bot_available", token, function(err, data){
				that.getTotalCards(board, function(totalCard){
					var totalCard = totalCard > 4 ? 4 : totalCard;
					board.addPlayer(token, totalCard, false)
					redis.hgetall("room:"+roomId, function(err, roomData) {
						redis.zincrby("room_config_occupancy:"+roomData.room_config_id, 1, "room:"+roomId, function(err, newScore) {
							redis.get("onlinePlayer:"+roomData.room_config_id, function(err, currentOnlinePlayers){
								var onlinePlayers = !!currentOnlinePlayers ? parseInt(currentOnlinePlayers) : 0;
				        redis.set("onlinePlayer:"+roomData.room_config_id, onlinePlayers+1, function(err, data){
							  });
							});
							
							board.botPlayers.push(token);

							board.totalBotCards += totalCard;
							game.totalBingos 		= roomData.bingo_factor == 'cards' ? Math.ceil(game.totalCards / parseInt(roomData.divider)) : Math.ceil(board.playersToAdd.length / parseInt(roomData.divider))
							game.bingosLeft 		= game.totalBingos;

							backendFetcher.get("/api/v1/users/"+token+".json", {}, board.app, function(user) {
								redis.sadd("game_players", "game_player:"+user.login_token);
						  	redis.hmset("game_player:"+user.login_token, "uid", user.id, "player_id", user.login_token, "first_name", user.first_name, "player_name", user.first_name+" "+user.last_name, "player_image", user.image_url, "is_bot", true, "round", 1, "attempt", 1);
						  	board.eventEmitter.emit("botPlayerAdded");
								cb({
									success: true
								});
							});
						});
					});
				});
			});
		})
	},

	getTotalCards: function(board, cb) {
		var roomId = board.roomId,
				redis = board.redis;

		redis.hmget("room:"+roomId, "room_config_id", function(err, roomConfigId){
			redis.get("room_id:"+roomConfigId[0], function(err, probabilities){
	  		probabilities = JSON.parse(probabilities);
	  		var randomNumber = Math.floor(Math.random()*101),
	  				probabilitySum = 0,
	  				totalCards = 0;
				for(var i=0; i<probabilities.length; i++) {
					probabilitySum = probabilitySum + probabilities[i]*100;
					if(probabilitySum < randomNumber) {
						totalCards = i;
					}
				}
				cb(totalCards+2);
	  	});
		})
	},

	assignBingoForBots: function(board, cb){
		var totalBots = board.botPlayers.length < 11 ? board.botPlayers.length : 10,
				totalCards = board.game.totalCards,
				startIndex = 0,
				endIndex = 0,
				numberArray = [],
				redis = board.redis;
		var roomName = board.roomName;

		redis.get("bot_bingo:"+totalBots, function(err, data){
			roomName = roomName.split(" ", 2);
			if(roomName[0] == "Speed_Bingo") {

				if(!!data) {
					startIndex 	= parseInt((data)/3);
					endIndex 		= startIndex + (totalCards*3) <= board.game.deck.length ? startIndex + (totalCards*3) : board.game.deck.length;
				} else {
					console.error('Start index not found from Redis');
					startIndex 	= 6
					endIndex 		= startIndex + (totalCards*3) <= board.game.deck.length ? startIndex + (totalCards*3) : board.game.deck.length;
				}
				for(var i=startIndex; i<endIndex; i++) {
					numberArray[i - startIndex] = board.game.deck[i];
				}
				numberArray = _.shuffle(numberArray);
				for(var j=0; j<board.totalBotCards; j++) {
					board.numberAssignedToBots[j] = numberArray[j];
				}
				cb(board.numberAssignedToBots);
					
		  } else {
		  	if(!!data) {
					startIndex 	= parseInt(data);
					endIndex 		= startIndex + (totalCards*3) <= board.game.deck.length ? startIndex + (totalCards*3) : board.game.deck.length;
				} else {
					console.error('Start index not found from Redis');
					startIndex 	= 23
					endIndex 		= startIndex + (totalCards*3) <= board.game.deck.length ? startIndex + (totalCards*3) : board.game.deck.length;
				}
				for(var i=startIndex; i<endIndex; i++) {
					numberArray[i - startIndex] = board.game.deck[i];
				}
				console.log(startIndex + ' and ' + endIndex)
				numberArray = _.shuffle(numberArray);
				console.log('---- Number Array ----')
				console.log(numberArray);
				for(var j=0; j<board.totalBotCards; j++) {
					board.numberAssignedToBots[j] = numberArray[j];
				}
				console.log(board.numberAssignedToBots);
				cb(board.numberAssignedToBots);
			}
			
		});
	},

	botBingo: function(board){
		var game 				= board.game,
				deckNumber 	= game.deck[game.currentDeckIndex],
				botPlayerId = board.botPlayers[game.botBingoPunchCount],
				realPlayer	=	board.players.length === board.botPlayers.length ? false : true;

		console.log(board.numberAssignedToBots);
		console.log('Current ball index - ' + (game.currentDeckIndex+1) + ' - ' + deckNumber + ' BotBingo - ' + game.botBingoPunchCount);
		if(realPlayer || game.botBingoPunchCount <= 0) {
			if(_.indexOf(board.numberAssignedToBots, parseInt(deckNumber)) >= 0) {
				console.log('Bot will punch a Bingo now!')
				game.punch(botPlayerId, true);
				game.botBingoPunchCount = game.botBingoPunchCount >= (board.botPlayers.length-1) ? 0 : game.botBingoPunchCount + 1;
			}
		} else { //If no active players then increse Bot punch frequency
			if(game.bingosLeft > 0 && _.indexOf(board.numberAssignedToBots, parseInt(deckNumber)) >= 0 && game.botBingoPunchCount <= 0) {
				console.log('No humans - Bot will punch first Bingo now!')
				game.punch(botPlayerId, true);
				game.botBingoPunchCount = game.botBingoPunchCount >= (board.botPlayers.length-1) ? 0 : game.botBingoPunchCount + 1;
			}
			if(game.bingosLeft > 0 && game.botBingoPunchCount > 0){
				console.log('No humans - Bot will punch a Bingo now!')
				game.punch(botPlayerId, true);
				game.botBingoPunchCount = game.botBingoPunchCount >= (board.botPlayers.length-1) ? 0 : game.botBingoPunchCount + 1;
			}
		}
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