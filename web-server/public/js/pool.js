angular.module('pool', []).controller('PoolController', ['$scope', '$http', '$window', function($scope, $http, $window) {

	$scope.clubData = [];

	$http.get('/clubs.json').
  success(function(data, status, headers, config) {
  	$scope.clubs = data;
  })

  $scope.joinClub = function(clubId) {
		window.pomelo.request("connector.entryHandler.joinClub", {clubId: clubId, playerIp: "127.0.0.1"}, function(data) {
      console.log(data);
      myPool.showPartial(".club");
    });
  };

   $scope.sit = function() {
    window.pomelo.request("pool.poolHandler.sit", {}, function(data) {
      console.log(data)
    })
  };

  $scope.general = function() {
    pomelo.request("pool.poolHandler.general", {name: "Amrendra", rank: 10}, function(data) {
      console.log(data)
    });
  }

}])