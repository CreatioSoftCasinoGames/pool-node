module.exports = function(app) {
	return new EntryRemote(app);
};

var EntryRemote = function(app) {
	this.app = app;
	this.sessionService = app.get('sessionService');
};

EntryRemote.prototype = {

	sendMessageToUser: function(uid, msg, route, cb) {
		console.log('---------------')
		console.log(uid);
		console.log(msg)
		// console.log(this.sessionService.getByUid(uid)[0])
		var connector = this.app.components.__connector__;
		connector.send(null, route, msg, [this.sessionService.getByUid(uid)[0].id], {}, function(err) {
			cb(null)
	  });
	}
}