var express = require('express');
var router = express.Router();

var utility = require("../models/utility")();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Express', gateHost: req.app.get('config').gateHost, gatePort: req.app.get('config').gatePort });
})

router.get('/clubs.json', function(req, res) {
	utility.getClubs(req.app, function(data) {
		res.json(data);	
	})
});

module.exports = router;
