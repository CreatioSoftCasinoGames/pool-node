var _ = require('underscore');
var events = require('events');

var Board = function(clubId, redis, clubType) {
	this.clubId 		 	= clubId;
	this.redis 				= redis;
	this.clubType    	= clubType;
	this.gamePlayers 	=	[];
	this.leavePlayers	=	[];
	this.gameRunning 	= false;
	this.eventEmitter = new events.EventEmitter();
	this.init()
}

Board.prototype = {

	init: function() {
		this.players 				= [];
		this.playersToAdd 	= [];
		this.temp 					= [];
		this.quarterFinal 	= [];
		this.semiFinal 			= [ [], [] ];
		this.finalGame 			= [];
		this.game 					= new Game(this);
		this.firstQuarterOver 	= false;
		this.secondQuarterOver = false;
		this.thirdQuarterOver 	= false;
		this.fourthQuarterOver = false;
		this.firstSemiOver 	= false;
		this.secondSemiOver = false;
		this.finalFromFirstFound = false;
		this.finalFromSecondFound = false;
		this.finalGameWinner = [];
	},


	addPlayer: function(playerId, isDummy) {
		var that = this;
		var player = new Player(playerId, isDummy, that.redis, function(data) {
				console.log('Player details added !');
				var opponentFound = false;
	    	if (that.clubType == "OneToOne") {
			    that.playersToAdd.push(player);

			  //   that.redis.hgetall("club:"+that.clubId, function(err, findClub) {
					// 	that.redis.zincrby("club_config_occupancy:"+findClub.club_config_id, 1, "club:"+that.clubId, function(err, newData) {
					// 		console.log(newData);
					// 		console.log('new data is ' + that.clubId + ' - ' + newData);
					// 	});
					// });

			  } else {
			  	if(that.quarterFinal.length <= 3 || (!!that.quarterFinal[3] && that.quarterFinal[3].length <= 2)) {
			  		that.redis.hgetall("club:"+that.clubId, function(err, findClub) {
							that.redis.zincrby("club_config_occupancy:"+findClub.club_config_id, 1, "club:"+that.clubId, function(err, newData) {
								console.log('new data is ' + that.clubId + ' - ' + newData);
							});
						});
						that.players.push(player);
				    that.temp.push(player);
				    if (player.isDummy == true) {
				    	player.playerIp = null;
				    }
				    if (that.temp.length == 2) {
			        that.temp[0].isServer = true;
			        that.temp[1].isServer = false;
		            if ((that.temp[0].isDummy == true) && (that.temp[1].isDummy == true)) {
		            	var winnerId = that.temp[0].playerId;
		            	console.log('Winner id - ' + winnerId);
		            	setTimeout(function(){
		            		that.gameOver(winnerId, "quarterFinal", function(){});
		            	},3000);
		            }

				        if (that.quarterFinal.length > 4) {
				            that.quarterFinal = [];
				        }
				        that.quarterFinal.push(that.temp);
				        that.temp = [];

				    }
				    that.eventEmitter.emit("addPlayer");
			  	} 
			  }
		});
	},


	gameOver: function(winnerId, stage, cb){
		console.log('Call back needs to be sent ! - ' + stage);
		var that 					= this,
				quarterCount 	= 0,
				semiCount 		= 0,
				callbackSent 	=	false,
				quarterFinalWinnerFound = false,
				semiFinalWinnerFound = false;
				finalWinnerFound = false;

		if(stage == "quarterFinal") {
			console.log("I am in quarter Final");
			_.each(that.quarterFinal, function(player) {
				// if (quarterCount <= 4) {
					quarterCount++;
				// }
				
				//If winner found at 0, 2, 4 or 6 index of Quarter final
				console.log("1. Quarterfinal - player - " + player[0].playerId + ' winner - ' + winnerId);
				if(player[0].playerId == winnerId) {
					console.log('Winner found at - ' + (quarterCount-1) +' !')
					if(quarterCount == 1 || quarterCount == 2) {
						if(_.where(that.semiFinal[0], {playerId: winnerId}).length < 1) {
							console.log('Push in semi final list - ' + that.semiFinal[0].length);
							that.semiFinal[0].push(player[0]);
							quarterFinalWinnerFound = true;
						}
					} else if(quarterCount == 3 || quarterCount == 4) {
						if(_.where(that.semiFinal[1], {playerId: winnerId}).length < 1) {
							console.log('Push in semi final list - ' + that.semiFinal[1].length);
							that.semiFinal[1].push(player[0]);
							quarterFinalWinnerFound = true;
						}
					}
				}
				//If winner found at 1, 3, 5 or 7 index of Quarter final
				console.log("2. Quarterfinal - player - " + player[1].playerId + ' winner - ' + winnerId);
				if(player[1].playerId == winnerId) {
					console.log('Winner found at - ' + (quarterCount-1) +' !')
					if(quarterCount == 1 || quarterCount == 2) {
						if(_.where(that.semiFinal[0], {playerId: winnerId}).length < 1) {
							console.log('Push in semi final list - ' + that.semiFinal[0].length);
							that.semiFinal[0].push(player[1]);
							quarterFinalWinnerFound = true;
						}
					} else if(quarterCount == 3 || quarterCount == 4) {
						if(_.where(that.semiFinal[1], {playerId: winnerId}).length < 1) {
							console.log('Push in semi final list - ' + that.semiFinal[1].length);
							that.semiFinal[1].push(player[1]);
							quarterFinalWinnerFound = true;
						}
					} 
				}

			  //If first semi final index has both bots then Game over
			  if(!that.firstSemiOver ) {
			  	if (that.semiFinal[0].length > 0) {
						if (that.semiFinal[0][0].isDummy ) {
							if (that.semiFinal[0].length > 1) {
								if (that.semiFinal[0][1].isDummy) {
									var firstSemiWinner = that.semiFinal[0][0].playerId
									setTimeout(function(){
										that.firstSemiOver = true;
										that.gameOver(firstSemiWinner, "semiFinal", function(){});
					      		// console.log(" hey Are you there");
					      	},5000);
								}
							}
				    }
					}
			  }

			  //If second semi final index has both bots then Game over
			  if(!that.secondSemiOver) {
			  	if (that.semiFinal[1].length > 0) {
						if (that.semiFinal[1][0].isDummy ) {
							if (that.semiFinal[1].length > 1) {
								if (that.semiFinal[1][1].isDummy) {
									var secondSemiWinner = that.semiFinal[1][0].playerId
									setTimeout(function(){
										that.secondSemiOver = true;
										that.gameOver(secondSemiWinner, "semiFinal", function(){});
					      	},5000);
								}
							}
				    }
					}
			  }
			  if (quarterFinalWinnerFound) {
			  	that.eventEmitter.emit("gameOver");
			  	callbackSent = true;
			  	cb();
			  };
	    });
		} else if(stage == "semiFinal") {
			console.log("I am in semifinal");
			//Transfer semi final players into final players array
			if(that.semiFinal[0].length > 1 || that.semiFinal[1].length > 1) {
				_.each(that.semiFinal, function(playerSet) {
					_.each(playerSet, function(player) {
						semiCount++;
						console.log((semiCount) + '. Player - ' + player.playerId + ' and winner - ' + winnerId);
						if(player.playerId == winnerId) {
								console.log('Push in winners list!');
							if(_.where(that.finalGame, {playerId: winnerId}).length < 1) {
								console.log('Winner not exists - Push in winners list!');
								that.finalGame.push(player);

								semiFinalWinnerFound = true;

								if (that.finalGame.length > 0) {
									// console.log(that.finalGame[0]);
									if (that.finalGame[0].isDummy) {
										if (that.finalGame.length > 1) {
											if (that.finalGame[1].isDummy) {
												var finalWinner = that.finalGame[0].playerId;
												that.finalGameWinner = that.finalGame[0];
												// console.log("It should be started after 7 seconds");
												setTimeout(function(){
													console.log("Send final game over!");
													that.gameOver(finalWinner, "final", function(){});
							      	  },5000);
											}
										}
									}
								}
							}
						}
						if (semiFinalWinnerFound) {
							if(semiCount >= that.semiFinal[0].length + that.semiFinal[1].length) {
								that.eventEmitter.emit("gameOver");
								callbackSent = true;
								cb();
							}
						}
							
					});
				});
			}
		} else if (stage == "final") {

			if (that.finalGame[0].playerId == winnerId || that.finalGame[1].playerId == winnerId) {
				that.eventEmitter.emit("tournamentWinner");
			}


			that.quarterFinal 	= [];
			that.semiFinal 			= [];
			that.finalGame 			= [];

			that.redis.hgetall("club:"+that.clubId, function(err, findClub) {
				redis.zadd("club_config_occupancy:"+findClub.club_config_id, 0, "club", this.clubId, function(err, data){
	      });
			});
			// that.eventEmitter.emit("gameOver");
			callbackSent = true
			cb();
		}
		if(!callbackSent) {
			console.error('Callback not sent from Game Over, Stage - ' + stage);
		}

	},


	newRound: function(cb) {
		var that = this,
				game = that.game,
				redis = that.redis;
		that.players = [];
		game.status = "PROGRESS";
	},

	restartGame: function() {
		var that = this;
		var game = that.game;
		game.status = "IDLE";
		if(that.playersToAdd.length >= 2) {
			console.log("Game will start here !");
		}
	},

	getMessage: function(messageId, cb) {
		var success = true,
				message = "";

		if (messageId == 1) {
			message = "Awaiting Player ...";
		}else if (messageId == 2)  {
			message = "Game In Progress ...";
		}else if (messageId == 3) {
			message = "Prateek Wins ! ";
		}else if (messageId == 4)  {
			message = "It's my break !";
		}else if (messageId == 5) {
			message = "I am on stripes ";
		}else if (messageId == 6)  {
			message = " I am on Solids ";
		}else if (messageId == 7) {
			message = "7 balls left";
		}else if (messageId == 8)  {
			message = "6 balls left";
		}else if (messageId == 9) {
			message = "5 balls left";
		}else if (messageId == 10)  {
			message = "4 balls left";
		}else if (messageId == 11) {
			message = "3 balls left";
		}else if (messageId == 12)  {
			message = "2 balls left";
		}else if (messageId == 13) {
			message = "1 ball left";
		}else if (messageId == 14)  {
			message = " On Black Ball";
		}else if (messageId == 15) {
			message = "Missed my shot ";
		} else {
			success = false
		}
		cb({
			success: success,
			message: message
		});
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
};

var Game = function(board) {
	this.board = board;
};


var Player = function(playerId, isDummy, redis, cb) {
	var that = this;
	that.playerId = playerId;
	that.isDummy = isDummy;
	redis.hgetall("game_player:"+playerId, function(err, data){
		if(!!data) {
		  that.playerLevel = parseInt(data.player_level);
		  that.playerName = data.player_name;
		  that.playerXp = parseInt(data.player_xp);
		  that.playerImage = data.player_image;
		  that.playerIp = data.yoursIp;
		  that.deviceAvatarId = parseInt(data.device_avatar_id);
		  cb()
		} else {
			cb()
		}
	});
};

exports.Board = Board;