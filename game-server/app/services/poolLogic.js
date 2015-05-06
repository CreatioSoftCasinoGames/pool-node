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

	addPlayer: function(playerId) {
		var that = this;
		var player = new Player(playerId, that.game);
		var opponentFound = false;

		// console.log(that.clubType);

		if (that.clubType == "OneToOne"){
			that.playersToAdd.push(player);
			// console.log(this.playersToAdd);
			that.eventEmitter.emit("addPlayer");
		} else {
			that.players.push(player);
			that.temp.push(player);
				if (that.temp.length == 2){
					if(that.quarterFinal.length > 4) {
						that.quarterFinal = [];
					}
					that.quarterFinal.push(that.temp);
					that.temp = [];
				}
      // }, 5000)
			// console.log(that.quarterFinal);
			that.eventEmitter.emit("addPlayer");

		}		
	},

	gameOver: function(winner){
		var that = this;
		_.each(that.quarterFinal, function(filteredPlayer) {
			if(_.indexOf(that.quarterFinal[0], winner) >= 0) {
				if (_.where(that.semiFinal[0], {playerId: winner.playerId}).length < 1) {
					that.semiFinal[0].push(winner);
				} 
			} else if (_.indexOf(that.quarterFinal[1], winner) >= 0) {
				if (_.where(that.semiFinal[0], {playerId: winner.playerId}).length < 1) {
					that.semiFinal[0].push(winner);
				} 
			} else if (_.indexOf(that.quarterFinal[2], winner) >= 0) {
				if (_.where(that.semiFinal[1], {playerId: winner.playerId}).length < 1) {
					that.semiFinal[1].push(winner);
				} 
			} else if (_.indexOf(that.quarterFinal[3], winner) >= 0) {
				if (_.where(that.semiFinal[1], {playerId: winner.playerId}).length < 1) {
					that.semiFinal[1].push(winner);
				} 
			}
			
    });

    _.each(that.semiFinal, function(semiFilteredPlayer) {
			if(_.indexOf(that.semiFinal[0], winner) >= 0) {
				if (_.where(that.finalGame, {playerId: winner.playerId}).length < 1) {
					that.finalGame.push(winner);
				} 
			} else if (_.indexOf(that.semiFinal[1], winner) >= 0) {
				if (_.where(that.finalGame, {playerId: winner.playerId}).length < 1) {
					that.finalGame.push(winner);
				} 
			}
			
    });

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


var Player = function(playerId) {
	this.playerId = playerId;
};

exports.Board = Board;

