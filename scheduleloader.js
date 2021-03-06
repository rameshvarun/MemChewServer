var moment = require('moment-timezone'); // Time handling
var _ = require("underscore");
var fs = require('fs');

global.OVERRIDE_DIR = __dirname + "/overrides";

if(!fs.existsSync("./overrides")) { fs.mkdirSync("overrides") };

global.DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
global.MEAL_NAMES = ["breakfast", "lunch", "dinner", "brunch"];

var generateSchedule = module.exports.generateSchedule = function() {
	var schedule = JSON.parse( fs.readFileSync("./schedulebase.json") );

	var now = moment().tz(TIME_ZONE);
	var week = now.startOf("week").format("MM-DD-YYYY");
	var overrideFile = OVERRIDE_DIR + "/" + week + ".js";

	var scope = {};
	scope.halls = schedule;
	_.each(schedule, function (hall) {
		scope[hall.id] = hall;
		_.each(DAY_NAMES, function(day, index) {
			scope[hall.id][day] = {};
			_.each(hall.schedule[index], function(meal) {
				scope[hall.id][day][meal.meal] = meal;
			});
		});
	});
	scope.close = function(item) { item.closed = true; }

	if(fs.existsSync(overrideFile)) {
		try {
			with(scope) eval(fs.readFileSync(overrideFile, "utf8"));
		}  catch(err) {
			fs.writeFile(overrideFile + ".error", err.name + ": " + err.message);
		}
	}

	return schedule;
}

var cached = null;
var cached_time = 0;
var RELOAD_TIME = 60000;

module.exports.getSchedule = function() {
	var time = new Date().getTime();
	if(!cached || time - cached_time > RELOAD_TIME) {
		cached = generateSchedule();
		console.log("Generating schedule...");
		cached_time = time;
	}
	return cached;
}
