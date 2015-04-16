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
		that.players.push(player)
	},

	restartGame: function() {
		var that = this;
		var game = that.game;
		game.status = "IDLE";
		if(that.playersToAdd.length >= 2) {
			console.log("Game will start here !");
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
