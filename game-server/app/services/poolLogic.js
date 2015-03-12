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
		this.game = new Game(this);
	},

	addPlayer: function(playerId) {
		var that = this;
		var player = new Player(playerId, that.game);
		var game = that.game;
		that.playersToAdd.push(player);
		that.restartGame();
	},

	restartGame: function() {
		var that = this;
		var game = that.game;
		game.status = "IDLE";
		console.log(that.playersToAdd.length);
		if(that.playersToAdd.length >= 2) {
			console.log("Game will start here !");
		}
	}
};

var Game = function(board) {
	this.board = board;
};

var Player = function(playerId, game) {
	this.playerId = playerId;
	this.game = game;
};

exports.Board = Board;