angular.module('pool', []).controller('PoolController', ['$scope', '$http', '$window', function($scope, $http, $window) {

	$scope.clubData = [];

	$http.get('/clubs.json').
  success(function(data, status, headers, config) {
  	$scope.clubs = data;
  })

  $scope.joinClub = function(clubConfigId) {
		window.pomelo.request("connector.entryHandler.joinClub", {clubConfigId: clubConfigId, playerIp: "192.168.2.101"}, function(data) {
      myPool.showPartial(".club");
      console.log(data);
    });
  };

  $scope.getClubConfigs = function() {
    window.pomelo.request("pool.poolHandler.getClubConfigs", {club_type: "Tournament"}, function(data) {
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
    // win_streak: 0, total_coins_won: 100, win_percentage: 60, won_count: 5, xp: 0, ball_potted: 10, strike_count: 70
    })
  };

  $scope.chat = function() {
    window.pomelo.request("pool.poolHandler.chat", {message: "Hello! :) abc1234 "}, function(data) {
    console.log(data);  
    })
  };


  $scope.gameOver = function() {

    window.pomelo.request("pool.poolHandler.gameOver", {winnerId: 55, stage: "quarterFinal"}, function(data) {
      console.log(data);  
    })

  };


  $scope.sit = function() {
    window.pomelo.request("pool.poolHandler.sit", {}, function(data) {
    console.log(data);
    })
  };

  $scope.standUp = function() {
    window.pomelo.request("pool.poolHandler.standUp", {}, function(data) {
      console.log(data)
    })
  };

  // $scope.sendPlayerDetails = function() {
  //   window.pomelo.request("pool.poolHandler.sendPlayerDetails", { 1 }, function(data) {
  //     console.log(data)
  //   })
  // };

  $scope.general = function() {
    // pomelo.request("pool.poolHandler.general", {name: "Amrendra", rank: 10}, function(data) {
    window.pomelo.request("connector.entryHandler.sendMessage", {name: "neeraj", rank: 10}, function(data) {
    console.log(data);
    });
  };

  var listenCallbacks = function() {

    window.pomelo.on("generalProgress", function(data) {
      alert("amrendra");
      console.log(data);
    })

    window.pomelo.on("chatProgress", function(data) {
      alert(data);
      console.log(data);
    })

    window.pomelo.on("gameOver", function(data) {
      alert("neeraj");
      console.log(data);
    })

    window.pomelo.on("addPlayer", function(data) {
      var length = data.quarterFinal.length;
      // alert(data);
      console.log(data);
    })

    // window.pomelo.on("tournamentWinner", function(data) {
    //   alert(data);
    //   console.log(data);
    // })


    // window.pomelo.on("sendPlayerDetails", function(data) {
    //   console.log(data);
    // })

  };

  listenCallbacks();

}])

