var express = require('express');
var router = express.Router();
var query = require('querystring');
var user = require("../models/user")();
var http = require('http');

/* GET users listing. */
router.post('/', function(req, res) {
  user.create(req.body, req.app, function(data) {
  	res.json(data);
  });
});

router.get('/sign_in', function(req, res) {
  res.render('users/sign_in', { title: "Sign In" });
});

router.get('/sign_up', function(req, res) {
  res.render('users/sign_up', { title: "Sign Up" });
});

module.exports = router;

