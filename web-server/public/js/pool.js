angular.module('pool', []).controller('PoolController', ['$scope', '$http', '$window', function($scope, $http, $window) {

	$scope.clubData = [];

	$http.get('/clubs.json').
  success(function(data, status, headers, config) {
  	$scope.clubs = data;
  })

  $scope.joinClub = function(clubConfigId) {
		window.pomelo.request("connector.entryHandler.joinClub", {clubConfigId: clubConfigId, playerIp: "192.168.2.101"}, function(data) {
      if(data.success) {
        myPool.showPartial(".club");
      } else {
        alert(data.message);
      }
      console.log(data);
    });
  };

  $scope.getClubConfigs = function() {
    window.pomelo.request("pool.poolHandler.getClubConfigs", {club_type: "OneToOne"}, function(data) {
      myPool.showPartial(".club_configs");
      $scope.$apply(function () {
        $scope.club_configs = data.club_configs;
      });
      console.log(data);
    });
  };

  $scope.getOnlinePlayers = function() {
    window.pomelo.request("pool.poolHandler.getOnlinePlayers", {gameType: "OneToOne"}, function(data) {
    console.log(data);
    })
  };

   $scope.updateProfile = function() {
    window.pomelo.request("pool.poolHandler.updateProfile", { device_avatar_id: 7 }, function(data) {
      console.log(data);
    });
  };

  $scope.chat = function() {
    window.pomelo.request("pool.poolHandler.chat", {message: "Hello! :) abc1234 "}, function(data) {
    console.log(data);  
    })
  };


  $scope.gameOver = function() {
    window.pomelo.request("pool.poolHandler.gameOver", {winnerId: 6750, stage: "quarterFinal"}, function(data) {
      console.log(data);  
    });
  };


  $scope.sit = function() {
    window.pomelo.request("pool.poolHandler.sit", {}, function(data) {
    console.log(data);
    })
  };

  $scope.standUp = function() {
    window.pomelo.request("connector.entryHandler.standUp", {}, function(data) {
      console.log(data)
      myPool.showPartial(".club_configs");
    })
  };

  $scope.getMessage = function() {
    window.pomelo.request("pool.poolHandler.getMessage", {messageId: 3}, function(data) {
      console.log(data)
    });
  };

  $scope.general = function() {
    window.pomelo.request("connector.entryHandler.sendMessage", {name: "neeraj", rank: 10}, function(data) {
      console.log(data);
    });
  };

  var listenCallbacks = function() {

    window.pomelo.on("generalProgress", function(data) {
      console.log(data);
    })

    window.pomelo.on("chatProgress", function(data) {
      console.log(data);
    })

    window.pomelo.on("friendAdded", function(data) {
      alert("New friend added - " + data.friendId)
    })

    window.pomelo.on("gameOver", function(data) {
      console.log(data);
    })

    window.pomelo.on("addPlayer", function(data) {
      console.log(data);
    });
  };

  listenCallbacks();

}])

