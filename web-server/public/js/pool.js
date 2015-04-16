angular.module('pool', []).controller('PoolController', ['$scope', '$http', '$window', function($scope, $http, $window) {

	$scope.clubData = [];

	$http.get('/clubs.json').
  success(function(data, status, headers, config) {
  	$scope.clubs = data;
  })

  $scope.joinClub = function(clubConfigId) {
		window.pomelo.request("connector.entryHandler.joinClub", {clubConfigId: clubConfigId, playerIp: "192.168.2.101"}, function(data) {
      myPool.showPartial(".club");
    });
  };

  $scope.getClubConfigs = function() {
    window.pomelo.request("pool.poolHandler.getClubConfigs", {club_type: "OneToOne"}, function(data) {
      myPool.showPartial(".club_configs");
      $scope.$apply(function () {
        $scope.club_configs = data.club_configs;
      });
    });
  };

  $scope.getOnlinePlayers = function() {
    window.pomelo.request("pool.poolHandler.getOnlinePlayers", {gameType: "OneToOne"}, function(data) {
      console.log(data)
    })
  };

   $scope.updateProfile = function() {
    window.pomelo.request("pool.poolHandler.updateProfile", {rank: 11 }, function(data) {
      console.log(data)
    })
  };

   $scope.sit = function() {
    window.pomelo.request("pool.poolHandler.sit", {}, function(data) {
      console.log(data)
    })
  };

  $scope.general = function() {
    // pomelo.request("pool.poolHandler.general", {name: "Amrendra", rank: 10}, function(data) {
    window.pomelo.request("connector.entryHandler.sendMessage", {name: "Amrendra", rank: 10}, function(data) {
      console.log(data)
    });
  };

   var listenCallbacks = function() {

    window.pomelo.on("generalProgress", function(data) {
      alert("amrendra");
      console.log(data)
    })
  }

}])