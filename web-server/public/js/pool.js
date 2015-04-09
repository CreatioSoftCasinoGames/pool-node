angular.module('pool', []).controller('PoolController', ['$scope', '$http', '$window', function($scope, $http, $window) {

	$scope.clubData = [];

	$http.get('/clubs.json').
  success(function(data, status, headers, config) {
  	$scope.clubs = data;
  })

  $scope.joinClub = function(clubConfigId) {
		window.pomelo.request("connector.entryHandler.joinClub", {clubConfigId: clubConfigId}, function(data) {
      console.log(data);
      myPool.showPartial(".club");
    });
  };

  $scope.getClubConfigs = function() {
    window.pomelo.request("pool.poolHandler.getClubConfigs", {}, function(data) {
      console.log(data.club_configs)
      myPool.showPartial(".club_configs");
      $scope.$apply(function () {
        $scope.club_configs = data.club_configs;
      });
    });
  };

  $scope.getOnlinePlayers = function() {
    window.pomelo.request("pool.poolHandler.getOnlinePlayers", {gameType :"Tournament"}, function(data) {
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