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

// This route is used to get a list of all of the dining halls. It returns if they are open,
// as well as the score
app.get('/halls', function(req, res) {
	// Get the current time in Pacific Standard
	var now = moment().tz("America/Los_Angeles");
	var day = now.format("DD-MM-YYYY");

	async.map(schedule, function(hall, callback) {
		// Shell of a data object, to be populated and sent back
		var data = {
			id : hall.id,
			name : hall.name,
			url : hall.url,
			open : false
		}

		var todays_schedule = hall.schedule[now.day()];
		for(var i = 0; i < todays_schedule.length; ++i) {
			var meal = todays_schedule[i];

			// Check if we are within the timeframe of this meal
			var start = moment.tz(day + " " + meal.start, "DD-MM-YYYY h:mma", TIME_ZONE);
			var end = moment.tz(day + " " + meal.end, "DD-MM-YYYY h:mma", TIME_ZONE);
			if(now.isAfter(start) && now.isBefore(end)) {
				data.open = true;
				data.closes = end.fromNow();
				data.meal = meal.meal;

				// Generate a meal id, which is a unique identifier for this meal, on this day, and this hall
				data.mealid = hall.id + ":" + day + ":" + meal.meal;

				async.parallel([
					// Count number of upvotes
					function(callback) {
						redis.get(data.mealid + "_upvotes", function(err, upvotes) {
							callback( null, upvotes ? parseInt(upvotes) : 0);
						});
					},
					// Count number of downvotes
					function(callback) {
						redis.get(data.mealid + "_downvotes", function(err, downvotes) {
							callback(null, downvotes ? parseInt(downvotes) : 0);
						});
					},
					// Determine if this user has already rated / what their rating was
					function(callback) {
						if(req.query.user) {
							redis.hget(data.mealid + "_voters", req.query.user, function(err, rating) {
								callback(null, rating ? rating : "none");
							});
						} else {
							callback(null, "none");
						}
					},
					// Count the number of comments on this hall
					function(callback) {
						redis.llen(data.mealid + "_comments", function(err, comments) {
							callback(null, comments ? parseInt(comments) : 0);
						});
					}
					], function(err, results) {
					// Return data result
					data.upvotes = results[0];
					data.downvotes = results[1];
					data.rating = results[2];
					data.comments = results[3];
					callback(null, data);
				});
				
				break;
			}
		}
		if(data.open == false) callback(null, data);
	}, function(err, result) {
		// Sort results first by if they are open, and then by their score
	    result.sort(function(a, b) {
			if(!a.open && !b.open) return 0;
			if(a.open && !b.open) return -1;
			if(b.open && !a.open) return 1;
			return (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes);
	    });
		res.json(result); // Send result back to client
	});
});

// This endpoint allows the user to upvote or downvote an object
// item should be a mealid or a commentid
app.get('/rate', function(req, res){
	// Ensure that all the arguments are provided
	if(req.query.item && req.query.user && req.query.action) {
		// Add user to set of users who have already voted on this item
		redis.hexists(req.query.item + "_voters", req.query.user, function(err, voted) {
			if(voted == 1) res.send({ error : "Already voted" }); // This user has already voted
			else {
				if(req.query.action == "upvote") { // Upvote action
					redis.multi().incr(req.query.item + "_upvotes")
					.hset(req.query.item + "_voters", req.query.user, "upvote")
					.exec(function(err, replies) {
						res.send({ result : "upvoted" });
					});
				} else if(req.query.action == "downvote") { // Downvote action
					redis.multi().incr(req.query.item + "_downvotes")
					.hset(req.query.item + "_voters", req.query.user, "downvote")
					.exec(function(err, replies) {
						res.send({ result : "downvoted" });
					});
				} else {
					res.send({ error : "Invalid action" }); // Unkown action
				}
			}
		});


	} else {
		res.send({ error : "Missing argument" });
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
