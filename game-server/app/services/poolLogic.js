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
	this.init()
}

Board.prototype = {

	init: function() {
		this.players = [];
		this.playersToAdd = [];
		this.temp = [];
		this.quarter_final = [];
		this.semi_final = [ [], [] ];
		this.final_game = [];

		this.game = new Game(this);
	},

	addPlayer: function(playerId) {
		var that = this;
		var player = new Player(playerId, that.game);

		// console.log(that.clubType);

		if (that.clubType == "OneToOne"){
			that.playersToAdd.push(player);
			// console.log(this.playersToAdd);
		} else {
			that.players.push(player);
			that.temp.push(player);
			if (that.temp.length == 2){
				that.quarter_final.push(that.temp);
				that.temp = [];
			}
			// console.log(that.quarter_final);

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

// pushPlayer: function(playerId, cardsCount) {
// 		var player = new Player(playerId, cardsCount);
// 		player.game = this;
// 		this.board.players.push(player);
// 		this.board.playersToAdd = _.reject(this.board.playersToAdd, function(player){ return (player.playerId == playerId); });
//  } 

exports.Board = Board;
