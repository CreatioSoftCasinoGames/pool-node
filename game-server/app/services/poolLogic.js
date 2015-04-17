var _ = require('underscore');
var events = require('events');

var Board = function(clubId, redis) {
	this.clubId 		 	= clubId;
	this.redis 				= redis;
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
		this.quarter_final = [];
		this.semi_final = [];
		this.final_game = [];

		this.game = new Game(this);
	},

	addPlayer: function(playerId) {
		var that = this;
		var player = new Player(playerId, that.game);
		if(this.club_type == "OneToOne"){
		  that.players.push(player)
		  // console.log(player);
		}else{
			that.players.push(this.quarter_final)
			// console.log(this.quarter_final);
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
