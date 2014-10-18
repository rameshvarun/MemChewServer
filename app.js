var express = require('express'); // Web framework
var async = require('async'); // Control flow library
var moment = require('moment-timezone'); // Time handling
var schedule = require('./schedule.json') // Dining hall schedule
var uuid = require('node-uuid'); // Generate unique id's

var TIME_ZONE = "America/Los_Angeles" // Current Time Zone
var IMAGES_FOLDER = "public";

// Connect to redis database
var redis = require("redis").createClient();
redis.on("error", function (err) {
	console.log("Error connecting to Redis: " + err);
});
redis.on("connect", function () {
	console.log("Connected to Redis...");
});

var app = express();

app.get('/halls', function(req, res) {
	var now = moment().tz("America/Los_Angeles");
	var day = now.format("DD-MM-YYYY");
	async.map(schedule, function(hall, callback) {
		var data = {
			id : hall.id,
			name : hall.name,
			url : hall.url,
			open : false
		}

		var todays_schedule = hall.schedule[now.day()];
		for(var i = 0; i < todays_schedule.length; ++i) {
			var meal = todays_schedule[i];
			var start = moment.tz(day + " " + meal.start, "DD-MM-YYYY h:mma", TIME_ZONE);
			var end = moment.tz(day + " " + meal.end, "DD-MM-YYYY h:mma", TIME_ZONE);

			if(now.isAfter(start) && now.isBefore(end)) {
				data.open = true;
				data.closes = end.fromNow();
				data.meal = meal.meal;
				data.mealid = hall.id + ":" + day + ":" + meal.meal;

				// Query upvotes
				redis.scard(data.mealid + "_upvotes", function(err, size) {
					data.upvotes = size;
					callback(null, data);
				});
				
				break;
			}
		}
		if(data.open == false) callback(null, data);
	}, function(err, result) {
		res.json(result);
	});
});

app.get('/upvote', function(req, res){
	if(req.query.meal && req.query.user) {
		redis.sadd(req.query.meal + "_upvotes", req.query.user, function(err, added) {
			if(added) res.send('Upvoted');
			else res.send('Already Upvoted');
		});
	} else {
		res.send('Invalid Arguments');
	}
});

app.get('/comment', function(req, res){
	if(req.query.meal && req.query.user && req.query.comment) {
		redis.rpush(req.query.meal + "_comments", req.query.comment, function(err, length) {
			res.send('Comment added.');
		});
		// TODO: Count words through sorted set
	} else {
		res.send('Invalid Arguments');
	}
});

app.get('/comments', function(req, res){
	if(req.query.meal) {
		/*var comment = {
			id : 
		}*/
		redis.lrange(req.query.meal + "_comments", 0, -1, function(err, list) {
			res.json(list);
		});
	} else {
		res.send('Invalid Arguments');
	}
});

var server = app.listen(3000, function() {
	console.log("Listening on port %d...", server.address().port);
});