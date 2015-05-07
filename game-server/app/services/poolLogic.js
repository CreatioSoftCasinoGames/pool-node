var _ = require('underscore');
var events = require('events');

var Board = function(clubId, redis, clubType) {
	this.clubId 		 	= clubId;
	this.redis 				= redis;
	this.clubType    = clubType;
	this.gamePlayers 	=	[];
	this.leavePlayers	=	[];
	this.gameRunning 	= false;
	this.eventEmitter = new events.EventEmitter();
	console.log(this.eventEmitter);
	this.init()
}

Board.prototype = {

	init: function() {
		this.players = [];
		this.playersToAdd = [];
		this.temp = [];
		this.quarterFinal = [];
		this.semiFinal = [ [], [] ];
		this.finalGame = [];
		this.game = new Game(this);

	},


	addPlayer: function(playerId, isDummy) {
		var that = this;
		var player = new Player(playerId, isDummy, that.redis, function(data) {
				console.log('Player details added !');
				var opponentFound = false;
	    	if (that.clubType == "OneToOne") {
			    that.playersToAdd.push(player);
			    that.eventEmitter.emit("addPlayer");
			  } else {
			    that.players.push(player);
			    that.temp.push(player);
			    if (player.isDummy == true) {
			    	player.playerIp = null;
			    }
			    if (that.temp.length == 2) {
			    	// console.log(that.temp);
		        that.temp[0].isServer = true;
		        that.temp[1].isServer = false;
	            if ((that.temp[0].isDummy == true) && (that.temp[1].isDummy == true)) {
	            	var winnerId = that.temp[0].playerId;
	            	console.log('Winner id - ' + winnerId);
	            	setTimeout(function(){
	            		console.log("Are you there");
	            		that.gameOver(winnerId);
	            	},10000);
	            }

			        if (that.quarterFinal.length > 4) {
			            that.quarterFinal = [];
			        }
			        that.quarterFinal.push(that.temp);
			        that.temp = [];

			    }
			    that.eventEmitter.emit("addPlayer");

			  }
		});
	},


	gameOver: function(winnerId){
		var that = this,
				playerCount = 0;
// console.log();
		_.each(that.quarterFinal, function(player) {
			playerCount++;
			//If winner found at 0, 2, 4 or 6 index of Quarter final
			console.log(player[0].playerId + ' and ' + winnerId);
			if(player[0].playerId == winnerId) {
				console.log('Winner found at - ' + (playerCount-1) +' !')
				if(playerCount == 1 || playerCount == 2) {
					that.semiFinal[0].push(player[0]);
				} else if(playerCount == 3 || playerCount == 4) {
					that.semiFinal[1].push(player[0]);
				}
			}
			//If winner found at 1, 3, 5 or 7 index of Quarter final
			// console.log(player[1].playerId)
			if(player[1].playerId == winnerId) {
				console.log('Winner found at - ' + (playerCount-1) +' !')
				if(playerCount == 1 || playerCount == 2) {
					that.semiFinal[0].push(player[1]);
				} else if(playerCount == 3 || playerCount == 4) {
					that.semiFinal[1].push(player[1]);
				} 
			}

      





    });
    

    that.eventEmitter.emit("gameOver");
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
		  that.playerLevel = data.player_level;
		  that.playerName = data.player_name;
		  that.playerXp = data.player_xp;
		  that.playerImage = data.player_image;
		  that.playerIp = data.yoursIp;
		  that.playerAvtarId = data.device_avatar_id;
		  cb()
		} else {
			cb()
		}
	});
};

exports.Board = Board;

