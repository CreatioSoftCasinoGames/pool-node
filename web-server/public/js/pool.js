angular.module('pool', []).controller('PoolController', ['$scope', '$http', '$window', function($scope, $http, $window) {

	$scope.clubData = [];

	$http.get('/clubs.json').
  success(function(data, status, headers, config) {
  	$scope.clubs = data;
  })

  $scope.getClubs = function() {
    myPool.showPartial(".clubs");
  };

}])