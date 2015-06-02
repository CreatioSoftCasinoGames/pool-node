var _ = require('underscore');
var events = require('events');

var Board = function(clubId, redis, app, clubType) {
	this.clubId 		 		= clubId;
	this.redis 					= redis;
	this.app 						=	app;
	this.clubType    		= clubType;
	this.waitingTime 		=	5000;
	this.addbotInterval	=	2000;
	this.gamePlayers 		=	[];
	this.leavePlayers		=	[];
	this.gameRunning 		= false;
	this.eventEmitter 	= new events.EventEmitter();
	this.init()
}

Board.prototype = {

	init: function() {
		this.players 							= [];
		this.playersToAdd 				= [];
		this.botAdded 						=	false;
		this.playerSets 					= [];
		this.quarterFinal 				= [];
		this.semiFinal 						= [ [], [] ];
		this.finalGame 						= [];
		this.game 								= new Game(this);
		this.firstQuarterOver 		= false;
		this.secondQuarterOver 		= false;
		this.thirdQuarterOver 		= false;
		this.fourthQuarterOver 		= false;
		this.firstSemiOver 				= false;
		this.secondSemiOver 			= false;
		this.finalFromFirstFound 	= false;
		this.finalFromSecondFound = false;
		this.finalGameWinner 			= [];
	},


	addPlayer: function(playerId, isDummy) {
		var that = this;
		var player = new Player(playerId, isDummy, that.redis, function(data) {
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
							});
						});
						that.players.push(player);
				    that.playerSets.push(player);
				    if (player.isDummy == true) {
				    	player.playerIp = null;
				    }
				    if (that.playerSets.length == 2) {
			        that.playerSets[0].isServer = true;
			        that.playerSets[1].isServer = false;
	            if ((that.playerSets[0].isDummy == true) && (that.playerSets[1].isDummy == true)) {
	            	// console.log(that.playerSets);
	            	var winnerId = that.playerSets[0].playerId;
	            	console.log('Winner id - ' + winnerId);
	            	setTimeout(function(){
	            		that.gameOver(winnerId, "quarterFinal", function(){});
	            	},3000);
	            }

			        if (that.quarterFinal.length > 4) {
			            that.quarterFinal = [];
			        }
			        that.quarterFinal.push(that.playerSets);
			        that.playerSets = [];
				    }
				    that.eventEmitter.emit("addPlayer");
			  	} 
			  }
		});
	},


	gameOver: function(winnerId, stage, cb){
		console.log('Call back needs to be sent ! - ' + stage);
		var that 							= this,
				quarterCount 			= 0,
				semiCount 				= 0,
				callbackSent 			=	false,
				QFWinnerFound 		= false,
				SFWinnerFound 		= false,
				finalWinnerFound 	= false;

		if(stage == "quarterFinal") {
			_.each(that.quarterFinal, function(player) {
					quarterCount++;
				
				//If winner found at 0, 2, 4 or 6 index of Quarter final
				// console.log("1. Quarterfinal - player - " + player[0].playerId + ' winner - ' + winnerId);
				if(player[0].playerId == winnerId) {
					// console.log('1 Winner found at - ' + (quarterCount) +' !')
					if((quarterCount == 1 && !that.firstQuarterOver) || (quarterCount == 2 && !that.secondQuarterOver)) {
						if(_.where(that.semiFinal[0], {playerId: winnerId}).length < 1) {
							// console.log('1  Push in semi final list - ' + that.semiFinal[0].length);
							that.semiFinal[0].push(player[0]);
							QFWinnerFound = true;
						}
					} else if((quarterCount == 3 && !that.thirdQuarterOver) || (quarterCount == 4 && !that.fourthQuarterOver)) {
						if(_.where(that.semiFinal[1], {playerId: winnerId}).length < 1) {
							// console.log('2 Push in semi final list - ' + that.semiFinal[1].length);
							that.semiFinal[1].push(player[0]);
							QFWinnerFound = true;
						}
					}
				} else if(player[1].playerId == winnerId) {
					// console.log('2 Winner found at - ' + (quarterCount) +' !')
					console.log(!that.firstQuarterOver);
					if((quarterCount == 1 && !that.firstQuarterOver) || (quarterCount == 2 && !that.secondQuarterOver)) {
						if(_.where(that.semiFinal[0], {playerId: winnerId}).length < 1) {
							// console.log('3 Push in semi final list - ' + that.semiFinal[0].length);
							that.semiFinal[0].push(player[1]);
							QFWinnerFound = true;
						}
					} else if((quarterCount == 3 && !that.thirdQuarterOver) || (quarterCount == 4 && !that.fourthQuarterOver)) {
						if(_.where(that.semiFinal[1], {playerId: winnerId}).length < 1) {
							// console.log('4 Push in semi final list - ' + that.semiFinal[1].length);
							that.semiFinal[1].push(player[1]);
							QFWinnerFound = true;
						}
					} 
				}

				if(QFWinnerFound) {
					// console.log(that.quarterFinal[1]);
					// console.log(winnerId);
					// console.log(_.where(that.quarterFinal[0], {playerId: winnerId}));
					// console.log(_.where(that.quarterFinal[1], {playerId: winnerId}));
					// console.log(_.where(that.quarterFinal[2], {playerId: winnerId}));
					// console.log(_.where(that.quarterFinal[3], {playerId: winnerId}));
					if(!!that.semiFinal[0][0] && that.semiFinal[0].length > 0 && !that.firstQuarterOver && _.where(that.quarterFinal[0], {playerId: winnerId}).length > 0) {
						console.log('1 Quarter final over !');
						that.firstQuarterOver = true;
					} else if(!!that.semiFinal[0][1] && that.semiFinal[0].length > 0 && !that.secondQuarterOver && _.where(that.quarterFinal[1], {playerId: winnerId}).length > 0) {
						console.log('2 Quarter final over !');
						that.secondQuarterOver = true;
					} else if(!!that.semiFinal[1][0] && that.semiFinal[1].length > 0 && !that.thirdQuarterOver && _.where(that.quarterFinal[2], {playerId: winnerId}).length > 0) {
						console.log('3 Quarter final over !');
						that.thirdQuarterOver = true;
					} else if(!!that.semiFinal[1][1] && that.semiFinal[1].length > 0 && !that.fourthQuarterOver && _.where(that.quarterFinal[3], {playerId: winnerId}).length > 0) {
						console.log('4 Quarter final over !');
						that.fourthQuarterOver = true;
					}
				}

			  //If first semi final index has both bots then Game over
			  if(!that.firstSemiOver) {
			  	if (that.semiFinal[0].length > 0) {
						if (that.semiFinal[0][0].isDummy ) {
							if (that.semiFinal[0].length > 1) {
								if (that.semiFinal[0][1].isDummy) {
									var firstSemiWinner = that.semiFinal[0][0].playerId;
											that.firstSemiOver = true;
										firstSemiTimeout = setTimeout(function(){
										that.gameOver(firstSemiWinner, "semiFinal", function(){});
					      		console.log("First semi final game over!");
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
									var secondSemiWinner = that.semiFinal[1][0].playerId;
									that.secondSemiOver = true;
									setTimeout(function(){
										that.gameOver(secondSemiWinner, "semiFinal", function(){});
										console.log("Second semi final game over!");
					      	},5000);
								}
							}
				    }
					}
			  }
			  if (QFWinnerFound && !callbackSent) {
			  	console.log('Sending game over for Quarterfinal!');
			  	that.eventEmitter.emit("gameOver");
			  	callbackSent = true;
			  	cb();
			  };
	    });
		} else if(stage == "semiFinal") {
			//Transfer semi final players into final players array
			if(that.semiFinal[0].length > 1 || that.semiFinal[1].length > 1) {
				_.each(that.semiFinal, function(playerSet) {
					_.each(playerSet, function(player) {
						semiCount++;
						// console.log((semiCount) + '. Player - ' + player.playerId + ' and winner - ' + winnerId);
						if(player.playerId == winnerId) {
								// console.log('Push in winners list!');
							if(_.where(that.finalGame, {playerId: winnerId}).length < 1) {
								// console.log('Winner not exists - Push in winners list!');
								that.finalGame.push(player);

								SFWinnerFound = true;

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
						if (SFWinnerFound && !callbackSent) {
							console.log('Sending game over for semiFinal!');
							that.eventEmitter.emit("gameOver");
							callbackSent = true;
							cb();
						}
							
					});
				});
			}
		} else if (stage == "final") {
			if(that.finalGame[0].playerId == winnerId ) {
				that.finalGameWinner = that.finalGame[0];
			} else if(that.finalGame[1].playerId == winnerId ) {
				that.finalGameWinner = that.finalGame[1];
			}
			// console.log(that.finalGameWinner);
			if (that.finalGame[0].playerId == winnerId || that.finalGame[1].playerId == winnerId) {
				that.eventEmitter.emit("tournamentWinner");
			}
			that.redis.hgetall("club:"+that.clubId, function(err, findClub) {
				redis.zadd("club_config_occupancy:"+findClub.club_config_id, 0, "club", this.clubId, function(err, data){
	      });
			});
			callbackSent = true
			cb();
		}
		if(!callbackSent) {
			// console.error('Callback not sent from Game Over, Stage - ' + stage);
			cb();
		}

		// setInterval(function(){
		// 	console.log('THIS IS TIMER BROADCAST')
		// 	that.eventEmitter.emit("gameOver");
		// }, 2000)

	},


	newRound: function(cb) {
		var that = this,
				game = that.game,
				redis = that.redis;
		that.players = [];
		game.status = "PROGRESS";
	},

	resetTournament: function(){
		if(this.players.length <= 0) {
	  	this.quarterFinal = [];
  		this.semiFinal = [[], []];
  		this.finalGame = [];
	  }
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