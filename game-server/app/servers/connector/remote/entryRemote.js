module.exports = function(app) {
	return new EntryRemote(app);
};

var EntryRemote = function(app) {
	this.app = app;
	this.sessionService = app.get('sessionService');
};

EntryRemote.prototype = {

	sendMessageToUser: function(uid, msg, route, cb) {
		var connector = this.app.components.__connector__;
		if(!!this.sessionService.getByUid(uid) && this.sessionService.getByUid(uid).length > 0) {
			connector.send(null, route, msg, [this.sessionService.getByUid(uid)[0].id], {}, function(err) {
				cb(null)
		  });
	  } else {
			console.error('Session not found for this player - ' + uid);
			cb(null)
		}
	}
}