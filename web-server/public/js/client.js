var Pool = function() {
	this.init();
}

Pool.prototype = {

	init: function() {
		this.bindNavLinkClick();
		this.bindLoginClick();
		this.signUp();
		this.getClubConfigs();
		this.guestLoginClick();
		this.pomelo = window.pomelo;
		this.host = $("body").data("gate-host");
		this.port = $("body").data("gate-port");
		this.user = null;

	},

	getClubConfigs: function() {
		var that = this;
		$(document).on("click", "#get-club_configs", function() {
			alert("neeraj ")
			that.showPartial(".club_configs");
		})
	},

	signUp: function() {
		var that = this;
		$("#sign-up-form").on("submit", function() {
			 pomelo.init({
		    host: that.host,
		    port: that.port,
		    log: true
		  }, function() {
				var formData = {}
				$.each($("#sign-up-form").serializeArray(), function(i, obj) {
					formData[obj.name] = obj.value;
				});
				pomelo.request("gate.gateHandler.signUp", {first_name: $("#first_name").val(), last_name: $("#last_name").val(), email: $("#email").val(), password: $("#password").val()}, function(data) {
					if(data.userCreated) {
						console.log('User created !');
					} else {
						console.log('User can\'t be created ! - ' + data.err);
					}
				});
			});
			return false;
		})
	},

	bindNavLinkClick: function() {
		var that = this;
		$(".nav-link").bind("click", function() {
			that.showPartial($(this).data("partial"))
			return false
		})
	},

	bindLoginClick: function() {
		var that = this;

		$("#sign-in-form").on("submit", function() {
		  pomelo.init({
		    host: that.host,
		    port: that.port,
		    log: true
		  }, function() {
		    pomelo.request("gate.gateHandler.getConnector", {email: $("#user_email").val(), password: $("#user_password").val()}, function(data) {
		      if(data.loginSuccess){
					pomelo.disconnect();
					that.user = data.user;
					that.connectPomelo(data.host, data.port);
			 	} else {
			 		console.log("Invalid username or password");
		      	}
		    });
		  });
			return false;
		})
	},

	guestLoginClick: function() {
		var that = this;
		$("#guest-sign-in-form").on("submit", function() {
		  pomelo.init({
		    host: that.host,
		    port: that.port,
		    log: true
		  }, function() {
		    pomelo.request("gate.gateHandler.getConnector", {is_guest: true, device_id: "amrendrapc0123456789"}, function(data) {
		      if(data.loginSuccess){
						pomelo.disconnect();
						that.user = data.user;
						that.connectPomelo(data.host, data.port);
				 	} else {
				 		console.log("Invalid username or password");
			    }
		    });
		  });
			return false;
		})
	},


	showPartial: function(partialClass) {
		$(".partial").addClass("hide");
		$(partialClass).removeClass("hide");
	},

	connectPomelo: function(host, port) {
		var that = this;
		pomelo.init({
	    host: host,
	    port: port,
	    log: true
	  }, function() {
  		pomelo.request("connector.entryHandler.enter", {login_token: that.user.login_token}, function(data) {
  			console.log(data)
	      if(data.requestPreferredTableConfig) {
	      	that.showPartial(".table_preferences");
	      } else {
	      	console.log("User is ready to enter");
	      }
	    });
	  });
	}

}

$(function() {	
	myPool = new Pool();
})