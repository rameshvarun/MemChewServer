
global.TIME_ZONE = "America/Los_Angeles" // Current Time Zone
global.IMAGES_FOLDER = "public";

var express = require('express'); // Web framework
var async = require('async'); // Control flow library
var moment = require('moment-timezone'); // Time handling
var scheduleloader = require('./scheduleloader') // Dining hall schedule
var uuid = require('node-uuid'); // Generate unique id's
var bodyParser = require('body-parser'); // Parsing request bodies

// Connect to redis database
var redis = require("redis").createClient();
redis.on("error", function (err) {
	console.log("Error connecting to Redis: " + err);
});
redis.on("connect", function () {
	console.log("Connected to Redis...");
});

var app = express();
app.use(bodyParser.urlencoded({ extended: true })); // Parse request bodies

// Helper function that simply returns the score of an item
function score(item) { return item.upvotes - item.downvotes; }
function scoreOrder(a, b) { return score(b) - score(a); }

// This route is used to get a list of all of the dining halls. It returns if they are open,
// as well as the score
app.get('/halls', function(req, res) {
	// Get the current time in Pacific Standard
	var now = moment().tz(TIME_ZONE);
	var day = now.format("DD-MM-YYYY");

	async.map(scheduleloader.generateSchedule(), function(hall, callback) {
		// Shell of a data object, to be populated and sent back
		var data = {
			id : hall.id,
			name : hall.name,
			url : hall.url,
			open : false,
			latitude : hall.latitude,
			longitude : hall.longitude
		}

		var todays_schedule = hall.schedule[now.day()];
		for(var i = 0; i < todays_schedule.length; ++i) {
			var meal = todays_schedule[i];
			if(meal.closed || hall.closed) continue;

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
			return scoreOrder(a, b);
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

var MAX_COMMENT_LENGTH = 250;
var MAX_IMAGE_SIZE = 1000000;

// Use this route to post a new comment
app.post('/comment', function(req, res){
	if( req.param('meal') && req.param('user') && (req.param('comment') || req.param('image')) ) {
		var is_image = req.param('image') != null;
		var size_valid = is_image ? req.param('image').length < MAX_IMAGE_SIZE : req.param('comment').length < MAX_COMMENT_LENGTH;

		// Ensure that comments are under 500 characters	
		if(size_valid) {
			var comment = {
				user : req.param('user'),
				id : uuid.v4(),
				moment : moment().tz("America/Los_Angeles").format()
			};

			if(is_image) comment.image = req.param('image');
			else comment.text = req.param('comment');

			redis.rpush(req.param('meal') + "_comments", JSON.stringify(comment), function(err, length) {
				res.send({ result : "Added comment", comment : comment });
			});
			// TODO: Count words through sorted set
		} else {
			res.send({ error : "Text or image is too long." });
		}
	} else {
		res.send({ error : "Missing argument" });
	}
});

// Use this route to list all of the comments on a given meal
app.get('/comments', function(req, res){
	if(req.query.meal) {
		redis.lrange(req.query.meal + "_comments", 0, -1, function(err, comments) {
			async.map(comments,
			function(comment, callback) {
				comment = JSON.parse(comment);
				comment.moment = moment.tz(comment.moment, TIME_ZONE);
				comment.time = comment.moment.fromNow();

				async.parallel([
					// Count number of upvotes
					function(callback) {
						redis.get(comment.id + "_upvotes", function(err, upvotes) {
							callback( null, upvotes ? parseInt(upvotes) : 0);
						});
					},
					// Count number of downvotes
					function(callback) {
						redis.get(comment.id + "_downvotes", function(err, downvotes) {
							callback(null, downvotes ? parseInt(downvotes) : 0);
						});
					},
					// Determine if this user has already rated / what their rating was
					function(callback) {
						if(req.query.user) {
							redis.hget(comment.id + "_voters", req.query.user, function(err, rating) {
								callback(null, rating ? rating : "none");
							});
						} else {
							callback(null, "none");
						}
					}], function(err, results) {
					// Return comment result
					comment.upvotes = results[0];
					comment.downvotes = results[1];
					comment.rating = results[2];
					callback(null, comment);
				});
			},
			function(err, results) {
				results.sort(scoreOrder);
				res.json(results);
			});
		});
	} else {
		res.send({ error : "Missing argument" });
	}
});

// Register admin routes
require("./admin")(app)

var server = app.listen(3000, function() {
	console.log("Listening on port %d...", server.address().port);
});
